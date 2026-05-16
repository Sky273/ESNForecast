import { Router } from "express";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { prisma } from "../../db";
import { consumeActivationToken, sendAccountActivationEmail } from "../auth/accountInvitationService";
import { buildExecutivePdf } from "../reports/executivePdfReport";
import { buildScenarioProjection } from "./projectionService";
import { coerceDates, serializeDates } from "../../utils/serialize";

export const forecastingRouter = Router();
const dateFields = ["invoiceDate", "dueDate", "expectedPaymentDate", "expectedDate", "startDate", "endDate"];

const crud = (modelName: keyof typeof prisma) => {
  const router = Router();
  const model = (prisma as any)[modelName];
  router.get("/", async (req, res, next) => {
    try {
      const where = req.query.scenarioId ? { scenarioId: String(req.query.scenarioId) } : undefined;
      res.json(serializeDates(await model.findMany({ where, orderBy: { createdAt: "desc" } })));
    } catch (error) {
      next(error);
    }
  });
  router.post("/", async (req, res, next) => {
    try {
      res.status(201).json(serializeDates(await model.create({ data: coerceDates(req.body, dateFields) })));
    } catch (error) {
      next(error);
    }
  });
  router.put("/:id", async (req, res, next) => {
    try {
      const data = coerceDates(req.body, dateFields);
      delete data.id;
      delete data.createdAt;
      delete data.updatedAt;
      res.json(serializeDates(await model.update({ where: { id: req.params.id }, data })));
    } catch (error) {
      next(error);
    }
  });
  router.delete("/:id", async (req, res, next) => {
    try {
      await model.delete({ where: { id: req.params.id } });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });
  return router;
};

forecastingRouter.use("/invoice-forecasts", crud("invoiceForecast" as any));
forecastingRouter.use("/cash-in-forecasts", crud("cashInForecast" as any));
forecastingRouter.use("/cash-out-forecasts", crud("cashOutForecast" as any));
forecastingRouter.use("/simulation-events", crud("simulationEvent" as any));
forecastingRouter.use("/users", usersRouter());

forecastingRouter.get("/scenarios", async (_req, res, next) => {
  try {
    const rows = await prisma.scenario.findMany({ orderBy: [{ isActive: "desc" }, { createdAt: "desc" }] });
    const enriched = await Promise.all(rows.map(async (scenario) => {
      const projection = await buildScenarioProjection(scenario.id);
      return {
        ...serializeDates(scenario),
        totalRevenue: projection.summary.totalRevenueGenerated,
        totalCosts: projection.summary.totalCostsAccrued,
        grossMargin: projection.summary.totalGrossMargin,
        finalBalance: projection.summary.finalClosingCash,
        riskMonths: projection.summary.riskMonths.length
      };
    }));
    res.json(enriched);
  } catch (error) {
    next(error);
  }
});

forecastingRouter.post("/scenarios", async (req, res, next) => {
  try {
    const row = await prisma.scenario.create({ data: req.body });
    await audit("scenario", row.id, "create", null, row);
    res.status(201).json(serializeDates(row));
  } catch (error) {
    next(error);
  }
});

forecastingRouter.get("/scenarios/:id", async (req, res, next) => {
  try {
    if (req.params.id === "compare") {
      const scenarioA = String(req.query.scenarioA);
      const scenarioB = String(req.query.scenarioB);
      const [a, b] = await Promise.all([buildScenarioProjection(scenarioA, Number(req.query.horizon) || undefined), buildScenarioProjection(scenarioB, Number(req.query.horizon) || undefined)]);
      return res.json({
        scenarioA: a,
        scenarioB: b,
        deltas: a.months.map((month: any, index: number) => ({
          month: month.month,
          revenueDelta: month.revenueGenerated - (b.months[index]?.revenueGenerated ?? 0),
          costDelta: month.costsAccrued - (b.months[index]?.costsAccrued ?? 0),
          cashDelta: month.closingCash - (b.months[index]?.closingCash ?? 0)
        }))
      });
    }
    const row = await prisma.scenario.findUnique({ where: { id: req.params.id } });
    if (!row) return res.status(404).json({ error: "Scenario not found" });
    res.json(serializeDates(row));
  } catch (error) {
    next(error);
  }
});

forecastingRouter.put("/scenarios/:id", async (req, res, next) => {
  try {
    const before = await prisma.scenario.findUnique({ where: { id: req.params.id } });
    const row = await prisma.scenario.update({ where: { id: req.params.id }, data: req.body });
    await audit("scenario", row.id, "update", before, row);
    res.json(serializeDates(row));
  } catch (error) {
    next(error);
  }
});

forecastingRouter.delete("/scenarios/:id", async (req, res, next) => {
  try {
    await prisma.scenario.update({ where: { id: req.params.id }, data: { archivedAt: new Date(), isActive: false } });
    await audit("scenario", req.params.id, "archive", null, { archivedAt: new Date() });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

forecastingRouter.post("/scenarios/:id/duplicate", async (req, res, next) => {
  try {
    const source = await prisma.scenario.findUnique({ where: { id: req.params.id } });
    if (!source) return res.status(404).json({ error: "Scenario not found" });
    const copy = await prisma.scenario.create({
      data: {
        name: req.body.name ?? `${source.name} copie`,
        type: req.body.type ?? "custom",
        riskLevel: source.riskLevel,
        notes: source.notes,
        author: source.author
      }
    });
    await audit("scenario", copy.id, "duplicate", source, copy);
    res.status(201).json(serializeDates(copy));
  } catch (error) {
    next(error);
  }
});

forecastingRouter.post("/scenarios/:id/set-active", async (req, res, next) => {
  try {
    await prisma.scenario.updateMany({ data: { isActive: false } });
    const row = await prisma.scenario.update({ where: { id: req.params.id }, data: { isActive: true } });
    res.json(serializeDates(row));
  } catch (error) {
    next(error);
  }
});

forecastingRouter.get("/scenarios/compare/pairs", async (req, res, next) => {
  try {
    const scenarioA = String(req.query.scenarioA);
    const scenarioB = String(req.query.scenarioB);
    const [a, b] = await Promise.all([buildScenarioProjection(scenarioA, Number(req.query.horizon) || undefined), buildScenarioProjection(scenarioB, Number(req.query.horizon) || undefined)]);
    res.json({
      scenarioA: a,
      scenarioB: b,
      deltas: a.months.map((month: any, index: number) => ({
        month: month.month,
        revenueDelta: month.revenueGenerated - (b.months[index]?.revenueGenerated ?? 0),
        costDelta: month.costsAccrued - (b.months[index]?.costsAccrued ?? 0),
        cashDelta: month.closingCash - (b.months[index]?.closingCash ?? 0)
      }))
    });
  } catch (error) {
    next(error);
  }
});

forecastingRouter.get("/projections/scenario/:scenarioId", async (req, res, next) => {
  try {
    res.json(await buildScenarioProjection(req.params.scenarioId, Number(req.query.horizon) || undefined));
  } catch (error) {
    next(error);
  }
});

forecastingRouter.get("/projections/scenario/:scenarioId/month/:month", async (req, res, next) => {
  try {
    const projection = await buildScenarioProjection(req.params.scenarioId, 24);
    const month = projection.months.find((item: any) => item.month === req.params.month);
    if (!month) return res.status(404).json({ error: "Month not found" });
    res.json(month);
  } catch (error) {
    next(error);
  }
});

forecastingRouter.post("/projections/scenario/:scenarioId/recalculate", async (req, res, next) => {
  try {
    res.json(await buildScenarioProjection(req.params.scenarioId, Number(req.query.horizon) || undefined));
  } catch (error) {
    next(error);
  }
});

forecastingRouter.get("/profitability/missions", async (req, res, next) => {
  try {
    res.json((await buildScenarioProjection(String(req.query.scenarioId || ""), Number(req.query.horizon) || undefined)).missionProfitability);
  } catch (error) {
    next(error);
  }
});

forecastingRouter.get("/profitability/resources", async (req, res, next) => {
  try {
    res.json((await buildScenarioProjection(String(req.query.scenarioId || ""), Number(req.query.horizon) || undefined)).resourceProfitability);
  } catch (error) {
    next(error);
  }
});

forecastingRouter.get("/bench", async (req, res, next) => {
  try {
    const projection = await buildScenarioProjection(String(req.query.scenarioId || ""), Number(req.query.horizon) || undefined);
    res.json({
      totalBenchCost: projection.summary.totalBenchCost,
      months: projection.months.map((month: any) => ({ month: month.month, benchCost: month.benchCost, utilizationRate: month.internalUtilizationRate }))
    });
  } catch (error) {
    next(error);
  }
});

forecastingRouter.get("/alerts", async (req, res, next) => {
  try {
    const projection = await buildScenarioProjection(String(req.query.scenarioId || ""), Number(req.query.horizon) || undefined);
    const persisted = await prisma.alert.findMany({ where: req.query.scenarioId ? { scenarioId: String(req.query.scenarioId) } : undefined, orderBy: { createdAt: "desc" } });
    res.json([...projection.alerts, ...serializeDates(persisted) as any[]]);
  } catch (error) {
    next(error);
  }
});

forecastingRouter.put("/alerts/:id/status", async (req, res, next) => {
  try {
    res.json(await prisma.alert.update({ where: { id: req.params.id }, data: { status: req.body.status } }));
  } catch (error) {
    next(error);
  }
});

forecastingRouter.get("/reports/executive.json", async (req, res, next) => {
  try {
    const projection = await buildScenarioProjection(String(req.query.scenarioId || ""), Number(req.query.horizon) || 12);
    res.json({
      generatedAt: new Date().toISOString(),
      summary: projection.summary,
      alerts: projection.alerts.slice(0, 10),
      topMissions: projection.missionProfitability.slice().sort((a: any, b: any) => b.grossMargin - a.grossMargin).slice(0, 5),
      monthly: projection.months
    });
  } catch (error) {
    next(error);
  }
});

forecastingRouter.get("/reports/executive.pdf", async (req, res, next) => {
  try {
    const horizon = Number(req.query.horizon) || 12;
    const projection = await buildScenarioProjection(String(req.query.scenarioId || ""), horizon);
    const pdf = buildExecutivePdf(projection as any, { horizon });
    res
      .type("application/pdf")
      .setHeader("Content-Disposition", "inline; filename=\"executive-report.pdf\"")
      .setHeader("Cache-Control", "no-store")
      .send(pdf);
  } catch (error) {
    next(error);
  }
});

forecastingRouter.get("/audit-logs", async (_req, res, next) => {
  try {
    res.json(serializeDates(await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { user: true } })));
  } catch (error) {
    next(error);
  }
});

forecastingRouter.post("/auth/login", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { email: String(req.body.email ?? "").trim() } });
    if (!user || !user.passwordHash || !verifyPassword(String(req.body.password ?? ""), user.passwordHash)) return res.status(401).json({ error: "Invalid credentials" });
    res.json({ token: createAuthToken(user), user: maskUser(user) });
  } catch (error) {
    next(error);
  }
});

forecastingRouter.post("/auth/logout", (_req, res) => res.status(204).send());
forecastingRouter.get("/auth/me", async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: "Session expired" });
    res.json(maskUser(user));
  } catch (error) {
    next(error);
  }
});

forecastingRouter.post("/auth/refresh", async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: "Session expired" });
    res.json({ token: createAuthToken(user), user: maskUser(user) });
  } catch (error) {
    next(error);
  }
});

forecastingRouter.post("/auth/forgot-password", async (_req, res) => {
  // TODO backend production: generate ? single-use reset token, store its hash with expiry, and send it by email.
  res.json({ ok: true, message: "If an account exists, ? reset email has been sent." });
});

forecastingRouter.post("/auth/reset-password", async (req, res) => {
  // TODO backend production: validate reset token hash, expiry and single-use status before updating the user password.
  if (!req.body?.token || !req.body?.newPassword) return res.status(400).json({ error: "Invalid or expired reset token" });
  res.json({ ok: true, message: "Password reset accepted." });
});

forecastingRouter.post("/auth/activate", async (req, res) => {
  const token = String(req.body?.token ?? "");
  const newPassword = String(req.body?.newPassword ?? "");
  if (!token || !isStrongPassword(newPassword)) return res.status(400).json({ error: "Invalid or expired invitation" });
  const user = await consumeActivationToken(token);
  if (!user) return res.status(400).json({ error: "Invalid or expired invitation" });
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(newPassword) } });
  await audit("user", user.id, "activate_account", null, { userId: user.id });
  res.json({ ok: true, message: "Account activation accepted." });
});

forecastingRouter.post("/auth/change-password", async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: "Session expired" });
    const newPassword = String(req.body.newPassword ?? "");
    if (!verifyPassword(String(req.body.currentPassword ?? ""), user.passwordHash)) return res.status(400).json({ error: "Password change failed" });
    if (!isStrongPassword(newPassword)) return res.status(400).json({ error: "Password policy not met" });
    const updated = await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(newPassword) } });
    await audit("user", user.id, "change_password", null, { userId: user.id });
    res.json({ ok: true, user: maskUser(updated) });
  } catch (error) {
    next(error);
  }
});

async function audit(entityType: string, entityId: string, action: string, before: unknown, after: unknown) {
  await prisma.auditLog.create({ data: { entityType, entityId, action, before: before as any, after: after as any } });
}

function usersRouter() {
  const router = Router();

  router.get("/", async (_req, res, next) => {
    try {
      const rows = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
      res.json(serializeDates(rows.map(maskUser)));
    } catch (error) {
      next(error);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      const email = String(req.body.email ?? "").trim();
      const name = String(req.body.name ?? "").trim();
      if (!email || !name) return res.status(400).json({ error: "Email and name are required" });
      const organizationId = req.body.organizationId ? String(req.body.organizationId) : undefined;
      const role = req.body.role ?? "readonly";
      const user = await prisma.user.create({ data: { organizationId, email, name, role, passwordHash: null } });
      const invitation = await sendAccountActivationEmail(user);
      await audit("user", user.id, "create_invited_user", null, { userId: user.id, email: user.email, mailSent: invitation.sent });
      res.status(201).json({
        ...serializeDates(maskUser(user)),
        invitationEmailSent: invitation.sent,
        activationEmailStatus: invitation.sent ? "sent" : "smtp_not_configuréd",
        activationPreviewUrl: !invitation.sent && process.env.NODE_ENV !== "production" ? invitation.activationUrl : undefined,
        activationExpiresAt: invitation.expiresAt.toISOString()
      });
    } catch (error) {
      next(error);
    }
  });

  router.put("/:id", async (req, res, next) => {
    try {
      const data = { ...req.body };
      delete data.id;
      delete data.createdAt;
      delete data.updatedAt;
      delete data.passwordHash;
      const row = await prisma.user.update({ where: { id: req.params.id }, data });
      res.json(serializeDates(maskUser(row)));
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:id", async (req, res, next) => {
    try {
      await prisma.user.delete({ where: { id: req.params.id } });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function maskUser(user: any) {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}

function createAuthToken(user: any) {
  return Buffer.from(JSON.stringify({ userId: user.id, role: user.role })).toString("base64url");
}

async function getAuthenticatedUser(req: any) {
  const header = String(req.headers.authorization ?? "");
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (!token) return null;
  try {
    const payload = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
    if (!payload.userId) return null;
    return prisma.user.findUnique({ where: { id: String(payload.userId) } });
  } catch {
    return null;
  }
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function isStrongPassword(password: string) {
  return password.length >= 12 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}

function verifyPassword(password: string, stored?: string | null) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const actual = Buffer.from(scryptSync(password, salt, 64).toString("hex"));
  const expected = Buffer.from(hash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
