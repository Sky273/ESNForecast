import {
  analyzeStrategicDependencies,
  buildAiExecutiveAnalysis,
  buildStaffingForecast,
  calculateCapacityPlan,
  calculateExecutiveSituation,
  calculateMonthlyVariance,
  generateInvoiceFromTimesheet,
  runMonteCarloSimulation,
  runRuleEngine
} from "@esn-forecast/shared";
import type { V2ExecutiveInput } from "@esn-forecast/shared";
import { prisma } from "../../db";
import { buildScenarioProjection } from "../forecasting/projectionService";
import { serializeDates } from "../../utils/serialize";

export async function buildV2Input(scenarioId?: string, horizon?: number): Promise<V2ExecutiveInput> {
  const [
    scenarioProjection,
    timesheets,
    monthlyActuals,
    invoices,
    payments,
    resourceSkills,
    missionSkillNeeds,
    businessRules,
    assumptions,
    clients,
    missions,
    offers,
    plannedHires
  ] = await Promise.all([
    buildScenarioProjection(scenarioId, horizon),
    prisma.timesheet.findMany(),
    prisma.monthlyActual.findMany(),
    prisma.invoice.findMany(),
    prisma.payment.findMany(),
    prisma.resourceSkill.findMany(),
    prisma.missionSkillNeed.findMany(),
    prisma.businessRule.findMany(),
    prisma.probabilisticAssumption.findMany({ where: scenarioId ? { scenarioId } : undefined }),
    prisma.client.findMany(),
    prisma.mission.findMany(),
    prisma.offer.findMany(),
    prisma.plannedHire.findMany({ where: scenarioId ? { scenarioId } : undefined })
  ]);

  return {
    scenarioProjection,
    timesheets: serializeDates(timesheets) as any,
    monthlyActuals: serializeDates(monthlyActuals) as any,
    invoices: serializeDates(invoices) as any,
    payments: serializeDates(payments) as any,
    resourceSkills: serializeDates(resourceSkills) as any,
    missionSkillNeeds: serializeDates(missionSkillNeeds) as any,
    businessRules: businessRules.map((rule) => ({
      ...serializeDates(rule),
      condition: rule.condition as any,
      action: rule.action as any
    })) as any,
    assumptions: serializeDates(assumptions) as any,
    clients: serializeDates(clients) as any,
    missions: serializeDates(missions) as any,
    offers: serializeDates(offers) as any,
    plannedHires: serializeDates(plannedHires) as any
  };
}

export async function buildExecutiveSituation(scenarioId?: string, horizon?: number) {
  return calculateExecutiveSituation(await buildV2Input(scenarioId, horizon));
}

export async function buildVariances(scenarioId?: string, horizon?: number) {
  const input = await buildV2Input(scenarioId, horizon);
  return input.monthlyActuals
    .map((actual) => {
      const month = `${actual.year}-${String(actual.month).padStart(2, "0")}`;
      const forecast = input.scenarioProjection.months.find((item) => item.month === month);
      return forecast ? calculateMonthlyVariance(forecast, actual) : undefined;
    })
    .filter(Boolean);
}

export async function buildCapacity(scenarioId?: string, horizon?: number) {
  const [capacity, skills] = await Promise.all([
    buildV2Input(scenarioId, horizon).then(calculateCapacityPlan),
    prisma.skill.findMany()
  ]);
  const skillsById = new Map(skills.map((skill) => [skill.id, skill]));
  return capacity.map((row) => {
    const skill = skillsById.get(row.skillId);
    return {
      ...row,
      skillName: skill?.name ?? row.skillId,
      skillCategory: skill?.category ?? null,
      skillLabel: skill ? `${skill.name}${skill.category ? ` (${skill.category})` : ""}` : row.skillId
    };
  });
}

export async function buildMissionStaffingForecast(scenarioId?: string, horizon?: number) {
  const [input, assignments, skills, employees, partnerResources, freelancers] = await Promise.all([
    buildV2Input(scenarioId, horizon),
    prisma.missionAssignment.findMany(),
    prisma.skill.findMany(),
    prisma.employee.findMany(),
    prisma.partnerResource.findMany(),
    prisma.freelancer.findMany()
  ]);

  const resources = [
    ...employees.map((resource) => ({
      resourceType: "employee" as const,
      resourceId: resource.id,
      label: `${resource.firstName} ${resource.lastName}`.trim()
    })),
    ...partnerResources.map((resource) => ({
      resourceType: "partner" as const,
      resourceId: resource.id,
      label: `${resource.firstName} ${resource.lastName}`.trim()
    })),
    ...freelancers.map((resource) => ({
      resourceType: "freelancer" as const,
      resourceId: resource.id,
      label: `${resource.firstName} ${resource.lastName}`.trim()
    }))
  ];

  return buildStaffingForecast({
    months: input.scenarioProjection.months.map((month) => month.month),
    clients: input.clients,
    missions: input.missions,
    missionSkillNeeds: input.missionSkillNeeds,
    resourceSkills: input.resourceSkills,
    assignments: serializeDates(assignments) as any,
    skills,
    resources
  });
}

export async function buildStrategicRisks(scenarioId?: string, horizon?: number) {
  return analyzeStrategicDependencies(await buildV2Input(scenarioId, horizon));
}

export async function buildRulesEvaluation(scenarioId?: string, horizon?: number) {
  return runRuleEngine(await buildV2Input(scenarioId, horizon));
}

export async function buildMonteCarlo(scenarioId?: string, horizon?: number, iterations = 500) {
  const result = runMonteCarloSimulation(await buildV2Input(scenarioId, horizon), iterations);
  if (scenarioId) {
    await prisma.monteCarloResult.create({ data: { scenarioId, iterations: result.iterations, result: result as any } });
  }
  return result;
}

export async function buildAiAnalysis(scenarioId?: string, horizon?: number) {
  return buildAiExecutiveAnalysis(await buildExecutiveSituation(scenarioId, horizon));
}

export async function createInvoiceFromTimesheet(timesheetId: string) {
  const timesheet = await prisma.timesheet.findUnique({ where: { id: timesheetId } });
  if (!timesheet) throw new Error("Timesheet not found");
  const mission = await prisma.mission.findUnique({ where: { id: timesheet.missionId } });
  if (!mission) throw new Error("Mission not found");
  const invoice = generateInvoiceFromTimesheet(serializeDates(timesheet) as any, serializeDates(mission) as any, mission.clientId, mission.defaultDailyRate);
  return prisma.invoice.create({
    data: {
      companyId: invoice.companyId,
      clientId: invoice.clientId,
      missionId: invoice.missionId,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: new Date(`${invoice.invoiceDate}T00:00:00.000Z`),
      dueDate: new Date(`${invoice.dueDate}T00:00:00.000Z`),
      amountHT: invoice.amountHT,
      vatRate: invoice.vatRate,
      amountTTC: invoice.amountTTC,
      status: invoice.status,
      paidAmount: invoice.paidAmount,
      source: invoice.source
    }
  });
}
