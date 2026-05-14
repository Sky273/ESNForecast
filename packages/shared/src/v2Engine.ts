import type { Client, Mission } from "./types";
import type { ScenarioMonthProjection } from "./v1Types";
import type {
  AiExecutiveAnalysis,
  BusinessRule,
  CapacityPlanRow,
  ExecutiveSituation,
  Invoice,
  MissionSkillNeed,
  MonthlyActual,
  MonthlyVariance,
  MonteCarloResult,
  ProbabilisticAssumption,
  RuleAlert,
  StrategicDependencyResult,
  Timesheet,
  V2ExecutiveInput
} from "./v2Types";

const EPSILON = 0.000001;

export function generateInvoiceFromTimesheet(
  timesheet: Timesheet,
  mission: Mission,
  clientId: string,
  dailyRate: number
): Invoice {
  if (timesheet.status !== "approved" && timesheet.status !== "locked") {
    throw new Error("Only approved or locked timesheets can generate actual invoices");
  }

  const invoiceDate = monthEnd(timesheet.year, timesheet.month);
  const dueDate = addDays(invoiceDate, 30);
  const amountHT = roundCurrency(timesheet.billableDays * dailyRate);
  const vatRate = 0.2;

  return {
    id: `invoice-${timesheet.id}`,
    companyId: "company-demo",
    clientId,
    missionId: mission.id,
    invoiceNumber: `CRA-${timesheet.year}-${String(timesheet.month).padStart(2, "0")}-${timesheet.id}`,
    invoiceDate,
    dueDate,
    amountHT,
    vatRate,
    amountTTC: roundCurrency(amountHT * (1 + vatRate)),
    status: "issued",
    paidAmount: 0,
    source: "generated_from_timesheet"
  };
}

export function calculateMonthlyVariance(forecast: ScenarioMonthProjection, actual: MonthlyActual): MonthlyVariance {
  const actualCosts =
    actual.actualEmployeeCosts + actual.actualExternalCosts + actual.actualFixedCosts + actual.actualVariableCosts;
  const revenueVariance = roundCurrency(actual.actualRevenueGenerated - forecast.revenueGenerated);
  const costsVariance = roundCurrency(actualCosts - forecast.totalCosts);
  const marginVariance = roundCurrency(actual.actualGrossMargin - forecast.grossMargin);
  const cashVariance = roundCurrency(actual.actualClosingCash - forecast.closingCash);

  return {
    month: forecast.month,
    forecastRevenue: forecast.revenueGenerated,
    actualRevenue: actual.actualRevenueGenerated,
    revenueVariance,
    revenueVariancePercent: percent(revenueVariance, forecast.revenueGenerated),
    forecastCosts: forecast.totalCosts,
    actualCosts,
    costsVariance,
    costsVariancePercent: percent(costsVariance, forecast.totalCosts),
    forecastMargin: forecast.grossMargin,
    actualMargin: actual.actualGrossMargin,
    marginVariance,
    forecastCash: forecast.closingCash,
    actualCash: actual.actualClosingCash,
    cashVariance,
    mainVarianceReasons: explainVariance(revenueVariance, costsVariance, marginVariance, cashVariance)
  };
}

export function calculateCapacityPlan(input: V2ExecutiveInput): CapacityPlanRow[] {
  const months = input.scenarioProjection.months.map((month) => month.month);
  const rows: CapacityPlanRow[] = [];

  for (const month of months) {
    const [year, monthNumber] = month.split("-").map(Number);
    const activeNeeds = input.missionSkillNeeds.filter((need) => dateRangeIntersectsMonth(need, year, monthNumber));
    const skillIds = Array.from(new Set(activeNeeds.map((need) => need.skillId)));

    for (const skillId of skillIds) {
      const availableFTE = input.resourceSkills.filter((skill) => skill.skillId === skillId).length;
      const requiredFTE = activeNeeds
        .filter((need) => need.skillId === skillId)
        .reduce((total, need) => total + need.requiredFTE, 0);
      const gapFTE = roundRatio(availableFTE - requiredFTE);

      rows.push({
        month,
        skillId,
        availableFTE,
        requiredFTE,
        gapFTE,
        status: gapFTE < 0 ? "shortage" : gapFTE > 0 ? "surplus" : "covered"
      });
    }
  }

  return rows.sort((a, b) => a.month.localeCompare(b.month) || a.skillId.localeCompare(b.skillId));
}

export function runMonteCarloSimulation(input: V2ExecutiveInput, iterations: number): MonteCarloResult {
  const safeIterations = Math.max(1, Math.floor(iterations));
  const seed = hashString(input.scenarioProjection.scenarioId || "reference");
  const months = input.scenarioProjection.months.map((month) => {
    const revenueSamples: number[] = [];
    const marginSamples: number[] = [];
    const cashSamples: number[] = [];
    const assumption = input.assumptions.find((item) => item.field === "revenueGenerated");

    for (let index = 0; index < safeIterations; index += 1) {
      const random = seededRandom(seed + index * 9973);
      const revenueDelta = assumption ? sampleAssumption(assumption, random) - assumption.mostLikelyValue : 0;
      const revenue = Math.max(0, month.revenueGenerated + revenueDelta);
      const margin = revenue - month.totalCosts;
      const closingCash = month.closingCash + revenueDelta;
      revenueSamples.push(roundCurrency(revenue));
      marginSamples.push(roundCurrency(margin));
      cashSamples.push(roundCurrency(closingCash));
    }

    return {
      month: month.month,
      revenue: percentiles(revenueSamples),
      margin: percentiles(marginSamples),
      closingCash: percentiles(cashSamples),
      riskBelowZero: roundRatio(cashSamples.filter((value) => value < 0).length / safeIterations)
    };
  });

  return {
    iterations: safeIterations,
    months,
    riskSummary: {
      probabilityNegativeCash: roundRatio(Math.max(...months.map((month) => month.riskBelowZero), 0)),
      mostSensitiveFields: input.assumptions.map((assumption) => assumption.field)
    }
  };
}

export function runRuleEngine(input: V2ExecutiveInput): RuleAlert[] {
  const alerts: RuleAlert[] = [];

  for (const rule of input.businessRules.filter((item) => item.isActive)) {
    for (const month of input.scenarioProjection.months) {
      const metricValue = readMetric(month, rule.condition.metric);
      if (matchesRule(metricValue, rule)) {
        alerts.push({
          id: `rule-${rule.id}-${month.month}`,
          ruleId: rule.id,
          severity: rule.severity,
          message: rule.action.message,
          month: month.month,
          explanation: `${String(rule.condition.metric)}=${String(metricValue)} ${rule.condition.operator} ${String(rule.condition.value)}`
        });
      }
    }
  }

  return alerts;
}

export function analyzeStrategicDependencies(input: V2ExecutiveInput): StrategicDependencyResult {
  const revenueByClient = new Map<string, number>();

  for (const mission of input.missions) {
    const missionRevenue = input.scenarioProjection.months.reduce((total, month) => {
      const missionShare = input.missions.length === 0 ? 0 : month.revenueGenerated / input.missions.length;
      return total + missionShare;
    }, 0);
    revenueByClient.set(mission.clientId, (revenueByClient.get(mission.clientId) ?? 0) + missionRevenue);
  }

  const totalRevenue = Array.from(revenueByClient.values()).reduce((total, value) => total + value, 0);
  const clientsById = new Map(input.clients.map((client) => [client.id, client]));

  return {
    clientConcentration: Array.from(revenueByClient.entries())
      .map(([clientId, revenue]) => {
        const revenueShare = totalRevenue > 0 ? revenue / totalRevenue : 0;
        const client = clientsById.get(clientId);
        const severity: "info" | "warning" | "critical" = revenueShare >= 0.35 ? "critical" : revenueShare >= 0.2 ? "warning" : "info";
        return {
          clientId,
          clientName: client?.name ?? clientId,
          revenue: roundCurrency(revenue),
          revenueShare: roundRatio(revenueShare),
          severity
        };
      })
      .sort((a, b) => b.revenueShare - a.revenueShare)
  };
}

export function calculateExecutiveSituation(input: V2ExecutiveInput): ExecutiveSituation {
  const variances = input.monthlyActuals
    .map((actual) => {
      const monthKey = `${actual.year}-${String(actual.month).padStart(2, "0")}`;
      const forecast = input.scenarioProjection.months.find((month) => month.month === monthKey);
      return forecast ? calculateMonthlyVariance(forecast, actual) : undefined;
    })
    .filter((variance): variance is MonthlyVariance => Boolean(variance));
  const alerts = runRuleEngine(input);
  const capacity = calculateCapacityPlan(input);
  const risks = analyzeStrategicDependencies(input);

  return {
    summary: {
      forecastRevenue: roundCurrency(input.scenarioProjection.summary.totalRevenueGenerated),
      actualRevenue: roundCurrency(input.monthlyActuals.reduce((total, actual) => total + actual.actualRevenueGenerated, 0)),
      revenueVariance: roundCurrency(variances.reduce((total, variance) => total + variance.revenueVariance, 0)),
      finalClosingCash: roundCurrency(input.scenarioProjection.summary.finalClosingCash),
      criticalAlerts: alerts.filter((alert) => alert.severity === "critical").length,
      capacityShortages: capacity.filter((row) => row.status === "shortage").length
    },
    forecast: input.scenarioProjection,
    variances,
    capacity,
    risks,
    alerts,
    monteCarlo: runMonteCarloSimulation(input, 100)
  };
}

export function buildAiExecutiveAnalysis(situation: ExecutiveSituation): AiExecutiveAnalysis {
  const worstVariance = [...situation.variances].sort(
    (a, b) => Math.abs(b.marginVariance) - Math.abs(a.marginVariance)
  )[0];
  const hasCapacityShortage = situation.capacity.some((row) => row.status === "shortage");

  return {
    executiveSummary: `Situation calculee sur ${situation.forecast.months.length} mois avec ${situation.alerts.length} alerte(s).`,
    sourceFacts: [
      `CA previsionnel: ${situation.summary.forecastRevenue}`,
      `CA reel constate: ${situation.summary.actualRevenue}`,
      `Tresorerie finale: ${situation.summary.finalClosingCash}`,
      `Ecarts analyses: ${situation.variances.length}`
    ],
    attentionPoints: [
      ...(worstVariance ? [`Ecart de marge le plus fort en ${worstVariance.month}: ${worstVariance.marginVariance}`] : []),
      ...(hasCapacityShortage ? ["Besoin de capacite non couvert detecte"] : []),
      ...situation.alerts.map((alert) => alert.message)
    ],
    recommendations: [
      worstVariance
        ? `Investiguer les causes principales de l'ecart ${worstVariance.month}: ${worstVariance.mainVarianceReasons.join(", ")}.`
        : "Maintenir une revue mensuelle des ecarts previsionnel/reel.",
      hasCapacityShortage
        ? "Arbitrer entre staffing interne, sous-traitance et recrutement sur les competences en tension."
        : "Conserver le suivi capacite pour anticiper les fins de mission."
    ],
    limits: [
      "Analyse basee uniquement sur les calculs fournis par ESN Forecast.",
      "Aucune donnee externe ou hypothese non renseignee n'est inventee."
    ]
  };
}

function explainVariance(revenueVariance: number, costsVariance: number, marginVariance: number, cashVariance: number) {
  const reasons: string[] = [];
  if (Math.abs(revenueVariance) > EPSILON) {
    reasons.push(revenueVariance < 0 ? "CA reel inferieur au previsionnel" : "CA reel superieur au previsionnel");
  }
  if (Math.abs(costsVariance) > EPSILON) {
    reasons.push(costsVariance > 0 ? "Couts reels superieurs au previsionnel" : "Couts reels inferieurs au previsionnel");
  }
  if (Math.abs(marginVariance) > EPSILON) {
    reasons.push(marginVariance < 0 ? "Marge degradee" : "Marge amelioree");
  }
  if (Math.abs(cashVariance) > EPSILON) {
    reasons.push(cashVariance < 0 ? "Tresorerie sous prevision" : "Tresorerie au-dessus de la prevision");
  }
  return reasons.length > 0 ? reasons : ["Aucun ecart significatif"];
}

function dateRangeIntersectsMonth(need: MissionSkillNeed, year: number, month: number) {
  const start = new Date(`${need.startDate}T00:00:00.000Z`);
  const end = need.endDate ? new Date(`${need.endDate}T00:00:00.000Z`) : new Date(Date.UTC(year, month, 0));
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEndDate = new Date(Date.UTC(year, month, 0));
  return start <= monthEndDate && end >= monthStart;
}

function monthEnd(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function percent(value: number, base: number) {
  return Math.abs(base) > EPSILON ? roundRatio(value / base) : 0;
}

function percentiles(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    p10: percentile(sorted, 0.1),
    p50: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9)
  };
}

function percentile(sortedValues: number[], p: number) {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.floor((sortedValues.length - 1) * p)));
  return roundCurrency(sortedValues[index]);
}

function sampleAssumption(assumption: ProbabilisticAssumption, random: number) {
  if (random > assumption.probability) return assumption.mostLikelyValue;
  if (assumption.distributionType === "fixed") return assumption.mostLikelyValue;
  if (assumption.distributionType === "triangular") {
    const min = assumption.minValue;
    const mode = assumption.mostLikelyValue;
    const max = assumption.maxValue;
    const threshold = (mode - min) / (max - min || 1);
    if (random < threshold) {
      return min + Math.sqrt(random * (max - min) * (mode - min));
    }
    return max - Math.sqrt((1 - random) * (max - min) * (max - mode));
  }
  return assumption.minValue + (assumption.maxValue - assumption.minValue) * random;
}

function readMetric(month: ScenarioMonthProjection, metric: string) {
  return (month as unknown as Record<string, unknown>)[metric];
}

function matchesRule(metricValue: unknown, rule: BusinessRule) {
  const expected = rule.condition.value;
  switch (rule.condition.operator) {
    case "lt":
      return Number(metricValue) < Number(expected);
    case "lte":
      return Number(metricValue) <= Number(expected);
    case "gt":
      return Number(metricValue) > Number(expected);
    case "gte":
      return Number(metricValue) >= Number(expected);
    case "eq":
      return metricValue === expected;
    case "neq":
      return metricValue !== expected;
    default:
      return false;
  }
}

function hashString(value: string) {
  return value.split("").reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 17);
}

function seededRandom(seed: number) {
  const value = Math.sin(seed) * 10000;
  return value - Math.floor(value);
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundRatio(value: number) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}
