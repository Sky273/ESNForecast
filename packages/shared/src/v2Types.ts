import type { Client, Mission, MissionAssignment, ResourceType } from "./types";
import type { ScenarioMonthProjection, ScenarioProjectionResult } from "./v1Types";

export type ResourceTypeV2 = "employee" | "partner_resource" | "freelancer";

export type TimesheetStatus = "draft" | "submitted" | "approved" | "rejected" | "locked";

export interface Timesheet {
  id: string;
  resourceType: ResourceTypeV2;
  resourceId: string;
  missionId: string;
  month: number;
  year: number;
  workedDays: number;
  billableDays: number;
  nonBillableDays: number;
  absenceDays: number;
  vacationDays: number;
  sickLeaveDays: number;
  trainingDays: number;
  internalDays: number;
  status: TimesheetStatus;
  submittedBy?: string;
  approvedBy?: string;
  submittedAt?: string;
  approvedAt?: string;
  notes?: string;
}

export interface MonthlyActual {
  id: string;
  companyId: string;
  month: number;
  year: number;
  actualRevenueGenerated: number;
  actualRevenueInvoiced: number;
  actualCashIn: number;
  actualEmployeeCosts: number;
  actualExternalCosts: number;
  actualFixedCosts: number;
  actualVariableCosts: number;
  actualCashOut: number;
  actualGrossMargin: number;
  actualNetMargin: number;
  actualClosingCash: number;
  notes?: string;
  lockedAt?: string;
  lockedBy?: string;
}

export interface MonthlyVariance {
  month: string;
  forecastRevenue: number;
  actualRevenue: number;
  revenueVariance: number;
  revenueVariancePercent: number;
  forecastCosts: number;
  actualCosts: number;
  costsVariance: number;
  costsVariancePercent: number;
  forecastMargin: number;
  actualMargin: number;
  marginVariance: number;
  forecastCash: number;
  actualCash: number;
  cashVariance: number;
  mainVarianceReasons: string[];
}

export type V2InvoiceStatus = "draft" | "issued" | "partially_paid" | "paid" | "overdue" | "cancelled";

export interface Invoice {
  id: string;
  companyId: string;
  clientId: string;
  missionId?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  amountHT: number;
  vatRate: number;
  amountTTC: number;
  status: V2InvoiceStatus;
  paymentDate?: string;
  paidAmount: number;
  source: "manual" | "imported" | "generated_from_timesheet" | "accounting_connector";
  notes?: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  clientId: string;
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  status: "received" | "pending" | "cancelled";
  notes?: string;
}

export interface ResourceSkill {
  id: string;
  resourceType: ResourceTypeV2;
  resourceId: string;
  skillId: string;
  level: "junior" | "confirmed" | "senior" | "expert";
  yearsExperience?: number;
  lastUsedAt?: string;
}

export interface MissionSkillNeed {
  id: string;
  missionId: string;
  skillId: string;
  requiredLevel: "junior" | "confirmed" | "senior" | "expert";
  requiredFTE: number;
  startDate: string;
  endDate?: string;
  priority: "low" | "medium" | "high" | "critical";
}

export interface CapacityPlanRow {
  month: string;
  skillId: string;
  availableFTE: number;
  requiredFTE: number;
  gapFTE: number;
  status: "surplus" | "covered" | "shortage";
}

export interface StaffingForecastResourceLabel {
  resourceType: ResourceType;
  resourceId: string;
  label: string;
}

export interface StaffingForecastSkill {
  id: string;
  name: string;
  category?: string | null;
}

export interface StaffingForecastInput {
  months: string[];
  clients: Client[];
  missions: Mission[];
  missionSkillNeeds: MissionSkillNeed[];
  resourceSkills: ResourceSkill[];
  assignments: MissionAssignment[];
  skills: StaffingForecastSkill[];
  resources: StaffingForecastResourceLabel[];
}

export interface StaffingForecastAssignedResource {
  assignmentId: string;
  resourceType: ResourceType;
  resourceId: string;
  resourceName: string;
  occupancyRate: number;
  startDate: string;
  estimatedEndDate?: string | null;
}

export interface StaffingForecastRow {
  id: string;
  month: string;
  missionId: string;
  missionTitle: string;
  clientId: string;
  clientName: string;
  skillId: string;
  skillLabel: string;
  requiredLevel: string;
  priority: string;
  requiredFTE: number;
  assignedFTE: number;
  gapFTE: number;
  status: "staffed" | "partial" | "uncovered" | "surplus";
  assignedResources: StaffingForecastAssignedResource[];
  recommendedAction: string;
}

export interface StaffingForecastResult {
  rows: StaffingForecastRow[];
  summary: {
    totalNeeds: number;
    staffedNeeds: number;
    partialNeeds: number;
    uncoveredNeeds: number;
    surplusNeeds: number;
    totalRequiredFTE: number;
    totalAssignedFTE: number;
    totalGapFTE: number;
  };
}

export interface BusinessRule {
  id: string;
  name: string;
  description?: string;
  triggerType: string;
  condition: {
    metric: keyof ScenarioMonthProjection | string;
    operator: "lt" | "lte" | "gt" | "gte" | "eq" | "neq";
    value: number | string | boolean;
  };
  action: {
    type: "alert" | "notification";
    message: string;
  };
  severity: "info" | "warning" | "critical";
  isActive: boolean;
}

export interface RuleAlert {
  id: string;
  ruleId: string;
  severity: BusinessRule["severity"];
  message: string;
  month?: string;
  explanation: string;
}

export interface ProbabilisticAssumption {
  id: string;
  scenarioId: string;
  entityType: string;
  entityId: string;
  field: string;
  distributionType: "fixed" | "triangular" | "normal_simplified" | "discrete";
  minValue: number;
  mostLikelyValue: number;
  maxValue: number;
  probability: number;
  notes?: string;
}

export interface MonteCarloPercentiles {
  p10: number;
  p50: number;
  p90: number;
}

export interface MonteCarloMonth {
  month: string;
  revenue: MonteCarloPercentiles;
  margin: MonteCarloPercentiles;
  closingCash: MonteCarloPercentiles;
  riskBelowZero: number;
}

export interface MonteCarloResult {
  iterations: number;
  months: MonteCarloMonth[];
  riskSummary: {
    probabilityNegativeCash: number;
    mostSensitiveFields: string[];
  };
}

export interface Offer {
  id: string;
  clientId: string;
  title: string;
  status: "draft" | "internal_review" | "sent" | "accepted" | "rejected" | "expired";
  totalAmount: number;
  expectedMargin: number;
  probability: number;
}

export interface PlannedHire {
  id: string;
  scenarioId: string;
  title: string;
  expectedStartDate: string;
  expectedFullCost: number;
  expectedTJM: number;
  expectedUtilizationRate: number;
  probability: number;
  status: "planned" | "approved" | "recruiting" | "hired" | "cancelled";
}

export interface StrategicDependencyResult {
  clientConcentration: Array<{
    clientId: string;
    clientName: string;
    revenue: number;
    revenueShare: number;
    severity: "info" | "warning" | "critical";
  }>;
}

export interface ExecutiveSituation {
  summary: {
    forecastRevenue: number;
    actualRevenue: number;
    revenueVariance: number;
    finalClosingCash: number;
    criticalAlerts: number;
    capacityShortages: number;
  };
  forecast: ScenarioProjectionResult;
  variances: MonthlyVariance[];
  capacity: CapacityPlanRow[];
  risks: StrategicDependencyResult;
  alerts: RuleAlert[];
  monteCarlo?: MonteCarloResult;
}

export interface AiExecutiveAnalysis {
  executiveSummary: string;
  sourceFacts: string[];
  attentionPoints: string[];
  recommendations: string[];
  limits: string[];
}

export interface V2ExecutiveInput {
  scenarioProjection: ScenarioProjectionResult;
  timesheets: Timesheet[];
  monthlyActuals: MonthlyActual[];
  invoices: Invoice[];
  payments: Payment[];
  resourceSkills: ResourceSkill[];
  missionSkillNeeds: MissionSkillNeed[];
  businessRules: BusinessRule[];
  assumptions: ProbabilisticAssumption[];
  clients: Client[];
  missions: Mission[];
  offers: Offer[];
  plannedHires: PlannedHire[];
}
