const sum = (rows: any[], selector: (row: any) => number) => rows.reduce((total, row) => total + selector(row), 0);
const round = (value: number) => Math.round(value * 100) / 100;

export const budgetCatégories = ["revenue", "employee_costs", "partner_costs", "freelancer_costs", "fixed_costs", "variable_costs", "cash_in", "cash_out", "gross_margin", "net_margin", "closing_cash", "utilization_rate", "bench_cost", "commercial_pipeline"];

export function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function buildBudgetVariance({ budgetLines, rollingLines, actuals }: { budgetLines: any[]; rollingLines: any[]; actuals: any[] }) {
  const keys = new Set<string>();
  for (const line of budgetLines) keys.add(`${line.year}-${line.month}-${line.category}`);
  for (const line of rollingLines) keys.add(`${line.year}-${line.month}-${line.category}`);

  const actualByMonth = new Map(actuals.map((actual) => [`${actual.year}-${actual.month}`, actual]));
  const budgetValue = (year: number, month: number, category: string) => sum(budgetLines.filter((line) => line.year === year && line.month === month && line.category === category), (line) => line.amount);
  const forecastValue = (year: number, month: number, category: string) => sum(rollingLines.filter((line) => line.year === year && line.month === month && line.category === category), (line) => line.amount);
  const actualValue = (year: number, month: number, category: string) => {
    const actual = actualByMonth.get(`${year}-${month}`);
    if (!actual) return 0;
    const mapping: Record<string, number> = {
      revenue: actual.actualRevenueGenerated ?? 0,
      cash_in: actual.actualCashIn ?? 0,
      employee_costs: actual.actualEmployeeCosts ?? 0,
      partner_costs: actual.actualExternalCosts ?? 0,
      freelancer_costs: 0,
      fixed_costs: actual.actualFixedCosts ?? 0,
      variable_costs: actual.actualVariableCosts ?? 0,
      cash_out: actual.actualCashOut ?? 0,
      gross_margin: actual.actualGrossMargin ?? 0,
      net_margin: actual.actualNetMargin ?? 0,
      closing_cash: actual.actualClosingCash ?? 0
    };
    return mapping[category] ?? 0;
  };

  return Array.from(keys).map((key) => {
    const [yearRaw, monthRaw, ...categoryParts] = key.split("-");
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    const category = categoryParts.join("-");
    const budget = budgetValue(year, month, category);
    const forecast = forecastValue(year, month, category);
    const actual = actualValue(year, month, category);
    const varianceBudgetActual = actual - budget;
    const varianceForecastActual = actual - forecast;
    const varianceBudgetActualPercent = budget ? varianceBudgetActual / budget : 0;
    const absPercent = Math.abs(varianceBudgetActualPercent);
    const status = varianceBudgetActual > 0 && ["revenue", "cash_in", "gross_margin", "net_margin", "closing_cash", "utilization_rate"].includes(category)
      ? "overperforming"
      : absPercent > 0.2 ? "critical" : absPercent > 0.1 ? "warning" : absPercent > 0.05 ? "slight_variance" : "on_track";
    return {
      month: monthKey(year, month),
      category,
      budgetValue: round(budget),
      forecastValue: round(forecast),
      reforecastValue: round(forecast * 0.98),
      actualValue: round(actual),
      varianceBudgetActual: round(varianceBudgetActual),
      varianceBudgetActualPercent: round(varianceBudgetActualPercent),
      varianceForecastActual: round(varianceForecastActual),
      varianceForecastActualPercent: forecast ? round(varianceForecastActual / forecast) : 0,
      status
    };
  }).sort((a, b) => a.month.localeCompare(b.month) || a.category.localeCompare(b.category));
}

export function calculateAnnualLanding({ fiscalYear, budgetLines, rollingLines, actuals }: { fiscalYear: number; budgetLines: any[]; rollingLines: any[]; actuals: any[] }) {
  const revenueBudget = sum(budgetLines.filter((line) => line.category === "revenue"), (line) => line.amount);
  const marginBudget = sum(budgetLines.filter((line) => line.category === "gross_margin"), (line) => line.amount);
  const closingCashBudget = budgetLines.filter((line) => line.category === "closing_cash").sort((a, b) => a.month - b.month).at(-1)?.amount ?? 0;
  const actualRevenue = sum(actuals, (actual) => actual.actualRevenueGenerated ?? 0);
  const actualMargin = sum(actuals, (actual) => actual.actualGrossMargin ?? 0);
  const lastActualMonth = actuals.reduce((max, actual) => Math.max(max, actual.month), 0);
  const forecastRemaining = sum(rollingLines.filter((line) => line.category === "revenue" && line.month > lastActualMonth), (line) => line.amount);
  const forecastMarginRemaining = sum(rollingLines.filter((line) => line.category === "gross_margin" && line.month > lastActualMonth), (line) => line.amount);
  const projectedRevenue = actualRevenue + forecastRemaining;
  const projectedMargin = actualMargin + forecastMarginRemaining;
  const projectedClosingCash = rollingLines.filter((line) => line.category === "closing_cash").sort((a, b) => a.month - b.month).at(-1)?.amount ?? 0;
  const achievementProbability = revenueBudget ? Math.max(0, Math.min(1, projectedRevenue / revenueBudget - 0.05)) : 0;
  return {
    fiscalYear,
    budgetRevenue: round(revenueBudget),
    actualRevenueToDate: round(actualRevenue),
    forecastRevenueRemaining: round(forecastRemaining),
    projectedAnnualRevenue: round(projectedRevenue),
    revenueGap: round(projectedRevenue - revenueBudget),
    budgetGrossMargin: round(marginBudget),
    projectedGrossMargin: round(projectedMargin),
    marginGap: round(projectedMargin - marginBudget),
    budgetClosingCash: round(closingCashBudget),
    projectedClosingCash: round(projectedClosingCash),
    cashGap: round(projectedClosingCash - closingCashBudget),
    achievementProbability: round(achievementProbability),
    lowCase: { revenue: round(projectedRevenue * 0.92), cash: round(projectedClosingCash * 0.9) },
    medianCase: { revenue: round(projectedRevenue), cash: round(projectedClosingCash) },
    highCase: { revenue: round(projectedRevenue * 1.06), cash: round(projectedClosingCash * 1.08) },
    mainDrivers: [
      { label: "CA réalisé à date", impact: round(actualRevenue) },
      { label: "Forecast restant", impact: round(forecastRemaining) },
      { label: "Ecart trésorerie final", impact: round(projectedClosingCash - closingCashBudget) }
    ]
  };
}

export function calculateRequiredPipeline({ targetRevenue, actualRevenue, signedRemainingRevenue, weightedPipelineRevenue, conversionRate, averageOpportunityAmount = 85000 }: { targetRevenue: number; actualRevenue: number; signedRemainingRevenue: number; weightedPipelineRevenue: number; conversionRate: number; averageOpportunityAmount?: number }) {
  const revenueGap = Math.max(0, targetRevenue - actualRevenue - signedRemainingRevenue - weightedPipelineRevenue);
  const requiredGrossPipeline = conversionRate ? revenueGap / conversionRate : revenueGap;
  return {
    targetRevenue: round(targetRevenue),
    actualRevenue: round(actualRevenue),
    signedRemainingRevenue: round(signedRemainingRevenue),
    weightedPipelineRevenue: round(weightedPipelineRevenue),
    revenueGap: round(revenueGap),
    historicalConversionRate: conversionRate,
    requiredGrossPipeline: round(requiredGrossPipeline),
    opportunitiesNeeded: Math.ceil(requiredGrossPipeline / averageOpportunityAmount),
    latestSignatureMonth: "2026-09",
    recommendations: [
      "Securiser les prolongations critiques avant fin T3",
      "Créer du pipeline qualifié sur les comptes Banque et Energie",
      "Prioriser les offres ? marge supérieure ? 28 %"
    ]
  };
}

export function calculateBudgetStaffing({ fiscalYear, budgetRevenue, averageDailyRate = 780, internalCapacityBeforeSeptember = 150, internalCapacityAfterSeptember = 166, externalCapacityBeforeSeptember = 46, externalCapacityAfterSeptember = 54 }: { fiscalYear: number; budgetRevenue: number; averageDailyRate?: number; internalCapacityBeforeSeptember?: number; internalCapacityAfterSeptember?: number; externalCapacityBeforeSeptember?: number; externalCapacityAfterSeptember?: number }) {
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const monthlyRevenue = budgetRevenue / 12;
    const requiredBillableDays = monthlyRevenue / averageDailyRate;
    const internalCapacityDays = month < 9 ? internalCapacityBeforeSeptember : internalCapacityAfterSeptember;
    const externalCapacityDays = month < 9 ? externalCapacityBeforeSeptember : externalCapacityAfterSeptember;
    const gapDays = internalCapacityDays + externalCapacityDays - requiredBillableDays;
    return {
      fiscalYear,
      month,
      requiredBillableDays: round(requiredBillableDays),
      internalCapacityDays,
      externalCapacityDays,
      gapDays: round(gapDays),
      requiredFTE: round(requiredBillableDays / 20),
      availableFTE: round((internalCapacityDays + externalCapacityDays) / 20),
      staffingGapFTE: round(gapDays / 20),
      missingSkills: gapDays < 0 ? ["Java senior", "Data engineering"] : month > 9 ? ["Cloud AWS"] : [],
      recommendedActions: gapDays < 0 ? ["Lancer recrutement senior", "Securiser partenaire data"] : ["Maintenir taux occupation interne"]
    };
  });
}

export function buildWhatMustBeTrue({ projectedAnnualRevenue, budgetRevenue, projectedClosingCash, budgetClosingCash }: { projectedAnnualRevenue: number; budgetRevenue: number; projectedClosingCash: number; budgetClosingCash: number }) {
  return [
    {
      conditionType: "revenue_condition",
      description: "Signer le pipeline manquant avant la fin du T3",
      targetValue: budgetRevenue,
      currentValue: projectedAnnualRevenue,
      gap: round(projectedAnnualRevenue - budgetRevenue),
      riskLevel: projectedAnnualRevenue >= budgetRevenue ? "low" : "high",
      status: projectedAnnualRevenue >= budgetRevenue ? "satisfied" : "at_risk",
      relatedActions: ["Relancer opportunites Banque", "Convertir offre GreenGrid"]
    },
    {
      conditionType: "cash_condition",
      description: "Conserver une trésorerie finale au-dessus du budget",
      targetValue: budgetClosingCash,
      currentValue: projectedClosingCash,
      gap: round(projectedClosingCash - budgetClosingCash),
      riskLevel: projectedClosingCash >= budgetClosingCash ? "low" : "critical",
      status: projectedClosingCash >= budgetClosingCash ? "satisfied" : "not_satisfied",
      relatedActions: ["Accelerer encaissements", "Reporter dépenses non essentielles"]
    },
    {
      conditionType: "staffing_condition",
      description: "Maintenir le taux d'occupation interne au-dessus de 86 %",
      targetValue: 0.86,
      currentValue: 0.81,
      gap: -0.05,
      riskLevel: "medium",
      status: "at_risk",
      relatedActions: ["Placer les consultants disponibles", "Reduire sous-traitance faible marge"]
    }
  ];
}
