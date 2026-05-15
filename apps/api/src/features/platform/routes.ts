import { Router } from "express";
import { prisma } from "../../db";
import { ApiError } from "../../middleware/requestContext";

const db = prisma as any;
export const platformRouter = Router();

const take = (value: unknown, fallback = 50) => Math.min(Number(value ?? fallback) || fallback, 200);
const firstOrg = async () => db.organization.findFirst({ orderBy: { createdAt: "asc" } });
const firstCompany = async () => db.company.findFirst({ orderBy: { name: "asc" } });

async function organizationId() {
  const organization = await firstOrg();
  if (!organization) throw new ApiError(404, "NOT_FOUND", "Aucune organisation disponible.", { action: "Executer le seed ou creer une organisation." });
  return organization.id;
}

platformRouter.get("/ready", async (_req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, checks: { api: "up", database: "up", workers: "inline" }, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

platformRouter.get("/system/status", async (_req, res, next) => {
  try {
    const [connectors, failedJobs, recentErrors, lastBackup] = await Promise.all([
      db.connector.groupBy({ by: ["status"], _count: true }).catch(() => []),
      db.jobRun.count({ where: { status: { in: ["failed", "retrying"] } } }),
      db.errorReport.count({ where: { status: "open" } }),
      db.backupRun.findFirst({ orderBy: { createdAt: "desc" } })
    ]);
    res.json({
      status: failedJobs || recentErrors ? "degraded" : "opérational",
      api: "opérational",
      database: "opérational",
      workers: "inline",
      connectors,
      failedJobs,
      recentErrors,
      lastBackup,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

platformRouter.get("/observability/summary", async (_req, res, next) => {
  try {
    const [logs, errors, jobs, slowRequests, connectorErrors] = await Promise.all([
      db.applicationLog.count(),
      db.errorReport.count({ where: { status: "open" } }),
      db.jobRun.groupBy({ by: ["status"], _count: true }),
      db.performanceSnapshot.findMany({ where: { metric: "api_latency_ms" }, orderBy: { capturedAt: "desc" }, take: 5 }),
      db.providerError.count({ where: { resolvedAt: null } }).catch(() => 0)
    ]);
    res.json({ logs, openErrors: errors, jobs, slowRequests, connectorErrors });
  } catch (error) {
    next(error);
  }
});

platformRouter.get("/observability/logs", async (req, res, next) => {
  try {
    res.json(await db.applicationLog.findMany({ orderBy: { timestamp: "desc" }, take: take(req.query.take) }));
  } catch (error) {
    next(error);
  }
});

platformRouter.get("/observability/errors", async (req, res, next) => {
  try {
    res.json(await db.errorReport.findMany({ orderBy: { createdAt: "desc" }, take: take(req.query.take) }));
  } catch (error) {
    next(error);
  }
});

platformRouter.get("/observability/slow-requests", async (req, res, next) => {
  try {
    res.json(await db.performanceSnapshot.findMany({ where: { metric: "api_latency_ms" }, orderBy: { value: "desc" }, take: take(req.query.take) }));
  } catch (error) {
    next(error);
  }
});

platformRouter.get("/jobs", async (req, res, next) => {
  try {
    const where: Record<string, string> = {};
    if (typeof req.query.status === "string") where.status = req.query.status;
    if (typeof req.query.type === "string") where.type = req.query.type;
    res.json(await db.jobRun.findMany({ where, orderBy: { createdAt: "desc" }, take: take(req.query.take, 100) }));
  } catch (error) {
    next(error);
  }
});

platformRouter.get("/jobs/:id", async (req, res, next) => {
  try {
    const job = await db.jobRun.findUnique({ where: { id: req.params.id } });
    if (!job) throw new ApiError(404, "NOT_FOUND", "Job introuvable.");
    res.json(job);
  } catch (error) {
    next(error);
  }
});

platformRouter.post("/jobs/:id/retry", async (req, res, next) => {
  try {
    res.json(await db.jobRun.update({ where: { id: req.params.id }, data: { status: "retrying", progressPercent: 0, errorMessage: null, correlationId: req.correlationId } }));
  } catch (error) {
    next(error);
  }
});

platformRouter.post("/jobs/:id/cancel", async (req, res, next) => {
  try {
    res.json(await db.jobRun.update({ where: { id: req.params.id }, data: { status: "cancelled", finishedAt: new Date(), correlationId: req.correlationId } }));
  } catch (error) {
    next(error);
  }
});

platformRouter.get("/backoffice/organizations", async (_req, res, next) => {
  try {
    res.json(await db.organization.findMany({ orderBy: { createdAt: "asc" } }));
  } catch (error) {
    next(error);
  }
});

platformRouter.get("/backoffice/organizations/:id", async (req, res, next) => {
  try {
    const [organization, users, companies, connectors, jobs, errors] = await Promise.all([
      db.organization.findUnique({ where: { id: req.params.id } }),
      db.user.count({ where: { organizationId: req.params.id } }),
      db.company.count({ where: { organizationId: req.params.id } }),
      db.connector.findMany({ where: { organizationId: req.params.id }, take: 10 }),
      db.jobRun.findMany({ where: { organizationId: req.params.id }, orderBy: { createdAt: "desc" }, take: 10 }),
      db.errorReport.findMany({ where: { organizationId: req.params.id }, orderBy: { createdAt: "desc" }, take: 10 })
    ]);
    if (!organization) throw new ApiError(404, "NOT_FOUND", "Organisation introuvable.");
    res.json({ organization, users, companies, connectors, jobs, errors });
  } catch (error) {
    next(error);
  }
});

platformRouter.get("/backoffice/organizations/:id/diagnostics", async (req, res, next) => {
  try {
    const [jobs, errors, securityEvents, qualityScores] = await Promise.all([
      db.jobRun.count({ where: { organizationId: req.params.id, status: { in: ["failed", "retrying"] } } }),
      db.errorReport.count({ where: { organizationId: req.params.id, status: "open" } }),
      db.securityEvent.count({ where: { organizationId: req.params.id } }),
      db.dataQualityScore.findMany({ where: { organizationId: req.params.id }, orderBy: { domain: "asc" } })
    ]);
    res.json({ organizationId: req.params.id, failedOrRetryingJobs: jobs, openErrors: errors, securityEvents, qualityScores });
  } catch (error) {
    next(error);
  }
});

async function createSupportAction(req: any, action: string) {
  return db.supportAction.create({
    data: { organizationId: req.params.id, action, status: "success", requestedBy: "admin", correlationId: req.correlationId, result: { queuedAt: new Date().toISOString() }, complètedAt: new Date() }
  });
}

platformRouter.post("/backoffice/organizations/:id/recalculate", async (req, res, next) => {
  try {
    await db.jobRun.create({ data: { organizationId: req.params.id, type: "projection", status: "queued", triggeredBy: "user", correlationId: req.correlationId, inputSummary: { source: "backoffice" } } });
    res.json(await createSupportAction(req, "recalculate_projections"));
  } catch (error) {
    next(error);
  }
});

platformRouter.post("/backoffice/organizations/:id/resync", async (req, res, next) => {
  try {
    await db.jobRun.create({ data: { organizationId: req.params.id, type: "connector_sync", status: "queued", triggeredBy: "user", correlationId: req.correlationId, inputSummary: { source: "backoffice" } } });
    res.json(await createSupportAction(req, "resync_connectors"));
  } catch (error) {
    next(error);
  }
});

platformRouter.post("/backups", async (req, res, next) => {
  try {
    const orgId = req.body?.organizationId ?? await organizationId();
    const company = await firstCompany();
    res.status(201).json(await db.backupRun.create({ data: { organizationId: orgId, companyId: company?.id, type: req.body?.type ?? "full_organization", status: "success", filePath: `backups/${orgId}-${Date.now()}.json`, sizeBytes: 42800, createdBy: "admin", complètedAt: new Date() } }));
  } catch (error) {
    next(error);
  }
});

platformRouter.get("/backups", async (req, res, next) => {
  try {
    res.json(await db.backupRun.findMany({ orderBy: { createdAt: "desc" }, take: take(req.query.take, 50) }));
  } catch (error) {
    next(error);
  }
});

platformRouter.get("/backups/:id/download", async (req, res, next) => {
  try {
    const backup = await db.backupRun.findUnique({ where: { id: req.params.id } });
    if (!backup) throw new ApiError(404, "NOT_FOUND", "Sauvegarde introuvable.");
    res.json({ metadata: backup, data: { note: "Export démo V5 sans secrets provider.", generatedAt: new Date().toISOString() } });
  } catch (error) {
    next(error);
  }
});

platformRouter.post("/restores/dry-run", async (req, res, next) => {
  try {
    const orgId = req.body?.organizationId ?? await organizationId();
    res.status(201).json(await db.restoreRun.create({ data: { organizationId: orgId, sourceBackupId: req.body?.sourceBackupId, mode: "dry_run", status: "success", resultSummary: { valid: true, warnings: ["Les tokens provider sont exclus de la restauration par defaut."] }, createdBy: "admin", complètedAt: new Date() } }));
  } catch (error) {
    next(error);
  }
});

platformRouter.post("/restores", async (req, res, next) => {
  try {
    const orgId = req.body?.organizationId ?? await organizationId();
    res.status(201).json(await db.restoreRun.create({ data: { organizationId: orgId, sourceBackupId: req.body?.sourceBackupId, mode: "restore", status: "queued", resultSummary: { accepted: true }, createdBy: "admin" } }));
  } catch (error) {
    next(error);
  }
});

platformRouter.post("/exports/full", async (req, res, next) => {
  try {
    const orgId = req.body?.organizationId ?? await organizationId();
    const company = await firstCompany();
    res.status(201).json(await db.exportRun.create({ data: { organizationId: orgId, companyId: company?.id, type: "full", format: req.body?.format ?? "json", status: "success", filePath: `exports/${orgId}-${Date.now()}.zip`, sizeBytes: 64000, createdBy: "admin", complètedAt: new Date() } }));
  } catch (error) {
    next(error);
  }
});

platformRouter.get("/exports/:id/download", async (req, res, next) => {
  try {
    const exportRun = await db.exportRun.findUnique({ where: { id: req.params.id } });
    if (!exportRun) throw new ApiError(404, "NOT_FOUND", "Export introuvable.");
    res.json({ metadata: exportRun, domains: ["missions", "resources", "clients", "invoices", "payments", "transactions", "projections", "audit"] });
  } catch (error) {
    next(error);
  }
});

platformRouter.get("/retention-policies", async (_req, res, next) => {
  try {
    res.json(await db.retentionPolicy.findMany({ orderBy: { domain: "asc" } }));
  } catch (error) {
    next(error);
  }
});

platformRouter.put("/retention-policies/:id", async (req, res, next) => {
  try {
    res.json(await db.retentionPolicy.update({ where: { id: req.params.id }, data: req.body }));
  } catch (error) {
    next(error);
  }
});

platformRouter.post("/purge-runs", async (req, res, next) => {
  try {
    const orgId = req.body?.organizationId ?? await organizationId();
    res.status(201).json(await db.purgeRun.create({ data: { organizationId: orgId, domain: req.body?.domain ?? "logs", status: "queued" } }));
  } catch (error) {
    next(error);
  }
});

platformRouter.get("/security/events", async (req, res, next) => {
  try {
    res.json(await db.securityEvent.findMany({ orderBy: { createdAt: "desc" }, take: take(req.query.take) }));
  } catch (error) {
    next(error);
  }
});

platformRouter.get("/security/login-attempts", async (req, res, next) => {
  try {
    res.json(await db.loginAttempt.findMany({ orderBy: { createdAt: "desc" }, take: take(req.query.take) }));
  } catch (error) {
    next(error);
  }
});

platformRouter.get("/security/sensitive-access", async (req, res, next) => {
  try {
    res.json(await db.sensitiveDataAccessLog.findMany({ orderBy: { createdAt: "desc" }, take: take(req.query.take) }));
  } catch (error) {
    next(error);
  }
});

platformRouter.get("/security/sessions", (_req, res) => res.json([{ id: "démo-session", user: "admin@esnforecast.local", status: "active", lastSeenAt: new Date().toISOString() }]));
platformRouter.post("/security/sessions/:id/revoke", (req, res) => res.json({ id: req.params.id, status: "revoked", correlationId: req.correlationId }));

platformRouter.get("/feature-flags", async (_req, res, next) => {
  try {
    res.json(await db.featureFlag.findMany({ orderBy: { key: "asc" } }));
  } catch (error) {
    next(error);
  }
});

platformRouter.post("/feature-flags", async (req, res, next) => {
  try {
    const { id, createdAt, updatedAt, ...data } = req.body;
    res.status(201).json(await db.featureFlag.create({ data }));
  } catch (error) {
    next(error);
  }
});

platformRouter.put("/feature-flags/:id", async (req, res, next) => {
  try {
    const { id, createdAt, updatedAt, ...data } = req.body;
    res.json(await db.featureFlag.update({ where: { id: req.params.id }, data }));
  } catch (error) {
    next(error);
  }
});

platformRouter.delete("/feature-flags/:id", async (req, res, next) => {
  try {
    await db.featureFlag.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

platformRouter.get("/onboarding", async (req, res, next) => {
  try {
    const orgId = (typeof req.query.organizationId === "string" && req.query.organizationId) || await organizationId();
    const state = await db.onboardingState.findFirst({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" } });
    res.json(state ?? { organizationId: orgId, steps: {}, complètedAt: null });
  } catch (error) {
    next(error);
  }
});

platformRouter.put("/onboarding/steps/:stepKey", async (req, res, next) => {
  try {
    const orgId = req.body?.organizationId ?? await organizationId();
    const current = await db.onboardingState.findFirst({ where: { organizationId: orgId } });
    const steps = { ...(current?.steps ?? {}), [req.params.stepKey]: Boolean(req.body?.complèted ?? true) };
    res.json(current
      ? await db.onboardingState.update({ where: { id: current.id }, data: { steps } })
      : await db.onboardingState.create({ data: { organizationId: orgId, steps } }));
  } catch (error) {
    next(error);
  }
});

platformRouter.post("/onboarding/reset", async (req, res, next) => {
  try {
    const orgId = req.body?.organizationId ?? await organizationId();
    await db.onboardingState.deleteMany({ where: { organizationId: orgId } });
    res.json(await db.onboardingState.create({ data: { organizationId: orgId, steps: {} } }));
  } catch (error) {
    next(error);
  }
});

platformRouter.get("/help/contextual", async (req, res, next) => {
  try {
    const pageKey = typeof req.query.page === "string" ? req.query.page : "dashboard";
    res.json(await db.helpArticle.findMany({ where: { pageKey, isActive: true }, orderBy: { title: "asc" } }));
  } catch (error) {
    next(error);
  }
});
