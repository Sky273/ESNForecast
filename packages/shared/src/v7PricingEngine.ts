export type PricingRoundingMode = "none" | "nearest_5" | "nearest_10" | "nearest_50";
export type OverheadAllocationMode = "none" | "flat_daily_amount" | "percentage_of_direct_cost" | "percentage_of_revenue" | "monthly_fixed_pool";

export type MissionPricingInput = {
  revenue: number;
  billableDays: number;
  directCosts: number;
  targetMarginRate: number;
  minimumMarginRate: number;
  overheadAllocationMode: OverheadAllocationMode;
  overheadDailyAmount?: number;
  overheadRate?: number;
  monthlyOverheadPool?: number;
  roundingMode?: PricingRoundingMode;
};

export type MissionPricingResult = {
  billableDays: number;
  currentDailyRate: number;
  directDailyCost: number;
  overheadTotal: number;
  fullCostTotal: number;
  fullDailyCost: number;
  currentMarginRate: number;
  floorDailyRate: number;
  recommendedDailyRate: number;
  targetMarginGap: number;
  monthlyImpactAmount: number;
  annualizedImpactAmount: number;
  status: "insufficient_data" | "healthy" | "watch" | "underpriced" | "critical" | "renegotiation_recommended";
  missingData: string[];
};

export type PricingSimulationInput = MissionPricingInput & {
  simulatedDailyRate?: number;
  discountRate?: number;
  costIncreaseAmount?: number;
  costIncreaseRate?: number;
  changedBillableDays?: number;
};

const round = (value: number) => Math.round(value * 100) / 100;

export function roundDailyRate(value: number, mode: PricingRoundingMode = "nearest_10") {
  if (!Number.isFinite(value)) return 0;
  const step = mode === "nearest_5" ? 5 : mode === "nearest_10" ? 10 : mode === "nearest_50" ? 50 : 0;
  return step ? Math.ceil(value / step) * step : round(value);
}

export function calculateOverhead(input: MissionPricingInput) {
  if (input.overheadAllocationMode === "none") return 0;
  if (input.overheadAllocationMode === "flat_daily_amount") return (input.overheadDailyAmount ?? 0) * input.billableDays;
  if (input.overheadAllocationMode === "percentage_of_direct_cost") return input.directCosts * (input.overheadRate ?? 0);
  if (input.overheadAllocationMode === "percentage_of_revenue") return input.revenue * (input.overheadRate ?? 0);
  if (input.overheadAllocationMode === "monthly_fixed_pool") return input.monthlyOverheadPool ?? 0;
  return 0;
}

export function calculateFloorRate(fullDailyCost: number, minimumMarginRate: number, roundingMode: PricingRoundingMode = "nearest_10") {
  const denominator = Math.max(0.01, 1 - minimumMarginRate);
  return roundDailyRate(fullDailyCost / denominator, roundingMode);
}

export function calculateRecommendedRate(fullDailyCost: number, targetMarginRate: number, roundingMode: PricingRoundingMode = "nearest_10") {
  const denominator = Math.max(0.01, 1 - targetMarginRate);
  return roundDailyRate(fullDailyCost / denominator, roundingMode);
}

export function calculateMissionPricing(input: MissionPricingInput): MissionPricingResult {
  const missingData = [
    input.billableDays > 0 ? "" : "billableDays",
    input.revenue > 0 ? "" : "revenue",
    input.directCosts >= 0 ? "" : "directCosts"
  ].filter(Boolean);
  if (missingData.length) {
    return {
      billableDays: input.billableDays,
      currentDailyRate: 0,
      directDailyCost: 0,
      overheadTotal: 0,
      fullCostTotal: 0,
      fullDailyCost: 0,
      currentMarginRate: 0,
      floorDailyRate: 0,
      recommendedDailyRate: 0,
      targetMarginGap: 0,
      monthlyImpactAmount: 0,
      annualizedImpactAmount: 0,
      status: "insufficient_data",
      missingData
    };
  }

  const overheadTotal = calculateOverhead(input);
  const fullCostTotal = input.directCosts + overheadTotal;
  const currentDailyRate = input.revenue / input.billableDays;
  const directDailyCost = input.directCosts / input.billableDays;
  const fullDailyCost = fullCostTotal / input.billableDays;
  const currentMarginRate = input.revenue ? (input.revenue - fullCostTotal) / input.revenue : 0;
  const floorDailyRate = calculateFloorRate(fullDailyCost, input.minimumMarginRate, input.roundingMode);
  const recommendedDailyRate = calculateRecommendedRate(fullDailyCost, input.targetMarginRate, input.roundingMode);
  const targetRevenue = recommendedDailyRate * input.billableDays;
  const targetMarginGap = targetRevenue - input.revenue;
  const monthlyImpactAmount = Math.max(0, targetMarginGap);
  const annualizedImpactAmount = monthlyImpactAmount * 12;
  const status =
    currentMarginRate < 0 || currentDailyRate < floorDailyRate * 0.9 ? "critical" :
    currentDailyRate < floorDailyRate ? "underpriced" :
    currentDailyRate < recommendedDailyRate || currentMarginRate < input.targetMarginRate ? "renegotiation_recommended" :
    currentMarginRate < input.targetMarginRate + 0.03 ? "watch" :
    "healthy";

  return {
    billableDays: round(input.billableDays),
    currentDailyRate: round(currentDailyRate),
    directDailyCost: round(directDailyCost),
    overheadTotal: round(overheadTotal),
    fullCostTotal: round(fullCostTotal),
    fullDailyCost: round(fullDailyCost),
    currentMarginRate: round(currentMarginRate),
    floorDailyRate,
    recommendedDailyRate,
    targetMarginGap: round(targetMarginGap),
    monthlyImpactAmount: round(monthlyImpactAmount),
    annualizedImpactAmount: round(annualizedImpactAmount),
    status,
    missingData
  };
}

export function simulatePricing(input: PricingSimulationInput) {
  const billableDays = input.changedBillableDays ?? input.billableDays;
  const baseDailyRate = input.simulatedDailyRate ?? (input.billableDays ? input.revenue / input.billableDays : 0);
  const discountedRate = baseDailyRate * (1 - (input.discountRate ?? 0));
  const directCosts = input.directCosts * (1 + (input.costIncreaseRate ?? 0)) + (input.costIncreaseAmount ?? 0);
  const result = calculateMissionPricing({
    ...input,
    billableDays,
    directCosts,
    revenue: discountedRate * billableDays
  });
  return {
    simulatedDailyRate: round(discountedRate),
    revenue: round(discountedRate * billableDays),
    costDelta: round(directCosts - input.directCosts),
    discountImpact: round((baseDailyRate - discountedRate) * billableDays),
    ...result
  };
}

export function calculateRenegotiationPriority(input: {
  marginGap: number;
  monthlyImpactAmount: number;
  currentDailyRate: number;
  recommendedDailyRate: number;
  remainingMonths?: number;
  isCriticalMission?: boolean;
}) {
  const marginScore = Math.min(35, Math.max(0, input.marginGap * -100));
  const impactScore = Math.min(30, Math.max(0, input.monthlyImpactAmount / 500));
  const rateGap = input.recommendedDailyRate ? Math.max(0, (input.recommendedDailyRate - input.currentDailyRate) / input.recommendedDailyRate) : 0;
  const rateScore = Math.min(20, rateGap * 100);
  const durationScore = Math.min(10, (input.remainingMonths ?? 6) * 1.2);
  const criticalScore = input.isCriticalMission ? 5 : 0;
  const score = Math.round(Math.min(100, marginScore + impactScore + rateScore + durationScore + criticalScore));
  const severity = score >= 81 ? "critical" : score >= 61 ? "high" : score >= 31 ? "medium" : "low";
  return {
    score,
    severity,
    factors: [
      { label: "Ecart marge", value: round(marginScore) },
      { label: "Impact mensuel", value: round(impactScore) },
      { label: "Ecart TJM recommandé", value: round(rateScore) },
      { label: "Duree restante", value: round(durationScore) }
    ]
  };
}
