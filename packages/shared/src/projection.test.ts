import { describe, expect, it } from "vitest";
import {
  calculateEmployeeMonthlyCost,
  calculateExternalCost,
  calculateMissionAssignmentRevenue,
  calculateMissionMargin,
  calculateMonthlyProjection
} from "./projection";
import type { ProjectionParams } from "./types";

const baseParams: ProjectionParams = {
  startMonth: "2026-06",
  horizonMonths: 3,
  employees: [
    {
      id: "e1",
      firstName: "Alice",
      lastName: "Martin",
      position: "Consultante",
      status: "consultant",
      assignable: true,
      startDate: "2025-01-01",
      monthlyGrossSalary: 4000,
      employerChargeRate: 0.45,
      benefitsMonthly: 500
    },
    {
      id: "e2",
      firstName: "Bruno",
      lastName: "Sales",
      position: "Commercial",
      status: "sales",
      assignable: false,
      startDate: "2025-01-01",
      monthlyGrossSalary: 4500,
      employerChargeRate: 0.42,
      benefitsMonthly: 300
    }
  ],
  partnerResources: [
    {
      id: "p1",
      partnerId: "partner-1",
      firstName: "Nadia",
      lastName: "Partner",
      role: "DevOps",
      dailyCost: 520,
      monthlyFees: 0,
      availableFrom: "2026-01-01"
    }
  ],
  freelancers: [
    {
      id: "f1",
      firstName: "Ilyes",
      lastName: "Free",
      specialty: "Data",
      dailyCost: 600,
      monthlyFees: 200,
      availableFrom: "2026-01-01"
    }
  ],
  clients: [{ id: "c1", name: "Client A", sector: "Banque", paymentDelayDays: 30 }],
  missions: [
    {
      id: "m1",
      title: "Plateforme data",
      clientId: "c1",
      status: "active",
      type: "time_material",
      startDate: "2026-06-01",
      estimatedEndDate: "2026-08-31",
      defaultDailyRate: 750,
      signatureProbability: 1
    },
    {
      id: "m2",
      title: "Avant-vente IA",
      clientId: "c1",
      status: "planned",
      type: "time_material",
      startDate: "2026-07-01",
      estimatedEndDate: "2026-08-31",
      defaultDailyRate: 850,
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
      estimatedEndDate: "2026-08-31",
      occupancyRate: 1,
      calculationMode: "business_days"
    },
    {
      id: "a2",
      missionId: "m2",
      resourceType: "partner",
      resourceId: "p1",
      startDate: "2026-07-01",
      estimatedEndDate: "2026-08-31",
      occupancyRate: 0.5,
      calculationMode: "business_days",
      specificDailyRate: 850
    }
  ],
  fixedCosts: [
    {
      id: "fc1",
      label: "Loyer",
      category: "locaux",
      monthlyAmount: 3000,
      startDate: "2026-01-01",
      recurrence: "monthly"
    }
  ],
  variableCosts: [
    {
      id: "vc1",
      label: "Matériel",
      category: "equipment",
      amount: 2000,
      date: "2026-07-10"
    }
  ],
  settings: {
    horizonMonths: 3,
    averageBusinessDaysPerMonth: 20,
    defaultEmployeeChargeRate: 0.45,
    overheadRate: 0,
    simplifiedTaxRate: 0,
    revenueRecognitionMode: "billing",
    defaultPaymentDelayDays: 30,
    applyProbabilityToPlannedMissions: true,
    minimumMarginRate: 0.2
  }
};

describe("projection engine", () => {
  it("calculates full employee monthly cost from salary, charges and benefits", () => {
    expect(calculateEmployeeMonthlyCost(baseParams.employees[0], baseParams.settings)).toBe(6300);
  });

  it("calculates time-material mission revenue from days, rate and occupancy", () => {
    const revenue = calculateMissionAssignmentRevenue(baseParams.missions[0], baseParams.assignments[0], 20, baseParams.settings);
    expect(revenue).toBe(15000);
  });

  it("calculates external cost from purchase rate, days and monthly fees", () => {
    const cost = calculateExternalCost(baseParams.partnerResources[0], baseParams.assignments[1], 20);
    expect(cost).toBe(5200);
  });

  it("calculates assignment margin", () => {
    expect(calculateMissionMargin(15000, 6300)).toEqual({ gross: 8700, rate: 0.58 });
  });

  it("calculates monthly projection with weighted planned revenue", () => {
    const projection = calculateMonthlyProjection(baseParams);
    expect(projection.months).toHaveLength(3);
    expect(projection.months[0].revenue.total).toBe(15000);
    expect(projection.months[1].revenue.expected).toBe(8500);
    expect(projection.months[1].revenue.weighted).toBe(4250);
    expect(projection.months[1].costs.fixed).toBe(3000);
    expect(projection.summary.totalRevenue).toBe(53500);
  });

  it("calculates cumulative balance month by month", () => {
    const projection = calculateMonthlyProjection(baseParams);
    expect(projection.months[0].balance.cumulative).toBe(projection.months[0].balance.monthly);
    expect(projection.months[1].balance.cumulative).toBe(
      projection.months[0].balance.monthly + projection.months[1].balance.monthly
    );
  });
});
