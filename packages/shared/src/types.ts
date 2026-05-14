export type ResourceType = "employee" | "partner" | "freelancer";
export type MissionStatus = "draft" | "planned" | "active" | "completed" | "suspended" | "cancelled";
export type MissionType = "time_material" | "fixed_price" | "technical_assistance" | "service_center" | "other";
export type RecurrenceType = "monthly" | "quarterly" | "annual" | "one_time";
export type AssignmentCalculationMode = "business_days" | "fixed_days_monthly" | "fixed_monthly_amount";
export type RevenueRecognitionMode = "billing" | "estimated_collection";

export interface Company {
  id: string;
  name: string;
  currency: string;
  defaultEmployeeSocialRate: number;
  defaultEmployerRate: number;
  defaultOverheadRate?: number | null;
  projectionStartMonth: string;
  defaultProjectionHorizonMonths: number;
}

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  status: "consultant" | "sales" | "administrative" | "management" | "support" | "other";
  assignable: boolean;
  startDate: string;
  endDate?: string | null;
  monthlyGrossSalary: number;
  monthlyEmployerCharges?: number | null;
  employerChargeRate?: number | null;
  benefitsMonthly: number;
  notes?: string | null;
}

export interface Partner {
  id: string;
  name: string;
  notes?: string | null;
}

export interface PartnerResource {
  id: string;
  partnerId: string;
  firstName: string;
  lastName: string;
  role: string;
  dailyCost: number;
  monthlyFees: number;
  availableFrom: string;
  availableTo?: string | null;
  notes?: string | null;
}

export interface Freelancer {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string;
  dailyCost: number;
  monthlyFees: number;
  paymentTerms?: string | null;
  availableFrom: string;
  availableTo?: string | null;
  notes?: string | null;
}

export interface Client {
  id: string;
  name: string;
  sector: string;
  primaryContact?: string | null;
  contactEmail?: string | null;
  paymentDelayDays: number;
  notes?: string | null;
}

export interface Mission {
  id: string;
  title: string;
  clientId: string;
  status: MissionStatus;
  type: MissionType;
  startDate: string;
  estimatedEndDate?: string | null;
  actualEndDate?: string | null;
  defaultDailyRate: number;
  fixedPriceAmount?: number | null;
  signatureProbability: number;
  paymentDelayDays?: number | null;
  notes?: string | null;
}

export interface MissionAssignment {
  id: string;
  missionId: string;
  resourceType: ResourceType;
  resourceId: string;
  startDate: string;
  estimatedEndDate?: string | null;
  specificDailyRate?: number | null;
  specificDailyCost?: number | null;
  occupancyRate: number;
  billedDaysPerMonth?: number | null;
  calculationMode: AssignmentCalculationMode;
  fixedMonthlyAmount?: number | null;
  notes?: string | null;
}

export interface FixedCost {
  id: string;
  label: string;
  category: string;
  monthlyAmount: number;
  startDate: string;
  endDate?: string | null;
  recurrence: RecurrenceType;
  notes?: string | null;
}

export interface VariableCost {
  id: string;
  label: string;
  category: string;
  amount: number;
  date: string;
  recurrence?: RecurrenceType | null;
  missionId?: string | null;
  resourceId?: string | null;
  notes?: string | null;
}

export interface ProjectionSettings {
  horizonMonths: 3 | 6 | 12 | 24;
  averageBusinessDaysPerMonth: number;
  defaultEmployeeChargeRate: number;
  overheadRate: number;
  simplifiedTaxRate: number;
  revenueRecognitionMode: RevenueRecognitionMode;
  defaultPaymentDelayDays: number;
  applyProbabilityToPlannedMissions: boolean;
  minimumMarginRate: number;
}

export interface ProjectionParams {
  startMonth: string;
  horizonMonths: number;
  employees: Employee[];
  partnerResources: PartnerResource[];
  freelancers: Freelancer[];
  clients: Client[];
  missions: Mission[];
  assignments: MissionAssignment[];
  fixedCosts: FixedCost[];
  variableCosts: VariableCost[];
  settings: ProjectionSettings;
}

export interface ProjectionAlert {
  type: "negative_balance" | "negative_margin" | "low_probability_revenue" | "unassigned_employee" | "high_fixed_costs" | "low_margin_rate" | "mission_ending" | "revenue_drop";
  severity: "info" | "warning" | "critical";
  message: string;
  month?: string;
  entityId?: string;
}

export interface MonthlyProjection {
  month: string;
  revenue: {
    signed: number;
    expected: number;
    weighted: number;
    total: number;
  };
  costs: {
    employees: number;
    partners: number;
    freelancers: number;
    fixed: number;
    variable: number;
    taxes: number;
    total: number;
  };
  margins: {
    gross: number;
    net: number;
    rate: number;
  };
  balance: {
    monthly: number;
    cumulative: number;
  };
  activity: {
    soldDays: number;
    purchasedDays: number;
    internalUtilizationRate: number;
  };
  details: {
    missions: Array<{ missionId: string; title: string; revenue: number; cost: number; margin: number }>;
    fixedCosts: Array<{ id: string; label: string; amount: number }>;
    variableCosts: Array<{ id: string; label: string; amount: number }>;
  };
  alerts: ProjectionAlert[];
}

export interface ProjectionResult {
  months: MonthlyProjection[];
  summary: {
    totalRevenue: number;
    totalCosts: number;
    totalGrossMargin: number;
    finalCumulativeBalance: number;
    averageMarginRate: number;
    riskMonths: string[];
  };
  alerts: ProjectionAlert[];
}
