import {
  calculateEmployeeMonthlyCost,
  calculateExternalCost,
  calculateMissionAssignmentRevenue
} from "./projection";
import type {
  CashInForecast,
  CashOutForecast,
  InvoiceForecast,
  MissionProfitability,
  ResourceProfitability,
  ScenarioMonthProjection,
  ScenarioProjectionInput,
  ScenarioProjectionResult,
  ForecastAlert
} from "./forecastTypes";
import type { Employee, Mission, MissionAssignment, ProjectionSettings } from "./types";

const round = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
const toDate = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
const formatMonth = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
const addDays = (date: string, days: number) => {
  const result = toDate(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
};
const addMonths = (date: Date, months: number) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
const monthStart = (month: string) => toDate(`${month}-01`);
const monthEnd = (month: string) => new Date(Date.UTC(monthStart(month).getUTCFullYear(), monthStart(month).getUTCMonth() + 1, 0));
const monthOf = (date: string) => date.slice(0, 7);
const isInMonth = (date: string, month: string) => monthOf(date) === month;
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
  return Math.max(0, effectiveEnd.getUTCDate() - effectiveStart.getUTCDate() + 1) / end.getUTCDate();
};
const missionEnd = (mission: Mission) => mission.actualEndDate ?? mission.estimatedEndDate ?? undefined;
const missionEligible = (mission: Mission) => mission.status !== "cancelled" && mission.status !== "completed" && mission.status !== "suspended";

export function calculateCashInFromInvoice(invoice: InvoiceForecast): CashInForecast {
  const amount = invoice.amountTTC ?? invoice.amountHT * (1 + (invoice.vatRate ?? 0));
  return {
    id: `cash-in-${invoice.id}`,
    scenarioId: invoice.scenarioId,
    sourceType: "invoice",
    sourceId: invoice.id,
    expectedDate: invoice.expectedPaymentDate,
    amount: round(amount),
    probability: invoice.probability,
    weightedAmount: round(amount * invoice.probability),
    status: invoice.status === "paid" ? "paid" : invoice.status === "cancelled" ? "cancelled" : invoice.status === "late" ? "late" : "planned",
    notes: invoice.notes
  };
}

export function calculateFixedPriceInvoiceSchedule(mission: Mission, scenarioId: string, paymentDelayDays: number): InvoiceForecast[] {
  const amount = mission.fixedPriceAmount ?? 0;
  const start = mission.startDate;
  const middle = addDays(start, 30);
  const end = mission.estimatedEndDate ?? addDays(start, 60);
  const dates = [start, middle, end];
  const shares = [0.3, 0.4, 0.3];
  return dates.map((invoiceDate, index) => ({
    id: `${mission.id}-schedule-${index + 1}`,
    missionId: mission.id,
    scenarioId,
    invoiceDate,
    dueDate: addDays(invoiceDate, paymentDelayDays),
    expectedPaymentDate: addDays(invoiceDate, paymentDelayDays),
    amountHT: round(amount * shares[index]),
    vatRate: 0.2,
    amountTTC: round(amount * shares[index] * 1.2),
    status: "planned",
    probability: mission.status === "planned" ? mission.signatureProbability : 1
  }));
}

export function applySimulationEvents(input: ScenarioProjectionInput): ScenarioProjectionInput {
  const copy: ScenarioProjectionInput = {
    ...input,
    missions: input.missions.map((mission) => ({ ...mission })),
    assignments: input.assignments.map((assignment) => ({ ...assignment })),
    fixedCosts: input.fixedCosts.map((cost) => ({ ...cost })),
    variableCosts: input.variableCosts.map((cost) => ({ ...cost })),
    employees: input.employees.map((employee) => ({ ...employee })),
    invoiceForecasts: input.invoiceForecasts.map((invoice) => ({ ...invoice })),
    cashInForecasts: input.cashInForecasts.map((cashIn) => ({ ...cashIn })),
    cashOutForecasts: input.cashOutForecasts.map((cashOut) => ({ ...cashOut }))
  };
  for (const event of input.simulationEvents.filter((item) => item.isActive)) {
    if (event.type === "mission_loss" && event.relatedMissionId) {
      const mission = copy.missions.find((item) => item.id === event.relatedMissionId);
      if (mission) mission.estimatedEndDate = addDays(event.startDate, -1);
    }
    if (event.type === "mission_delay" && event.relatedMissionId) {
      const mission = copy.missions.find((item) => item.id === event.relatedMissionId);
      const days = Number(event.parameters.days ?? 30);
      if (mission) mission.startDate = addDays(mission.startDate, days);
    }
    if (event.type === "mission_extension" && event.relatedMissionId) {
      const mission = copy.missions.find((item) => item.id === event.relatedMissionId);
      const days = Number(event.parameters.days ?? 30);
      if (mission && mission.estimatedEndDate) mission.estimatedEndDate = addDays(mission.estimatedEndDate, days);
    }
    if (event.type === "sale_rate_change" && event.relatedMissionId) {
      for (const assignment of copy.assignments.filter((item) => item.missionId === event.relatedMissionId)) {
        const baseRate = assignment.specificDailyRate ?? copy.missions.find((mission) => mission.id === assignment.missionId)?.defaultDailyRate ?? 0;
        assignment.specificDailyRate = round(baseRate * (1 + (event.percentage ?? 0)));
      }
    }
    if (event.type === "purchase_rate_change" && event.relatedResourceId) {
      for (const assignment of copy.assignments.filter((item) => item.resourceId === event.relatedResourceId)) {
        if (assignment.specificDailyCost) assignment.specificDailyCost = round(assignment.specificDailyCost * (1 + (event.percentage ?? 0)));
      }
    }
    if (event.type === "exceptional_cost" && event.amount) {
      copy.variableCosts.push({
        id: `sim-cost-${event.id}`,
        label: event.label,
        category: "simulation",
        amount: event.amount,
        date: event.startDate
      });
    }
    if (event.type === "fixed_cost_change" && event.amount) {
      copy.fixedCosts.push({
        id: `sim-fixed-${event.id}`,
        label: event.label,
        category: "simulation",
        monthlyAmount: event.amount,
        startDate: event.startDate,
        endDate: event.endDate,
        recurrence: "monthly"
      });
    }
  }
  return copy;
}

export function calculateBenchCost(input: ScenarioProjectionInput, month: string) {
  const assignedRates = new Map<string, number>();
  for (const assignment of input.assignments.filter((item) => item.resourceType === "employee")) {
    if (overlapsMonth(assignment.startDate, assignment.estimatedEndDate, month)) {
      assignedRates.set(assignment.resourceId, (assignedRates.get(assignment.resourceId) ?? 0) + assignment.occupancyRate);
    }
  }
  const employees = input.employees
    .filter((employee) => employee.assignable && overlapsMonth(employee.startDate, employee.endDate, month))
    .map((employee) => {
      const utilization = Math.min(1, assignedRates.get(employee.id) ?? 0);
      const monthlyCost = calculateEmployeeMonthlyCost(employee, input.settings);
      return {
        employeeId: employee.id,
        name: `${employee.firstName} ${employee.lastName}`,
        utilizationRate: utilization,
        benchCost: round(monthlyCost * (1 - utilization)),
        unassignedDays: round(input.settings.averageBusinessDaysPerMonth * (1 - utilization))
      };
    })
    .filter((employee) => employee.benchCost > 0);
  return {
    employees,
    totalBenchCost: round(employees.reduce((sum, employee) => sum + employee.benchCost, 0))
  };
}

export function calculateScenarioProjection(input: ScenarioProjectionInput): ScenarioProjectionResult {
  const effective = applySimulationEvents(input);
  const months: ScenarioMonthProjection[] = [];
  const alerts: ForecastAlert[] = [];
  const missionStats = new Map<string, MissionProfitability>();
  const resourceStats = new Map<string, ResourceProfitability>();
  const start = monthStart(effective.startMonth);
  let cash = effective.settings.initialCash;
  let cumulativeBalance = 0;

  const generatedInvoices = effective.missions
    .filter((mission) => mission.type === "fixed_price" && mission.fixedPriceAmount)
    .flatMap((mission) => calculateFixedPriceInvoiceSchedule(mission, effective.scenario.id, mission.paymentDelayDays ?? effective.settings.defaultPaymentDelayDays))
    .concat(calculateTimeMaterialInvoiceSchedule(effective));
  const invoices = [...generatedInvoices, ...effective.invoiceForecasts].filter((invoice) => invoice.scenarioId === effective.scenario.id);
  const cashIns = [
    ...invoices.map(calculateCashInFromInvoice),
    ...effective.cashInForecasts.filter((item) => item.scenarioId === effective.scenario.id)
  ].filter((item) => item.status !== "cancelled");
  const manualCashOuts = effective.cashOutForecasts.filter((item) => item.scenarioId === effective.scenario.id && item.status !== "cancelled");

  for (let index = 0; index < effective.horizonMonths; index += 1) {
    const month = formatMonth(addMonths(start, index));
    const monthAlerts: ForecastAlert[] = [];
    let revenueSigned = 0;
    let revenueExpected = 0;
    let revenueWeighted = 0;
    let employeeCosts = 0;
    let partnerCosts = 0;
    let freelancerCosts = 0;
    let soldDays = 0;
    let internalProducedDays = 0;
    let externalProducedDays = 0;
    const openingCash = cash;

    for (const assignment of effective.assignments) {
      const mission = effective.missions.find((item) => item.id === assignment.missionId);
      if (!mission || !missionEligible(mission) || !overlapsMonth(mission.startDate, missionEnd(mission), month) || !overlapsMonth(assignment.startDate, assignment.estimatedEndDate, month)) continue;
      const ratio = Math.min(monthOverlapRatio(mission.startDate, missionEnd(mission), month), monthOverlapRatio(assignment.startDate, assignment.estimatedEndDate, month));
      const businessDays = effective.settings.averageBusinessDaysPerMonth * ratio;
      const revenue = calculateMissionAssignmentRevenue(mission, assignment, businessDays, effective.settings as ProjectionSettings);
      const unweightedRevenue = calculateMissionAssignmentRevenue(mission, assignment, businessDays, { ...effective.settings, applyProbabilityToPlannedMissions: false } as ProjectionSettings);
      if (mission.status === "planned") {
        revenueExpected += unweightedRevenue;
        revenueWeighted += revenue;
      } else {
        revenueSigned += revenue;
      }
      soldDays += businessDays * assignment.occupancyRate;

      let cost = 0;
      if (assignment.resourceType === "employee") {
        const employee = effective.employees.find((item) => item.id === assignment.resourceId);
        if (employee) {
          const monthly = calculateEmployeeMonthlyCost(employee, effective.settings);
          cost = effective.settings.employeeCostMode === "prorated_by_assignment" ? monthly * assignment.occupancyRate * ratio : 0;
          employeeCosts += cost;
          internalProducedDays += businessDays * assignment.occupancyRate;
          addResourceStat(resourceStats, employee.id, "employee", `${employee.firstName} ${employee.lastName}`, revenue, cost, assignment, businessDays);
        }
      } else if (assignment.resourceType === "partner") {
        const resource = effective.partnerResources.find((item) => item.id === assignment.resourceId);
        if (resource) {
          cost = calculateExternalCost(resource, assignment, businessDays);
          partnerCosts += cost;
          externalProducedDays += businessDays * assignment.occupancyRate;
          addResourceStat(resourceStats, resource.id, "partner", `${resource.firstName} ${resource.lastName}`, revenue, cost, assignment, businessDays);
        }
      } else {
        const resource = effective.freelancers.find((item) => item.id === assignment.resourceId);
        if (resource) {
          cost = calculateExternalCost(resource, assignment, businessDays);
          freelancerCosts += cost;
          externalProducedDays += businessDays * assignment.occupancyRate;
          addResourceStat(resourceStats, resource.id, "freelancer", `${resource.firstName} ${resource.lastName}`, revenue, cost, assignment, businessDays);
        }
      }
      addMissionStat(missionStats, mission, revenue, cost, assignment, businessDays);
    }

    for (const employee of effective.employees) {
      if (!overlapsMonth(employee.startDate, employee.endDate, month)) continue;
      if (!employee.assignable || effective.settings.employeeCostMode !== "prorated_by_assignment") {
        employeeCosts += calculateEmployeeMonthlyCost(employee, effective.settings);
      }
    }

    const fixedCosts = effective.fixedCosts.reduce((sum, cost) => sum + fixedCostForMonth(cost.startDate, cost.endDate, cost.monthlyAmount, cost.recurrence, month), 0);
    const variableCosts = effective.variableCosts.reduce((sum, cost) => sum + (isInMonth(cost.date, month) ? cost.amount : 0), 0);
    const revenueGenerated = round(revenueSigned + revenueWeighted);
    const revenueInvoiced = round(invoices.filter((invoice) => isInMonth(invoice.invoiceDate, month) && invoice.status !== "cancelled").reduce((sum, invoice) => sum + invoice.amountHT * invoice.probability, 0));
    const cashInExpected = round(cashIns.filter((item) => isInMonth(item.expectedDate, month)).reduce((sum, item) => sum + item.amount, 0));
    const cashInWeighted = round(cashIns.filter((item) => isInMonth(item.expectedDate, month)).reduce((sum, item) => sum + item.weightedAmount, 0));
    const directCosts = round(employeeCosts + partnerCosts + freelancerCosts);
    const grossMargin = round(revenueGenerated - directCosts);
    const taxCosts = grossMargin > 0 ? round(grossMargin * effective.settings.simplifiedTaxRate) : 0;
    const totalCosts = round(directCosts + fixedCosts + variableCosts + taxCosts);
    const cashOutExpected = round(totalCosts + manualCashOuts.filter((item) => isInMonth(item.expectedDate, month)).reduce((sum, item) => sum + item.amount, 0));
    const bench = calculateBenchCost(effective, month);
    const monthlyBalanceAccrual = round(revenueGenerated - totalCosts);
    const monthlyCashBalance = round(cashInWeighted - cashOutExpected);
    cumulativeBalance = round(cumulativeBalance + monthlyBalanceAccrual);
    cash = round(cash + monthlyCashBalance);
    const utilization = effective.employees.filter((employee) => employee.assignable && overlapsMonth(employee.startDate, employee.endDate, month)).length
      ? round(internalProducedDays / (effective.employees.filter((employee) => employee.assignable && overlapsMonth(employee.startDate, employee.endDate, month)).length * effective.settings.averageBusinessDaysPerMonth))
      : 0;

    if (cash < effective.settings.criticalCashThreshold) {
      monthAlerts.push(makeAlert("treasury_below_threshold", "critical", `Trésorerie sous le seuil critique en ${month}`, month, "Reduire les sorties ou securiser des encaissements."));
    }
    if (monthlyBalanceAccrual < 0) {
      monthAlerts.push(makeAlert("negative_monthly_balance", "warning", `Solde mensuel negatif en ${month}`, month, "Revoir les couts et missions contributrices."));
    }
    if (utilization < effective.settings.minimumUtilizationRate) {
      monthAlerts.push(makeAlert("low_internal_utilization", "warning", `Taux d'occupation interne faible en ${month}`, month, "Prioriser le staffing des consultants disponibles."));
    }
    alerts.push(...monthAlerts);

    months.push({
      month,
      revenueGenerated,
      revenueSigned: round(revenueSigned),
      revenueExpected: round(revenueExpected),
      revenueWeighted: round(revenueWeighted),
      revenueInvoiced,
      cashInExpected,
      cashInWeighted,
      costsAccrued: totalCosts,
      costsPaid: cashOutExpected,
      cashOutExpected,
      employeeCosts: round(employeeCosts),
      partnerCosts: round(partnerCosts),
      freelancerCosts: round(freelancerCosts),
      fixedCosts: round(fixedCosts),
      variableCosts: round(variableCosts),
      taxCosts,
      totalCosts,
      grossMargin,
      netMargin: round(revenueGenerated - totalCosts),
      marginRate: revenueGenerated > 0 ? round(grossMargin / revenueGenerated) : 0,
      monthlyBalanceAccrual,
      monthlyCashBalance,
      openingCash,
      closingCash: cash,
      cumulativeBalance,
      soldDays: round(soldDays),
      internalProducedDays: round(internalProducedDays),
      externalProducedDays: round(externalProducedDays),
      internalUtilizationRate: utilization,
      benchCost: bench.totalBenchCost,
      alerts: monthAlerts
    });
  }

  const missionProfitability = Array.from(missionStats.values()).map(finalizeMissionStat);
  const resourceProfitability = Array.from(resourceStats.values()).map((resource) => ({
    ...resource,
    revenueGenerated: round(resource.revenueGenerated),
    costGenerated: round(resource.costGenerated),
    marginGenerated: round(resource.marginGenerated),
    utilizationRate: round(resource.utilizationRate / Math.max(1, effective.horizonMonths)),
    billedDays: round(resource.billedDays),
    unbilledDays: Math.max(0, round(effective.settings.averageBusinessDaysPerMonth * effective.horizonMonths - resource.billedDays)),
    benchCost: round(resource.benchCost),
    averageSaleRate: resource.billedDays > 0 ? round(resource.revenueGenerated / resource.billedDays) : 0,
    averagePurchaseRate: resource.billedDays > 0 ? round(resource.costGenerated / resource.billedDays) : 0
  }));
  const cashflow = months.map((month) => ({
    month: month.month,
    openingCash: month.openingCash,
    cashIn: month.cashInWeighted,
    cashOut: month.cashOutExpected,
    variation: month.monthlyCashBalance,
    closingCash: month.closingCash,
    weightedClosingCash: month.closingCash,
    status: month.closingCash < effective.settings.criticalCashThreshold ? "critical" as const : month.closingCash < effective.settings.criticalCashThreshold * 2 ? "watch" as const : "healthy" as const
  }));
  const totalRevenueGenerated = round(months.reduce((sum, month) => sum + month.revenueGenerated, 0));
  const totalCostsAccrued = round(months.reduce((sum, month) => sum + month.costsAccrued, 0));
  const totalGrossMargin = round(months.reduce((sum, month) => sum + month.grossMargin, 0));
  return {
    scenarioId: effective.scenario.id,
    months,
    missionProfitability,
    resourceProfitability,
    cashflow,
    alerts,
    summary: {
      totalRevenueGenerated,
      totalRevenueInvoiced: round(months.reduce((sum, month) => sum + month.revenueInvoiced, 0)),
      totalCashIn: round(months.reduce((sum, month) => sum + month.cashInWeighted, 0)),
      totalCostsAccrued,
      totalCashOut: round(months.reduce((sum, month) => sum + month.cashOutExpected, 0)),
      totalGrossMargin,
      finalClosingCash: months.at(-1)?.closingCash ?? effective.settings.initialCash,
      finalCumulativeBalance: months.at(-1)?.cumulativeBalance ?? 0,
      averageMarginRate: totalRevenueGenerated > 0 ? round(totalGrossMargin / totalRevenueGenerated) : 0,
      averageUtilizationRate: months.length ? round(months.reduce((sum, month) => sum + month.internalUtilizationRate, 0) / months.length) : 0,
      totalBenchCost: round(months.reduce((sum, month) => sum + month.benchCost, 0)),
      riskMonths: months.filter((month) => month.closingCash < effective.settings.criticalCashThreshold || month.monthlyBalanceAccrual < 0).map((month) => month.month)
    }
  };
}

function calculateTimeMaterialInvoiceSchedule(input: ScenarioProjectionInput): InvoiceForecast[] {
  const invoices: InvoiceForecast[] = [];
  const start = monthStart(input.startMonth);
  for (let index = 0; index < input.horizonMonths; index += 1) {
    const month = formatMonth(addMonths(start, index));
    for (const mission of input.missions.filter((item) => item.type !== "fixed_price" && missionEligible(item) && overlapsMonth(item.startDate, missionEnd(item), month))) {
      const amount = input.assignments
        .filter((assignment) => assignment.missionId === mission.id && overlapsMonth(assignment.startDate, assignment.estimatedEndDate, month))
        .reduce((sum, assignment) => {
          const ratio = Math.min(monthOverlapRatio(mission.startDate, missionEnd(mission), month), monthOverlapRatio(assignment.startDate, assignment.estimatedEndDate, month));
          return sum + calculateMissionAssignmentRevenue(mission, assignment, input.settings.averageBusinessDaysPerMonth * ratio, { ...input.settings, applyProbabilityToPlannedMissions: false } as ProjectionSettings);
        }, 0);
      if (amount <= 0) continue;
      const invoiceDate = monthEnd(month).toISOString().slice(0, 10);
      const paymentDelay = mission.paymentDelayDays ?? input.clients.find((client) => client.id === mission.clientId)?.paymentDelayDays ?? input.settings.defaultPaymentDelayDays;
      const probability = mission.status === "planned" ? mission.signatureProbability : 1;
      invoices.push({
        id: `${input.scenario.id}-${mission.id}-${month}-tm`,
        missionId: mission.id,
        scenarioId: input.scenario.id,
        invoiceDate,
        dueDate: addDays(invoiceDate, paymentDelay),
        expectedPaymentDate: addDays(invoiceDate, paymentDelay),
        amountHT: round(amount),
        vatRate: 0.2,
        amountTTC: round(amount * 1.2),
        status: "planned",
        probability
      });
    }
  }
  return invoices;
}

function addMissionStat(stats: Map<string, MissionProfitability>, mission: Mission, revenue: number, cost: number, assignment: MissionAssignment, businessDays: number) {
  const current = stats.get(mission.id) ?? {
    missionId: mission.id,
    title: mission.title,
    clientId: mission.clientId,
    status: mission.status,
    revenueSigned: 0,
    revenueExpected: 0,
    revenueWeighted: 0,
    revenueInvoiced: 0,
    cashInExpected: 0,
    internalCosts: 0,
    externalCosts: 0,
    associatedCosts: 0,
    grossMargin: 0,
    netMargin: 0,
    marginRate: 0,
    averageSaleRate: 0,
    averagePurchaseRate: 0,
    soldDays: 0,
    producedDays: 0,
    riskLevel: "low",
    profitabilityBadge: "correct"
  } satisfies MissionProfitability;
  if (mission.status === "planned") current.revenueExpected += revenue;
  else current.revenueSigned += revenue;
  current.revenueWeighted += revenue;
  if (assignment.resourceType === "employee") current.internalCosts += cost;
  else current.externalCosts += cost;
  current.soldDays += businessDays * assignment.occupancyRate;
  current.producedDays += businessDays * assignment.occupancyRate;
  stats.set(mission.id, current);
}

function finalizeMissionStat(mission: MissionProfitability): MissionProfitability {
  const grossMargin = round(mission.revenueWeighted - mission.internalCosts - mission.externalCosts - mission.associatedCosts);
  const marginRate = mission.revenueWeighted > 0 ? round(grossMargin / mission.revenueWeighted) : 0;
  return {
    ...mission,
    revenueSigned: round(mission.revenueSigned),
    revenueExpected: round(mission.revenueExpected),
    revenueWeighted: round(mission.revenueWeighted),
    internalCosts: round(mission.internalCosts),
    externalCosts: round(mission.externalCosts),
    grossMargin,
    netMargin: grossMargin,
    marginRate,
    averageSaleRate: mission.soldDays > 0 ? round(mission.revenueWeighted / mission.soldDays) : 0,
    averagePurchaseRate: mission.producedDays > 0 ? round((mission.internalCosts + mission.externalCosts) / mission.producedDays) : 0,
    soldDays: round(mission.soldDays),
    producedDays: round(mission.producedDays),
    riskLevel: grossMargin < 0 ? "critical" : marginRate < 0.15 ? "high" : marginRate < 0.25 ? "medium" : "low",
    profitabilityBadge: grossMargin < 0 ? "negative" : marginRate < 0.15 ? "weak" : marginRate < 0.35 ? "correct" : "excellent"
  };
}

function addResourceStat(
  stats: Map<string, ResourceProfitability>,
  resourceId: string,
  resourceType: "employee" | "partner" | "freelancer",
  name: string,
  revenue: number,
  cost: number,
  assignment: MissionAssignment,
  businessDays: number
) {
  const days = businessDays * assignment.occupancyRate;
  const current = stats.get(resourceId) ?? {
    resourceId,
    resourceType,
    name,
    revenueGenerated: 0,
    costGenerated: 0,
    marginGenerated: 0,
    utilizationRate: 0,
    billedDays: 0,
    unbilledDays: 0,
    benchCost: 0,
    missions: [],
    averageSaleRate: 0,
    averagePurchaseRate: 0
  };
  current.revenueGenerated += revenue;
  current.costGenerated += cost;
  current.marginGenerated += revenue - cost;
  current.billedDays += days;
  current.utilizationRate += Math.min(1, assignment.occupancyRate);
  if (!current.missions.includes(assignment.missionId)) current.missions.push(assignment.missionId);
  stats.set(resourceId, current);
}

function fixedCostForMonth(startDate: string, endDate: string | null | undefined, monthlyAmount: number, recurrence: string, month: string) {
  if (!overlapsMonth(startDate, endDate, month)) return 0;
  if (recurrence === "monthly") return monthlyAmount;
  const diff = (monthStart(month).getUTCFullYear() - toDate(startDate).getUTCFullYear()) * 12 + monthStart(month).getUTCMonth() - toDate(startDate).getUTCMonth();
  if (recurrence === "quarterly") return diff % 3 === 0 ? monthlyAmount * 3 : 0;
  if (recurrence === "annual") return diff % 12 === 0 ? monthlyAmount * 12 : 0;
  return isInMonth(startDate, month) ? monthlyAmount : 0;
}

function makeAlert(type: string, severity: "info" | "warning" | "critical", message: string, month: string, recommendedAction: string): ForecastAlert {
  return { type, severity, message, month, recommendedAction, status: "new" };
}
