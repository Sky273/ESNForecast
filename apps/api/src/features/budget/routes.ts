import { Router } from "express";
import { prisma } from "../../db";
import { ApiError } from "../../middleware/requestContext";
import { buildBudgetForecastActualPdf } from "../reports/executivePdfReport";
import { buildBudgetVariance, buildWhatMustBeTrue, calculateAnnualLanding, calculateBudgetStaffing, calculateRequiredPipeline } from "./budgetService";

const db = prisma as any;
export const budgetRouter = Router();
const take = (value: unknown, fallback = 100) => Math.min(Number(value ?? fallback) || fallback, 500);
const fiscalYear = (value: unknown) => Number(value ?? 2026) || 2026;

async function context() {
  const [organization, company] = await Promise.all([
    db.organization.findFirst({ orderBy: { createdAt: "asc" } }),
    db.company.findFirst({ orderBy: { name: "asc" } })
  ]);
  if (!organization || !company) throw new ApiError(404, "NOT_FOUND", "Organisation ou societe introuvable.", { action: "Exécuter le seed démo." });
  return { organization, company };
}

async function getReferenceBudget(year: number, budgetId?: string) {
  const budget = budgetId
    ? await db.budget.findUnique({ where: { id: budgetId } })
    : await db.budget.findFirst({ where: { fiscalYear: year, isReference: true }, orderBy: { versionNumber: "desc" } });
  if (!budget) throw new ApiError(404, "NOT_FOUND", "Budget de reference introuvable.");
  return budget;
}

const numberParam = (value: unknown, fallback: number) => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
};

async function requiredPipelinePayload(source: Record<string, unknown>) {
  const year = fiscalYear(source.fiscalYear);
  const budget = await getReferenceBudget(year, typeof source.budgetId === "string" ? source.budgetId : undefined);
  const [budgetLines, actuals] = await Promise.all([
    db.budgetLine.findMany({ where: { budgetId: budget.id, category: "revenue" } }),
    db.monthlyActual.findMany({ where: { year } })
  ]);
  const targetRevenue = budgetLines.reduce((total: number, line: any) => total + line.amount, 0);
  const calculation = calculateRequiredPipeline({
    targetRevenue,
    actualRevenue: actuals.reduce((total: number, actual: any) => total + actual.actualRevenueGenerated, 0),
    signedRemainingRevenue: numberParam(source.signedRemainingRevenue, 840000),
    weightedPipelineRevenue: numberParam(source.weightedPipelineRevenue, 210000),
    conversionRate: numberParam(source.conversionRate, 0.35),
    averageOpportunityAmount: numberParam(source.averageOpportunityAmount, 85000)
  });
  return { budget, calculation, fiscalYear: year };
}

budgetRouter.get("/budgets", async (req, res, next) => {
  try {
    const where = typeof req.query.fiscalYear === "string" ? { fiscalYear: fiscalYear(req.query.fiscalYear) } : {};
    res.json(await db.budget.findMany({ where, orderBy: [{ fiscalYear: "desc" }, { versionNumber: "desc" }], take: take(req.query.take) }));
  } catch (error) {
    next(error);
  }
});

budgetRouter.post("/budgets", async (req, res, next) => {
  try {
    const { organization, company } = await context();
    res.status(201).json(await db.budget.create({
      data: {
        organizationId: req.body?.organizationId ?? organization.id,
        companyId: req.body?.companyId ?? company.id,
        fiscalYear: fiscalYear(req.body?.fiscalYear),
        name: req.body?.name ?? "Nouveau budget",
        description: req.body?.description,
        status: req.body?.status ?? "draft",
        versionNumber: req.body?.versionNumber ?? 1,
        budgetType: req.body?.budgetType ?? "initial",
        createdBy: req.body?.createdBy ?? "admin"
      }
    }));
  } catch (error) {
    next(error);
  }
});

budgetRouter.get("/budgets/:id", async (req, res, next) => {
  try {
    const budget = await db.budget.findUnique({ where: { id: req.params.id } });
    if (!budget) throw new ApiError(404, "NOT_FOUND", "Budget introuvable.");
    const lines = await db.budgetLine.findMany({ where: { budgetId: budget.id }, orderBy: [{ year: "asc" }, { month: "asc" }, { category: "asc" }] });
    res.json({ ...budget, lines });
  } catch (error) {
    next(error);
  }
});

budgetRouter.put("/budgets/:id", async (req, res, next) => {
  try {
    const current = await db.budget.findUnique({ where: { id: req.params.id } });
    if (!current) throw new ApiError(404, "NOT_FOUND", "Budget introuvable.");
    if (current.status === "locked" || current.status === "approved") throw new ApiError(409, "CONFLICT", "Un budget validé ou verrouillé ne peut pas être modifié directement.", { action: "Dupliquer le budget pour créer une nouvelle version." });
    res.json(await db.budget.update({ where: { id: req.params.id }, data: req.body }));
  } catch (error) {
    next(error);
  }
});

budgetRouter.delete("/budgets/:id", async (req, res, next) => {
  try {
    await db.$transaction([
      db.budgetLine.deleteMany({ where: { budgetId: req.params.id } }),
      db.rollingForecast.updateMany({ where: { sourceBudgetId: req.params.id }, data: { sourceBudgetId: null } }),
      db.budget.delete({ where: { id: req.params.id } })
    ]);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

budgetRouter.post("/budgets/:id/duplicate", async (req, res, next) => {
  try {
    const current = await db.budget.findUnique({ where: { id: req.params.id } });
    if (!current) throw new ApiError(404, "NOT_FOUND", "Budget introuvable.");
    const duplicate = await db.budget.create({ data: { ...current, id: undefined, name: req.body?.name ?? `${current.name} - revision`, status: "draft", budgetType: "revised", versionNumber: current.versionNumber + 1, isReference: false, approvedAt: null, lockedAt: null, approvedBy: null, lockedBy: null, createdAt: undefined, updatedAt: undefined } });
    const lines = await db.budgetLine.findMany({ where: { budgetId: current.id } });
    await db.budgetLine.createMany({ data: lines.map((line: any) => ({ ...line, id: undefined, budgetId: duplicate.id, createdAt: undefined, updatedAt: undefined })) });
    res.status(201).json(duplicate);
  } catch (error) {
    next(error);
  }
});

for (const [path, status, dateField] of [["submit-review", "in_review", null], ["approve", "approved", "approvedAt"], ["lock", "locked", "lockedAt"], ["archive", "archived", null]] as const) {
  budgetRouter.post(`/budgets/:id/${path}`, async (req, res, next) => {
    try {
      res.json(await db.budget.update({ where: { id: req.params.id }, data: { status, [dateField ?? "updatedAt"]: new Date(), approvedBy: status === "approved" ? "direction" : undefined, lockedBy: status === "locked" ? "direction" : undefined } }));
    } catch (error) {
      next(error);
    }
  });
}

budgetRouter.get("/budgets/:id/lines", async (req, res, next) => {
  try {
    res.json(await db.budgetLine.findMany({ where: { budgetId: req.params.id }, orderBy: [{ year: "asc" }, { month: "asc" }, { category: "asc" }] }));
  } catch (error) {
    next(error);
  }
});

budgetRouter.post("/budgets/:id/lines", async (req, res, next) => {
  try {
    res.status(201).json(await db.budgetLine.create({ data: { ...req.body, budgetId: req.params.id } }));
  } catch (error) {
    next(error);
  }
});

budgetRouter.put("/budget-lines/:id", async (req, res, next) => {
  try {
    res.json(await db.budgetLine.update({ where: { id: req.params.id }, data: req.body }));
  } catch (error) {
    next(error);
  }
});

budgetRouter.delete("/budget-lines/:id", async (req, res, next) => {
  try {
    await db.budgetLine.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

budgetRouter.post("/budgets/:id/import-csv", async (req, res) => res.json({ budgetId: req.params.id, acceptedRows: req.body?.rows?.length ?? 0, rejectedRows: 0, status: "validated" }));

budgetRouter.post("/budgets/:id/generate", async (req, res, next) => {
  try {
    const budget = await db.budget.findUnique({ where: { id: req.params.id } });
    if (!budget) throw new ApiError(404, "NOT_FOUND", "Budget introuvable.");
    const growth = Number(req.body?.revenueGrowth ?? 0.06);
    const monthlyRevenue = 185000 * (1 + growth);
    await db.budgetLine.deleteMany({ where: { budgetId: budget.id } });
    const data = Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      return [
        { budgetId: budget.id, year: budget.fiscalYear, month, category: "revenue", amount: monthlyRevenue, comment: "Genere depuis hypothese de croissance" },
        { budgetId: budget.id, year: budget.fiscalYear, month, category: "gross_margin", amount: monthlyRevenue * 0.29 },
        { budgetId: budget.id, year: budget.fiscalYear, month, category: "closing_cash", amount: 120000 + month * 4500 }
      ];
    }).flat();
    await db.budgetLine.createMany({ data });
    res.json({ budgetId: budget.id, generatedLines: data.length });
  } catch (error) {
    next(error);
  }
});

budgetRouter.get("/objectives", async (req, res, next) => {
  try {
    res.json(await db.objective.findMany({ where: typeof req.query.fiscalYear === "string" ? { fiscalYear: fiscalYear(req.query.fiscalYear) } : {}, orderBy: [{ fiscalYear: "desc" }, { type: "asc" }] }));
  } catch (error) {
    next(error);
  }
});

budgetRouter.post("/objectives", async (req, res, next) => {
  try {
    const { organization, company } = await context();
    res.status(201).json(await db.objective.create({ data: { organizationId: organization.id, companyId: company.id, fiscalYear: fiscalYear(req.body?.fiscalYear), name: req.body?.name, type: req.body?.type, targetValue: Number(req.body?.targetValue), unit: req.body?.unit ?? "amount", period: req.body?.period ?? "annual", status: req.body?.status ?? "active" } }));
  } catch (error) {
    next(error);
  }
});

budgetRouter.get("/objectives/status", async (req, res, next) => {
  try {
    const year = fiscalYear(req.query.fiscalYear);
    const objectives = await db.objective.findMany({ where: { fiscalYear: year } });
    const landing = await annualLandingPayload(year, typeof req.query.budgetId === "string" ? req.query.budgetId : undefined);
    res.json(objectives.map((objective: any) => {
      const currentValue = objective.type === "revenue" ? landing.projectedAnnualRevenue : objective.type === "cash" ? landing.projectedClosingCash : objective.type === "gross_margin" ? landing.projectedGrossMargin : objective.targetValue * 0.86;
      const ratio = objective.targetValue ? currentValue / objective.targetValue : 0;
      return { ...objective, currentValue, achievementRate: ratio, status: ratio >= 1 ? "achieved" : ratio >= 0.9 ? "at_risk" : "missed" };
    }));
  } catch (error) {
    next(error);
  }
});

budgetRouter.get("/objectives/:id", async (req, res, next) => {
  try {
    const objective = await db.objective.findUnique({ where: { id: req.params.id } });
    if (!objective) throw new ApiError(404, "NOT_FOUND", "Objectif introuvable.");
    res.json(objective);
  } catch (error) {
    next(error);
  }
});
budgetRouter.put("/objectives/:id", async (req, res, next) => { try { res.json(await db.objective.update({ where: { id: req.params.id }, data: req.body })); } catch (error) { next(error); } });
budgetRouter.delete("/objectives/:id", async (req, res, next) => { try { await db.objective.delete({ where: { id: req.params.id } }); res.status(204).send(); } catch (error) { next(error); } });

budgetRouter.get("/rolling-forecasts", async (_req, res, next) => { try { res.json(await db.rollingForecast.findMany({ orderBy: { generatedAt: "desc" } })); } catch (error) { next(error); } });
budgetRouter.post("/rolling-forecasts/generate", async (req, res, next) => {
  try {
    const { organization, company } = await context();
    const year = fiscalYear(req.body?.fiscalYear);
    const budget = await getReferenceBudget(year, req.body?.sourceBudgetId);
    const forecast = await db.rollingForecast.create({ data: { organizationId: organization.id, companyId: company.id, name: req.body?.name ?? `Rolling forecast ${year}`, baseMonth: req.body?.baseMonth ?? `${year}-07`, horizonMonths: Number(req.body?.horizonMonths ?? 12), sourceBudgetId: budget.id, status: "active", generatedBy: "finance" } });
    const budgetLines = await db.budgetLine.findMany({ where: { budgetId: budget.id } });
    await db.rollingForecastLine.createMany({ data: budgetLines.map((line: any) => ({ rollingForecastId: forecast.id, year: line.year, month: line.month, category: line.category, amount: line.month <= 6 ? line.amount * 0.92 : line.amount * 0.96, source: line.month <= 6 ? "actual" : "reforecast", confidenceScore: line.month <= 6 ? 0.95 : 0.72, comment: "Généré depuis budget et réel partiel" })) });
    res.status(201).json(forecast);
  } catch (error) {
    next(error);
  }
});
budgetRouter.get("/rolling-forecasts/:id", async (req, res, next) => { try { const forecast = await db.rollingForecast.findUnique({ where: { id: req.params.id } }); if (!forecast) throw new ApiError(404, "NOT_FOUND", "Rolling forecast introuvable."); res.json(forecast); } catch (error) { next(error); } });
budgetRouter.put("/rolling-forecasts/:id", async (req, res, next) => {
  try {
    res.json(await db.rollingForecast.update({
      where: { id: req.params.id },
      data: {
        name: req.body?.name,
        baseMonth: req.body?.baseMonth,
        horizonMonths: Number(req.body?.horizonMonths),
        status: req.body?.status,
        notes: req.body?.notes
      }
    }));
  } catch (error) {
    next(error);
  }
});
budgetRouter.get("/rolling-forecasts/:id/lines", async (req, res, next) => { try { res.json(await db.rollingForecastLine.findMany({ where: { rollingForecastId: req.params.id }, orderBy: [{ year: "asc" }, { month: "asc" }, { category: "asc" }] })); } catch (error) { next(error); } });
budgetRouter.post("/rolling-forecasts/:id/lines", async (req, res, next) => {
  try {
    res.status(201).json(await db.rollingForecastLine.create({
      data: {
        rollingForecastId: req.params.id,
        month: Number(req.body?.month),
        year: Number(req.body?.year),
        category: req.body?.category,
        amount: Number(req.body?.amount ?? 0),
        source: req.body?.source ?? "manual_override",
        confidenceScore: Number(req.body?.confidenceScore ?? 0.7),
        comment: req.body?.comment
      }
    }));
  } catch (error) {
    next(error);
  }
});
budgetRouter.put("/rolling-forecast-lines/:id", async (req, res, next) => {
  try {
    res.json(await db.rollingForecastLine.update({
      where: { id: req.params.id },
      data: {
        amount: Number(req.body?.amount),
        source: req.body?.source,
        confidenceScore: Number(req.body?.confidenceScore),
        comment: req.body?.comment
      }
    }));
  } catch (error) {
    next(error);
  }
});
budgetRouter.delete("/rolling-forecast-lines/:id", async (req, res, next) => {
  try {
    await db.rollingForecastLine.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
budgetRouter.post("/rolling-forecasts/:id/archive", async (req, res, next) => { try { res.json(await db.rollingForecast.update({ where: { id: req.params.id }, data: { status: "archived" } })); } catch (error) { next(error); } });
budgetRouter.delete("/rolling-forecasts/:id", async (req, res, next) => {
  try {
    await db.$transaction([
      db.rollingForecastLine.deleteMany({ where: { rollingForecastId: req.params.id } }),
      db.rollingForecast.delete({ where: { id: req.params.id } })
    ]);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

async function annualLandingPayload(year: number, budgetId?: string) {
  const budget = await getReferenceBudget(year, budgetId);
  const rolling = await db.rollingForecast.findFirst({ where: { sourceBudgetId: budget.id, status: "active" }, orderBy: { generatedAt: "desc" } });
  const [budgetLines, rollingLines, actuals] = await Promise.all([
    db.budgetLine.findMany({ where: { budgetId: budget.id } }),
    rolling ? db.rollingForecastLine.findMany({ where: { rollingForecastId: rolling.id } }) : Promise.resolve([]),
    db.monthlyActual.findMany({ where: { year } })
  ]);
  return calculateAnnualLanding({ fiscalYear: year, budgetLines, rollingLines, actuals });
}

budgetRouter.get("/annual-landing", async (req, res, next) => {
  try {
    res.json(await annualLandingPayload(fiscalYear(req.query.fiscalYear), typeof req.query.budgetId === "string" ? req.query.budgetId : undefined));
  } catch (error) {
    next(error);
  }
});

budgetRouter.get("/variance-analyses", async (req, res, next) => { try { res.json(await db.varianceAnalysis.findMany({ where: typeof req.query.fiscalYear === "string" ? { fiscalYear: fiscalYear(req.query.fiscalYear) } : {}, orderBy: [{ fiscalYear: "desc" }, { month: "asc" }] })); } catch (error) { next(error); } });
budgetRouter.post("/variance-analyses/recalculate", async (req, res, next) => {
  try {
    const year = fiscalYear(req.body?.fiscalYear);
    const budget = await getReferenceBudget(year, req.body?.budgetId);
    const rolling = await db.rollingForecast.findFirst({ where: { sourceBudgetId: budget.id, status: "active" }, orderBy: { generatedAt: "desc" } });
    const [budgetLines, rollingLines, actuals] = await Promise.all([
      db.budgetLine.findMany({ where: { budgetId: budget.id } }),
      rolling ? db.rollingForecastLine.findMany({ where: { rollingForecastId: rolling.id } }) : Promise.resolve([]),
      db.monthlyActual.findMany({ where: { year } })
    ]);
    res.json(buildBudgetVariance({ budgetLines, rollingLines, actuals }));
  } catch (error) {
    next(error);
  }
});
budgetRouter.get("/variance-analyses/:id", async (req, res, next) => { try { const variance = await db.varianceAnalysis.findUnique({ where: { id: req.params.id } }); if (!variance) throw new ApiError(404, "NOT_FOUND", "Ecart introuvable."); const [causes, comments] = await Promise.all([db.varianceCause.findMany({ where: { varianceAnalysisId: variance.id } }), db.varianceComment.findMany({ where: { varianceAnalysisId: variance.id } })]); res.json({ ...variance, causes, comments }); } catch (error) { next(error); } });
budgetRouter.put("/variance-analyses/:id", async (req, res, next) => { try { res.json(await db.varianceAnalysis.update({ where: { id: req.params.id }, data: req.body })); } catch (error) { next(error); } });
budgetRouter.delete("/variance-analyses/:id", async (req, res, next) => {
  try {
    await db.$transaction([
      db.varianceComment.deleteMany({ where: { varianceAnalysisId: req.params.id } }),
      db.varianceCause.deleteMany({ where: { varianceAnalysisId: req.params.id } }),
      db.varianceAnalysis.delete({ where: { id: req.params.id } })
    ]);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
budgetRouter.post("/variance-analyses/:id/comments", async (req, res, next) => { try { res.status(201).json(await db.varianceComment.create({ data: { varianceAnalysisId: req.params.id, userId: req.body?.userId ?? "finance", comment: req.body?.comment, visibility: req.body?.visibility ?? "internal" } })); } catch (error) { next(error); } });
budgetRouter.post("/variance-analyses/:id/causes", async (req, res, next) => { try { res.status(201).json(await db.varianceCause.create({ data: { varianceAnalysisId: req.params.id, causeType: req.body?.causeType ?? "other", description: req.body?.description, amountImpact: Number(req.body?.amountImpact ?? 0), confidenceScore: Number(req.body?.confidenceScore ?? 0.7) } })); } catch (error) { next(error); } });

budgetRouter.get("/action-plans", async (_req, res, next) => { try { res.json(await db.actionPlan.findMany({ orderBy: { createdAt: "desc" } })); } catch (error) { next(error); } });
budgetRouter.post("/action-plans", async (req, res, next) => { try { const { organization, company } = await context(); res.status(201).json(await db.actionPlan.create({ data: { organizationId: organization.id, companyId: company.id, fiscalYear: fiscalYear(req.body?.fiscalYear), title: req.body?.title, description: req.body?.description, status: req.body?.status ?? "active", ownerUserId: req.body?.ownerUserId ?? "direction" } })); } catch (error) { next(error); } });
budgetRouter.get("/action-plans/:id", async (req, res, next) => { try { const plan = await db.actionPlan.findUnique({ where: { id: req.params.id } }); if (!plan) throw new ApiError(404, "NOT_FOUND", "Plan d'action introuvable."); const items = await db.actionItem.findMany({ where: { actionPlanId: plan.id }, orderBy: { dueDate: "asc" } }); res.json({ ...plan, items }); } catch (error) { next(error); } });
budgetRouter.put("/action-plans/:id", async (req, res, next) => { try { res.json(await db.actionPlan.update({ where: { id: req.params.id }, data: req.body })); } catch (error) { next(error); } });
budgetRouter.delete("/action-plans/:id", async (req, res, next) => {
  try {
    await db.$transaction([
      db.actionItem.deleteMany({ where: { actionPlanId: req.params.id } }),
      db.actionPlan.delete({ where: { id: req.params.id } })
    ]);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
budgetRouter.post("/action-plans/:id/items", async (req, res, next) => { try { res.status(201).json(await db.actionItem.create({ data: { ...req.body, actionPlanId: req.params.id } })); } catch (error) { next(error); } });
budgetRouter.put("/action-items/:id", async (req, res, next) => { try { res.json(await db.actionItem.update({ where: { id: req.params.id }, data: req.body })); } catch (error) { next(error); } });
budgetRouter.delete("/action-items/:id", async (req, res, next) => { try { await db.actionItem.delete({ where: { id: req.params.id } }); res.status(204).send(); } catch (error) { next(error); } });
const completeActionItem = async (req: any, res: any, next: any) => { try { res.json(await db.actionItem.update({ where: { id: req.params.id }, data: { status: "done", actualImpactAmount: req.body?.actualImpactAmount } })); } catch (error) { next(error); } };
budgetRouter.post("/action-items/:id/complete", completeActionItem);
budgetRouter.post("/action-items/:id/complète", completeActionItem);
budgetRouter.post("/action-items/:id/cancel", async (req, res, next) => { try { res.json(await db.actionItem.update({ where: { id: req.params.id }, data: { status: "cancelled" } })); } catch (error) { next(error); } });

budgetRouter.get("/action-suggestions", async (_req, res, next) => { try { res.json(await db.actionSuggestion.findMany({ orderBy: [{ priority: "desc" }, { createdAt: "desc" }] })); } catch (error) { next(error); } });
budgetRouter.post("/action-suggestions/:id/accept", async (req, res, next) => { try { res.json(await db.actionSuggestion.update({ where: { id: req.params.id }, data: { status: "accepted", resolvedAt: new Date() } })); } catch (error) { next(error); } });
budgetRouter.post("/action-suggestions/:id/reject", async (req, res, next) => { try { res.json(await db.actionSuggestion.update({ where: { id: req.params.id }, data: { status: "rejected", resolvedAt: new Date() } })); } catch (error) { next(error); } });
budgetRouter.post("/action-suggestions/:id/convert-to-action", async (req, res, next) => {
  try {
    const suggestion = await db.actionSuggestion.update({ where: { id: req.params.id }, data: { status: "converted_to_action", resolvedAt: new Date() } });
    const { company } = await context();
    const plan = await db.actionPlan.findFirst({ where: { organizationId: suggestion.organizationId, fiscalYear: fiscalYear(req.body?.fiscalYear), status: "active" } });
    const targetPlan = plan ?? await db.actionPlan.create({ data: { organizationId: suggestion.organizationId, companyId: company.id, fiscalYear: fiscalYear(req.body?.fiscalYear), title: "Plan d'action budgetaire", status: "active", ownerUserId: "direction" } });
    res.status(201).json(await db.actionItem.create({ data: { actionPlanId: targetPlan.id, title: suggestion.title, description: suggestion.description, actionType: "custom", status: "todo", priority: suggestion.priority, expectedImpactAmount: suggestion.expectedImpactAmount, expectedImpactMonth: suggestion.expectedImpactMonth } }));
  } catch (error) {
    next(error);
  }
});

budgetRouter.get("/required-pipeline", async (req, res, next) => {
  try {
    const { calculation } = await requiredPipelinePayload(req.query as Record<string, unknown>);
    res.json(calculation);
  } catch (error) {
    next(error);
  }
});

budgetRouter.post("/required-pipeline/recalculate", async (req, res, next) => {
  try {
    const { budget, calculation, fiscalYear: year } = await requiredPipelinePayload(req.body ?? {});
    const snapshot = await db.requiredPipelineSnapshot.create({
      data: {
        organizationId: budget.organizationId,
        companyId: budget.companyId,
        fiscalYear: year,
        targetRevenue: calculation.targetRevenue,
        actualRevenue: calculation.actualRevenue,
        signedRemainingRevenue: calculation.signedRemainingRevenue,
        weightedPipelineRevenue: calculation.weightedPipelineRevenue,
        revenueGap: calculation.revenueGap,
        historicalConversionRate: calculation.historicalConversionRate,
        requiredGrossPipeline: calculation.requiredGrossPipeline,
        opportunitiesNeeded: calculation.opportunitiesNeeded,
        latestSignatureMonth: calculation.latestSignatureMonth,
        recommendations: calculation.recommendations
      }
    });
    res.status(201).json({ ...calculation, snapshotId: snapshot.id, calculatedAt: snapshot.calculatedAt });
  } catch (error) {
    next(error);
  }
});

budgetRouter.get("/budget-staffing", async (req, res, next) => {
  try {
    const year = fiscalYear(req.query.fiscalYear);
    const budget = await getReferenceBudget(year, typeof req.query.budgetId === "string" ? req.query.budgetId : undefined);
    const revenue = await db.budgetLine.aggregate({ where: { budgetId: budget.id, category: "revenue" }, _sum: { amount: true } });
    res.json(calculateBudgetStaffing({
      fiscalYear: year,
      budgetRevenue: revenue._sum.amount ?? 0,
      averageDailyRate: Number(req.query.averageDailyRate ?? 780),
      internalCapacityBeforeSeptember: Number(req.query.internalCapacityBeforeSeptember ?? 150),
      internalCapacityAfterSeptember: Number(req.query.internalCapacityAfterSeptember ?? 166),
      externalCapacityBeforeSeptember: Number(req.query.externalCapacityBeforeSeptember ?? 46),
      externalCapacityAfterSeptember: Number(req.query.externalCapacityAfterSeptember ?? 54)
    }));
  } catch (error) {
    next(error);
  }
});

budgetRouter.get("/what-must-be-true", async (req, res, next) => {
  try {
    const year = fiscalYear(req.query.fiscalYear);
    const stored = await db.whatMustBeTrueCondition.findMany({ where: { fiscalYear: year }, orderBy: { riskLevel: "desc" } });
    if (stored.length) return res.json(stored);
    const landing = await annualLandingPayload(year, typeof req.query.budgetId === "string" ? req.query.budgetId : undefined);
    res.json(buildWhatMustBeTrue(landing));
  } catch (error) {
    next(error);
  }
});
budgetRouter.post("/what-must-be-true", async (req, res, next) => {
  try {
    const { organization, company } = await context();
    res.status(201).json(await db.whatMustBeTrueCondition.create({
      data: {
        organizationId: organization.id,
        companyId: company.id,
        fiscalYear: fiscalYear(req.body?.fiscalYear),
        conditionType: req.body?.conditionType ?? "custom",
        description: req.body?.description,
        targetValue: req.body?.targetValue === "" ? null : Number(req.body?.targetValue ?? 0),
        currentValue: req.body?.currentValue === "" ? null : Number(req.body?.currentValue ?? 0),
        gap: req.body?.gap === "" ? null : Number(req.body?.gap ?? 0),
        riskLevel: req.body?.riskLevel ?? "medium",
        status: req.body?.status ?? "at_risk",
        relatedActions: req.body?.relatedActions ? String(req.body.relatedActions).split("\n").filter(Boolean) : []
      }
    }));
  } catch (error) {
    next(error);
  }
});
budgetRouter.put("/what-must-be-true/:id", async (req, res, next) => {
  try {
    res.json(await db.whatMustBeTrueCondition.update({
      where: { id: req.params.id },
      data: {
        conditionType: req.body?.conditionType,
        description: req.body?.description,
        targetValue: req.body?.targetValue === "" ? null : Number(req.body?.targetValue ?? 0),
        currentValue: req.body?.currentValue === "" ? null : Number(req.body?.currentValue ?? 0),
        gap: req.body?.gap === "" ? null : Number(req.body?.gap ?? 0),
        riskLevel: req.body?.riskLevel,
        status: req.body?.status,
        relatedActions: req.body?.relatedActions ? String(req.body.relatedActions).split("\n").filter(Boolean) : undefined
      }
    }));
  } catch (error) {
    next(error);
  }
});
budgetRouter.delete("/what-must-be-true/:id", async (req, res, next) => {
  try {
    await db.whatMustBeTrueCondition.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

budgetRouter.get("/reports/budget-forecast-actual.json", async (req, res, next) => {
  try {
    const year = fiscalYear(req.query.fiscalYear);
    const [landing, variances, actions, pipeline, staffing, conditions] = await Promise.all([
      annualLandingPayload(year, typeof req.query.budgetId === "string" ? req.query.budgetId : undefined),
      db.varianceAnalysis.findMany({ where: { fiscalYear: year }, take: 10 }),
      db.actionPlan.findMany({ where: { fiscalYear: year }, take: 10 }),
      Promise.resolve(null),
      db.budgetStaffingSnapshot.findMany({ where: { fiscalYear: year }, take: 12 }),
      db.whatMustBeTrueCondition.findMany({ where: { fiscalYear: year }, take: 10 })
    ]);
    res.json({ fiscalYear: year, landing, variances, actions, pipeline, staffing, conditions, generatedAt: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

budgetRouter.get("/reports/budget-forecast-actual.demo.csv", (_req, res) => {
  res.type("text/csv").send("section,metric,value\nlanding,status,generated\n");
});
budgetRouter.get("/reports/budget-forecast-actual.demo.pdf", (_req, res) => {
  res.type("application/pdf").send(Buffer.from("PDF démo Budget Forecast Actual"));
});

budgetRouter.get("/reports/budget-forecast-actual.csv", async (req, res, next) => {
  try {
    const year = fiscalYear(req.query.fiscalYear);
    const payload = await budgetForecastActualReport(year, typeof req.query.budgetId === "string" ? req.query.budgetId : undefined);
    const rows = [
      ["section", "metric", "value"],
      ["landing", "budgetRevenue", payload.landing.budgetRevenue],
      ["landing", "actualRevenueToDate", payload.landing.actualRevenueToDate],
      ["landing", "forecastRevenueRemaining", payload.landing.forecastRevenueRemaining],
      ["landing", "projectedAnnualRevenue", payload.landing.projectedAnnualRevenue],
      ["landing", "revenueGap", payload.landing.revenueGap],
      ["landing", "achievementProbability", payload.landing.achievementProbability],
      ...payload.variances.map((row: any) => ["variance", `${row.month ?? ""}-${row.category}`, row.varianceAmount]),
      ...payload.actions.map((row: any) => ["action", row.title, row.status])
    ];
    res.type("text/csv").send(rows.map((row) => row.map(csvCell).join(",")).join("\n"));
  } catch (error) {
    next(error);
  }
});

budgetRouter.get("/reports/budget-forecast-actual.pdf", async (req, res, next) => {
  try {
    const year = fiscalYear(req.query.fiscalYear);
    const payload = await budgetForecastActualReport(year, typeof req.query.budgetId === "string" ? req.query.budgetId : undefined);
    res.type("application/pdf").send(buildBudgetForecastActualPdf(payload));
  } catch (error) {
    next(error);
  }
});

async function budgetForecastActualReport(year: number, budgetId?: string) {
  const [landing, variances, actions, staffing, conditions] = await Promise.all([
    annualLandingPayload(year, budgetId),
    db.varianceAnalysis.findMany({ where: { fiscalYear: year }, orderBy: { updatedAt: "desc" }, take: 20 }),
    db.actionPlan.findMany({ where: { fiscalYear: year }, orderBy: { updatedAt: "desc" }, take: 20 }),
    db.budgetStaffingSnapshot.findMany({ where: { fiscalYear: year }, orderBy: [{ year: "asc" }, { month: "asc" }], take: 12 }),
    db.whatMustBeTrueCondition.findMany({ where: { fiscalYear: year }, orderBy: { updatedAt: "desc" }, take: 20 })
  ]);
  return { fiscalYear: year, landing, variances, actions, pipeline: null, staffing, conditions, generatedAt: new Date().toISOString() };
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

budgetRouter.post("/ai/analyze/budget", async (req, res, next) => {
  try {
    const landing = await annualLandingPayload(fiscalYear(req.body?.fiscalYear), req.body?.budgetId);
    res.json({ summary: `Atterrissage CA ${landing.projectedAnnualRevenue} EUR pour un budget ${landing.budgetRevenue} EUR.`, facts: landing.mainDrivers, recommendations: ["Prioriser pipeline manquant", "Suivre actions cash", "Commenter les écarts critiques"] });
  } catch (error) {
    next(error);
  }
});
budgetRouter.post("/ai/analyze/annual-landing", async (req, res, next) => { try { res.json(await annualLandingPayload(fiscalYear(req.body?.fiscalYear), req.body?.budgetId)); } catch (error) { next(error); } });
budgetRouter.post("/ai/analyze/variance", async (_req, res) => res.json({ summary: "Les écarts prioritaires portent sur le CA, la marge et le cash.", guardrail: "Analyse basée sur les écarts calculés et commentaires existants." }));
budgetRouter.post("/ai/generate/action-suggestions", async (_req, res) => res.json({ suggestions: ["Relancer factures en retard", "Securiser prolongations", "Reduire sous-traitance faible marge"] }));
budgetRouter.post("/ai/generate/budget-codir-summary", async (_req, res) => res.json({ title: "Synthèse CODIR budget vs réel", sections: ["Atterrissage", "Écarts", "Actions", "Conditions de réussite"] }));
