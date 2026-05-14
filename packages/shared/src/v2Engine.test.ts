import { describe, expect, it } from "vitest";
import {
  analyzeStrategicDependencies,
  buildAiExecutiveAnalysis,
  calculateCapacityPlan,
  calculateExecutiveSituation,
  calculateMonthlyVariance,
  generateInvoiceFromTimesheet,
  runMonteCarloSimulation,
  runRuleEngine
} from "./v2Engine";
import type { V2ExecutiveInput } from "./v2Types";

const input: V2ExecutiveInput = {
  scenarioProjection: {
    scenarioId: "reference",
    months: [
      {
        month: "2026-06",
        revenueGenerated: 40000,
        revenueSigned: 40000,
        revenueExpected: 0,
        revenueWeighted: 40000,
        revenueInvoiced: 38000,
        cashInExpected: 0,
        cashInWeighted: 0,
        costsAccrued: 26000,
        costsPaid: 26000,
        cashOutExpected: 26000,
        employeeCosts: 12000,
        partnerCosts: 4000,
        freelancerCosts: 0,
        fixedCosts: 8000,
        variableCosts: 1000,
        taxCosts: 1000,
        totalCosts: 26000,
        grossMargin: 24000,
        netMargin: 14000,
        marginRate: 0.6,
        monthlyBalanceAccrual: 14000,
        monthlyCashBalance: -26000,
        openingCash: 70000,
        closingCash: 44000,
        cumulativeBalance: 14000,
        soldDays: 40,
        internalProducedDays: 20,
        externalProducedDays: 10,
        internalUtilizationRate: 0.8,
        benchCost: 2000,
        alerts: []
      }
    ],
    missionProfitability: [],
    resourceProfitability: [],
    cashflow: [{ month: "2026-06", openingCash: 70000, cashIn: 0, cashOut: 26000, variation: -26000, closingCash: 44000, weightedClosingCash: 44000, status: "healthy" }],
    alerts: [],
    summary: {
      totalRevenueGenerated: 40000,
      totalRevenueInvoiced: 38000,
      totalCashIn: 0,
      totalCostsAccrued: 26000,
      totalCashOut: 26000,
      totalGrossMargin: 24000,
      finalClosingCash: 44000,
      finalCumulativeBalance: 14000,
      averageMarginRate: 0.6,
      averageUtilizationRate: 0.8,
      totalBenchCost: 2000,
      riskMonths: []
    }
  },
  timesheets: [
    {
      id: "ts1",
      resourceType: "employee",
      resourceId: "e1",
      missionId: "m1",
      month: 6,
      year: 2026,
      workedDays: 20,
      billableDays: 18,
      nonBillableDays: 2,
      absenceDays: 0,
      vacationDays: 0,
      sickLeaveDays: 0,
      trainingDays: 0,
      internalDays: 2,
      status: "approved"
    }
  ],
  monthlyActuals: [
    {
      id: "a1",
      companyId: "c1",
      month: 6,
      year: 2026,
      actualRevenueGenerated: 36000,
      actualRevenueInvoiced: 36000,
      actualCashIn: 20000,
      actualEmployeeCosts: 12500,
      actualExternalCosts: 4000,
      actualFixedCosts: 8500,
      actualVariableCosts: 2500,
      actualCashOut: 27500,
      actualGrossMargin: 19500,
      actualNetMargin: 8500,
      actualClosingCash: 62500
    }
  ],
  invoices: [
    {
      id: "inv1",
      companyId: "c1",
      clientId: "client-a",
      missionId: "m1",
      invoiceNumber: "F-2026-001",
      invoiceDate: "2026-06-30",
      dueDate: "2026-07-30",
      amountHT: 36000,
      vatRate: 0.2,
      amountTTC: 43200,
      status: "partially_paid",
      paidAmount: 20000,
      source: "generated_from_timesheet"
    }
  ],
  payments: [{ id: "pay1", invoiceId: "inv1", clientId: "client-a", paymentDate: "2026-07-20", amount: 20000, paymentMethod: "wire", status: "received" }],
  resourceSkills: [{ id: "rs1", resourceType: "employee", resourceId: "e1", skillId: "java", level: "senior" }],
  missionSkillNeeds: [{ id: "need1", missionId: "m1", skillId: "java", requiredLevel: "confirmed", requiredFTE: 2, startDate: "2026-06-01", endDate: "2026-08-31", priority: "high" }],
  businessRules: [
    {
      id: "rule1",
      name: "Cash low",
      triggerType: "monthly_projection",
      condition: { metric: "closingCash", operator: "lt", value: 50000 },
      action: { type: "alert", message: "Cash sous seuil de vigilance" },
      severity: "warning",
      isActive: true
    }
  ],
  assumptions: [{ id: "pa1", scenarioId: "reference", entityType: "mission", entityId: "m1", field: "revenueGenerated", distributionType: "triangular", minValue: 30000, mostLikelyValue: 40000, maxValue: 50000, probability: 1 }],
  clients: [{ id: "client-a", name: "Client A", sector: "Banque", paymentDelayDays: 30 }],
  missions: [{ id: "m1", title: "Mission A", clientId: "client-a", status: "active", type: "time_material", startDate: "2026-06-01", estimatedEndDate: "2026-08-31", defaultDailyRate: 1000, signatureProbability: 1 }],
  offers: [],
  plannedHires: []
};

describe("V2 executive engine", () => {
  it("generates a real invoice from an approved timesheet", () => {
    const invoice = generateInvoiceFromTimesheet(input.timesheets[0], input.missions[0], "client-a", 1000);
    expect(invoice.amountHT).toBe(18000);
    expect(invoice.source).toBe("generated_from_timesheet");
  });

  it("calculates monthly variance between forecast and actual", () => {
    const variance = calculateMonthlyVariance(input.scenarioProjection.months[0], input.monthlyActuals[0]);
    expect(variance.revenueVariance).toBe(-4000);
    expect(variance.costsVariance).toBe(1500);
    expect(variance.mainVarianceReasons.length).toBeGreaterThan(0);
  });

  it("detects capacity gaps by skill", () => {
    const capacity = calculateCapacityPlan(input);
    expect(capacity[0].skillId).toBe("java");
    expect(capacity[0].gapFTE).toBe(-1);
  });

  it("runs a deterministic Monte Carlo summary", () => {
    const result = runMonteCarloSimulation(input, 100);
    expect(result.iterations).toBe(100);
    expect(result.months[0].revenue.p10).toBeLessThanOrEqual(result.months[0].revenue.p50);
    expect(result.months[0].revenue.p50).toBeLessThanOrEqual(result.months[0].revenue.p90);
  });

  it("evaluates business rules into alerts", () => {
    const alerts = runRuleEngine(input);
    expect(alerts[0].message).toBe("Cash sous seuil de vigilance");
    expect(alerts[0].explanation).toContain("closingCash");
  });

  it("analyzes client concentration risk", () => {
    const risks = analyzeStrategicDependencies(input);
    expect(risks.clientConcentration[0].clientId).toBe("client-a");
    expect(risks.clientConcentration[0].revenueShare).toBe(1);
  });

  it("builds an AI analysis using only calculated facts", () => {
    const analysis = buildAiExecutiveAnalysis(calculateExecutiveSituation(input));
    expect(analysis.sourceFacts.some((fact) => fact.includes("Tresorerie finale"))).toBe(true);
    expect(analysis.recommendations.length).toBeGreaterThan(0);
  });
});
