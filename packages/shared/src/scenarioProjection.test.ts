import { describe, expect, it } from "vitest";
import {
  calculateBenchCost,
  calculateCashInFromInvoice,
  calculateFixedPriceInvoiceSchedule,
  calculateScenarioProjection,
  applySimulationEvents
} from "./scenarioProjection";
import type { ScenarioProjectionInput } from "./forecastTypes";

const baseInput: ScenarioProjectionInput = {
  company: {
    id: "company-1",
    name: "Demo ESN",
    currency: "EUR",
    defaultEmployeeSocialRate: 0.22,
    defaultEmployerRate: 0.45,
    projectionStartMonth: "2026-06",
    defaultProjectionHorizonMonths: 6
  },
  scenario: {
    id: "reference",
    name: "Reference",
    type: "reference",
    isActive: true,
    riskLevel: "low",
    createdAt: "2026-05-01"
  },
  settings: {
    horizonMonths: 6,
    averageBusinessDaysPerMonth: 20,
    defaultEmployeeChargeRate: 0.45,
    overheadRate: 0,
    simplifiedTaxRate: 0.1,
    revenueRecognitionMode: "billing",
    defaultPaymentDelayDays: 30,
    defaultSupplierPaymentDelayDays: 30,
    applyProbabilityToPlannedMissions: true,
    minimumMarginRate: 0.2,
    initialCash: 50000,
    criticalCashThreshold: 15000,
    minimumUtilizationRate: 0.75,
    employeeCostMode: "full_monthly"
  },
  employees: [
    {
      id: "e1",
      firstName: "Alice",
      lastName: "Martin",
      position: "Consultante",
      status: "consultant",
      assignable: true,
      startDate: "2026-01-01",
      monthlyGrossSalary: 4000,
      employerChargeRate: 0.45,
      benefitsMonthly: 500
    },
    {
      id: "e2",
      firstName: "Nora",
      lastName: "Bench",
      position: "Consultante",
      status: "consultant",
      assignable: true,
      startDate: "2026-01-01",
      monthlyGrossSalary: 3500,
      employerChargeRate: 0.45,
      benefitsMonthly: 350
    }
  ],
  partners: [],
  partnerResources: [
    {
      id: "p1",
      partnerId: "partner-1",
      firstName: "Paul",
      lastName: "Partner",
      role: "DevOps",
      dailyCost: 550,
      monthlyFees: 0,
      availableFrom: "2026-01-01"
    }
  ],
  freelancers: [
    {
      id: "f1",
      firstName: "Fanny",
      lastName: "Free",
      specialty: "Data",
      dailyCost: 650,
      monthlyFees: 200,
      availableFrom: "2026-01-01"
    }
  ],
  clients: [{ id: "c1", name: "Banque A", sector: "Banque", paymentDelayDays: 45 }],
  missions: [
    {
      id: "m1",
      title: "Core banking",
      clientId: "c1",
      status: "active",
      type: "time_material",
      startDate: "2026-06-01",
      estimatedEndDate: "2026-11-30",
      defaultDailyRate: 900,
      signatureProbability: 1,
      paymentDelayDays: 45
    },
    {
      id: "m2",
      title: "Forfait data",
      clientId: "c1",
      status: "planned",
      type: "fixed_price",
      startDate: "2026-07-01",
      estimatedEndDate: "2026-09-30",
      defaultDailyRate: 800,
      fixedPriceAmount: 60000,
      signatureProbability: 0.5
    }
  ],
  assignments: [
    {
      id: "a1",
      missionId: "m1",
      resourceType: "employee",
      resourceId: "e1",
      startDate: "2026-06-01",
      estimatedEndDate: "2026-11-30",
      occupancyRate: 1,
      calculationMode: "business_days",
      specificDailyRate: 900
    },
    {
      id: "a2",
      missionId: "m2",
      resourceType: "partner",
      resourceId: "p1",
      startDate: "2026-07-01",
      estimatedEndDate: "2026-09-30",
      occupancyRate: 0.5,
      calculationMode: "business_days",
      specificDailyRate: 800,
      specificDailyCost: 550
    }
  ],
  fixedCosts: [
    {
      id: "fc1",
      label: "Loyer",
      category: "locaux",
      monthlyAmount: 5000,
      startDate: "2026-01-01",
      recurrence: "monthly"
    }
  ],
  variableCosts: [{ id: "vc1", label: "Materiel", category: "equipment", amount: 2500, date: "2026-07-12" }],
  invoiceForecasts: [
    {
      id: "i1",
      missionId: "m1",
      scenarioId: "reference",
      invoiceDate: "2026-06-30",
      dueDate: "2026-08-14",
      expectedPaymentDate: "2026-08-14",
      amountHT: 18000,
      vatRate: 0.2,
      amountTTC: 21600,
      status: "planned",
      probability: 1
    }
  ],
  cashInForecasts: [],
  cashOutForecasts: [{ id: "co1", scenarioId: "reference", sourceType: "tax", expectedDate: "2026-08-15", amount: 12000, status: "planned" }],
  simulationEvents: [],
  startMonth: "2026-06",
  horizonMonths: 6
};

describe("Scenario projection engine", () => {
  it("calculates cash-in from invoice expected payment date and probability", () => {
    const cashIn = calculateCashInFromInvoice(baseInput.invoiceForecasts[0]);
    expect(cashIn.expectedDate).toBe("2026-08-14");
    expect(cashIn.amount).toBe(21600);
    expect(cashIn.weightedAmount).toBe(21600);
  });

  it("creates a fixed-price invoice schedule", () => {
    const invoices = calculateFixedPriceInvoiceSchedule(baseInput.missions[1], "reference", 30);
    expect(invoices).toHaveLength(3);
    expect(invoices.reduce((sum, invoice) => sum + invoice.amountHT, 0)).toBe(60000);
  });

  it("calculates bench cost for unassigned assignable employees", () => {
    const bench = calculateBenchCost(baseInput, "2026-06");
    expect(bench.totalBenchCost).toBe(5425);
    expect(bench.employees[0].employeeId).toBe("e2");
  });

  it("applies a mission-loss simulation event without mutating base input", () => {
    const simulated = applySimulationEvents({
      ...baseInput,
      simulationEvents: [
        {
          id: "sim-1",
          scenarioId: "reference",
          type: "mission_loss",
          label: "Perte mission",
          startDate: "2026-08-01",
          relatedMissionId: "m1",
          parameters: {},
          isActive: true
        }
      ]
    });
    expect(simulated.missions.find((mission) => mission.id === "m1")?.estimatedEndDate).toBe("2026-07-31");
    expect(baseInput.missions.find((mission) => mission.id === "m1")?.estimatedEndDate).toBe("2026-11-30");
  });

  it("calculates scenario projection with generated, invoiced and collected revenue", () => {
    const projection = calculateScenarioProjection(baseInput);
    expect(projection.months[0].revenueGenerated).toBe(18000);
    expect(projection.months[0].revenueInvoiced).toBe(36000);
    expect(projection.months[0].cashInExpected).toBe(0);
    expect(projection.months[2].cashInExpected).toBe(72000);
    expect(projection.cashflow[2].cashIn).toBe(57600);
  });

  it("calculates mission and resource profitability", () => {
    const projection = calculateScenarioProjection(baseInput);
    const mission = projection.missionProfitability.find((item) => item.missionId === "m1");
    const resource = projection.resourceProfitability.find((item) => item.resourceId === "e1");
    expect(mission?.revenueWeighted).toBeGreaterThan(100000);
    expect(mission?.marginRate).toBeGreaterThan(0.5);
    expect(resource?.utilizationRate).toBe(1);
    expect(resource?.revenueGenerated).toBeGreaterThan(100000);
  });

  it("marks pessimistic scenario as riskier than optimistic scenario", () => {
    const pessimistic = calculateScenarioProjection({
      ...baseInput,
      scenario: { ...baseInput.scenario, id: "pessimistic", type: "pessimistic" },
      simulationEvents: [
        {
          id: "sim-loss",
          scenarioId: "pessimistic",
          type: "mission_loss",
          label: "Perte mission",
          startDate: "2026-08-01",
          relatedMissionId: "m1",
          parameters: {},
          isActive: true
        }
      ]
    });
    const optimistic = calculateScenarioProjection({
      ...baseInput,
      scenario: { ...baseInput.scenario, id: "optimistic", type: "optimistic" },
      simulationEvents: [
        {
          id: "sim-rate",
          scenarioId: "optimistic",
          type: "sale_rate_change",
          label: "Hausse TJM",
          startDate: "2026-06-01",
          percentage: 0.1,
          relatedMissionId: "m1",
          parameters: {},
          isActive: true
        }
      ]
    });
    expect(pessimistic.summary.finalClosingCash).toBeLessThan(optimistic.summary.finalClosingCash);
    expect(pessimistic.alerts.some((alert) => alert.type === "treasury_below_threshold")).toBe(true);
  });
});
