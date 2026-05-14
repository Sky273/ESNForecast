import type {
  Employee,
  FixedCost,
  Freelancer,
  Mission,
  MissionAssignment,
  MonthlyProjection,
  PartnerResource,
  ProjectionAlert,
  ProjectionParams,
  ProjectionResult,
  ProjectionSettings,
  VariableCost
} from "./types";

const roundMoney = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;

const toDate = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00.000Z`);

const monthStart = (month: string) => toDate(`${month}-01`);

const formatMonth = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

const addMonths = (date: Date, months: number) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));

const monthEnd = (month: string) => {
  const start = monthStart(month);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
};

const isWithinMonth = (date: string, month: string) => {
  const current = toDate(date);
  return current >= monthStart(month) && current <= monthEnd(month);
};

const overlapsMonth = (startDate: string, endDate: string | null | undefined, month: string) => {
  const start = toDate(startDate);
  const end = endDate ? toDate(endDate) : new Date(Date.UTC(2099, 11, 31));
  return start <= monthEnd(month) && end >= monthStart(month);
};

const monthOverlapRatio = (startDate: string, endDate: string | null | undefined, month: string) => {
  if (!overlapsMonth(startDate, endDate, month)) return 0;
  const start = monthStart(month);
  const end = monthEnd(month);
  const effectiveStart = toDate(startDate) > start ? toDate(startDate) : start;
  const effectiveEnd = endDate && toDate(endDate) < end ? toDate(endDate) : end;
  const totalDays = end.getUTCDate();
  const activeDays = Math.max(0, effectiveEnd.getUTCDate() - effectiveStart.getUTCDate() + 1);
  return activeDays / totalDays;
};

const probability = (mission: Mission, settings: ProjectionSettings) => {
  if (mission.status !== "planned") return 1;
  if (!settings.applyProbabilityToPlannedMissions) return 1;
  return Math.max(0, Math.min(1, mission.signatureProbability));
};

export const calculateEmployeeMonthlyCost = (employee: Employee, settings: ProjectionSettings) => {
  const charges = employee.monthlyEmployerCharges ?? employee.monthlyGrossSalary * (employee.employerChargeRate ?? settings.defaultEmployeeChargeRate);
  return roundMoney(employee.monthlyGrossSalary + charges + employee.benefitsMonthly);
};

export const calculateMissionAssignmentRevenue = (
  mission: Mission,
  assignment: MissionAssignment,
  businessDays: number,
  settings: ProjectionSettings
) => {
  if (assignment.calculationMode === "fixed_monthly_amount") {
    return roundMoney((assignment.fixedMonthlyAmount ?? 0) * probability(mission, settings));
  }
  if (mission.type === "fixed_price" && mission.fixedPriceAmount) {
    return roundMoney((mission.fixedPriceAmount / 3) * probability(mission, settings));
  }
  const days = assignment.calculationMode === "fixed_days_monthly"
    ? assignment.billedDaysPerMonth ?? 0
    : businessDays * assignment.occupancyRate;
  const rate = assignment.specificDailyRate ?? mission.defaultDailyRate;
  return roundMoney(rate * days * probability(mission, settings));
};

export const calculateExternalCost = (
  resource: PartnerResource | Freelancer,
  assignment: MissionAssignment,
  businessDays: number
) => {
  const days = assignment.calculationMode === "fixed_days_monthly"
    ? assignment.billedDaysPerMonth ?? 0
    : businessDays * assignment.occupancyRate;
  const dailyCost = assignment.specificDailyCost ?? resource.dailyCost;
  return roundMoney(dailyCost * days + resource.monthlyFees);
};

export const calculateMissionMargin = (revenue: number, cost: number) => {
  const gross = roundMoney(revenue - cost);
  return { gross, rate: revenue > 0 ? roundMoney(gross / revenue) : 0 };
};

const fixedCostAmountForMonth = (cost: FixedCost, month: string) => {
  if (!overlapsMonth(cost.startDate, cost.endDate, month)) return 0;
  if (cost.recurrence === "monthly") return cost.monthlyAmount;
  if (cost.recurrence === "quarterly") {
    const diff = monthDiff(cost.startDate, `${month}-01`);
    return diff % 3 === 0 ? cost.monthlyAmount * 3 : 0;
  }
  if (cost.recurrence === "annual") {
    const diff = monthDiff(cost.startDate, `${month}-01`);
    return diff % 12 === 0 ? cost.monthlyAmount * 12 : 0;
  }
  return isWithinMonth(cost.startDate, month) ? cost.monthlyAmount : 0;
};

const variableCostAmountForMonth = (cost: VariableCost, month: string) => {
  if (isWithinMonth(cost.date, month)) return cost.amount;
  if (!cost.recurrence || cost.recurrence === "one_time" || monthStart(month) < monthStart(cost.date.slice(0, 7))) return 0;
  const diff = monthDiff(cost.date, `${month}-01`);
  if (cost.recurrence === "monthly") return cost.amount;
  if (cost.recurrence === "quarterly") return diff % 3 === 0 ? cost.amount : 0;
  if (cost.recurrence === "annual") return diff % 12 === 0 ? cost.amount : 0;
  return 0;
};

const monthDiff = (from: string, to: string) => {
  const a = toDate(from);
  const b = toDate(to);
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth();
};

const isMissionRevenueEligible = (mission: Mission) =>
  mission.status !== "cancelled" && mission.status !== "completed" && mission.status !== "suspended";

const missionEndForProjection = (mission: Mission) => mission.actualEndDate ?? mission.estimatedEndDate ?? undefined;

export function calculateMonthlyProjection(params: ProjectionParams): ProjectionResult {
  let cumulative = 0;
  const allAlerts: ProjectionAlert[] = [];
  const start = monthStart(params.startMonth);
  const months: MonthlyProjection[] = [];

  for (let index = 0; index < params.horizonMonths; index += 1) {
    const month = formatMonth(addMonths(start, index));
    const monthAlerts: ProjectionAlert[] = [];
    const missionDetails = new Map<string, { missionId: string; title: string; revenue: number; cost: number; margin: number }>();

    let signedRevenue = 0;
    let expectedRevenue = 0;
    let weightedRevenue = 0;
    let employeeCosts = 0;
    let partnerCosts = 0;
    let freelancerCosts = 0;
    let soldDays = 0;
    let purchasedDays = 0;
    let internalAssignedOccupancy = 0;

    const activeAssignableEmployees = params.employees.filter((employee) =>
      employee.assignable && overlapsMonth(employee.startDate, employee.endDate, month)
    );

    for (const assignment of params.assignments) {
      const mission = params.missions.find((item) => item.id === assignment.missionId);
      if (!mission || !isMissionRevenueEligible(mission)) continue;
      if (!overlapsMonth(mission.startDate, missionEndForProjection(mission), month)) continue;
      if (!overlapsMonth(assignment.startDate, assignment.estimatedEndDate, month)) continue;

      const activeRatio = Math.min(
        monthOverlapRatio(mission.startDate, missionEndForProjection(mission), month),
        monthOverlapRatio(assignment.startDate, assignment.estimatedEndDate, month)
      );
      const businessDays = params.settings.averageBusinessDaysPerMonth * activeRatio;
      const revenue = calculateMissionAssignmentRevenue(mission, assignment, businessDays, params.settings);
      const rawRevenue = calculateMissionAssignmentRevenue(mission, assignment, businessDays, {
        ...params.settings,
        applyProbabilityToPlannedMissions: false
      });

      if (mission.status === "planned") {
        expectedRevenue += rawRevenue;
        weightedRevenue += revenue;
      } else {
        signedRevenue += revenue;
      }

      let cost = 0;
      if (assignment.resourceType === "employee") {
        const employee = params.employees.find((item) => item.id === assignment.resourceId);
        if (employee) {
          cost = calculateEmployeeMonthlyCost(employee, params.settings) * assignment.occupancyRate * activeRatio;
          employeeCosts += cost;
          internalAssignedOccupancy += assignment.occupancyRate * activeRatio;
        }
      } else if (assignment.resourceType === "partner") {
        const partner = params.partnerResources.find((item) => item.id === assignment.resourceId);
        if (partner) {
          cost = calculateExternalCost(partner, assignment, businessDays);
          partnerCosts += cost;
          purchasedDays += businessDays * assignment.occupancyRate;
        }
      } else {
        const freelancer = params.freelancers.find((item) => item.id === assignment.resourceId);
        if (freelancer) {
          cost = calculateExternalCost(freelancer, assignment, businessDays);
          freelancerCosts += cost;
          purchasedDays += businessDays * assignment.occupancyRate;
        }
      }

      soldDays += businessDays * assignment.occupancyRate;
      const current = missionDetails.get(mission.id) ?? { missionId: mission.id, title: mission.title, revenue: 0, cost: 0, margin: 0 };
      current.revenue += revenue;
      current.cost += cost;
      current.margin = current.revenue - current.cost;
      missionDetails.set(mission.id, current);
    }

    for (const employee of params.employees) {
      if (!overlapsMonth(employee.startDate, employee.endDate, month)) continue;
      if (!employee.assignable) {
        employeeCosts += calculateEmployeeMonthlyCost(employee, params.settings);
      }
    }

    const fixedCostRows = params.fixedCosts
      .map((cost) => ({ id: cost.id, label: cost.label, amount: roundMoney(fixedCostAmountForMonth(cost, month)) }))
      .filter((cost) => cost.amount > 0);
    const variableCostRows = params.variableCosts
      .map((cost) => ({ id: cost.id, label: cost.label, amount: roundMoney(variableCostAmountForMonth(cost, month)) }))
      .filter((cost) => cost.amount > 0);
    const fixedCosts = fixedCostRows.reduce((sum, item) => sum + item.amount, 0);
    const variableCosts = variableCostRows.reduce((sum, item) => sum + item.amount, 0);
    const revenueTotal = roundMoney(signedRevenue + weightedRevenue);
    const directCosts = roundMoney(employeeCosts + partnerCosts + freelancerCosts);
    const grossMargin = roundMoney(revenueTotal - directCosts);
    const taxes = grossMargin > 0 ? roundMoney(grossMargin * params.settings.simplifiedTaxRate) : 0;
    const totalCosts = roundMoney(directCosts + fixedCosts + variableCosts + taxes);
    const netBalance = roundMoney(revenueTotal - totalCosts);
    cumulative = roundMoney(cumulative + netBalance);
    const marginRate = revenueTotal > 0 ? roundMoney(grossMargin / revenueTotal) : 0;

    if (netBalance < 0) {
      monthAlerts.push({ type: "negative_balance", severity: "critical", month, message: `Solde négatif prévu en ${month}` });
    }
    if (marginRate > 0 && marginRate < params.settings.minimumMarginRate) {
      monthAlerts.push({ type: "low_margin_rate", severity: "warning", month, message: `Taux de marge inférieur au seuil en ${month}` });
    }
    if (fixedCosts > 0 && revenueTotal > 0 && fixedCosts / revenueTotal > 0.35) {
      monthAlerts.push({ type: "high_fixed_costs", severity: "warning", month, message: `Frais fixes élevés par rapport au CA en ${month}` });
    }
    for (const detail of missionDetails.values()) {
      if (detail.margin < 0) {
        monthAlerts.push({ type: "negative_margin", severity: "critical", month, entityId: detail.missionId, message: `Mission à marge négative: ${detail.title}` });
      }
    }

    allAlerts.push(...monthAlerts);
    months.push({
      month,
      revenue: {
        signed: roundMoney(signedRevenue),
        expected: roundMoney(expectedRevenue),
        weighted: roundMoney(weightedRevenue),
        total: revenueTotal
      },
      costs: {
        employees: roundMoney(employeeCosts),
        partners: roundMoney(partnerCosts),
        freelancers: roundMoney(freelancerCosts),
        fixed: roundMoney(fixedCosts),
        variable: roundMoney(variableCosts),
        taxes,
        total: totalCosts
      },
      margins: {
        gross: grossMargin,
        net: roundMoney(revenueTotal - totalCosts),
        rate: marginRate
      },
      balance: {
        monthly: netBalance,
        cumulative
      },
      activity: {
        soldDays: roundMoney(soldDays),
        purchasedDays: roundMoney(purchasedDays),
        internalUtilizationRate: activeAssignableEmployees.length ? roundMoney(internalAssignedOccupancy / activeAssignableEmployees.length) : 0
      },
      details: {
        missions: Array.from(missionDetails.values()).map((item) => ({
          ...item,
          revenue: roundMoney(item.revenue),
          cost: roundMoney(item.cost),
          margin: roundMoney(item.margin)
        })),
        fixedCosts: fixedCostRows,
        variableCosts: variableCostRows
      },
      alerts: monthAlerts
    });
  }

  const firstMonth = months[0]?.month;
  const assignedEmployeeIds = new Set(params.assignments.filter((assignment) => assignment.resourceType === "employee").map((assignment) => assignment.resourceId));
  for (const employee of params.employees) {
    if (employee.assignable && !assignedEmployeeIds.has(employee.id)) {
      allAlerts.push({
        type: "unassigned_employee",
        severity: "warning",
        month: firstMonth,
        entityId: employee.id,
        message: `Salarié plaçable non affecté: ${employee.firstName} ${employee.lastName}`
      });
    }
  }
  for (const mission of params.missions) {
    if (mission.status === "planned" && mission.signatureProbability < 0.5 && mission.defaultDailyRate >= 800) {
      allAlerts.push({
        type: "low_probability_revenue",
        severity: "info",
        entityId: mission.id,
        message: `Mission prévue contributrice mais peu probable: ${mission.title}`
      });
    }
  }
  for (let i = 1; i < months.length; i += 1) {
    const previous = months[i - 1].revenue.total;
    if (previous > 0 && months[i].revenue.total < previous * 0.65) {
      const alert = { type: "revenue_drop" as const, severity: "warning" as const, month: months[i].month, message: `Baisse forte de CA prévue en ${months[i].month}` };
      months[i].alerts.push(alert);
      allAlerts.push(alert);
    }
  }

  const totalRevenue = roundMoney(months.reduce((sum, item) => sum + item.revenue.total, 0));
  const totalCosts = roundMoney(months.reduce((sum, item) => sum + item.costs.total, 0));
  const totalGrossMargin = roundMoney(months.reduce((sum, item) => sum + item.margins.gross, 0));

  return {
    months,
    summary: {
      totalRevenue,
      totalCosts,
      totalGrossMargin,
      finalCumulativeBalance: months.at(-1)?.balance.cumulative ?? 0,
      averageMarginRate: totalRevenue > 0 ? roundMoney(totalGrossMargin / totalRevenue) : 0,
      riskMonths: months.filter((item) => item.balance.monthly < 0).map((item) => item.month)
    },
    alerts: allAlerts
  };
}
