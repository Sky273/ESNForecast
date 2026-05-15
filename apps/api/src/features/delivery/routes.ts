import { Router } from "express";
import { createHash } from "node:crypto";
import { prisma } from "../../db";
import {
  buildAiAnalysis,
  buildCapacity,
  buildExecutiveSituation,
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
    const [forecasts, invoices, reconciliations] = await Promise.all([
      prisma.invoiceForecast.findMany(),
      prisma.invoice.findMany(),
      prisma.billingReconciliation.findMany()
    ]);
    res.json(serializeDates({ forecasts, invoices, reconciliations, suggestions: suggestReconciliation(forecasts, invoices) }));
  } catch (error) {
    next(error);
  }
});

deliveryRouter.post("/reconciliation/billing/:id/match", (req, res, next) => updateStatus(prisma.billingReconciliation, req.params.id, { status: "matched", ...req.body }, res, next));
deliveryRouter.post("/reconciliation/billing/:id/ignore", (req, res, next) => updateStatus(prisma.billingReconciliation, req.params.id, { status: "ignored" }, res, next));

deliveryRouter.get("/capacity", async (req, res, next) => {
  try {
    res.json(await buildCapacity(stringParam(req.query.scenarioId), numberParam(req.query.horizon)));
  } catch (error) {
    next(error);
  }
});

deliveryRouter.get("/capacity/skills", async (_req, res, next) => {
  try {
    res.json(serializeDates(await prisma.skill.findMany({ orderBy: { name: "asc" } })));
  } catch (error) {
    next(error);
  }
});

deliveryRouter.get("/staffing/forecast", async (req, res, next) => {
  try {
    const capacity = await buildCapacity(stringParam(req.query.scenarioId), numberParam(req.query.horizon));
    res.json({ capacity, uncoveredNeeds: capacity.filter((row) => row.status === "shortage") });
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

deliveryRouter.get("/connectors", async (_req, res, next) => {
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
});
deliveryRouter.post("/connectors/:provider/sync", async (req, res, next) => {
  try {
    const provider = req.params.provider;
    const row = provider.startsWith("hr")
      ? await prisma.hrSync.create({ data: { provider, status: "completed", lastSyncAt: new Date(), importedEmployeesCount: 0, importedAbsencesCount: 0, errors: req.body.errors ?? [] } })
      : await prisma.accountingSync.create({ data: { provider, status: "completed", lastSyncAt: new Date(), importedInvoicesCount: 0, importedPaymentsCount: 0, importedExpensesCount: 0, errors: req.body.errors ?? [] } });
    res.status(201).json(serializeDates(row));
  } catch (error) {
    next(error);
  }
});
deliveryRouter.get("/connectors/:provider/status", async (req, res, next) => {
  try {
    const [accounting, hr] = await Promise.all([
      prisma.accountingSync.findFirst({ where: { provider: req.params.provider }, orderBy: { createdAt: "desc" } }),
      prisma.hrSync.findFirst({ where: { provider: req.params.provider }, orderBy: { createdAt: "desc" } })
    ]);
    res.json(serializeDates(accounting ?? hr ?? { provider: req.params.provider, status: "never_synced" }));
  } catch (error) {
    next(error);
  }
});

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
    const client = await prisma.client.findFirst({ where: { name: opportunity.clientName } }) ?? await prisma.client.create({ data: { name: opportunity.clientName, sector: "A qualifier", paymentDelayDays: 30 } });
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

function suggestReconciliation(forecasts: Array<{ id: string; amountHT: number; expectedPaymentDate: Date }>, invoices: Array<{ id: string; amountHT: number; dueDate: Date }>) {
  return forecasts.flatMap((forecast) => {
    const match = invoices.find((invoice) => Math.abs(invoice.amountHT - forecast.amountHT) < 1);
    if (!match) return [];
    const dateVarianceDays = Math.round((match.dueDate.getTime() - forecast.expectedPaymentDate.getTime()) / 86400000);
    return [{ invoiceForecastId: forecast.id, invoiceId: match.id, amountVariance: match.amountHT - forecast.amountHT, dateVarianceDays }];
  });
}
