import { Router } from "express";
import { prisma } from "../../db";
import {
  buildRunway,
  buildConnectedFinanceOverview,
  detectAndStoreAnomalies,
  evaluateBankCategorization,
  generateCodirReport,
  recalculateClientPaymentProfiles,
  recalculateDataQuality,
  recalculateForecastReliability,
  refreshReconciliationSuggestions,
  runReforecastJob
} from "./connectedFinanceService";
import { coerceDates, serializeDates } from "../../utils/serialize";
import { buildCodirPdf } from "../reports/executivePdfReport";

export const connectedFinanceRouter = Router();

const dateFields = ["lastSyncAt", "nextSyncAt", "startedAt", "finishedAt", "consentExpiresAt", "grantedAt", "expiresAt", "revokedAt", "balanceDate", "transactionDate", "bookingDate", "valueDate", "invoiceDate", "dueDate", "paymentDate", "resolvedAt", "cancelledAt", "detectedAt", "resolvedAt"];

const crud = (modelName: keyof typeof prisma, orderBy: any = { createdAt: "desc" }) => {
  const router = Router();
  const model = (prisma as any)[modelName];
  router.get("/", async (req, res, next) => {
    try {
      res.json(serializeDates(await model.findMany({ where: buildWhere(req.query), orderBy })));
    } catch (error) {
      next(error);
    }
  });
  router.get("/:id", async (req, res, next) => {
    try {
      const row = await model.findUnique({ where: { id: req.params.id } });
      if (!row) return res.status(404).json({ error: "Not found" });
      res.json(serializeDates(row));
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
      res.json(serializeDates(await model.update({ where: { id: req.params.id }, data: sanitize(coerceDates(req.body, dateFields)) })));
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

connectedFinanceRouter.use("/connectors", crud("connector" as any));
connectedFinanceRouter.use("/financial-categories", crud("financialCategory" as any));
connectedFinanceRouter.use("/bank/categorization-rules", crud("bankCategorizationRule" as any, { priority: "asc" }));
connectedFinanceRouter.use("/reforecast/suggestions", crud("reforecastSuggestion" as any));

connectedFinanceRouter.get("/financial/situation", async (req, res, next) => {
  try {
    res.json(await buildConnectedFinanceOverview(stringParam(req.query.scenarioId), numberParam(req.query.horizon)));
  } catch (error) {
    next(error);
  }
});

connectedFinanceRouter.post("/connectors/:id/sync", async (req, res, next) => {
  try {
    const connector = await prisma.connector.update({ where: { id: req.params.id }, data: { status: "syncing" } });
    const run = await prisma.connectorSyncRun.create({ data: { connectorId: connector.id, status: "success", finishedAt: new Date(), importedCount: 3, logs: { mode: "mock", provider: connector.provider } } });
    await prisma.connector.update({ where: { id: connector.id }, data: { status: "connected", lastSyncAt: new Date(), errorMessage: null } });
    res.json(serializeDates(run));
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.post("/connectors/:id/disconnect", async (req, res, next) => updateStatus(prisma.connector, req.params.id, { status: "disconnected" }, res, next));
connectedFinanceRouter.get("/connectors/:id/status", async (req, res, next) => {
  try {
    const connector = await prisma.connector.findUnique({ where: { id: req.params.id } });
    if (!connector) return res.status(404).json({ error: "Connector not found" });
    res.json(serializeDates(connector));
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.get("/connectors/:id/sync-runs", async (req, res, next) => {
  try {
    res.json(serializeDates(await prisma.connectorSyncRun.findMany({ where: { connectorId: req.params.id }, orderBy: { startedAt: "desc" } })));
  } catch (error) {
    next(error);
  }
});

connectedFinanceRouter.get("/bank/connections", async (_req, res, next) => {
  try {
    res.json(serializeDates(await prisma.bankConnection.findMany({ orderBy: { createdAt: "desc" } })));
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.post("/bank/connections", async (req, res, next) => {
  try {
    res.status(201).json(serializeDates(await prisma.bankConnection.create({ data: sanitize(coerceDates(req.body, dateFields)) as any })));
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.post("/bank/connections/:id/refresh-consent", async (req, res, next) => updateStatus(prisma.bankConnection, req.params.id, { status: "active", consentExpiresAt: addDays(new Date(), 90) }, res, next));
connectedFinanceRouter.post("/bank/connections/:id/revoke", async (req, res, next) => updateStatus(prisma.bankConnection, req.params.id, { status: "revoked" }, res, next));

connectedFinanceRouter.get("/bank/accounts", async (_req, res, next) => {
  try {
    res.json(serializeDates(await prisma.bankAccount.findMany({ orderBy: { name: "asc" } })));
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.get("/bank/accounts/:id", async (req, res, next) => {
  try {
    const row = await prisma.bankAccount.findUnique({ where: { id: req.params.id } });
    if (!row) return res.status(404).json({ error: "Bank account not found" });
    res.json(serializeDates(row));
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.post("/bank/accounts", async (req, res, next) => {
  try {
    res.status(201).json(serializeDates(await prisma.bankAccount.create({ data: sanitize(coerceDates(req.body, dateFields)) as any })));
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.put("/bank/accounts/:id", async (req, res, next) => {
  try {
    res.json(serializeDates(await prisma.bankAccount.update({ where: { id: req.params.id }, data: sanitize(coerceDates(req.body, dateFields)) as any })));
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.delete("/bank/accounts/:id", async (req, res, next) => {
  try {
    await prisma.bankAccount.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.get("/bank/accounts/:id/transactions", async (req, res, next) => {
  try {
    res.json(serializeDates(await prisma.bankTransaction.findMany({ where: { bankAccountId: req.params.id }, orderBy: { transactionDate: "desc" } })));
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.post("/bank/accounts/:id/sync", async (req, res, next) => {
  try {
    const account = await prisma.bankAccount.findUnique({ where: { id: req.params.id } });
    if (!account) return res.status(404).json({ error: "Bank account not found" });
    res.json(serializeDates({ accountId: account.id, importedCount: 0, status: "mock_sync_complèted" }));
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.get("/bank/transactions", async (req, res, next) => {
  try {
    res.json(serializeDates(await prisma.bankTransaction.findMany({ where: buildWhere(req.query), orderBy: { transactionDate: "desc" } })));
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.get("/bank/transactions/:id", async (req, res, next) => {
  try {
    const row = await prisma.bankTransaction.findUnique({ where: { id: req.params.id } });
    if (!row) return res.status(404).json({ error: "Transaction not found" });
    res.json(serializeDates(row));
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.post("/bank/transactions", async (req, res, next) => {
  try {
    res.status(201).json(serializeDates(await prisma.bankTransaction.create({ data: sanitize(coerceDates(req.body, dateFields)) as any })));
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.put("/bank/transactions/:id", async (req, res, next) => {
  try {
    res.json(serializeDates(await prisma.bankTransaction.update({ where: { id: req.params.id }, data: sanitize(coerceDates(req.body, dateFields)) as any })));
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.delete("/bank/transactions/:id", async (req, res, next) => {
  try {
    await prisma.bankTransaction.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.put("/bank/transactions/:id/category", async (req, res, next) => updateStatus(prisma.bankTransaction, req.params.id, { categoryId: req.body.categoryId, categorizationStatus: "manually_categorized", confidenceScore: 1 }, res, next));
connectedFinanceRouter.post("/bank/transactions/import-csv", async (req, res, next) => {
  try {
    const accountId = req.body.bankAccountId;
    const account = await prisma.bankAccount.findUnique({ where: { id: accountId } });
    if (!account) return res.status(404).json({ error: "Bank account not found" });
    const rows = parseCsv(String(req.body.csv ?? ""));
    let importedCount = 0;
    for (const [index, row] of rows.entries()) {
      const amount = Number(row.amount ?? row.montant ?? 0);
      if (!row.date || !row.label || !Number.isFinite(amount)) continue;
      await prisma.bankTransaction.upsert({
        where: { bankAccountId_externalTransactionId: { bankAccountId: account.id, externalTransactionId: String(row.reference ?? `csv-${row.date}-${index}-${amount}`) } },
        create: {
          organizationId: account.organizationId,
          companyId: account.companyId,
          bankAccountId: account.id,
          externalTransactionId: String(row.reference ?? `csv-${row.date}-${index}-${amount}`),
          transactionDate: new Date(`${row.date}T00:00:00.000Z`),
          bookingDate: new Date(`${row.bookingDate ?? row.date}T00:00:00.000Z`),
          label: String(row.label),
          amount,
          currency: String(row.currency ?? "EUR"),
          direction: amount >= 0 ? "credit" : "debit",
          status: "booked",
          rawPayload: row
        },
        update: { rawPayload: row }
      });
      importedCount += 1;
    }
    res.status(201).json({ importedCount, rejectedCount: rows.length - importedCount });
  } catch (error) {
    next(error);
  }
});

connectedFinanceRouter.post("/accounting/import-csv", async (req, res, next) => {
  try {
    const connectorId = req.body.connectorId;
    const rows = parseCsv(String(req.body.csv ?? ""));
    let importedInvoices = 0;
    for (const [index, row] of rows.entries()) {
      if (!row.invoiceNumber || !row.invoiceDate || !row.amountTTC) continue;
      await prisma.accountingInvoiceImport.upsert({
        where: { connectorId_externalId: { connectorId, externalId: String(row.externalId ?? row.invoiceNumber ?? index) } },
        create: {
          connectorId,
          externalId: String(row.externalId ?? row.invoiceNumber ?? index),
          invoiceNumber: String(row.invoiceNumber),
          type: String(row.type ?? "customer_invoice"),
          clientOrSupplierName: String(row.clientOrSupplierName ?? row.client ?? row.supplier ?? "Unknown"),
          invoiceDate: new Date(`${row.invoiceDate}T00:00:00.000Z`),
          dueDate: row.dueDate ? new Date(`${row.dueDate}T00:00:00.000Z`) : null,
          amountHT: Number(row.amountHT ?? 0),
          vatAmount: Number(row.vatAmount ?? 0),
          amountTTC: Number(row.amountTTC),
          paidAmount: Number(row.paidAmount ?? 0),
          status: String(row.status ?? "imported"),
          rawPayload: row
        },
        update: { rawPayload: row }
      });
      importedInvoices += 1;
    }
    res.status(201).json({ importedInvoices, rejectedCount: rows.length - importedInvoices });
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.get("/accounting/imports/invoices", async (_req, res, next) => {
  try {
    res.json(serializeDates(await prisma.accountingInvoiceImport.findMany({ orderBy: { importedAt: "desc" } })));
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.get("/accounting/imports/payments", async (_req, res, next) => {
  try {
    res.json(serializeDates(await prisma.accountingPaymentImport.findMany({ orderBy: { importedAt: "desc" } })));
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.post("/accounting/sync", async (_req, res, next) => {
  try {
    res.json({ status: "mock_accounting_sync_complèted", importedInvoices: 0, importedPayments: 0 });
  } catch (error) {
    next(error);
  }
});

connectedFinanceRouter.post("/bank/categorization-rules/evaluate", async (_req, res, next) => {
  try {
    res.json(await evaluateBankCategorization());
  } catch (error) {
    next(error);
  }
});

connectedFinanceRouter.get("/reconciliation/suggestions", async (_req, res, next) => {
  try {
    const rows = await prisma.reconciliationSuggestion.findMany({ orderBy: { confidenceScore: "desc" } });
    res.json(serializeDates(await enrichReconciliationSuggestions(rows.length ? rows : await refreshReconciliationSuggestions())));
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.get("/reconciliation/candidates", async (req, res, next) => {
  try {
    res.json(serializeDates(await buildReconciliationCandidates(stringParam(req.query.targetType), stringParam(req.query.q))));
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.get("/reconciliation/queue", async (_req, res, next) => {
  try {
    res.json(serializeDates(await buildReconciliationQueue()));
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.post("/reconciliation/suggestions/refresh", async (_req, res, next) => {
  try {
    res.json(serializeDates(await enrichReconciliationSuggestions(await refreshReconciliationSuggestions())));
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.post("/reconciliation/suggestions/:id/accept", async (req, res, next) => {
  try {
    const suggestion = await prisma.reconciliationSuggestion.update({ where: { id: req.params.id }, data: { status: "accepted", resolvedAt: new Date(), resolvedBy: req.body.resolvedBy } });
    const reconciliation = await upsertFinancialReconciliation(await buildFinancialReconciliationData(suggestion, req.body));
    await prisma.bankTransaction.update({ where: { id: suggestion.transactionId }, data: { reconciliationStatus: "reconciled", confidenceScore: suggestion.confidenceScore } });
    res.json(serializeDates({ suggestion, reconciliation }));
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.post("/reconciliation/suggestions/:id/reject", async (req, res, next) => updateStatus(prisma.reconciliationSuggestion, req.params.id, { status: "rejected", resolvedAt: new Date(), resolvedBy: req.body.resolvedBy }, res, next));
connectedFinanceRouter.post("/reconciliation/suggestions/:id/match", async (req, res, next) => {
  try {
    const suggestion = await prisma.reconciliationSuggestion.update({
      where: { id: req.params.id },
      data: {
        targetType: req.body.targetType,
        targetId: req.body.targetId,
        confidenceScore: 1,
        status: "accepted",
        resolvedAt: new Date(),
        resolvedBy: req.body.resolvedBy
      }
    });
    const reconciliation = await upsertFinancialReconciliation(await buildFinancialReconciliationData(suggestion, req.body));
    await prisma.bankTransaction.update({ where: { id: suggestion.transactionId }, data: { reconciliationStatus: "reconciled", confidenceScore: 1 } });
    res.json(serializeDates({ suggestion, reconciliation }));
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.post("/reconciliation/transactions/:id/match", async (req, res, next) => {
  try {
    const transaction = await prisma.bankTransaction.findUnique({ where: { id: req.params.id } });
    if (!transaction) return res.status(404).json({ error: "Transaction not found" });
    const suggestion = await prisma.reconciliationSuggestion.create({
      data: {
        organizationId: transaction.organizationId,
        transactionId: transaction.id,
        targetType: stringParam(req.body.targetType) ?? "manual",
        targetId: stringParam(req.body.targetId),
        confidenceScore: 1,
        reason: stringParam(req.body.notes) ?? "Rapprochement manuel",
        status: "accepted",
        resolvedAt: new Date(),
        resolvedBy: stringParam(req.body.resolvedBy)
      }
    });
    await prisma.reconciliationSuggestion.updateMany({
      where: { transactionId: transaction.id, status: "pending", id: { not: suggestion.id } },
      data: { status: "rejected", resolvedAt: new Date(), resolvedBy: stringParam(req.body.resolvedBy) }
    });
    const reconciliation = await upsertFinancialReconciliation(await buildFinancialReconciliationData(suggestion, req.body));
    await prisma.bankTransaction.update({ where: { id: transaction.id }, data: { reconciliationStatus: "reconciled", confidenceScore: 1 } });
    res.json(serializeDates({ suggestion, reconciliation }));
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.post("/reconciliation/transactions/:id/ignore", async (req, res, next) => {
  try {
    const transaction = await prisma.bankTransaction.update({ where: { id: req.params.id }, data: { reconciliationStatus: "ignored" } });
    await prisma.reconciliationSuggestion.updateMany({
      where: { transactionId: transaction.id, status: "pending" },
      data: { status: "rejected", resolvedAt: new Date(), resolvedBy: stringParam(req.body.resolvedBy) }
    });
    res.json(serializeDates(transaction));
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.get("/reconciliation/financial", async (_req, res, next) => {
  try {
    res.json(serializeDates(await prisma.financialReconciliation.findMany({ orderBy: { createdAt: "desc" } })));
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.post("/reconciliation/financial", async (req, res, next) => {
  try {
    res.status(201).json(serializeDates(await prisma.financialReconciliation.create({ data: sanitize(req.body) as any })));
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.post("/reconciliation/financial/:id/cancel", async (req, res, next) => updateStatus(prisma.financialReconciliation, req.params.id, { status: "cancelled", cancelledAt: new Date() }, res, next));
connectedFinanceRouter.get("/reconciliation/chains", async (_req, res, next) => {
  try {
    const [forecasts, invoices, payments, reconciliations] = await Promise.all([
      prisma.invoiceForecast.findMany(),
      prisma.invoice.findMany(),
      prisma.payment.findMany(),
      prisma.financialReconciliation.findMany()
    ]);
    res.json(serializeDates({ forecasts, invoices, payments, reconciliations }));
  } catch (error) {
    next(error);
  }
});

connectedFinanceRouter.get("/client-payment-profiles", async (_req, res, next) => {
  try {
    const rows = await prisma.clientPaymentProfile.findMany({ orderBy: { reliabilityScore: "asc" } });
    const clientIds = rows.map((row) => row.clientId);
    const clients = await prisma.client.findMany({ where: { id: { in: clientIds } } });
    const clientsById = new Map(clients.map((client) => [client.id, client.name]));
    res.json(serializeDates(rows.map((row) => ({ ...row, clientName: clientsById.get(row.clientId) ?? row.clientId }))));
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.get("/client-payment-profiles/:clientId", async (req, res, next) => {
  try {
    const row = await prisma.clientPaymentProfile.findUnique({ where: { clientId: req.params.clientId } });
    if (!row) return res.status(404).json({ error: "Profile not found" });
    const client = await prisma.client.findUnique({ where: { id: row.clientId } });
    res.json(serializeDates({ ...row, clientName: client?.name ?? row.clientId }));
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.post("/client-payment-profiles/recalculate", async (_req, res, next) => {
  try {
    res.json(await recalculateClientPaymentProfiles());
  } catch (error) {
    next(error);
  }
});

connectedFinanceRouter.post("/reforecast/recalculate", async (req, res, next) => {
  try {
    const result = await runReforecastJob({
      scenarioId: req.body.scenarioId,
      horizon: req.body.horizon,
      materialityThreshold: req.body.materialityThreshold,
      triggeredBy: "user",
      triggeredByUserId: req.body.triggeredByUserId,
      correlationId: req.correlationId
    });
    res.status(202).json(result);
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.post("/reforecast/suggestions/:id/accept", (req, res, next) => updateStatus(prisma.reforecastSuggestion, req.params.id, { status: "accepted", resolvedAt: new Date(), resolvedBy: req.body.resolvedBy }, res, next));
connectedFinanceRouter.post("/reforecast/suggestions/:id/reject", (req, res, next) => updateStatus(prisma.reforecastSuggestion, req.params.id, { status: "rejected", resolvedAt: new Date(), resolvedBy: req.body.resolvedBy }, res, next));

connectedFinanceRouter.get("/forecast-reliability", async (_req, res, next) => {
  try {
    res.json(serializeDates(await prisma.forecastReliabilityScore.findMany({ orderBy: { month: "asc" } })));
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.post("/forecast-reliability/recalculate", async (req, res, next) => {
  try {
    res.json(await recalculateForecastReliability(req.body.scenarioId, req.body.horizon));
  } catch (error) {
    next(error);
  }
});

connectedFinanceRouter.get("/treasury/actual-vs-forecast", async (req, res, next) => {
  try {
    res.json((await buildConnectedFinanceOverview(stringParam(req.query.scenarioId), numberParam(req.query.horizon))).treasury);
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.get("/treasury/runway", async (req, res, next) => {
  try {
    res.json(await buildRunway(stringParam(req.query.scenarioId), numberParam(req.query.horizon)));
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.get("/treasury/recalibrated", async (req, res, next) => {
  try {
    res.json((await buildConnectedFinanceOverview(stringParam(req.query.scenarioId), numberParam(req.query.horizon))).treasury);
  } catch (error) {
    next(error);
  }
});

connectedFinanceRouter.get("/financial-anomalies", async (_req, res, next) => {
  try {
    res.json(serializeDates(await prisma.financialAnomaly.findMany({ orderBy: { detectedAt: "desc" } })));
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.post("/financial-anomalies/detect", async (_req, res, next) => {
  try {
    res.json(await detectAndStoreAnomalies());
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.post("/financial-anomalies/:id/review", (req, res, next) => updateStatus(prisma.financialAnomaly, req.params.id, { status: "reviewed" }, res, next));
connectedFinanceRouter.post("/financial-anomalies/:id/resolve", (req, res, next) => updateStatus(prisma.financialAnomaly, req.params.id, { status: "resolved", resolvedAt: new Date(), resolvedBy: req.body.resolvedBy }, res, next));
connectedFinanceRouter.post("/financial-anomalies/:id/ignore", (req, res, next) => updateStatus(prisma.financialAnomaly, req.params.id, { status: "ignored", resolvedAt: new Date(), resolvedBy: req.body.resolvedBy }, res, next));

connectedFinanceRouter.get("/data-quality", async (_req, res, next) => {
  try {
    const issues = await prisma.dataQualityIssue.findMany({ orderBy: { createdAt: "desc" } });
    res.json(serializeDates({ issues, score: Math.max(0, 100 - issues.filter((issue) => issue.status === "open").length * 8) }));
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.post("/data-quality/recalculate", async (_req, res, next) => {
  try {
    res.json(await recalculateDataQuality());
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.post("/data-quality/issues/:id/resolve", (req, res, next) => updateStatus(prisma.dataQualityIssue, req.params.id, { status: "fixed", resolvedAt: new Date() }, res, next));
connectedFinanceRouter.post("/data-quality/issues/:id/ignore", (req, res, next) => updateStatus(prisma.dataQualityIssue, req.params.id, { status: "ignored", resolvedAt: new Date() }, res, next));

connectedFinanceRouter.get("/reports/codir.json", async (req, res, next) => {
  try {
    res.json(await generateCodirReport(String(req.query.month ?? new Date().toISOString().slice(0, 7)), stringParam(req.query.scenarioId), numberParam(req.query.horizon)));
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.get("/reports/codir.pdf", async (req, res, next) => {
  try {
    const report = await generateCodirReport(String(req.query.month ?? new Date().toISOString().slice(0, 7)), stringParam(req.query.scenarioId), numberParam(req.query.horizon));
    const pdf = buildCodirPdf(report);
    res
      .type("application/pdf")
      .setHeader("Content-Disposition", "inline; filename=\"codir-report.pdf\"")
      .setHeader("Cache-Control", "no-store")
      .send(pdf);
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.post("/reports/codir/generate", async (req, res, next) => {
  try {
    res.status(201).json(await generateCodirReport(req.body.month ?? new Date().toISOString().slice(0, 7), req.body.scenarioId, req.body.horizon));
  } catch (error) {
    next(error);
  }
});

connectedFinanceRouter.post("/ai/analyze/cash-variance", async (req, res, next) => {
  try {
    const situation = await buildConnectedFinanceOverview(req.body.scenarioId, req.body.horizon);
    res.json({ answer: "Les écarts cash sont calculés à partir du solde bancaire réel et de la projection.", sourceFacts: situation.treasury, recommendations: situation.runway.recommendedActions });
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.post("/ai/analyze/connector-health", async (_req, res, next) => {
  try {
    const situation = await buildConnectedFinanceOverview();
    res.json({ answer: "état des connecteurs calcule sans exposer de secret.", connectorHealth: situation.connectorHealth });
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.post("/ai/analyze/codir", async (req, res, next) => {
  try {
    const report = await generateCodirReport(req.body.month ?? new Date().toISOString().slice(0, 7), req.body.scenarioId, req.body.horizon);
    res.json({ summary: "Synthèse CODIR générée à partir du réel bancaire, des écarts et du runway.", source: report.payload });
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.post("/ai/create-reconciliation-draft", async (_req, res, next) => {
  try {
    res.status(201).json(await refreshReconciliationSuggestions());
  } catch (error) {
    next(error);
  }
});
connectedFinanceRouter.post("/ai/create-reforecast-draft", async (req, res, next) => {
  try {
    const situation = await buildConnectedFinanceOverview(req.body.scenarioId, req.body.horizon);
    res.status(201).json({ drafts: situation.treasury.filter((row) => Math.abs(row.variance) > 5000) });
  } catch (error) {
    next(error);
  }
});

connectedFinanceRouter.get("/audit/financial", async (_req, res, next) => {
  try {
    res.json(serializeDates(await prisma.auditLog.findMany({ where: { entityType: { contains: "financial" } }, orderBy: { createdAt: "desc" } })));
  } catch (error) {
    next(error);
  }
});

function buildWhere(query: Record<string, unknown>) {
  const where: Record<string, unknown> = {};
  for (const key of ["organizationId", "companyId", "status", "bankAccountId", "categoryId", "categorizationStatus", "reconciliationStatus", "type", "provider"]) {
    if (query[key]) where[key] = String(query[key]);
  }
  return Object.keys(where).length ? where : undefined;
}

async function enrichReconciliationSuggestions(rows: any[]) {
  const [transactions, accounts, invoices, payments, fixedCosts, variableCosts] = await Promise.all([
    prisma.bankTransaction.findMany({ where: { id: { in: unique(rows.map((row) => row.transactionId)) } } }),
    prisma.bankAccount.findMany(),
    prisma.invoice.findMany({ where: { id: { in: unique(rows.filter((row) => row.targetType === "invoice").map((row) => row.targetId).filter(Boolean)) } } }),
    prisma.payment.findMany({ where: { id: { in: unique(rows.filter((row) => row.targetType === "payment").map((row) => row.targetId).filter(Boolean)) } } }),
    prisma.fixedCost.findMany({ where: { id: { in: unique(rows.filter((row) => row.targetType === "fixed_cost").map((row) => row.targetId).filter(Boolean)) } } }),
    prisma.variableCost.findMany({ where: { id: { in: unique(rows.filter((row) => row.targetType === "variable_cost").map((row) => row.targetId).filter(Boolean)) } } })
  ]);
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const transactionById = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  const targetLabels = buildTargetLabelMap({ invoices, payments, fixedCosts, variableCosts });
  return rows.map((row) => {
    const transaction = transactionById.get(row.transactionId);
    const targetKey = targetMapKey(row.targetType, row.targetId);
    return {
      ...row,
      transactionLabel: transaction ? formatTransactionLabel(transaction, accountById.get(transaction.bankAccountId)) : row.transactionId,
      transactionDate: transaction?.transactionDate,
      transactionAmount: transaction?.amount,
      transactionCounterparty: transaction?.counterpartyName,
      transactionAccountName: transaction ? accountById.get(transaction.bankAccountId)?.name : undefined,
      targetLabel: targetLabels.get(targetKey) ?? formatTargetFallback(row.targetType, row.targetId),
      targetTypeLabel: targetTypeLabel(row.targetType)
    };
  });
}

async function buildReconciliationQueue() {
  const pendingTransactions = await prisma.bankTransaction.findMany({
    where: { reconciliationStatus: { in: ["unreconciled", "suggested"] }, status: { not: "cancelled" } },
    orderBy: [{ transactionDate: "desc" }, { amount: "desc" }],
    take: 300
  });
  const pendingTransactionIds = unique(pendingTransactions.map((transaction) => transaction.id));
  let suggestions = await prisma.reconciliationSuggestion.findMany({
    where: { transactionId: { in: pendingTransactionIds }, status: "pending" },
    orderBy: { confidenceScore: "desc" }
  });
  if (pendingTransactions.length && suggestions.length === 0) {
    await refreshReconciliationSuggestions();
    suggestions = await prisma.reconciliationSuggestion.findMany({
      where: { transactionId: { in: pendingTransactionIds }, status: "pending" },
      orderBy: { confidenceScore: "desc" }
    });
  }
  const enrichedSuggestions = await enrichReconciliationSuggestions(suggestions);
  const suggestionsByTransaction = new Map<string, any[]>();
  for (const suggestion of enrichedSuggestions) {
    const bucket = suggestionsByTransaction.get(suggestion.transactionId) ?? [];
    bucket.push(suggestion);
    suggestionsByTransaction.set(suggestion.transactionId, bucket);
  }
  const accounts = await prisma.bankAccount.findMany({ where: { id: { in: unique(pendingTransactions.map((transaction) => transaction.bankAccountId)) } } });
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const items = pendingTransactions.map((transaction) => {
    const transactionSuggestions = suggestionsByTransaction.get(transaction.id) ?? [];
    const bestSuggestion = transactionSuggestions[0];
    const absoluteAmount = Math.abs(transaction.amount);
    const priority = absoluteAmount >= 10000 || !bestSuggestion ? "high" : absoluteAmount >= 2500 ? "medium" : "normal";
    return {
      id: transaction.id,
      transactionId: transaction.id,
      transactionLabel: formatTransactionLabel(transaction, accountById.get(transaction.bankAccountId)),
      transactionDate: transaction.transactionDate,
      transactionAmount: transaction.amount,
      transactionDirection: transaction.direction,
      transactionCounterparty: transaction.counterpartyName,
      transactionAccountName: accountById.get(transaction.bankAccountId)?.name,
      reconciliationStatus: transaction.reconciliationStatus,
      priority,
      queueStatus: bestSuggestion ? "suggested" : "manual_review",
      ageDays: daysBetween(new Date(), transaction.transactionDate),
      suggestionCount: transactionSuggestions.length,
      bestSuggestion,
      suggestions: transactionSuggestions
    };
  });
  return {
    summary: {
      total: items.length,
      suggested: items.filter((item) => item.queueStatus === "suggested").length,
      manualReview: items.filter((item) => item.queueStatus === "manual_review").length,
      highPriority: items.filter((item) => item.priority === "high").length,
      amountToProcess: items.reduce((sum, item) => sum + Math.abs(item.transactionAmount ?? 0), 0)
    },
    items
  };
}

async function buildReconciliationCandidates(targetType?: string, q?: string) {
  const [invoices, payments, fixedCosts, variableCosts] = await Promise.all([
    !targetType || targetType === "invoice" ? prisma.invoice.findMany({ orderBy: { invoiceDate: "desc" }, take: 200 }) : Promise.resolve([]),
    !targetType || targetType === "payment" ? prisma.payment.findMany({ orderBy: { paymentDate: "desc" }, take: 200 }) : Promise.resolve([]),
    !targetType || targetType === "fixed_cost" ? prisma.fixedCost.findMany({ orderBy: { startDate: "desc" }, take: 200 }) : Promise.resolve([]),
    !targetType || targetType === "variable_cost" ? prisma.variableCost.findMany({ orderBy: { date: "desc" }, take: 200 }) : Promise.resolve([])
  ]);
  const candidates = [
    ...invoices.map((row) => ({ targetType: "invoice", targetId: row.id, label: invoiceLabel(row), amount: row.amountTTC, date: row.invoiceDate })),
    ...payments.map((row) => ({ targetType: "payment", targetId: row.id, label: paymentLabel(row), amount: row.amount, date: row.paymentDate })),
    ...fixedCosts.map((row) => ({ targetType: "fixed_cost", targetId: row.id, label: fixedCostLabel(row), amount: row.monthlyAmount, date: row.startDate })),
    ...variableCosts.map((row) => ({ targetType: "variable_cost", targetId: row.id, label: variableCostLabel(row), amount: row.amount, date: row.date }))
  ];
  const needle = q?.toLowerCase().trim();
  return needle ? candidates.filter((candidate) => candidate.label.toLowerCase().includes(needle)) : candidates;
}

async function upsertFinancialReconciliation(data: any) {
  const existing = await prisma.financialReconciliation.findFirst({
    where: { transactionId: data.transactionId, status: "reconciled" },
    orderBy: { createdAt: "desc" }
  });
  if (existing) {
    return prisma.financialReconciliation.update({ where: { id: existing.id }, data });
  }
  return prisma.financialReconciliation.create({ data });
}

async function buildFinancialReconciliationData(suggestion: any, body: Record<string, unknown>) {
  const transaction = await prisma.bankTransaction.findUnique({ where: { id: suggestion.transactionId } });
  const target = await getReconciliationTarget(suggestion.targetType, suggestion.targetId);
  const targetAmount = target?.amount ?? Math.abs(transaction?.amount ?? 0);
  const targetDate = target?.date;
  return {
    organizationId: suggestion.organizationId,
    transactionId: suggestion.transactionId,
    targetType: suggestion.targetType,
    targetId: suggestion.targetId,
    amountMatched: numberParam(body.amountMatched) ?? Math.min(Math.abs(transaction?.amount ?? targetAmount), Math.abs(targetAmount)),
    dateVarianceDays: targetDate && transaction ? daysBetween(transaction.transactionDate, targetDate) : 0,
    amountVariance: transaction ? Math.abs(transaction.amount) - Math.abs(targetAmount) : 0,
    confidenceScore: suggestion.confidenceScore,
    matchedBy: stringParam(body.matchedBy) ?? "user",
    status: "reconciled",
    notes: stringParam(body.notes)
  };
}

async function getReconciliationTarget(targetType: string, targetId?: string | null) {
  if (!targetId) return undefined;
  if (targetType === "invoice") {
    const row = await prisma.invoice.findUnique({ where: { id: targetId } });
    return row ? { amount: row.amountTTC, date: row.dueDate } : undefined;
  }
  if (targetType === "payment") {
    const row = await prisma.payment.findUnique({ where: { id: targetId } });
    return row ? { amount: row.amount, date: row.paymentDate } : undefined;
  }
  if (targetType === "fixed_cost") {
    const row = await prisma.fixedCost.findUnique({ where: { id: targetId } });
    return row ? { amount: row.monthlyAmount, date: row.startDate } : undefined;
  }
  if (targetType === "variable_cost") {
    const row = await prisma.variableCost.findUnique({ where: { id: targetId } });
    return row ? { amount: row.amount, date: row.date } : undefined;
  }
  return undefined;
}

function buildTargetLabelMap(groups: { invoices: any[]; payments: any[]; fixedCosts: any[]; variableCosts: any[] }) {
  const labels = new Map<string, string>();
  groups.invoices.forEach((row) => labels.set(targetMapKey("invoice", row.id), invoiceLabel(row)));
  groups.payments.forEach((row) => labels.set(targetMapKey("payment", row.id), paymentLabel(row)));
  groups.fixedCosts.forEach((row) => labels.set(targetMapKey("fixed_cost", row.id), fixedCostLabel(row)));
  groups.variableCosts.forEach((row) => labels.set(targetMapKey("variable_cost", row.id), variableCostLabel(row)));
  return labels;
}

function invoiceLabel(row: any) {
  return `${row.invoiceNumber ?? "Facture"} - ${moneyLabel(row.amountTTC)} - ${dateLabel(row.invoiceDate)}`;
}

function paymentLabel(row: any) {
  return `Paiement ${dateLabel(row.paymentDate)} - ${moneyLabel(row.amount)}`;
}

function fixedCostLabel(row: any) {
  return `${row.label ?? "Frais fixe"} - ${moneyLabel(row.monthlyAmount)}`;
}

function variableCostLabel(row: any) {
  return `${row.label ?? "Frais variable"} - ${moneyLabel(row.amount)} - ${dateLabel(row.date)}`;
}

function formatTransactionLabel(transaction: any, account?: any) {
  return `${dateLabel(transaction.transactionDate)} - ${transaction.label} - ${moneyLabel(transaction.amount)}${account?.name ? ` - ${account.name}` : ""}`;
}

function targetMapKey(targetType: string, targetId?: string | null) {
  return `${targetType}:${targetId ?? ""}`;
}

function formatTargetFallback(targetType: string, targetId?: string | null) {
  return targetId ? `${targetTypeLabel(targetType)} ${targetId}` : targetTypeLabel(targetType);
}

function targetTypeLabel(value: string) {
  const labels: Record<string, string> = { invoice: "Facture", payment: "Paiement", fixed_cost: "Frais fixe", variable_cost: "Frais variable", tax: "Taxe", manual: "Manuel" };
  return labels[value] ?? value;
}

function moneyLabel(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value ?? 0);
}

function dateLabel(value: Date | string) {
  return new Date(value).toISOString().slice(0, 10);
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function daysBetween(left: Date, right: Date) {
  return Math.round((left.getTime() - right.getTime()) / 86400000);
}

function sanitize(data: Record<string, unknown>) {
  const copy = { ...data };
  delete copy.id;
  delete copy.createdAt;
  delete copy.updatedAt;
  return copy;
}

async function updateStatus(model: any, id: string, data: Record<string, unknown>, res: any, next: any) {
  try {
    res.json(serializeDates(await model.update({ where: { id }, data })));
  } catch (error) {
    next(error);
  }
}

function parseCsv(csv: string) {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const separator = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(separator).map((header) => header.trim());
  return lines.slice(1).map((line) => Object.fromEntries(line.split(separator).map((value, index) => [headers[index], value.trim()])));
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function stringParam(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function numberParam(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return typeof value === "string" && value ? Number(value) : undefined;
}
