import {
  calculateMissionPricing,
  calculateRenegotiationPriority,
  simulatePricing,
  type MissionPricingInput,
  type OverheadAllocationMode,
  type PricingRoundingMode
} from "@esn-forecast/shared";
import { prisma } from "../../db";

const db = prisma as any;
const round = (value: number) => Math.round(value * 100) / 100;

export async function getPricingContext() {
  const [organization, company] = await Promise.all([
    db.organization.findFirst({ orderBy: { createdAt: "asc" } }),
    db.company.findFirst({ orderBy: { name: "asc" } })
  ]);
  if (!organization || !company) throw new Error("Organisation ou societe introuvable.");
  const settings = await db.pricingSettings.findFirst({ where: { companyId: company.id }, orderBy: { createdAt: "desc" } });
  return { organization, company, settings: settings ?? defaultSettings(organization.id, company.id) };
}

export function defaultSettings(organizationId: string, companyId: string) {
  return {
    organizationId,
    companyId,
    defaultTargetMarginRate: 0.3,
    minimumMarginRate: 0.2,
    defaultOverheadAllocationMode: "percentage_of_direct_cost",
    defaultOverheadDailyAmount: 0,
    defaultOverheadRate: 0.08,
    monthlyOverheadPool: 0,
    roundingMode: "nearest_10",
    defaultCommercialDiscountWarningRate: 0.05,
    renegotiationMarginThreshold: 0.25,
    renegotiationReviewPeriodMonths: 3
  };
}

export async function ensurePricingSettings() {
  const { organization, company, settings } = await getPricingContext();
  if (settings.id) return settings;
  return db.pricingSettings.create({ data: defaultSettings(organization.id, company.id) });
}

export async function buildMissionPricingInput(missionId: string): Promise<MissionPricingInput & { mission: any; clientName?: string; companyId: string; organizationId: string }> {
  const { organization, company, settings } = await getPricingContext();
  const mission = await db.mission.findUnique({ where: { id: missionId }, include: { client: true, assignments: true, variableCosts: true } });
  if (!mission) throw new Error("Mission introuvable.");
  const profile = await db.missionPricingProfile.findUnique({ where: { missionId } });
  const businessDays = 20;
  const billableDays = mission.assignments.reduce((total: number, assignment: any) => total + (assignment.billedDaysPerMonth ?? businessDays * (assignment.occupancyRate ?? 1)), 0);
  const revenue = mission.assignments.reduce((total: number, assignment: any) => {
    const days = assignment.billedDaysPerMonth ?? businessDays * (assignment.occupancyRate ?? 1);
    return total + days * (assignment.specificDailyRate ?? mission.defaultDailyRate ?? 0);
  }, 0);
  const directCosts = round(await missionDirectCosts(mission, businessDays));
  const variableCosts = mission.variableCosts.reduce((total: number, cost: any) => total + (cost.amount ?? 0), 0);
  return {
    organizationId: organization.id,
    companyId: company.id,
    mission,
    clientName: mission.client?.name,
    revenue,
    billableDays,
    directCosts: directCosts + variableCosts,
    targetMarginRate: profile?.targetMarginRate ?? settings.defaultTargetMarginRate,
    minimumMarginRate: profile?.minimumMarginRate ?? settings.minimumMarginRate,
    overheadAllocationMode: (profile?.overheadAllocationMode ?? settings.defaultOverheadAllocationMode) as OverheadAllocationMode,
    overheadDailyAmount: profile?.overheadDailyAmount ?? settings.defaultOverheadDailyAmount,
    overheadRate: profile?.overheadRate ?? settings.defaultOverheadRate,
    monthlyOverheadPool: profile?.monthlyOverheadAmount ?? settings.monthlyOverheadPool,
    roundingMode: settings.roundingMode as PricingRoundingMode
  };
}

async function missionDirectCosts(mission: any, businessDays: number) {
  let total = 0;
  for (const assignment of mission.assignments) {
    const days = assignment.billedDaysPerMonth ?? businessDays * (assignment.occupancyRate ?? 1);
    if (assignment.specificDailyCost) {
      total += assignment.specificDailyCost * days;
    } else if (assignment.resourceType === "employee" && assignment.employeeId) {
      const employee = await db.employee.findUnique({ where: { id: assignment.employeeId } });
      const monthlyCost = (employee?.monthlyGrossSalary ?? 0) + (employee?.monthlyEmployerCharges ?? (employee?.monthlyGrossSalary ?? 0) * (employee?.employerChargeRate ?? 0.45)) + (employee?.benefitsMonthly ?? 0);
      total += monthlyCost * (assignment.occupancyRate ?? 1);
    } else if (assignment.resourceType === "partner" && assignment.partnerResourceId) {
      const resource = await db.partnerResource.findUnique({ where: { id: assignment.partnerResourceId } });
      total += (assignment.specificDailyCost ?? resource?.dailyCost ?? 0) * days + (resource?.monthlyFees ?? 0);
    } else if (assignment.resourceType === "freelancer" && assignment.freelancerId) {
      const freelancer = await db.freelancer.findUnique({ where: { id: assignment.freelancerId } });
      total += (assignment.specificDailyCost ?? freelancer?.dailyCost ?? 0) * days + (freelancer?.monthlyFees ?? 0);
    }
  }
  return total;
}

export async function calculateMissionProfile(missionId: string) {
  const input = await buildMissionPricingInput(missionId);
  const result = calculateMissionPricing(input);
  const profile = await db.missionPricingProfile.upsert({
    where: { missionId },
    create: {
      organizationId: input.organizationId,
      companyId: input.companyId,
      missionId,
      targetMarginRate: input.targetMarginRate,
      minimumMarginRate: input.minimumMarginRate,
      overheadAllocationMode: input.overheadAllocationMode,
      overheadDailyAmount: input.overheadDailyAmount,
      overheadRate: input.overheadRate,
      monthlyOverheadAmount: input.monthlyOverheadPool,
      pricingStatus: result.status,
      currentAverageSaleDailyRate: result.currentDailyRate,
      calculatedFloorDailyRate: result.floorDailyRate,
      recommendedDailyRate: result.recommendedDailyRate,
      currentMarginRate: result.currentMarginRate,
      targetMarginGap: result.targetMarginGap,
      monthlyImpactAmount: result.monthlyImpactAmount,
      annualizedImpactAmount: result.annualizedImpactAmount,
      lastCalculatedAt: new Date()
    },
    update: {
      pricingStatus: result.status,
      currentAverageSaleDailyRate: result.currentDailyRate,
      calculatedFloorDailyRate: result.floorDailyRate,
      recommendedDailyRate: result.recommendedDailyRate,
      currentMarginRate: result.currentMarginRate,
      targetMarginGap: result.targetMarginGap,
      monthlyImpactAmount: result.monthlyImpactAmount,
      annualizedImpactAmount: result.annualizedImpactAmount,
      lastCalculatedAt: new Date()
    }
  });
  return { mission: input.mission, clientName: input.clientName, input, result, profile };
}

export async function listUnderpricedMissions() {
  const missions = await db.mission.findMany({ include: { client: true }, orderBy: { title: "asc" } });
  const rows = [];
  for (const mission of missions) {
    const analysis = await calculateMissionProfile(mission.id);
    if (["underpriced", "critical", "renegotiation_recommended", "watch"].includes(analysis.result.status)) {
      rows.push(toMissionPricingRow(analysis));
    }
  }
  return rows.sort((a, b) => b.annualizedImpactAmount - a.annualizedImpactAmount);
}

export async function recalculateRenegotiationCandidates() {
  const rows = await listUnderpricedMissions();
  const { settings } = await getPricingContext();
  await db.renegotiationCandidate.deleteMany({});
  const created = [];
  for (const row of rows.filter((item) => item.currentMarginRate < settings.renegotiationMarginThreshold || item.currentDailyRate < item.recommendedDailyRate)) {
    const priority = calculateRenegotiationPriority({
      marginGap: row.currentMarginRate - row.targetMarginRate,
      monthlyImpactAmount: row.monthlyImpactAmount,
      currentDailyRate: row.currentDailyRate,
      recommendedDailyRate: row.recommendedDailyRate,
      remainingMonths: 6,
      isCriticalMission: row.pricingStatus === "critical"
    });
    created.push(await db.renegotiationCandidate.create({
      data: {
        organizationId: row.organizationId,
        companyId: row.companyId,
        missionId: row.missionId,
        reason: row.currentDailyRate < row.calculatedFloorDailyRate ? "TJM sous le plancher" : "Marge inférieure à la cible",
        severity: priority.severity,
        currentDailyRate: row.currentDailyRate,
        floorDailyRate: row.calculatedFloorDailyRate,
        recommendedDailyRate: row.recommendedDailyRate,
        targetDailyRate: row.recommendedDailyRate,
        marginGap: round(row.currentMarginRate - row.targetMarginRate),
        monthlyImpactAmount: row.monthlyImpactAmount,
        annualizedImpactAmount: row.annualizedImpactAmount,
        priorityScore: priority.score,
        priorityFactors: priority.factors,
        status: "new",
        nextReviewDate: new Date(Date.now() + settings.renegotiationReviewPeriodMonths * 30 * 24 * 60 * 60 * 1000)
      }
    }));
  }
  return created.sort((a, b) => b.priorityScore - a.priorityScore);
}

export async function enrichMissionLabels<T extends { missionId?: string | null }>(rows: T[]) {
  const missionIds = [...new Set(rows.map((row) => row.missionId).filter(Boolean))] as string[];
  if (!missionIds.length) return rows;
  const missions = await db.mission.findMany({ where: { id: { in: missionIds } }, include: { client: true } });
  const missionsById = new Map(missions.map((mission: any) => [
    mission.id,
    {
      missionTitle: mission.title,
      missionLabel: mission.client?.name ? `${mission.title} - ${mission.client.name}` : mission.title,
      clientName: mission.client?.name
    }
  ]));
  return rows.map((row) => ({ ...row, ...(missionsById.get(String(row.missionId)) ?? {}) }));
}

export async function createPricingSimulation(missionId: string, payload: any) {
  const { pricingInput, effectivePayload, output } = await previewPricingSimulation(missionId, payload);
  const simulation = await db.pricingSimulation.create({
    data: {
      organizationId: pricingInput.organizationId,
      companyId: pricingInput.companyId,
      missionId,
      scenarioId: effectivePayload?.scenarioId,
      name: effectivePayload?.name ?? "Simulation pricing",
      input: effectivePayload ?? {},
      output,
      createdBy: effectivePayload?.createdBy ?? "finance",
      variants: {
        create: [
          { name: "Actuel", dailyRate: pricingInput.billableDays ? pricingInput.revenue / pricingInput.billableDays : 0, discountRate: 0, result: calculateMissionPricing(pricingInput), isSelected: false },
          { name: "Simule", dailyRate: output.simulatedDailyRate, discountRate: effectivePayload?.discountRate ?? 0, costAssumptions: effectivePayload ?? {}, result: output, isSelected: true }
        ]
      }
    },
    include: { variants: true }
  });
  return simulation;
}

export async function previewPricingSimulation(missionId: string, payload: any) {
  const input = await buildMissionPricingInput(missionId);
  const requestedBillableDays = Number(payload?.changedBillableDays ?? payload?.billableDays ?? input.billableDays);
  const requestedDirectDailyCost = Number(payload?.simulatedDirectDailyCost ?? payload?.directDailyCost ?? 0);
  const effectivePayload = {
    ...payload,
    changedBillableDays: requestedBillableDays > 0 ? requestedBillableDays : 20,
    simulatedDirectDailyCost: requestedDirectDailyCost > 0
      ? requestedDirectDailyCost
      : input.billableDays > 0
        ? round(input.directCosts / input.billableDays)
        : undefined
  };
  const output = simulatePricing({ ...input, ...effectivePayload });
  return {
    missionId,
    name: effectivePayload?.name ?? "Simulation pricing",
    input: effectivePayload ?? {},
    output,
    pricingInput: input,
    effectivePayload
  };
}

export function toMissionPricingRow(analysis: any) {
  const { mission, clientName, input, result, profile } = analysis;
  return {
    organizationId: input.organizationId,
    companyId: input.companyId,
    missionId: mission.id,
    missionTitle: mission.title,
    clientName,
    pricingStatus: result.status,
    targetMarginRate: input.targetMarginRate,
    minimumMarginRate: input.minimumMarginRate,
    currentDailyRate: result.currentDailyRate,
    calculatedFloorDailyRate: result.floorDailyRate,
    recommendedDailyRate: result.recommendedDailyRate,
    currentMarginRate: result.currentMarginRate,
    targetMarginGap: result.targetMarginGap,
    monthlyImpactAmount: result.monthlyImpactAmount,
    annualizedImpactAmount: result.annualizedImpactAmount,
    fullDailyCost: result.fullDailyCost,
    billableDays: result.billableDays,
    missingData: result.missingData,
    profileId: profile.id
  };
}

export async function pricingDashboard() {
  const missions = await db.mission.findMany();
  const rows = await listUnderpricedMissions();
  const candidates = await db.renegotiationCandidate.findMany({ orderBy: { priorityScore: "desc" } });
  const topCandidates = await enrichMissionLabels(candidates.slice(0, 8));
  const healthyCount = Math.max(0, missions.length - rows.filter((row) => ["underpriced", "critical", "renegotiation_recommended"].includes(row.pricingStatus)).length);
  return {
    missionsAnalyzed: missions.length,
    healthyMissions: healthyCount,
    underpricedMissions: rows.filter((row) => ["underpriced", "critical"].includes(row.pricingStatus)).length,
    renegotiationCandidates: candidates.length,
    potentialMonthlyGain: round(candidates.reduce((total: number, row: any) => total + row.monthlyImpactAmount, 0)),
    potentialAnnualGain: round(candidates.reduce((total: number, row: any) => total + row.annualizedImpactAmount, 0)),
    averageCurrentMargin: rows.length ? round(rows.reduce((total, row) => total + row.currentMarginRate, 0) / rows.length) : 0,
    topCandidates,
    underpriced: rows.slice(0, 10)
  };
}
