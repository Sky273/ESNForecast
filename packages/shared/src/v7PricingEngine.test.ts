import { describe, expect, it } from "vitest";
import { calculateFloorRate, calculateMissionPricing, calculateRecommendedRate, calculateRenegotiationPriority, roundDailyRate, simulatePricing } from "./v7PricingEngine";

describe("v7 pricing engine", () => {
  it("calculates floor and recommended daily rates with rounding", () => {
    expect(calculateFloorRate(450, 0.2, "nearest_10")).toBe(570);
    expect(calculateRecommendedRate(450, 0.3, "nearest_10")).toBe(650);
    expect(roundDailyRate(642.86, "nearest_50")).toBe(650);
  });

  it("calculates full daily cost and detects underpriced missions", () => {
    const result = calculateMissionPricing({
      revenue: 11400,
      billableDays: 20,
      directCosts: 9000,
      targetMarginRate: 0.3,
      minimumMarginRate: 0.2,
      overheadAllocationMode: "flat_daily_amount",
      overheadDailyAmount: 40,
      roundingMode: "nearest_10"
    });
    expect(result.fullDailyCost).toBe(490);
    expect(result.floorDailyRate).toBe(620);
    expect(result.recommendedDailyRate).toBe(700);
    expect(result.status).toBe("underpriced");
  });

  it("simulates discount and cost increase impact", () => {
    const result = simulatePricing({
      revenue: 14000,
      billableDays: 20,
      directCosts: 8500,
      targetMarginRate: 0.3,
      minimumMarginRate: 0.2,
      overheadAllocationMode: "percentage_of_direct_cost",
      overheadRate: 0.08,
      simulatedDailyRate: 700,
      discountRate: 0.05,
      costIncreaseAmount: 500
    });
    expect(result.simulatedDailyRate).toBe(665);
    expect(result.discountImpact).toBe(700);
    expect(result.costDelta).toBe(500);
  });

  it("builds an explainable renegotiation priority score", () => {
    const priority = calculateRenegotiationPriority({
      marginGap: -0.14,
      monthlyImpactAmount: 8200,
      currentDailyRate: 550,
      recommendedDailyRate: 720,
      remainingMonths: 8,
      isCriticalMission: true
    });
    expect(priority.score).toBeGreaterThan(40);
    expect(priority.severity).not.toBe("low");
    expect(priority.factors).toHaveLength(4);
  });
});
