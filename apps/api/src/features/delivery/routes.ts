import { Router } from "express";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../../db";
import {
  buildAiAnalysis,
  buildCapacity,
  buildExecutiveSituation,
  buildMissionStaffingForecast,
  buildMonteCarlo,
  buildRulesEvaluation,
  buildStrategicRisks,
  buildVariances,
  createInvoiceFromTimesheet
} from "./deliveryService";
import { coerceDates, serializeDates } from "../../utils/serialize";

export const deliveryRouter = Router();

const dateFields = [
  "submittedAt",
  "approvedAt",
  "lockedAt",
  "closedAt",
  "reopenedAt",
  "invoiceDate",
  "dueDate",
  "paymentDate",
  "startDate",
  "endDate",
  "lastSyncedAt",
  "lastUsedAt",
  "expectedStartDate",
  "expectedEndDate",
  "requestedAt",
  "approvedAt",
  "rejectedAt",
  "revokedAt",
  "uploadedAt"
];

const crud = (modelName: keyof typeof prisma, options: { include?: unknown; orderBy?: unknown } = {}) => {
  const router = Router();
  const model = (prisma as any)[modelName];

  router.get("/", async (req, res, next) => {
    try {
      const where = buildWhere(req.query);
      const rows = await model.findMany({ where, include: options.include, orderBy: options.orderBy ?? { createdAt: "desc" } });
      res.json(serializeDates(rows));
    } catch (error) {
      next(error);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      res.status(201).json(serializeDates(await model.create({ data: sanitize(coerceDates(req.body, dateFields)) })));
    } catch (error) {
      next(error);
    }
  });

  router.put("/:id", async (req, res, next) => {
    try {
      const data = sanitize(coerceDates(req.body, dateFields));
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

deliveryRouter.use("/timesheets", crud("timesheet" as any));
deliveryRouter.use("/invoices", crud("invoice" as any));
deliveryRouter.use("/payments", crud("payment" as any));
deliveryRouter.use("/planned-hires", crud("plannedHire" as any));
deliveryRouter.use("/business-rules", crud("businessRule" as any));

deliveryRouter.post("/documents/upload", async (req, res, next) => {
  try {
    const { contentBase64, fileName, mimeType, companyId, entityType, entityId, category, notes } = req.body ?? {};
    if (!contentBase64 || !fileName || !mimeType || !companyId || !entityType || !entityId) {
      return res.status(400).json({ error: "Document upload requires companyId, entityType, entityId, fileName, mimeType and contentBase64." });
    }
    const content = Buffer.from(String(contentBase64), "base64");
    const document = await prisma.document.create({
      data: {
        companyId,
        entityType,
        entityId,
        fileName: sanitizeFileName(fileName),
        mimeType,
        size: content.length,
        storagePath: "",
        category: category ?? "other",
        notes
      }
    });
    const storagePath = path.join("documents", `${document.id}-${document.fileName}`);
    const absolutePath = path.join(process.cwd(), ".data", storagePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content);
    const updated = await prisma.document.update({ where: { id: document.id }, data: { storagePath } });
    res.status(201).json(serializeDates(updated));
  } catch (error) {
    next(error);
  }
});

deliveryRouter.get("/documents/:id/download", async (req, res, next) => {
  try {
    const document = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!document?.storagePath) return res.status(404).json({ error: "Document file not found." });
    const absolutePath = path.join(process.cwd(), ".data", document.storagePath);
    const content = await readFile(absolutePath);
    res.setHeader("Content-Type", document.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(document.fileName)}"`);
    res.send(content);
  } catch (error) {
    next(error);
  }
});

deliveryRouter.use("/documents", crud("document" as any, { orderBy: { uploadedAt: "desc" } }));
deliveryRouter.use("/offers", crud("offer" as any, { include: { lines: true } }));
deliveryRouter.use("/workflows", crud("approvalWorkflow" as any));
deliveryRouter.use("/notifications", crud("notification" as any));
deliveryRouter.use("/webhooks", crud("webhookSubscription" as any));

deliveryRouter.get("/actuals/monthly", async (_req, res, next) => {
  try {
    res.json(serializeDates(await prisma.monthlyActual.findMany({ orderBy: [{ year: "desc" }, { month: "desc" }] })));
  } catch (error) {
    next(error);
  }
});

deliveryRouter.get("/executive/situation", async (req, res, next) => {
  try {
    res.json(await buildExecutiveSituation(stringParam(req.query.scenarioId), numberParam(req.query.horizon)));
  } catch (error) {
    next(error);
  }
});

deliveryRouter.post("/actuals/monthly", async (req, res, next) => {
  try {
    const data = sanitize(coerceDates(req.body, dateFields));
    res.status(201).json(serializeDates(await prisma.monthlyActual.create({ data: data as any })));
  } catch (error) {
    next(error);
  }
});
deliveryRouter.put("/actuals/monthly/:id", async (req, res, next) => {
  try {
    const data = sanitize(coerceDates(req.body, dateFields));
    res.json(serializeDates(await prisma.monthlyActual.update({ where: { id: req.params.id }, data: data as any })));
  } catch (error) {
    next(error);
  }
});
deliveryRouter.delete("/actuals/monthly/:id", async (req, res, next) => {
  try {
    await prisma.monthlyActual.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

deliveryRouter.get("/variances/monthly", async (req, res, next) => {
  try {
    res.json(await buildVariances(stringParam(req.query.scenarioId), numberParam(req.query.horizon)));
  } catch (error) {
    next(error);
  }
});

deliveryRouter.get("/monthly-closes", async (_req, res, next) => {
  try {
    res.json(serializeDates(await prisma.monthlyClose.findMany({ orderBy: [{ year: "desc" }, { month: "desc" }] })));
  } catch (error) {
    next(error);
  }
});
deliveryRouter.post("/monthly-closes", async (req, res, next) => {
  try {
    const data = sanitize(coerceDates(req.body, dateFields));
    res.status(201).json(serializeDates(await prisma.monthlyClose.create({ data: data as any })));
  } catch (error) {
    next(error);
  }
});
deliveryRouter.put("/monthly-closes/:id", async (req, res, next) => {
  try {
    const data = sanitize(coerceDates(req.body, dateFields));
    res.json(serializeDates(await prisma.monthlyClose.update({ where: { id: req.params.id }, data: data as any })));
  } catch (error) {
    next(error);
  }
});
deliveryRouter.delete("/monthly-closes/:id", async (req, res, next) => {
  try {
    await prisma.monthlyClose.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

deliveryRouter.post("/monthly-closes/:month/prepare", async (req, res, next) => {
  try {
    const [year, month] = parseMonth(req.params.month);
    const company = await requireCompany();
    const situation = await buildExecutiveSituation(stringParam(req.query.scenarioId), numberParam(req.query.horizon));
    const row = await prisma.monthlyClose.upsert({
      where: { companyId_year_month: { companyId: company.id, year, month } },
      create: { companyId: company.id, year, month, status: "in_review", revisedForecastSnapshot: situation as any },
      update: { status: "in_review", revisedForecastSnapshot: situation as any }
    });
    res.json(serializeDates(row));
  } catch (error) {
    next(error);
  }
});

deliveryRouter.post("/monthly-closes/:month/close", async (req, res, next) => {
  try {
    const [year, month] = parseMonth(req.params.month);
    const company = await requireCompany();
    const actual = await prisma.monthlyActual.findUnique({ where: { companyId_year_month: { companyId: company.id, year, month } } });
    const row = await prisma.monthlyClose.upsert({
      where: { companyId_year_month: { companyId: company.id, year, month } },
      create: { companyId: company.id, year, month, status: "closed", actualSnapshot: (actual ?? {}) as any, closedAt: new Date(), closedBy: req.body.closedBy },
      update: { status: "closed", actualSnapshot: (actual ?? {}) as any, closedAt: new Date(), closedBy: req.body.closedBy }
    });
    res.json(serializeDates(row));
  } catch (error) {
    next(error);
  }
});

deliveryRouter.post("/monthly-closes/:month/reopen", async (req, res, next) => {
  try {
    const [year, month] = parseMonth(req.params.month);
    const company = await requireCompany();
    res.json(serializeDates(await prisma.monthlyClose.update({
      where: { companyId_year_month: { companyId: company.id, year, month } },
      data: { status: "reopened", reopenedAt: new Date(), reopenedBy: req.body.reopenedBy }
    })));
  } catch (error) {
    next(error);
  }
});

deliveryRouter.post("/timesheets/:id/submit", (req, res, next) => updateStatus(prisma.timesheet, req.params.id, { status: "submitted", submittedAt: new Date(), submittedBy: req.body.submittedBy }, res, next));
deliveryRouter.post("/timesheets/:id/approve", (req, res, next) => updateStatus(prisma.timesheet, req.params.id, { status: "approved", approvedAt: new Date(), approvedBy: req.body.approvedBy }, res, next));
deliveryRouter.post("/timesheets/:id/reject", (req, res, next) => updateStatus(prisma.timesheet, req.params.id, { status: "rejected" }, res, next));
deliveryRouter.post("/timesheets/:id/lock", (req, res, next) => updateStatus(prisma.timesheet, req.params.id, { status: "locked", lockedAt: new Date() }, res, next));
deliveryRouter.post("/timesheets/:id/generate-invoice", async (req, res, next) => {
  try {
    res.status(201).json(serializeDates(await createInvoiceFromTimesheet(req.params.id)));
  } catch (error) {
    next(error);
  }
});

deliveryRouter.post("/invoices/:id/mark-paid", async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    const amount = Number(req.body.amount ?? invoice.amountTTC - invoice.paidAmount);
    const payment = await prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        clientId: invoice.clientId,
        paymentDate: req.body.paymentDate ? new Date(`${req.body.paymentDate}T00:00:00.000Z`) : new Date(),
        amount,
        paymentMethod: req.body.paymentMethod ?? "wire",
        status: "received"
      }
    });
    const paidAmount = invoice.paidAmount + amount;
    const status = paidAmount + 0.01 >= invoice.amountTTC ? "paid" : "partially_paid";
    const updated = await prisma.invoice.update({ where: { id: invoice.id }, data: { paidAmount, status, paymentDate: status === "paid" ? payment.paymentDate : invoice.paymentDate } });
    res.json(serializeDates({ invoice: updated, payment }));
  } catch (error) {
    next(error);
  }
});

deliveryRouter.get("/reconciliation/billing", async (_req, res, next) => {
  try {
    res.json(serializeDates(await buildBillingReconciliationQueue()));
  } catch (error) {
    next(error);
  }
});
deliveryRouter.get("/reconciliation/billing/queue", async (_req, res, next) => {
  try {
    res.json(serializeDates(await buildBillingReconciliationQueue()));
  } catch (error) {
    next(error);
  }
});
deliveryRouter.post("/reconciliation/billing/suggestions/refresh", async (_req, res, next) => {
  try {
    res.json(serializeDates(await refreshBillingReconciliationSuggestions()));
  } catch (error) {
    next(error);
  }
});
deliveryRouter.get("/reconciliation/billing/candidates", async (req, res, next) => {
  try {
    res.json(serializeDates(await buildBillingCandidates(stringParam(req.query.forecastId), stringParam(req.query.q))));
  } catch (error) {
    next(error);
  }
});
deliveryRouter.post("/reconciliation/billing/forecasts/:id/match", async (req, res, next) => {
  try {
    res.json(serializeDates(await matchBillingForecast(req.params.id, req.body)));
  } catch (error) {
    next(error);
  }
});
deliveryRouter.post("/reconciliation/billing/forecasts/:id/ignore", async (req, res, next) => {
  try {
    res.json(serializeDates(await ignoreBillingForecast(req.params.id, req.body)));
  } catch (error) {
    next(error);
  }
});
deliveryRouter.post("/reconciliation/billing/:id/cancel", async (req, res, next) => updateStatus(prisma.billingReconciliation, req.params.id, { status: "cancelled", notes: req.body.notes, updatedAt: new Date() }, res, next));
deliveryRouter.post("/reconciliation/billing/:id/match", (req, res, next) => updateStatus(prisma.billingReconciliation, req.params.id, { status: "matched", ...req.body }, res, next));
deliveryRouter.post("/reconciliation/billing/:id/ignore", (req, res, next) => updateStatus(prisma.billingReconciliation, req.params.id, { status: "ignored", ...req.body }, res, next));

deliveryRouter.get("/capacity", async (req, res, next) => {
  try {
    res.json(await buildCapacity(stringParam(req.query.scenarioId), numberParam(req.query.horizon)));
  } catch (error) {
    next(error);
  }
});

const normalizedSkillName = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

deliveryRouter.get("/capacity/skills", async (_req, res, next) => {
  try {
    res.json(serializeDates(await prisma.skill.findMany({ orderBy: { name: "asc" } })));
  } catch (error) {
    next(error);
  }
});
deliveryRouter.post("/capacity/skills", async (req, res, next) => {
  try {
    const name = String(req.body?.name ?? "").trim();
    res.status(201).json(serializeDates(await prisma.skill.create({
      data: {
        name,
        category: req.body?.category,
        aliases: req.body?.aliases ? String(req.body.aliases).split(",").map((alias) => alias.trim()).filter(Boolean) : [],
        normalizedName: req.body?.normalizedName ?? normalizedSkillName(name)
      }
    })));
  } catch (error) {
    next(error);
  }
});
deliveryRouter.put("/capacity/skills/:id", async (req, res, next) => {
  try {
    const data = sanitize(req.body);
    if (data.name && !data.normalizedName) data.normalizedName = normalizedSkillName(data.name);
    if (typeof data.aliases === "string") data.aliases = data.aliases.split(",").map((alias) => alias.trim()).filter(Boolean);
    res.json(serializeDates(await prisma.skill.update({ where: { id: req.params.id }, data: data as any })));
  } catch (error) {
    next(error);
  }
});
deliveryRouter.delete("/capacity/skills/:id", async (req, res, next) => {
  try {
    await prisma.$transaction([
      prisma.resourceSkill.deleteMany({ where: { skillId: req.params.id } }),
      prisma.missionSkillNeed.deleteMany({ where: { skillId: req.params.id } }),
      prisma.skill.delete({ where: { id: req.params.id } })
    ]);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
deliveryRouter.use("/capacity/resource-skills", crud("resourceSkill" as any));
deliveryRouter.use("/capacity/mission-skill-needs", crud("missionSkillNeed" as any));

deliveryRouter.get("/staffing/forecast", async (req, res, next) => {
  try {
    res.json(await buildMissionStaffingForecast(stringParam(req.query.scenarioId), numberParam(req.query.horizon)));
  } catch (error) {
    next(error);
  }
});

deliveryRouter.get("/risks/strategic", async (req, res, next) => {
  try {
    res.json(await buildStrategicRisks(stringParam(req.query.scenarioId), numberParam(req.query.horizon)));
  } catch (error) {
    next(error);
  }
});
deliveryRouter.get("/risks/dependencies", async (req, res, next) => {
  try {
    res.json(await buildStrategicRisks(stringParam(req.query.scenarioId), numberParam(req.query.horizon)));
  } catch (error) {
    next(error);
  }
});

deliveryRouter.post("/monte-carlo/run", async (req, res, next) => {
  try {
    res.json(await buildMonteCarlo(req.body.scenarioId, req.body.horizon, Number(req.body.iterations ?? 500)));
  } catch (error) {
    next(error);
  }
});
deliveryRouter.get("/monte-carlo/results/:id", async (req, res, next) => {
  try {
    const row = await prisma.monteCarloResult.findUnique({ where: { id: req.params.id } });
    if (!row) return res.status(404).json({ error: "Monte Carlo result not found" });
    res.json(serializeDates(row));
  } catch (error) {
    next(error);
  }
});

deliveryRouter.post("/ai/analyze/month", async (req, res, next) => {
  try {
    res.json(await buildAiAnalysis(req.body.scenarioId, req.body.horizon));
  } catch (error) {
    next(error);
  }
});
deliveryRouter.post("/ai/analyze/scenario", async (req, res, next) => {
  try {
    res.json(await buildAiAnalysis(req.body.scenarioId, req.body.horizon));
  } catch (error) {
    next(error);
  }
});
deliveryRouter.post("/ai/chat", async (req, res, next) => {
  try {
    const analysis = await buildAiAnalysis(req.body.scenarioId, req.body.horizon);
    res.json({ answer: analysis.executiveSummary, sourceFacts: analysis.sourceFacts, suggestedActions: analysis.recommendations });
  } catch (error) {
    next(error);
  }
});
deliveryRouter.post("/ai/create-simulation-draft", async (req, res, next) => {
  try {
    const scenario = await prisma.scenario.findFirst({ where: req.body.scenarioId ? { id: req.body.scenarioId } : { isActive: true } });
    if (!scenario) return res.status(404).json({ error: "Scenario not found" });
    const row = await prisma.simulationEvent.create({
      data: {
        scenarioId: scenario.id,
        type: req.body.type ?? "custom",
        label: req.body.label ?? "Brouillon assistant",
        startDate: req.body.startDate ? new Date(`${req.body.startDate}T00:00:00.000Z`) : new Date(),
        parameters: req.body.parameters ?? {},
        isActive: false,
        notes: "Draft generated by assistant; validation required before activation."
      }
    });
    res.status(201).json(serializeDates(row));
  } catch (error) {
    next(error);
  }
});

deliveryRouter.post("/business-rules/evaluate", async (req, res, next) => {
  try {
    res.json(await buildRulesEvaluation(req.body.scenarioId, req.body.horizon));
  } catch (error) {
    next(error);
  }
});

async function getDeliveryConnectors(_req: unknown, res: any, next: any) {
  try {
    const [accounting, hr, opportunities] = await Promise.all([
      prisma.accountingSync.findMany(),
      prisma.hrSync.findMany(),
      prisma.crmOpportunity.findMany()
    ]);
    res.json(serializeDates({ accounting, hr, crm: opportunities }));
  } catch (error) {
    next(error);
  }
}

async function syncDeliveryConnector(req: any, res: any, next: any) {
  try {
    const provider = req.params.provider;
    const row = provider.startsWith("hr")
      ? await prisma.hrSync.create({ data: { provider, status: "completed", lastSyncAt: new Date(), importedEmployeesCount: 0, importedAbsencesCount: 0, errors: req.body.errors ?? [] } })
      : await prisma.accountingSync.create({ data: { provider, status: "completed", lastSyncAt: new Date(), importedInvoicesCount: 0, importedPaymentsCount: 0, importedExpensesCount: 0, errors: req.body.errors ?? [] } });
    res.status(201).json(serializeDates(row));
  } catch (error) {
    next(error);
  }
}

deliveryRouter.get("/delivery/connectors", getDeliveryConnectors);
deliveryRouter.post("/delivery/connectors/:provider/sync", syncDeliveryConnector);
deliveryRouter.get("/delivery/connectors/:provider/status", getDeliveryConnectorStatus);
deliveryRouter.get("/connectors", getDeliveryConnectors);
deliveryRouter.post("/connectors/:provider/sync", syncDeliveryConnector);
deliveryRouter.get("/connectors/:provider/status", getDeliveryConnectorStatus);

async function getDeliveryConnectorStatus(req: any, res: any, next: any) {
  try {
    const [accounting, hr] = await Promise.all([
      prisma.accountingSync.findFirst({ where: { provider: req.params.provider }, orderBy: { createdAt: "desc" } }),
      prisma.hrSync.findFirst({ where: { provider: req.params.provider }, orderBy: { createdAt: "desc" } })
    ]);
    res.json(serializeDates(accounting ?? hr ?? { provider: req.params.provider, status: "never_synced" }));
  } catch (error) {
    next(error);
  }
}

deliveryRouter.get("/crm/opportunities", async (_req, res, next) => {
  try {
    res.json(serializeDates(await prisma.crmOpportunity.findMany({ orderBy: { createdAt: "desc" } })));
  } catch (error) {
    next(error);
  }
});
deliveryRouter.post("/crm/opportunities/:id/convert-to-mission", async (req, res, next) => {
  try {
    const opportunity = await prisma.crmOpportunity.findUnique({ where: { id: req.params.id } });
    if (!opportunity) return res.status(404).json({ error: "Opportunity not found" });
    const client = await prisma.client.findFirst({ where: { name: opportunity.clientName } }) ?? await prisma.client.create({ data: { name: opportunity.clientName, sector: "A qualifiér", paymentDelayDays: 30 } });
    const mission = await prisma.mission.create({
      data: {
        title: opportunity.opportunityName,
        clientId: client.id,
        status: "planned",
        type: "time_material",
        startDate: opportunity.expectedStartDate ?? new Date(),
        estimatedEndDate: opportunity.expectedEndDate,
        defaultDailyRate: opportunity.expectedTJM ?? 850,
        signatureProbability: opportunity.probability
      }
    });
    res.status(201).json(serializeDates(mission));
  } catch (error) {
    next(error);
  }
});

deliveryRouter.get("/hr/absences", async (_req, res, next) => {
  try {
    res.json(serializeDates(await prisma.absence.findMany({ orderBy: { startDate: "desc" } })));
  } catch (error) {
    next(error);
  }
});
deliveryRouter.post("/hr/absences", async (req, res, next) => {
  try {
    res.status(201).json(serializeDates(await prisma.absence.create({ data: sanitize(coerceDates(req.body, dateFields)) as any })));
  } catch (error) {
    next(error);
  }
});

deliveryRouter.post("/workflows/:id/approve", (req, res, next) => updateStatus(prisma.approvalWorkflow, req.params.id, { status: "approved", approvedAt: new Date(), approvedBy: req.body.approvedBy, comment: req.body.comment }, res, next));
deliveryRouter.post("/workflows/:id/reject", (req, res, next) => updateStatus(prisma.approvalWorkflow, req.params.id, { status: "rejected", rejectedAt: new Date(), rejectedBy: req.body.rejectedBy, comment: req.body.comment }, res, next));
deliveryRouter.post("/notifications/:id/read", (req, res, next) => updateStatus(prisma.notification, req.params.id, { status: "read" }, res, next));
deliveryRouter.post("/notifications/:id/dismiss", (req, res, next) => updateStatus(prisma.notification, req.params.id, { status: "dismissed" }, res, next));
deliveryRouter.post("/offers/:id/submit-review", (req, res, next) => updateStatus(prisma.offer, req.params.id, { status: "internal_review" }, res, next));
deliveryRouter.post("/offers/:id/approve", (req, res, next) => updateStatus(prisma.offer, req.params.id, { status: "accepted" }, res, next));
deliveryRouter.post("/offers/:id/convert-to-mission", async (req, res, next) => {
  try {
    const offer = await prisma.offer.findUnique({ where: { id: req.params.id } });
    if (!offer) return res.status(404).json({ error: "Offer not found" });
    const mission = await prisma.mission.create({
      data: {
        title: offer.title,
        clientId: offer.clientId,
        status: "planned",
        type: offer.pricingMode === "fixed_price" ? "fixed_price" : "time_material",
        startDate: offer.expectedStartDate ?? new Date(),
        estimatedEndDate: offer.expectedEndDate,
        defaultDailyRate: offer.totalAmount > 0 ? offer.totalAmount / 20 : 850,
        fixedPriceAmount: offer.pricingMode === "fixed_price" ? offer.totalAmount : null,
        signatureProbability: offer.probability
      }
    });
    res.status(201).json(serializeDates(mission));
  } catch (error) {
    next(error);
  }
});

deliveryRouter.get("/public/docs", (_req, res) => {
  res.json({
    name: "ESN Forecast Public API",
    version: "2.0",
    endpoints: ["/api/projections/scenario/:scenarioId", "/api/timesheets", "/api/invoices", "/api/webhooks"]
  });
});
deliveryRouter.get("/api-keys", async (_req, res, next) => {
  try {
    const rows = await prisma.apiKey.findMany({ orderBy: { createdAt: "desc" } });
    res.json(serializeDates(rows.map((row) => ({ ...row, keyHash: "masked" }))));
  } catch (error) {
    next(error);
  }
});
deliveryRouter.post("/api-keys", async (req, res, next) => {
  try {
    const rawKey = `esnf_${createHash("sha256").update(`${Date.now()}-${Math.random()}`).digest("hex")}`;
    const row = await prisma.apiKey.create({
      data: {
        companyId: req.body.companyId ?? (await requireCompany()).id,
        name: req.body.name,
        keyHash: createHash("sha256").update(rawKey).digest("hex"),
        scopes: req.body.scopes ?? []
      }
    });
    res.status(201).json(serializeDates({ ...row, rawKey }));
  } catch (error) {
    next(error);
  }
});
deliveryRouter.delete("/api-keys/:id", async (req, res, next) => {
  try {
    await prisma.apiKey.update({ where: { id: req.params.id }, data: { revokedAt: new Date() } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

function sanitize(data: Record<string, unknown>) {
  const copy = { ...data };
  delete copy.id;
  delete copy.createdAt;
  delete copy.updatedAt;
  return copy;
}

function sanitizeFileName(value: string) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").slice(0, 180);
}

function buildWhere(query: Record<string, unknown>) {
  const where: Record<string, unknown> = {};
  for (const key of ["scenarioId", "companyId", "clientId", "missionId", "status", "userId"]) {
    if (query[key]) where[key] = String(query[key]);
  }
  return Object.keys(where).length ? where : undefined;
}

async function updateStatus(model: any, id: string, data: Record<string, unknown>, res: any, next: any) {
  try {
    res.json(serializeDates(await model.update({ where: { id }, data })));
  } catch (error) {
    next(error);
  }
}

function stringParam(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function numberParam(value: unknown) {
  return typeof value === "string" && value ? Number(value) : undefined;
}

function parseMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) throw new Error("Month must use YYYY-MM format");
  return [year, month] as const;
}

async function requireCompany() {
  const company = await prisma.company.findFirst();
  if (!company) throw new Error("Company not found");
  return company;
}

async function buildBillingReconciliationQueue() {
  const [forecasts, invoices, payments, reconciliations, clients, missions, scenarios] = await Promise.all([
    prisma.invoiceForecast.findMany({ orderBy: [{ expectedPaymentDate: "asc" }, { invoiceDate: "asc" }], take: 400 }),
    prisma.invoice.findMany({ orderBy: { invoiceDate: "desc" }, take: 600 }),
    prisma.payment.findMany({ orderBy: { paymentDate: "desc" }, take: 800 }),
    prisma.billingReconciliation.findMany({ where: { status: { not: "cancelled" } }, orderBy: { updatedAt: "desc" } }),
    prisma.client.findMany(),
    prisma.mission.findMany(),
    prisma.scenario.findMany()
  ]);
  const context = buildBillingContext(clients, missions, scenarios, payments);
  const reconciliationsByForecast = new Map<string, any>();
  for (const reconciliation of reconciliations) {
    if (reconciliation.invoiceForecastId && !reconciliationsByForecast.has(reconciliation.invoiceForecastId)) {
      reconciliationsByForecast.set(reconciliation.invoiceForecastId, reconciliation);
    }
  }
  const items = forecasts.map((forecast) => buildBillingQueueItem(forecast, invoices, reconciliationsByForecast.get(forecast.id), context));
  return {
    summary: {
      total: items.length,
      suggested: items.filter((item) => item.queueStatus === "suggested").length,
      manualReview: items.filter((item) => item.queueStatus === "manual_review").length,
      matched: items.filter((item) => item.queueStatus === "matched").length,
      paymentPending: items.filter((item) => item.paymentStatus === "pending" || item.paymentStatus === "partial").length,
      amountToInvoice: items.filter((item) => item.queueStatus !== "matched" && item.queueStatus !== "ignored").reduce((sum, item) => sum + (item.forecastAmountTTC ?? 0), 0),
      amountVariance: items.reduce((sum, item) => sum + Math.abs(item.amountVariance ?? 0), 0)
    },
    items,
    suggestions: items.flatMap((item) => item.suggestions.map((suggestion: any) => ({ ...suggestion, invoiceForecastId: item.invoiceForecastId })))
  };
}

async function refreshBillingReconciliationSuggestions() {
  const queue = await buildBillingReconciliationQueue();
  return queue.suggestions;
}

async function buildBillingCandidates(forecastId?: string, q?: string) {
  const [forecast, invoices, payments, clients, missions, scenarios] = await Promise.all([
    forecastId ? prisma.invoiceForecast.findUnique({ where: { id: forecastId } }) : Promise.resolve(null),
    prisma.invoice.findMany({ orderBy: { invoiceDate: "desc" }, take: 600 }),
    prisma.payment.findMany({ orderBy: { paymentDate: "desc" }, take: 800 }),
    prisma.client.findMany(),
    prisma.mission.findMany(),
    prisma.scenario.findMany()
  ]);
  const context = buildBillingContext(clients, missions, scenarios, payments);
  const candidates = invoices.map((invoice) => {
    const score = forecast ? scoreBillingCandidate(forecast, invoice, context) : 0;
    const invoicePayments = context.paymentsByInvoice.get(invoice.id) ?? [];
    const paidAmount = invoicePayments.reduce((sum: number, payment: any) => sum + payment.amount, 0) || invoice.paidAmount || 0;
    return {
      invoiceId: invoice.id,
      label: invoiceLabel(invoice, context),
      invoiceNumber: invoice.invoiceNumber,
      amountHT: invoice.amountHT,
      amountTTC: invoice.amountTTC,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      status: invoice.status,
      paidAmount,
      payments: invoicePayments.map((payment: any) => ({ id: payment.id, label: paymentLabel(payment), amount: payment.amount, paymentDate: payment.paymentDate, status: payment.status })),
      score,
      amountVariance: forecast ? invoice.amountHT - forecast.amountHT : 0,
      dateVarianceDays: forecast ? daysBetween(invoice.dueDate, forecast.expectedPaymentDate) : 0
    };
  });
  const needle = q?.trim().toLowerCase();
  return (needle ? candidates.filter((candidate) => [candidate.label, candidate.invoiceNumber].join(" ").toLowerCase().includes(needle)) : candidates).sort((left, right) => right.score - left.score).slice(0, 100);
}

async function matchBillingForecast(forecastId: string, body: Record<string, unknown>) {
  const forecast = await prisma.invoiceForecast.findUnique({ where: { id: forecastId } });
  if (!forecast) throw new Error("Invoice forecast not found");
  const invoiceId = stringParam(body.invoiceId);
  if (!invoiceId) throw new Error("invoiceId is required");
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new Error("Invoice not found");
  const paymentId = stringParam(body.paymentId);
  const payment = paymentId ? await prisma.payment.findUnique({ where: { id: paymentId } }) : await prisma.payment.findFirst({ where: { invoiceId: invoice.id, status: { in: ["received", "reconciled"] } }, orderBy: { paymentDate: "desc" } });
  const amountVariance = invoice.amountHT - forecast.amountHT;
  const dateVarianceDays = daysBetween(invoice.dueDate, forecast.expectedPaymentDate);
  const status = Math.abs(amountVariance) > 1 ? "amount_variance" : Math.abs(dateVarianceDays) > 7 ? "date_variance" : payment ? "matched_paid" : "matched";
  const existing = await prisma.billingReconciliation.findFirst({ where: { invoiceForecastId: forecast.id, status: { not: "cancelled" } }, orderBy: { updatedAt: "desc" } });
  const data = {
    invoiceForecastId: forecast.id,
    invoiceId: invoice.id,
    paymentId: payment?.id,
    status,
    amountVariance,
    dateVarianceDays,
    notes: stringParam(body.notes)
  };
  const reconciliation = existing
    ? await prisma.billingReconciliation.update({ where: { id: existing.id }, data })
    : await prisma.billingReconciliation.create({ data });
  if (payment && payment.status !== "reconciled") {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "reconciled" } });
  }
  return reconciliation;
}

async function ignoreBillingForecast(forecastId: string, body: Record<string, unknown>) {
  const forecast = await prisma.invoiceForecast.findUnique({ where: { id: forecastId } });
  if (!forecast) throw new Error("Invoice forecast not found");
  const existing = await prisma.billingReconciliation.findFirst({ where: { invoiceForecastId: forecast.id, status: { not: "cancelled" } }, orderBy: { updatedAt: "desc" } });
  const data = {
    invoiceForecastId: forecast.id,
    status: "ignored",
    amountVariance: 0,
    dateVarianceDays: 0,
    notes: stringParam(body.notes)
  };
  return existing
    ? prisma.billingReconciliation.update({ where: { id: existing.id }, data })
    : prisma.billingReconciliation.create({ data });
}

function buildBillingQueueItem(forecast: any, invoices: any[], reconciliation: any, context: any) {
  const suggestions = invoices.map((invoice) => {
    const score = scoreBillingCandidate(forecast, invoice, context);
    return {
      invoiceForecastId: forecast.id,
      invoiceId: invoice.id,
      invoiceLabel: invoiceLabel(invoice, context),
      score,
      amountVariance: invoice.amountHT - forecast.amountHT,
      dateVarianceDays: daysBetween(invoice.dueDate, forecast.expectedPaymentDate),
      reason: billingSuggestionReason(forecast, invoice, context, score)
    };
  }).filter((suggestion) => suggestion.score >= 0.45).sort((left, right) => right.score - left.score).slice(0, 5);
  const matchedInvoice = reconciliation?.invoiceId ? invoices.find((invoice) => invoice.id === reconciliation.invoiceId) : undefined;
  const bestSuggestion = suggestions[0];
  const invoice = matchedInvoice ?? (reconciliation ? undefined : bestSuggestion ? invoices.find((candidate) => candidate.id === bestSuggestion.invoiceId) : undefined);
  const invoicePayments = invoice ? context.paymentsByInvoice.get(invoice.id) ?? [] : [];
  const paidAmount = invoicePayments.reduce((sum: number, payment: any) => sum + payment.amount, 0) || invoice?.paidAmount || 0;
  const forecastAmountTTC = forecast.amountTTC ?? forecast.amountHT * (1 + (forecast.vatRate ?? 0.2));
  const paymentStatus = invoice ? paidAmount + 0.01 >= invoice.amountTTC ? "paid" : paidAmount > 0 ? "partial" : "pending" : "not_invoiced";
  const queueStatus = reconciliation?.status === "ignored" ? "ignored" : reconciliation ? "matched" : bestSuggestion ? "suggested" : "manual_review";
  const amountVariance = reconciliation?.amountVariance ?? (invoice ? invoice.amountHT - forecast.amountHT : 0);
  const dateVarianceDays = reconciliation?.dateVarianceDays ?? (invoice ? daysBetween(invoice.dueDate, forecast.expectedPaymentDate) : 0);
  const priority = queueStatus === "manual_review" || Math.abs(amountVariance) > 1000 || Math.abs(dateVarianceDays) > 14 ? "high" : paymentStatus === "pending" || paymentStatus === "partial" ? "medium" : "normal";
  return {
    id: forecast.id,
    invoiceForecastId: forecast.id,
    reconciliationId: reconciliation?.id,
    forecastLabel: forecastLabel(forecast, context),
    missionLabel: context.missionById.get(forecast.missionId)?.title ?? forecast.missionId,
    clientLabel: context.clientByMissionId.get(forecast.missionId)?.name ?? "-",
    scenarioLabel: context.scenarioById.get(forecast.scenarioId)?.name ?? forecast.scenarioId,
    forecastInvoiceDate: forecast.invoiceDate,
    forecastDueDate: forecast.dueDate,
    forecastExpectedPaymentDate: forecast.expectedPaymentDate,
    forecastAmountHT: forecast.amountHT,
    forecastAmountTTC,
    queueStatus,
    priority,
    invoiceId: invoice?.id,
    invoiceLabel: invoice ? invoiceLabel(invoice, context) : undefined,
    invoiceNumber: invoice?.invoiceNumber,
    invoiceStatus: invoice?.status,
    invoiceAmountHT: invoice?.amountHT,
    invoiceAmountTTC: invoice?.amountTTC,
    paymentStatus,
    paidAmount,
    remainingAmount: invoice ? Math.max(0, invoice.amountTTC - paidAmount) : forecastAmountTTC,
    amountVariance,
    dateVarianceDays,
    notes: reconciliation?.notes,
    bestSuggestion,
    suggestions,
    payments: invoicePayments.map((payment: any) => ({ id: payment.id, label: paymentLabel(payment), amount: payment.amount, paymentDate: payment.paymentDate, status: payment.status }))
  };
}

function buildBillingContext(clients: any[], missions: any[], scenarios: any[], payments: any[]) {
  const clientById = new Map(clients.map((client) => [client.id, client]));
  const missionById = new Map(missions.map((mission) => [mission.id, mission]));
  const clientByMissionId = new Map(missions.map((mission) => [mission.id, clientById.get(mission.clientId)]));
  const scenarioById = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
  const paymentsByInvoice = new Map<string, any[]>();
  for (const payment of payments) {
    const bucket = paymentsByInvoice.get(payment.invoiceId) ?? [];
    bucket.push(payment);
    paymentsByInvoice.set(payment.invoiceId, bucket);
  }
  return { clientById, missionById, clientByMissionId, scenarioById, paymentsByInvoice };
}

function scoreBillingCandidate(forecast: any, invoice: any, context: any) {
  const mission = context.missionById.get(forecast.missionId);
  let score = 0;
  if (invoice.missionId && invoice.missionId === forecast.missionId) score += 0.35;
  if (mission?.clientId && invoice.clientId === mission.clientId) score += 0.25;
  const amountDelta = Math.abs(invoice.amountHT - forecast.amountHT);
  score += amountDelta <= 1 ? 0.25 : amountDelta <= Math.max(500, forecast.amountHT * 0.05) ? 0.15 : amountDelta <= Math.max(1500, forecast.amountHT * 0.15) ? 0.05 : 0;
  const dateDelta = Math.abs(daysBetween(invoice.dueDate, forecast.expectedPaymentDate));
  score += dateDelta <= 7 ? 0.15 : dateDelta <= 30 ? 0.08 : dateDelta <= 60 ? 0.03 : 0;
  return Math.min(1, Number(score.toFixed(2)));
}

function billingSuggestionReason(forecast: any, invoice: any, context: any, score: number) {
  const reasons = [];
  const mission = context.missionById.get(forecast.missionId);
  if (invoice.missionId === forecast.missionId) reasons.push("même mission");
  if (mission?.clientId && invoice.clientId === mission.clientId) reasons.push("même client");
  if (Math.abs(invoice.amountHT - forecast.amountHT) <= Math.max(500, forecast.amountHT * 0.05)) reasons.push("montant proche");
  if (Math.abs(daysBetween(invoice.dueDate, forecast.expectedPaymentDate)) <= 30) reasons.push("date proche");
  return reasons.length ? `${reasons.join(", ")} - score ${Math.round(score * 100)} %` : `Score ${Math.round(score * 100)} %`;
}

function forecastLabel(forecast: any, context: any) {
  const mission = context.missionById.get(forecast.missionId);
  const client = context.clientByMissionId.get(forecast.missionId);
  return `${client?.name ?? "Client"} - ${mission?.title ?? "Mission"} - ${moneyLabel(forecast.amountTTC ?? forecast.amountHT)}`;
}

function invoiceLabel(invoice: any, context: any) {
  const client = context.clientById.get(invoice.clientId);
  const mission = invoice.missionId ? context.missionById.get(invoice.missionId) : undefined;
  return `${invoice.invoiceNumber ?? "Facture"} - ${client?.name ?? "Client"}${mission?.title ? ` - ${mission.title}` : ""} - ${moneyLabel(invoice.amountTTC)}`;
}

function paymentLabel(payment: any) {
  return `${dateLabel(payment.paymentDate)} - ${moneyLabel(payment.amount)} - ${payment.status}`;
}

function moneyLabel(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value ?? 0);
}

function dateLabel(value: Date | string) {
  return new Date(value).toISOString().slice(0, 10);
}

function daysBetween(left: Date, right: Date) {
  return Math.round((left.getTime() - right.getTime()) / 86400000);
}
