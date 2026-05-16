export type ProviderName = "bridge" | "powens" | "tink" | "plaid" | "pennylane" | "sage" | "cegid" | "odoo" | "quickbooks";
export type ProviderEnvironment = "sandbox" | "development" | "production";

export interface ProviderCapabilities {
  supportsOAuth: boolean;
  supportsRefreshToken: boolean;
  supportsWebhooks: boolean;
  supportsIncrementalSync: boolean;
  supportsAccounts: boolean;
  supportsBalances: boolean;
  supportsTransactions: boolean;
  supportsInvoices: boolean;
  supportsPayments: boolean;
  supportsSupplierInvoices: boolean;
  supportsCustomerInvoices: boolean;
  supportsSandbox: boolean;
  supportsBusinessAccounts: boolean;
}

export interface NormalizedBankAccount {
  provider: string;
  externalConnectionId: string;
  externalAccountId: string;
  name: string;
  ibanMasked: string;
  currency: string;
  type: string;
  currentBalance: number;
  availableBalance: number;
  balanceDate: string;
  rawPayload: unknown;
}

export interface NormalizedBankTransaction {
  provider: string;
  externalTransactionId: string;
  externalAccountId: string;
  transactionDate: string;
  bookingDate: string;
  valueDate?: string;
  label: string;
  counterpartyName?: string;
  counterpartyIbanMasked?: string;
  amount: number;
  currency: string;
  direction: "credit" | "debit";
  status: string;
  providerCategory?: string;
  rawPayload: unknown;
}

export interface NormalizedAccountingInvoice {
  provider: string;
  externalInvoiceId: string;
  invoiceNumber: string;
  invoiceType: string;
  customerOrSupplierName: string;
  invoiceDate: string;
  dueDate?: string;
  amountHT: number;
  vatAmount: number;
  amountTTC: number;
  paidAmount: number;
  currency: string;
  status: string;
  rawPayload: unknown;
}

export interface NormalizedAccountingPayment {
  provider: string;
  externalPaymentId: string;
  externalInvoiceId?: string;
  paymentDate: string;
  amount: number;
  currency: string;
  payerOrPayeeName: string;
  method?: string;
  status: string;
  rawPayload: unknown;
}

export interface ProviderConfig {
  provider: ProviderName;
  environment: ProviderEnvironment;
  clientId?: string;
  clientSecret?: string;
  apiBaseUrl?: string;
  redirectUri?: string;
  webhookSecret?: string;
  configuréd: boolean;
}

export interface OAuthTokenResponse {
  accessToken?: string;
  refreshToken?: string;
  expiresInSeconds?: number;
  tokenType?: string;
  scopes?: string[];
  providerAccountId?: string;
}

export interface SyncResult {
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  logs: unknown[];
}

export interface FinancialConnectorProvider {
  getProviderName(): ProviderName;
  getProviderCapabilities(): ProviderCapabilities;
  validateConfig(): { ok: boolean; missing: string[]; environment: ProviderEnvironment };
  createAuthorizationUrl(input: { state: string; redirectUri: string; codeChallenge?: string }): Promise<string>;
  handleOAuthCallback(input: { code?: string; state: string; publicToken?: string }): Promise<OAuthTokenResponse>;
  refreshAccessToken(connectorId: string): Promise<OAuthTokenResponse | undefined>;
  revokeConnection(connectorId: string): Promise<void>;
  testConnection(connectorId?: string): Promise<{ ok: boolean; message: string }>;
  syncAccounts(connectorId: string): Promise<NormalizedBankAccount[]>;
  syncBalances(connectorId: string): Promise<NormalizedBankAccount[]>;
  syncTransactions(connectorId: string, cursor?: string): Promise<{ transactions: NormalizedBankTransaction[]; nextCursor?: string }>;
  syncInvoices(connectorId: string, cursor?: string): Promise<{ invoices: NormalizedAccountingInvoice[]; nextCursor?: string }>;
  syncPayments(connectorId: string, cursor?: string): Promise<{ payments: NormalizedAccountingPayment[]; nextCursor?: string }>;
  handleWebhook(payload: unknown, signature?: string): Promise<{ eventType: string; externalEventId?: string; signatureValid: boolean }>;
  mapError(error: unknown): { category: string; userMessage: string; retryable: boolean; requiresUserAction: boolean; providerErrorCode?: string; providerErrorMessage?: string; technicalDetails?: unknown };
  getRateLimitInfo(headers?: Headers): { remaining?: number; resetAt?: Date; isThrottled: boolean };
}
