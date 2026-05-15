export type BudgetVarianceInput = {
  budget: number;
  actual: number;
  forecast: number;
};

export function classifyBudgetVariance({ budget, actual }: BudgetVarianceInput) {
  const variance = actual - budget;
  const percent = budget ? variance / budget : 0;
  const abs = Math.abs(percent);
  const status = variance > 0 ? "overperforming" : abs > 0.2 ? "critical" : abs > 0.1 ? "warning" : abs > 0.05 ? "slight_variance" : "on_track";
  return { variance, percent, status };
}

export function calculateAnnualLanding(input: { budgetRevenue: number; actualRevenueToDate: number; forecastRevenueRemaining: number; budgetCash: number; projectedCash: number }) {
  const projectedAnnualRevenue = input.actualRevenueToDate + input.forecastRevenueRemaining;
  const revenueGap = projectedAnnualRevenue - input.budgetRevenue;
  return {
    projectedAnnualRevenue,
    revenueGap,
    cashGap: input.projectedCash - input.budgetCash,
    achievementProbability: input.budgetRevenue ? Math.max(0, Math.min(1, projectedAnnualRevenue / input.budgetRevenue - 0.05)) : 0
  };
}

export function calculateRequiredPipeline(input: { targetRevenue: number; actualRevenue: number; signedRevenue: number; weightedPipeline: number; conversionRate: number }) {
  const revenueGap = Math.max(0, input.targetRevenue - input.actualRevenue - input.signedRevenue - input.weightedPipeline);
  const requiredGrossPipeline = input.conversionRate ? revenueGap / input.conversionRate : revenueGap;
  return {
    revenueGap,
    requiredGrossPipeline,
    opportunitiesNeeded: Math.ceil(requiredGrossPipeline / 85000)
  };
}

export function classifyWhatMustBeTrue(input: { target: number; current: number }) {
  const gap = input.current - input.target;
  const ratio = input.target ? input.current / input.target : 0;
  return {
    gap,
    status: ratio >= 1 ? "satisfied" : ratio >= 0.85 ? "at_risk" : "not_satisfied",
    riskLevel: ratio >= 1 ? "low" : ratio >= 0.85 ? "medium" : "high"
  };
}

