import type {
  Client,
  Company,
  Employee,
  FixedCost,
  Freelancer,
  Mission,
  MissionAssignment,
  Partner,
  PartnerResource,
  ProjectionAlert,
  ProjectionSettings,
  VariableCost
} from "./types";

export type ScenarioType = "reference" | "pessimistic" | "realistic" | "optimistic" | "custom";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type InvoiceStatus = "planned" | "issued" | "paid" | "late" | "cancelled";
export type CashStatus = "planned" | "paid" | "late" | "cancelled";
export type AlertStatus = "new" | "seen" | "resolved" | "ignored";
export type EmployeeCostMode = "full_monthly" | "prorated_by_assignment" | "full_with_analytic_split";

export interface ForecastProjectionSettings extends ProjectionSettings {
  defaultSupplierPaymentDelayDays: number;
  initialCash: number;
  criticalCashThreshold: number;
  minimumUtilizationRate: number;
  employeeCostMode: EmployeeCostMode;
}

export interface Scenario {
  id: string;
  name: string;
  type: ScenarioType;
  isActive: boolean;
  riskLevel: RiskLevel;
  author?: string | null;
  createdAt: string;
  notes?: string | null;
}

export interface InvoiceForecast {
  id: string;
  missionId: string;
  scenarioId: string;
  invoiceDate: string;
  dueDate: string;
  expectedPaymentDate: string;
  amountHT: number;
  vatRate?: number | null;
  amountTTC?: number | null;
  status: InvoiceStatus;
  probability: number;
  notes?: string | null;
}

export interface CashInForecast {
  id: string;
  scenarioId: string;
  sourceType: "invoice" | "manual" | "other";
  sourceId?: string | null;
  expectedDate: string;
  amount: number;
  probability: number;
  weightedAmount: number;
  status: CashStatus;
  notes?: string | null;
}

export interface CashOutForecast {
  id: string;
  scenarioId: string;
  sourceType: "salary" | "employer_tax" | "freelancer_invoice" | "partner_invoice" | "fixed_cost" | "variable_cost" | "tax" | "manual" | "other";
  sourceId?: string | null;
  expectedDate: string;
  amount: number;
  status: CashStatus;
  notes?: string | null;
}

export interface SimulationEvent {
  id: string;
  scenarioId: string;
  type:
    | "new_mission"
    | "mission_loss"
    | "mission_delay"
    | "mission_extension"
    | "sale_rate_change"
    | "purchase_rate_change"
    | "employee_hire"
    | "employee_departure"
    | "bench_employee"
    | "fixed_cost_change"
    | "exceptional_cost"
    | "payment_delay"
    | "partial_non_payment";
  label: string;
  startDate: string;
  endDate?: string | null;
  amount?: number | null;
  percentage?: number | null;
  relatedMissionId?: string | null;
  relatedResourceId?: string | null;
  parameters: Record<string, unknown>;
  isActive: boolean;
  notes?: string | null;
}

export interface ScenarioProjectionInput {
  company: Company;
  scenario: Scenario;
  settings: ForecastProjectionSettings;
  employees: Employee[];
  partners: Partner[];
  partnerResources: PartnerResource[];
  freelancers: Freelancer[];
  clients: Client[];
  missions: Mission[];
  assignments: MissionAssignment[];
  fixedCosts: FixedCost[];
  variableCosts: VariableCost[];
  invoiceForecasts: InvoiceForecast[];
  cashInForecasts: CashInForecast[];
  cashOutForecasts: CashOutForecast[];
  simulationEvents: SimulationEvent[];
  startMonth: string;
  horizonMonths: number;
}

export interface ScenarioMonthProjection {
  month: string;
  revenueGenerated: number;
  revenueSigned: number;
  revenueExpected: number;
  revenueWeighted: number;
  revenueInvoiced: number;
  cashInExpected: number;
  cashInWeighted: number;
  costsAccrued: number;
  costsPaid: number;
  cashOutExpected: number;
  employeeCosts: number;
  partnerCosts: number;
  freelancerCosts: number;
  fixedCosts: number;
  variableCosts: number;
  taxCosts: number;
  totalCosts: number;
  grossMargin: number;
  netMargin: number;
  marginRate: number;
  monthlyBalanceAccrual: number;
  monthlyCashBalance: number;
  openingCash: number;
  closingCash: number;
  cumulativeBalance: number;
  soldDays: number;
  internalProducedDays: number;
  externalProducedDays: number;
  internalUtilizationRate: number;
  benchCost: number;
  alerts: ForecastAlert[];
}

export interface ForecastAlert extends Omit<ProjectionAlert, "type"> {
  type: string;
  recommendedAction?: string;
  status: AlertStatus;
}

export interface MissionProfitability {
  missionId: string;
  title: string;
  clientId: string;
  status: string;
  revenueSigned: number;
  revenueExpected: number;
  revenueWeighted: number;
  revenueInvoiced: number;
  cashInExpected: number;
  internalCosts: number;
  externalCosts: number;
  associatedCosts: number;
  grossMargin: number;
  netMargin: number;
  marginRate: number;
  averageSaleRate: number;
  averagePurchaseRate: number;
  soldDays: number;
  producedDays: number;
  riskLevel: RiskLevel;
  profitabilityBadge: "excellent" | "correct" | "weak" | "negative";
}

export interface ResourceProfitability {
  resourceId: string;
  resourceType: "employee" | "partner" | "freelancer";
  name: string;
  revenueGenerated: number;
  costGenerated: number;
  marginGenerated: number;
  utilizationRate: number;
  billedDays: number;
  unbilledDays: number;
  benchCost: number;
  missions: string[];
  averageSaleRate: number;
  averagePurchaseRate: number;
}

export interface CashflowMonth {
  month: string;
  openingCash: number;
  cashIn: number;
  cashOut: number;
  variation: number;
  closingCash: number;
  weightedClosingCash: number;
  status: "healthy" | "watch" | "critical";
}

export interface ScenarioProjectionResult {
  scenarioId: string;
  months: ScenarioMonthProjection[];
  missionProfitability: MissionProfitability[];
  resourceProfitability: ResourceProfitability[];
  cashflow: CashflowMonth[];
  alerts: ForecastAlert[];
  summary: {
    totalRevenueGenerated: number;
    totalRevenueInvoiced: number;
    totalCashIn: number;
    totalCostsAccrued: number;
    totalCashOut: number;
    totalGrossMargin: number;
    finalClosingCash: number;
    finalCumulativeBalance: number;
    averageMarginRate: number;
    averageUtilizationRate: number;
    totalBenchCost: number;
    riskMonths: string[];
  };
}
