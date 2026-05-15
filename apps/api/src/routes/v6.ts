import { Router } from "express";
import { prisma } from "../db";
import { ApiError } from "../middleware/requestContext";
import { buildBudgetVariance, buildWhatMustBeTrue, calculateAnnualLanding, calculateBudgetStaffing, calculateRequiredPipeline } from "../services/v6BudgetService";

const db = prisma as any;
export const v6Router = Router();
const take = (value: unknown, fallback = 100) => Math.min(Number(value ?? fallback) || fallback, 500);
const fiscalYear = (value: unknown) => Number(value ?? 2026) || 2026;

async function context() {
  const [organization, company] = await Promise.all([
    db.organization.findFirst({ orderBy: { createdAt: "asc" } }),
    db.company.findFirst({ orderBy: { name: "asc" } })
  ]);
  if (!organization || !company) throw new ApiError(404, "NOT_FOUND", "Organisation ou societe introuvable.", { action: "Executer le seed demo." });
  return { organization, company };
}

async function getReferenceBudget(year: number, budgetId?: string) {
  const budget = budgetId
    ? await db.budget.findUnique({ where: { id: budgetId } })
    : await db.budget.findFirst({ where: { fiscalYear: year, isReference: true }, orderBy: { versionNumber: "desc" } });
  if (!budget) throw new ApiError(404, "NOT_FOUND", "Budget de reference introuvable.");
  return budget;
}

v6Router.get("/budgets", async (req, res, next) => {
  try {
    const where = typeof req.query.fiscalYear === "string" ? { fiscalYear: fiscalYear(req.query.fiscalYear) } : {};
    res.json(await db.budget.findMany({ where, orderBy: [{ fiscalYear: "desc" }, { versionNumber: "desc" }], take: take(req.query.take) }));
  } catch (error) {
    next(error);
  }
});

v6Router.post("/budgets", async (req, res, next) => {
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

v6Router.get("/budgets/:id", async (req, res, next) => {
  try {
    const budget = await db.budget.findUnique({ where: { id: req.params.id } });
    if (!budget) throw new ApiError(404, "NOT_FOUND", "Budget introuvable.");
    const lines = await db.budgetLine.findMany({ where: { budgetId: budget.id }, orderBy: [{ year: "asc" }, { month: "asc" }, { category: "asc" }] });
    res.json({ ...budget, lines });
  } catch (error) {
    next(error);
  }
});

v6Router.put("/budgets/:id", async (req, res, next) => {
  try {
    const current = await db.budget.findUnique({ where: { id: req.params.id } });
    if (!current) throw new ApiError(404, "NOT_FOUND", "Budget introuvable.");
    if (current.status === "locked" || current.status === "approved") throw new ApiError(409, "CONFLICT", "Un budget valide ou verrouille ne peut pas etre modifie directement.", { action: "Dupliquer le budget pour creer une nouvelle version." });
    res.json(await db.budget.update({ where: { id: req.params.id }, data: req.body }));
  } catch (error) {
    next(error);
  }
});

v6Router.post("/budgets/:id/duplicate", async (req, res, next) => {
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
  v6Router.post(`/budgets/:id/${path}`, async (req, res, next) => {
    try {
      res.json(await db.budget.update({ where: { id: req.params.id }, data: { status, [dateField ?? "updatedAt"]: new Date(), approvedBy: status === "approved" ? "direction" : undefined, lockedBy: status === "locked" ? "direction" : undefined } }));
    } catch (error) {
      next(error);
    }
  });
}

v6Router.get("/budgets/:id/lines", async (req, res, next) => {
  try {
    res.json(await db.budgetLine.findMany({ where: { budgetId: req.params.id }, orderBy: [{ year: "asc" }, { month: "asc" }, { category: "asc" }] }));
  } catch (error) {
    next(error);
  }
});

v6Router.post("/budgets/:id/lines", async (req, res, next) => {
  try {
    res.status(201).json(await db.budgetLine.create({ data: { ...req.body, budgetId: req.params.id } }));
  } catch (error) {
    next(error);
  }
});

v6Router.put("/budget-lines/:id", async (req, res, next) => {
  try {
    res.json(await db.budgetLine.update({ where: { id: req.params.id }, data: req.body }));
  } catch (error) {
    next(error);
  }
});

v6Router.delete("/budget-lines/:id", async (req, res, next) => {
  try {
    await db.budgetLine.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

v6Router.post("/budgets/:id/import-csv", async (req, res) => res.json({ budgetId: req.params.id, acceptedRows: req.body?.rows?.length ?? 0, rejectedRows: 0, status: "validated" }));

v6Router.post("/budgets/:id/generate", async (req, res, next) => {
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

v6Router.get("/objectives", async (req, res, next) => {
  try {
    res.json(await db.objective.findMany({ where: typeof req.query.fiscalYear === "string" ? { fiscalYear: fiscalYear(req.query.fiscalYear) } : {}, orderBy: [{ fiscalYear: "desc" }, { type: "asc" }] }));
  } catch (error) {
    next(error);
  }
});

v6Router.post("/objectives", async (req, res, next) => {
  try {
    const { organization, company } = await context();
    res.status(201).json(await db.objective.create({ data: { organizationId: organization.id, companyId: company.id, fiscalYear: fiscalYear(req.body?.fiscalYear), name: req.body?.name, type: req.body?.type, targetValue: Number(req.body?.targetValue), unit: req.body?.unit ?? "amount", period: req.body?.period ?? "annual", status: req.body?.status ?? "active" } }));
  } catch (error) {
    next(error);
  }
});

v6Router.get("/objectives/status", async (req, res, next) => {
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

v6Router.get("/objectives/:id", async (req, res, next) => {
  try {
    const objective = await db.objective.findUnique({ where: { id: req.params.id } });
    if (!objective) throw new ApiError(404, "NOT_FOUND", "Objectif introuvable.");
    res.json(objective);
  } catch (error) {
    next(error);
  }
});
v6Router.put("/objectives/:id", async (req, res, next) => { try { res.json(await db.objective.update({ where: { id: req.params.id }, data: req.body })); } catch (error) { next(error); } });
v6Router.delete("/objectives/:id", async (req, res, next) => { try { await db.objective.delete({ where: { id: req.params.id } }); res.status(204).send(); } catch (error) { next(error); } });

v6Router.get("/rolling-forecasts", async (_req, res, next) => { try { res.json(await db.rollingForecast.findMany({ orderBy: { generatedAt: "desc" } })); } catch (error) { next(error); } });
v6Router.post("/rolling-forecasts/generate", async (req, res, next) => {
  try {
    const { organization, company } = await context();
    const year = fiscalYear(req.body?.fiscalYear);
    const budget = await getReferenceBudget(year, req.body?.sourceBudgetId);
    const forecast = await db.rollingForecast.create({ data: { organizationId: organization.id, companyId: company.id, name: req.body?.name ?? `Rolling forecast ${year}`, baseMonth: req.body?.baseMonth ?? `${year}-07`, horizonMonths: Number(req.body?.horizonMonths ?? 12), sourceBudgetId: budget.id, status: "active", generatedBy: "finance" } });
    const budgetLines = await db.budgetLine.findMany({ where: { budgetId: budget.id } });
    await db.rollingForecastLine.createMany({ data: budgetLines.map((line: any) => ({ rollingForecastId: forecast.id, year: line.year, month: line.month, category: line.category, amount: line.month <= 6 ? line.amount * 0.92 : line.amount * 0.96, source: line.month <= 6 ? "actual" : "reforecast", confidenceScore: line.month <= 6 ? 0.95 : 0.72, comment: "Genere V6 depuis budget et reel partiel" })) });
    res.status(201).json(forecast);
  } catch (error) {
    next(error);
  }
});
v6Router.get("/rolling-forecasts/:id", async (req, res, next) => { try { const forecast = await db.rollingForecast.findUnique({ where: { id: req.params.id } }); if (!forecast) throw new ApiError(404, "NOT_FOUND", "Rolling forecast introuvable."); res.json(forecast); } catch (error) { next(error); } });
v6Router.get("/rolling-forecasts/:id/lines", async (req, res, next) => { try { res.json(await db.rollingForecastLine.findMany({ where: { rollingForecastId: req.params.id }, orderBy: [{ year: "asc" }, { month: "asc" }, { category: "asc" }] })); } catch (error) { next(error); } });
v6Router.post("/rolling-forecasts/:id/archive", async (req, res, next) => { try { res.json(await db.rollingForecast.update({ where: { id: req.params.id }, data: { status: "archived" } })); } catch (error) { next(error); } });

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

v6Router.get("/annual-landing", async (req, res, next) => {
  try {
    res.json(await annualLandingPayload(fiscalYear(req.query.fiscalYear), typeof req.query.budgetId === "string" ? req.query.budgetId : undefined));
  } catch (error) {
    next(error);
  }
});

v6Router.get("/variance-analyses", async (req, res, next) => { try { res.json(await db.varianceAnalysis.findMany({ where: typeof req.query.fiscalYear === "string" ? { fiscalYear: fiscalYear(req.query.fiscalYear) } : {}, orderBy: [{ fiscalYear: "desc" }, { month: "asc" }] })); } catch (error) { next(error); } });
v6Router.post("/variance-analyses/recalculate", async (req, res, next) => {
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
v6Router.get("/variance-analyses/:id", async (req, res, next) => { try { const variance = await db.varianceAnalysis.findUnique({ where: { id: req.params.id } }); if (!variance) throw new ApiError(404, "NOT_FOUND", "Ecart introuvable."); const [causes, comments] = await Promise.all([db.varianceCause.findMany({ where: { varianceAnalysisId: variance.id } }), db.varianceComment.findMany({ where: { varianceAnalysisId: variance.id } })]); res.json({ ...variance, causes, comments }); } catch (error) { next(error); } });
v6Router.put("/variance-analyses/:id", async (req, res, next) => { try { res.json(await db.varianceAnalysis.update({ where: { id: req.params.id }, data: req.body })); } catch (error) { next(error); } });
v6Router.post("/variance-analyses/:id/comments", async (req, res, next) => { try { res.status(201).json(await db.varianceComment.create({ data: { varianceAnalysisId: req.params.id, userId: req.body?.userId ?? "finance", comment: req.body?.comment, visibility: req.body?.visibility ?? "internal" } })); } catch (error) { next(error); } });
v6Router.post("/variance-analyses/:id/causes", async (req, res, next) => { try { res.status(201).json(await db.varianceCause.create({ data: { varianceAnalysisId: req.params.id, causeType: req.body?.causeType ?? "other", description: req.body?.description, amountImpact: Number(req.body?.amountImpact ?? 0), confidenceScore: Number(req.body?.confidenceScore ?? 0.7) } })); } catch (error) { next(error); } });

v6Router.get("/action-plans", async (_req, res, next) => { try { res.json(await db.actionPlan.findMany({ orderBy: { createdAt: "desc" } })); } catch (error) { next(error); } });
v6Router.post("/action-plans", async (req, res, next) => { try { const { organization, company } = await context(); res.status(201).json(await db.actionPlan.create({ data: { organizationId: organization.id, companyId: company.id, fiscalYear: fiscalYear(req.body?.fiscalYear), title: req.body?.title, description: req.body?.description, status: req.body?.status ?? "active", ownerUserId: req.body?.ownerUserId ?? "direction" } })); } catch (error) { next(error); } });
v6Router.get("/action-plans/:id", async (req, res, next) => { try { const plan = await db.actionPlan.findUnique({ where: { id: req.params.id } }); if (!plan) throw new ApiError(404, "NOT_FOUND", "Plan d'action introuvable."); const items = await db.actionItem.findMany({ where: { actionPlanId: plan.id }, orderBy: { dueDate: "asc" } }); res.json({ ...plan, items }); } catch (error) { next(error); } });
v6Router.put("/action-plans/:id", async (req, res, next) => { try { res.json(await db.actionPlan.update({ where: { id: req.params.id }, data: req.body })); } catch (error) { next(error); } });
v6Router.post("/action-plans/:id/items", async (req, res, next) => { try { res.status(201).json(await db.actionItem.create({ data: { ...req.body, actionPlanId: req.params.id } })); } catch (error) { next(error); } });
v6Router.put("/action-items/:id", async (req, res, next) => { try { res.json(await db.actionItem.update({ where: { id: req.params.id }, data: req.body })); } catch (error) { next(error); } });
v6Router.post("/action-items/:id/complete", async (req, res, next) => { try { res.json(await db.actionItem.update({ where: { id: req.params.id }, data: { status: "done", actualImpactAmount: req.body?.actualImpactAmount } })); } catch (error) { next(error); } });
v6Router.post("/action-items/:id/cancel", async (req, res, next) => { try { res.json(await db.actionItem.update({ where: { id: req.params.id }, data: { status: "cancelled" } })); } catch (error) { next(error); } });

v6Router.get("/action-suggestions", async (_req, res, next) => { try { res.json(await db.actionSuggestion.findMany({ orderBy: [{ priority: "desc" }, { createdAt: "desc" }] })); } catch (error) { next(error); } });
v6Router.post("/action-suggestions/:id/accept", async (req, res, next) => { try { res.json(await db.actionSuggestion.update({ where: { id: req.params.id }, data: { status: "accepted", resolvedAt: new Date() } })); } catch (error) { next(error); } });
v6Router.post("/action-suggestions/:id/reject", async (req, res, next) => { try { res.json(await db.actionSuggestion.update({ where: { id: req.params.id }, data: { status: "rejected", resolvedAt: new Date() } })); } catch (error) { next(error); } });
v6Router.post("/action-suggestions/:id/convert-to-action", async (req, res, next) => {
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

v6Router.get("/required-pipeline", async (req, res, next) => {
  try {
    const year = fiscalYear(req.query.fiscalYear);
    const budget = await getReferenceBudget(year, typeof req.query.budgetId === "string" ? req.query.budgetId : undefined);
    const [budgetLines, actuals] = await Promise.all([db.budgetLine.findMany({ where: { budgetId: budget.id, category: "revenue" } }), db.monthlyActual.findMany({ where: { year } })]);
    const targetRevenue = budgetLines.reduce((total: number, line: any) => total + line.amount, 0);
    res.json(calculateRequiredPipeline({ targetRevenue, actualRevenue: actuals.reduce((total: number, actual: any) => total + actual.actualRevenueGenerated, 0), signedRemainingRevenue: 840000, weightedPipelineRevenue: 210000, conversionRate: 0.35 }));
  } catch (error) {
    next(error);
  }
});

v6Router.get("/budget-staffing", async (req, res, next) => {
  try {
    const year = fiscalYear(req.query.fiscalYear);
    const budget = await getReferenceBudget(year, typeof req.query.budgetId === "string" ? req.query.budgetId : undefined);
    const revenue = await db.budgetLine.aggregate({ where: { budgetId: budget.id, category: "revenue" }, _sum: { amount: true } });
    res.json(calculateBudgetStaffing({ fiscalYear: year, budgetRevenue: revenue._sum.amount ?? 0 }));
  } catch (error) {
    next(error);
  }
});

v6Router.get("/what-must-be-true", async (req, res, next) => {
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

v6Router.get("/reports/budget-forecast-actual.json", async (req, res, next) => {
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

v6Router.get("/reports/budget-forecast-actual.csv", (_req, res) => {
  res.type("text/csv").send("section,metric,value\nlanding,status,generated\n");
});
v6Router.get("/reports/budget-forecast-actual.pdf", (_req, res) => {
  res.type("application/pdf").send(Buffer.from("PDF demo V6 Budget Forecast Actual"));
});

v6Router.post("/ai/analyze/budget", async (req, res, next) => {
  try {
    const landing = await annualLandingPayload(fiscalYear(req.body?.fiscalYear), req.body?.budgetId);
    res.json({ summary: `Atterrissage CA ${landing.projectedAnnualRevenue} EUR pour un budget ${landing.budgetRevenue} EUR.`, facts: landing.mainDrivers, recommendations: ["Prioriser pipeline manquant", "Suivre actions cash", "Commenter les ecarts critiques"] });
  } catch (error) {
    next(error);
  }
});
v6Router.post("/ai/analyze/annual-landing", async (req, res, next) => { try { res.json(await annualLandingPayload(fiscalYear(req.body?.fiscalYear), req.body?.budgetId)); } catch (error) { next(error); } });
v6Router.post("/ai/analyze/variance", async (_req, res) => res.json({ summary: "Les ecarts prioritaires portent sur le CA, la marge et le cash.", guardrail: "Analyse basee sur les ecarts calcules et commentaires existants." }));
v6Router.post("/ai/generate/action-suggestions", async (_req, res) => res.json({ suggestions: ["Relancer factures en retard", "Securiser prolongations", "Reduire sous-traitance faible marge"] }));
v6Router.post("/ai/generate/budget-codir-summary", async (_req, res) => res.json({ title: "Synthese CODIR budget vs reel", sections: ["Atterrissage", "Ecarts", "Actions", "Conditions de reussite"] }));
