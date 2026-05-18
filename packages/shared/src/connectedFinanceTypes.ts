import type { Invoice, Payment } from "./deliveryTypes";
import type { ScenarioProjectionResult } from "./forecastTypes";

export type ConnectorType = "accounting" | "banking" | "invoicing" | "crm" | "hr" | "generic_csv";
export type ConnectorStatus = "inactive" | "connected" | "error" | "expired" | "syncing" | "disconnected";

export interface Connector {
  id: string;
  organizationId: string;
  companyId: string;
  type: ConnectorType;
  provider: string;
  name: string;
  status: ConnectorStatus;
  lastSyncAt?: string;
  nextSyncAt?: string;
  errorMessage?: string;
}

export interface BankAccount {
  id: string;
  organizationId: string;
  companyId: string;
  bankConnectionId: string;
  externalAccountId: string;
  name: string;
  ibanMasked: string;
  currency: string;
  type: "checking" | "savings" | "credit" | "other";
  currentBalance: number;
  availableBalance: number;
  balanceDate: string;
  isActive: boolean;
}

export interface BankTransaction {
  id: string;
  organizationId: string;
  companyId: string;
  bankAccountId: string;
  externalTransactionId: string;
  transactionDate: string;
  bookingDate: string;
  valueDate?: string;
  label: string;
  counterpartyName?: string;
  counterpartyIbanMasked?: string;
  amount: number;
  currency: string;
  direction: "credit" | "debit";
  status: "pending" | "booked" | "cancelled";
  categoryId?: string;
  categorizationStatus: "uncategorized" | "auto_categorized" | "manually_categorized" | "rule_categorized";
  reconciliationStatus: "unreconciled" | "suggested" | "reconciled" | "ignored";
  confidenceScore: number;
}

export interface FinancialCategory {
  id: string;
  organizationId: string;
  name: string;
  type: string;
  parentId?: string;
  isSystem: boolean;
  isActive: boolean;
}

export interface BankCategorizationRule {
  id: string;
  organizationId: string;
  name: string;
  priority: number;
  isActive: boolean;
  condition: {
    labelContains?: string;
    counterpartyContains?: string;
    direction?: "credit" | "debit";
    minAmount?: number;
    maxAmount?: number;
  };
  targetCategoryId: string;
  autoApply: "never" | "if_high_confidence" | "always";
}

export interface CategorizationResult {
  transactionId: string;
  categoryId?: string;
  status: BankTransaction["categorizationStatus"];
  confidenceScore: number;
  explanation: string;
}

export interface ConnectedReconciliationSuggestion {
  id: string;
  organizationId: string;
  transactionId: string;
  targetType: "invoice" | "payment" | "supplier_invoice" | "fixed_cost" | "variable_cost" | "payroll" | "tax" | "manual" | "unknown";
  targetId?: string;
  confidenceScore: number;
  reason: string;
  status: "pending" | "accepted" | "rejected" | "ignored";
}

export interface ClientPaymentProfile {
  clientId: string;
  averagePaymentDelayDays: number;
  medianPaymentDelayDays: number;
  averageLateDays: number;
  latePaymentRate: number;
  totalLateAmount: number;
  reliabilityScore: number;
  recommendedForecastDelayDays: number;
}

export interface ForecastReliabilityScore {
  scenarioId: string;
  month: string;
  score: number;
  confidenceLevel: "low" | "medium" | "high";
  factors: Record<string, number>;
  explanation: string;
}

export interface TreasuryActualVsForecastRow {
  month: string;
  forecastClosingCash: number;
  actualClosingCash: number;
  recalibratedClosingCash: number;
  variance: number;
  reliabilityScore: number;
}

export interface ConnectedReforecastSuggestion {
  type: "adjust_cash_balance";
  targetType: "treasury_month";
  targetId: string;
  currentValue: Record<string, number | string>;
  suggestedValue: Record<string, number | string>;
  impactAmount: number;
  impactMonth: string;
  explanation: string;
  confidenceScore: number;
  status: "pending";
}

export interface RunwayAnalysis {
  currentCash: number;
  averageMonthlyBurn: number;
  runwayWithoutNewRevenueMonths: number;
  runwayWeightedMonths: number;
  criticalDate?: string;
  assumptions: string[];
  recommendedActions: string[];
}

export interface FinancialAnomaly {
  id: string;
  organizationId: string;
  type: string;
  severity: "info" | "warning" | "critical";
  entityType: string;
  entityId: string;
  amount: number;
  explanation: string;
  suggestedAction: string;
  status: "new" | "reviewed" | "resolved" | "ignored";
}

export interface DataQualityIssue {
  id: string;
  organizationId: string;
  type: string;
  severity: "info" | "warning" | "critical";
  entityType: string;
  entityId: string;
  message: string;
  suggestedFix: string;
  status: "open" | "fixed" | "ignored";
}

export interface ConnectedFinanceInput {
  organizationId: string;
  companyId: string;
  scenarioId: string;
  projection: ScenarioProjectionResult;
  bankAccounts: BankAccount[];
  bankTransactions: BankTransaction[];
  invoices: Invoice[];
  payments: Payment[];
  categories: FinancialCategory[];
  categorizationRules: BankCategorizationRule[];
  connectors: Connector[];
}

export interface ConnectedFinanceSituation {
  bankSummary: {
    currentCash: number;
    accounts: number;
    lastBalanceDate?: string;
  };
  treasury: TreasuryActualVsForecastRow[];
  reconciliationSuggestions: ConnectedReconciliationSuggestion[];
  clientPaymentProfiles: ClientPaymentProfile[];
  reliabilityScores: ForecastReliabilityScore[];
  runway: RunwayAnalysis;
  anomalies: FinancialAnomaly[];
  dataQualityIssues: DataQualityIssue[];
  connectorHealth: {
    active: number;
    errors: number;
    expired: number;
    stale: number;
  };
}
