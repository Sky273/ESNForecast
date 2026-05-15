import { describe, expect, it } from "vitest";
import { calculateAnnualLanding, calculateRequiredPipeline, classifyBudgetVariance, classifyWhatMustBeTrue } from "./v6BudgetEngine";

describe("v6 budget engine", () => {
  it("classifies critical negative budget variance", () => {
    const result = classifyBudgetVariance({ budget: 200000, actual: 140000, forecast: 180000 });
    expect(result.variance).toBe(-60000);
    expect(result.status).toBe("critical");
  });

  it("calculates annual landing and achievement probability", () => {
    const result = calculateAnnualLanding({ budgetRevenue: 2400000, actualRevenueToDate: 900000, forecastRevenueRemaining: 1250000, budgetCash: 180000, projectedCash: 150000 });
    expect(result.projectedAnnualRevenue).toBe(2150000);
    expect(result.revenueGap).toBe(-250000);
    expect(result.cashGap).toBe(-30000);
    expect(result.achievementProbability).toBeGreaterThan(0.84);
    expect(result.achievementProbability).toBeLessThan(0.85);
  });

  it("calculates required commercial pipeline from conversion rate", () => {
    const result = calculateRequiredPipeline({ targetRevenue: 2400000, actualRevenue: 1000000, signedRevenue: 850000, weightedPipeline: 200000, conversionRate: 0.35 });
    expect(result.revenueGap).toBe(350000);
    expect(Math.round(result.requiredGrossPipeline)).toBe(1000000);
    expect(result.opportunitiesNeeded).toBe(12);
  });

  it("classifies what must be true conditions", () => {
    expect(classifyWhatMustBeTrue({ target: 0.86, current: 0.81 })).toMatchObject({ status: "at_risk", riskLevel: "medium" });
    expect(classifyWhatMustBeTrue({ target: 420000, current: 210000 })).toMatchObject({ status: "not_satisfied", riskLevel: "high" });
  });
});

