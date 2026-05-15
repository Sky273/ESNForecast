import { calculateMonthlyProjection, calculateScenarioProjection } from "@esn-forecast/shared";
import type { ProjectionParams, ScenarioProjectionInput } from "@esn-forecast/shared";
import { prisma } from "../../db";
import { serializeDates } from "../../utils/serialize";

export async function buildProjection(horizon?: number) {
  const [company, settings, employees, partnerResources, freelancers, clients, missions, assignments, fixedCosts, variableCosts] =
    await Promise.all([
      prisma.company.findFirst(),
      prisma.projectionSettings.findFirst(),
      prisma.employee.findMany(),
      prisma.partnerResource.findMany(),
      prisma.freelancer.findMany(),
      prisma.client.findMany(),
      prisma.mission.findMany(),
      prisma.missionAssignment.findMany(),
      prisma.fixedCost.findMany(),
      prisma.variableCost.findMany()
    ]);

  const effectiveSettings = settings ?? {
    horizonMonths: 12,
    averageBusinessDaysPerMonth: 20,
    defaultEmployeeChargeRate: 0.45,
    overheadRate: 0,
    simplifiedTaxRate: 0.12,
    revenueRecognitionMode: "billing",
    defaultPaymentDelayDays: 30,
    applyProbabilityToPlannedMissions: true,
    minimumMarginRate: 0.2
  };

  const params: ProjectionParams = {
    startMonth: company?.projectionStartMonth ?? new Date().toISOString().slice(0, 7),
    horizonMonths: horizon ?? effectiveSettings.horizonMonths,
    employees: serializeDates(employees) as any,
    partnerResources: serializeDates(partnerResources) as any,
    freelancers: serializeDates(freelancers) as any,
    clients: serializeDates(clients) as any,
    missions: serializeDates(missions) as any,
    assignments: serializeDates(assignments) as any,
    fixedCosts: serializeDates(fixedCosts) as any,
    variableCosts: serializeDates(variableCosts) as any,
    settings: effectiveSettings as any
  };

  return calculateMonthlyProjection(params);
}

export async function buildScenarioProjection(scenarioId?: string, horizon?: number) {
  const [
    company,
    settings,
    scenarios,
    employees,
    partners,
    partnerResources,
    freelancers,
    clients,
    missions,
    assignments,
    fixedCosts,
    variableCosts,
    invoiceForecasts,
    cashInForecasts,
    cashOutForecasts,
    simulationEvents
  ] = await Promise.all([
    prisma.company.findFirst(),
    prisma.projectionSettings.findFirst(),
    prisma.scenario.findMany({ orderBy: [{ isActive: "desc" }, { createdAt: "asc" }] }),
    prisma.employee.findMany(),
    prisma.partner.findMany(),
    prisma.partnerResource.findMany(),
    prisma.freelancer.findMany(),
    prisma.client.findMany(),
    prisma.mission.findMany(),
    prisma.missionAssignment.findMany(),
    prisma.fixedCost.findMany(),
    prisma.variableCost.findMany(),
    prisma.invoiceForecast.findMany(),
    prisma.cashInForecast.findMany(),
    prisma.cashOutForecast.findMany(),
    prisma.simulationEvent.findMany()
  ]);
  const scenario = scenarios.find((item) => item.id === scenarioId) ?? scenarios.find((item) => item.isActive) ?? scenarios[0] ?? {
    id: "reference",
    name: "Reference",
    type: "reference",
    isActive: true,
    riskLevel: "medium",
    createdAt: new Date()
  };
  const effectiveSettings = settings ?? {
    horizonMonths: 12,
    averageBusinessDaysPerMonth: 20,
    defaultEmployeeChargeRate: 0.45,
    overheadRate: 0,
    simplifiedTaxRate: 0.12,
    revenueRecognitionMode: "billing",
    defaultPaymentDelayDays: 30,
    defaultSupplierPaymentDelayDays: 30,
    applyProbabilityToPlannedMissions: true,
    minimumMarginRate: 0.2,
    initialCash: 50000,
    criticalCashThreshold: 15000,
    minimumUtilizationRate: 0.75,
    employeeCostMode: "full_monthly"
  };
  const params: ScenarioProjectionInput = {
    company: serializeDates(company ?? {
      id: "company",
      name: "ESN Forecast",
      currency: "EUR",
      defaultEmployeeSocialRate: 0.22,
      defaultEmployerRate: 0.45,
      projectionStartMonth: new Date().toISOString().slice(0, 7),
      defaultProjectionHorizonMonths: 12
    }) as any,
    scenario: serializeDates(scenario) as any,
    settings: effectiveSettings as any,
    employees: serializeDates(employees) as any,
    partners: serializeDates(partners) as any,
    partnerResources: serializeDates(partnerResources) as any,
    freelancers: serializeDates(freelancers) as any,
    clients: serializeDates(clients) as any,
    missions: serializeDates(missions) as any,
    assignments: serializeDates(assignments) as any,
    fixedCosts: serializeDates(fixedCosts) as any,
    variableCosts: serializeDates(variableCosts) as any,
    invoiceForecasts: serializeDates(invoiceForecasts) as any,
    cashInForecasts: serializeDates(cashInForecasts) as any,
    cashOutForecasts: serializeDates(cashOutForecasts) as any,
    simulationEvents: serializeDates(simulationEvents.filter((item) => item.scenarioId === scenario.id)) as any,
    startMonth: company?.projectionStartMonth ?? new Date().toISOString().slice(0, 7),
    horizonMonths: horizon ?? effectiveSettings.horizonMonths
  };
  return calculateScenarioProjection(params);
}
