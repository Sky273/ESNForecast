import { createHmac } from "node:crypto";
import { secretManager } from "./secretManager";
import type {
  FinancialConnectorProvider,
  NormalizedAccountingInvoice,
  NormalizedAccountingPayment,
  NormalizedBankAccount,
  NormalizedBankTransaction,
  OAuthTokenResponse,
  ProviderCapabilities,
  ProviderConfig,
  ProviderName
} from "./types";

export abstract class BaseProvider implements FinancialConnectorProvider {
  constructor(protected config: ProviderConfig) {}

  abstract getProviderName(): ProviderName;
  abstract getProviderCapabilities(): ProviderCapabilities;

  validateConfig() {
    const missing = [];
    if (!this.config.clientId) missing.push(`${this.envPrefix()}_CLIENT_ID`);
    if (!this.config.clientSecret) missing.push(this.getProviderName() === "plaid" ? "PLAID_SECRET" : `${this.envPrefix()}_CLIENT_SECRET`);
    return { ok: missing.length === 0, missing, environment: this.config.environment };
  }

  async createAuthorizationUrl(input: { state: string; redirectUri: string; codeChallenge?: string }) {
    if (!this.validateConfig().ok) return this.mockAuthorizationUrl(input.state, input.redirectUri);
    const url = new URL(this.authorizationEndpoint());
    url.searchParams.set("client_id", this.config.clientId!);
    url.searchParams.set("redirect_uri", input.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", input.state);
    if (input.codeChallenge) {
      url.searchParams.set("code_challenge", input.codeChallenge);
      url.searchParams.set("code_challenge_method", "S256");
    }
    url.searchParams.set("scope", this.defaultScopes().join(" "));
    return url.toString();
  }

  async handleOAuthCallback(input: { code?: string; state: string; publicToken?: string }): Promise<OAuthTokenResponse> {
    if (!this.validateConfig().ok || input.code?.startsWith("mock-") || input.publicToken?.startsWith("mock-")) {
      return {
        accessToken: `${this.getProviderName()}-mock-access-${input.state}`,
        refreshToken: `${this.getProviderName()}-mock-refresh-${input.state}`,
        expiresInSeconds: 3600,
        tokenType: "Bearer",
        scopes: this.defaultScopes(),
        providerAccountId: `mock-${this.getProviderName()}`
      };
    }
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code ?? input.publicToken ?? "",
      redirect_uri: this.config.redirectUri ?? "",
      client_id: this.config.clientId ?? "",
      client_secret: this.config.clientSecret ?? ""
    });
    const response = await this.providerFetch(this.tokenEndpoint(), { method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded" } });
    return this.normalizeTokenResponse(response);
  }

  async refreshAccessToken(_connectorId: string) {
    if (!this.validateConfig().ok) return undefined;
    return undefined;
  }

  async revokeConnection(_connectorId: string) {
    return undefined;
  }

  async testConnection() {
    const validation = this.validateConfig();
    return validation.ok
      ? { ok: true, message: `${this.getProviderName()} configured for ${validation.environment}` }
      : { ok: true, message: `${this.getProviderName()} running in mock mode; missing ${validation.missing.join(", ")}` };
  }

  async syncAccounts(connectorId: string): Promise<NormalizedBankAccount[]> {
    if (!this.getProviderCapabilities().supportsAccounts) return [];
    if (!this.validateConfig().ok) return this.mockAccounts(connectorId);
    const payload = await this.providerFetch(this.accountsEndpoint());
    return this.normalizeAccounts(payload);
  }

  async syncBalances(connectorId: string) {
    return this.syncAccounts(connectorId);
  }

  async syncTransactions(connectorId: string, cursor?: string) {
    if (!this.getProviderCapabilities().supportsTransactions) return { transactions: [] };
    if (!this.validateConfig().ok) return { transactions: this.mockTransactions(connectorId), nextCursor: new Date().toISOString() };
    const payload = await this.providerFetch(this.transactionsEndpoint(cursor));
    return { transactions: this.normalizeTransactions(payload), nextCursor: this.extractCursor(payload) };
  }

  async syncInvoices(connectorId: string, cursor?: string) {
    if (!this.getProviderCapabilities().supportsInvoices) return { invoices: [] };
    if (!this.validateConfig().ok) return { invoices: this.mockInvoices(connectorId), nextCursor: new Date().toISOString() };
    const payload = await this.providerFetch(this.invoicesEndpoint(cursor));
    return { invoices: this.normalizeInvoices(payload), nextCursor: this.extractCursor(payload) };
  }

  async syncPayments(connectorId: string, cursor?: string) {
    if (!this.getProviderCapabilities().supportsPayments) return { payments: [] };
    if (!this.validateConfig().ok) return { payments: this.mockPayments(connectorId), nextCursor: new Date().toISOString() };
    const payload = await this.providerFetch(this.paymentsEndpoint(cursor));
    return { payments: this.normalizePayments(payload), nextCursor: this.extractCursor(payload) };
  }

  async handleWebhook(payload: any, signature?: string) {
    const body = JSON.stringify(payload);
    const expected = this.config.webhookSecret ? createHmac("sha256", this.config.webhookSecret).update(body).digest("hex") : signature ?? "";
    return {
      eventType: String(payload?.type ?? payload?.event_type ?? "unknown"),
      externalEventId: payload?.id ?? payload?.event_id,
      signatureValid: this.config.webhookSecret ? secretManager.verifySignature(expected, signature) : true
    };
  }

  mapError(error: any) {
    const message = error?.message ?? String(error);
    const code = error?.code ?? error?.status;
    if (code === 401 || message.includes("token")) return { category: "TOKEN_EXPIRED", userMessage: "La connexion doit être renouvelée.", retryable: false, requiresUserAction: true, providerErrorCode: String(code ?? ""), providerErrorMessage: message };
    if (code === 429 || message.includes("rate")) return { category: "RATE_LIMITED", userMessage: "Quota provider atteint, la sync sera réessayée.", retryable: true, requiresUserAction: false, providerErrorCode: String(code ?? ""), providerErrorMessage: message };
    return { category: "UNKNOWN_PROVIDER_ERROR", userMessage: "Erreur provider non classée.", retryable: true, requiresUserAction: false, providerErrorCode: String(code ?? ""), providerErrorMessage: message, technicalDetails: { provider: this.getProviderName() } };
  }

  getRateLimitInfo(headers?: Headers) {
    const remaining = Number(headers?.get("x-ratelimit-remaining") ?? headers?.get("ratelimit-remaining") ?? NaN);
    const resetRaw = headers?.get("x-ratelimit-reset") ?? headers?.get("ratelimit-reset");
    return {
      remaining: Number.isFinite(remaining) ? remaining : undefined,
      resetAt: resetRaw ? new Date(Number(resetRaw) * 1000) : undefined,
      isThrottled: Number.isFinite(remaining) && remaining <= 0
    };
  }

  protected normalizeAccounts(payload: any): NormalizedBankAccount[] {
    const rows = Array.isArray(payload?.resources) ? payload.resources : Array.isArray(payload?.accounts) ? payload.accounts : Array.isArray(payload) ? payload : [];
    return rows.map((row: any) => ({
      provider: this.getProviderName(),
      externalConnectionId: String(row.connection_id ?? row.item_id ?? row.user_id ?? "default"),
      externalAccountId: String(row.id ?? row.account_id),
      name: String(row.name ?? row.display_name ?? "Compte"),
      ibanMasked: maskIban(row.iban ?? row.account_number ?? ""),
      currency: String(row.currency_code ?? row.currency ?? "EUR"),
      type: String(row.type ?? "checking"),
      currentBalance: Number(row.balance?.current ?? row.balance ?? row.current_balance ?? row.balances?.current ?? 0),
      availableBalance: Number(row.balance?.available ?? row.instant_balance ?? row.available_balance ?? row.balances?.available ?? row.balance?.current ?? row.balance ?? 0),
      balanceDate: String(row.balance_date ?? new Date().toISOString().slice(0, 10)),
      rawPayload: row
    }));
  }

  protected normalizeTransactions(payload: any): NormalizedBankTransaction[] {
    const rows = Array.isArray(payload?.resources) ? payload.resources : Array.isArray(payload?.transactions) ? payload.transactions : Array.isArray(payload) ? payload : [];
    return rows.map((row: any) => {
      const amount = Number(row.amount ?? row.value ?? 0);
      return {
        provider: this.getProviderName(),
        externalTransactionId: String(row.id ?? row.transaction_id),
        externalAccountId: String(row.account_id ?? row.accountId ?? row.account),
        transactionDate: String(row.date ?? row.transaction_date ?? row.authorized_date ?? new Date().toISOString().slice(0, 10)).slice(0, 10),
        bookingDate: String(row.booking_date ?? row.date ?? new Date().toISOString().slice(0, 10)).slice(0, 10),
        valueDate: row.value_date ? String(row.value_date).slice(0, 10) : undefined,
        label: String(row.clean_description ?? row.provider_description ?? row.label ?? row.name ?? row.description ?? "Transaction"),
        counterpartyName: row.counterparty_name ?? row.merchant_name,
        counterpartyIbanMasked: maskIban(row.counterparty_iban ?? ""),
        amount,
        currency: String(row.currency_code ?? row.currency ?? "EUR"),
        direction: amount >= 0 ? "credit" : "debit",
        status: String(row.status ?? "booked"),
        providerCategory: row.category ?? row.category_id,
        rawPayload: row
      };
    });
  }

  protected normalizeInvoices(payload: any): NormalizedAccountingInvoice[] {
    const rows = Array.isArray(payload?.invoices) ? payload.invoices : Array.isArray(payload) ? payload : [];
    return rows.map((row: any) => ({
      provider: this.getProviderName(),
      externalInvoiceId: String(row.id ?? row.invoice_id),
      invoiceNumber: String(row.invoice_number ?? row.number ?? row.reference ?? row.id),
      invoiceType: String(row.type ?? "customer_invoice"),
      customerOrSupplierName: String(row.customer?.name ?? row.supplier?.name ?? row.contact?.name ?? row.customer_name ?? "Unknown"),
      invoiceDate: String(row.invoice_date ?? row.date ?? row.created_at ?? new Date().toISOString()).slice(0, 10),
      dueDate: row.due_date ? String(row.due_date).slice(0, 10) : undefined,
      amountHT: Number(row.amount_ht ?? row.net_amount ?? row.total_excluding_tax ?? 0),
      vatAmount: Number(row.vat_amount ?? row.tax_amount ?? 0),
      amountTTC: Number(row.amount_ttc ?? row.total_amount ?? row.total ?? 0),
      paidAmount: Number(row.paid_amount ?? row.amount_paid ?? 0),
      currency: String(row.currency ?? "EUR"),
      status: String(row.status ?? "imported"),
      rawPayload: row
    }));
  }

  protected normalizePayments(payload: any): NormalizedAccountingPayment[] {
    const rows = Array.isArray(payload?.payments) ? payload.payments : Array.isArray(payload) ? payload : [];
    return rows.map((row: any) => ({
      provider: this.getProviderName(),
      externalPaymentId: String(row.id ?? row.payment_id),
      externalInvoiceId: row.invoice_id ?? row.invoiceId,
      paymentDate: String(row.payment_date ?? row.date ?? new Date().toISOString()).slice(0, 10),
      amount: Number(row.amount ?? 0),
      currency: String(row.currency ?? "EUR"),
      payerOrPayeeName: String(row.payer_name ?? row.payee_name ?? row.contact?.name ?? "Unknown"),
      method: row.method ?? row.payment_method,
      status: String(row.status ?? "received"),
      rawPayload: row
    }));
  }

  protected extractCursor(payload: any) {
    return payload?.next_cursor ?? payload?.cursor ?? payload?.next ?? payload?.pagination?.next_uri ?? undefined;
  }

  protected async providerFetch(url: string, init: RequestInit = {}) {
    const response = await fetch(url, init);
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw Object.assign(new Error(`Provider ${this.getProviderName()} returned ${response.status}${body ? `: ${body}` : ""}`), { status: response.status, body });
    }
    return response.json();
  }

  protected mockAuthorizationUrl(state: string, redirectUri: string) {
    const url = new URL(redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("code", `mock-${this.getProviderName()}`);
    return url.toString();
  }

  protected mockAccounts(connectorId: string): NormalizedBankAccount[] {
    return [{ provider: this.getProviderName(), externalConnectionId: connectorId, externalAccountId: `${this.getProviderName()}-account`, name: `${this.getProviderName()} sandbox account`, ibanMasked: "FR76********0000", currency: "EUR", type: "checking", currentBalance: 88000, availableBalance: 87000, balanceDate: new Date().toISOString().slice(0, 10), rawPayload: { mock: true } }];
  }

  protected mockTransactions(_connectorId: string): NormalizedBankTransaction[] {
    const today = new Date().toISOString().slice(0, 10);
    return [{ provider: this.getProviderName(), externalTransactionId: `${this.getProviderName()}-tx-sandbox`, externalAccountId: `${this.getProviderName()}-account`, transactionDate: today, bookingDate: today, label: `${this.getProviderName()} sandbox transaction`, amount: 1200, currency: "EUR", direction: "credit", status: "booked", rawPayload: { mock: true } }];
  }

  protected mockInvoices(_connectorId: string): NormalizedAccountingInvoice[] {
    return [{ provider: this.getProviderName(), externalInvoiceId: `${this.getProviderName()}-invoice`, invoiceNumber: `${this.getProviderName().toUpperCase()}-001`, invoiceType: "customer_invoice", customerOrSupplierName: "Client sandbox", invoiceDate: new Date().toISOString().slice(0, 10), dueDate: new Date().toISOString().slice(0, 10), amountHT: 1000, vatAmount: 200, amountTTC: 1200, paidAmount: 0, currency: "EUR", status: "issued", rawPayload: { mock: true } }];
  }

  protected mockPayments(_connectorId: string): NormalizedAccountingPayment[] {
    return [{ provider: this.getProviderName(), externalPaymentId: `${this.getProviderName()}-payment`, externalInvoiceId: `${this.getProviderName()}-invoice`, paymentDate: new Date().toISOString().slice(0, 10), amount: 1200, currency: "EUR", payerOrPayeeName: "Client sandbox", method: "wire", status: "received", rawPayload: { mock: true } }];
  }

  protected normalizeTokenResponse(payload: any): OAuthTokenResponse {
    return { accessToken: payload.access_token, refreshToken: payload.refresh_token, expiresInSeconds: payload.expires_in, tokenType: payload.token_type, scopes: typeof payload.scope === "string" ? payload.scope.split(" ") : payload.scopes, providerAccountId: payload.item_id ?? payload.user_id ?? payload.connection_id };
  }

  protected defaultScopes() { return ["accounts", "transactions"]; }
  protected authorizationEndpoint() { return `${this.config.apiBaseUrl}/oauth/authorize`; }
  protected tokenEndpoint() { return `${this.config.apiBaseUrl}/oauth/token`; }
  protected accountsEndpoint() { return `${this.config.apiBaseUrl}/accounts`; }
  protected transactionsEndpoint(cursor?: string) { return `${this.config.apiBaseUrl}/transactions${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`; }
  protected invoicesEndpoint(cursor?: string) { return `${this.config.apiBaseUrl}/invoices${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`; }
  protected paymentsEndpoint(cursor?: string) { return `${this.config.apiBaseUrl}/payments${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`; }
  protected envPrefix() { return this.getProviderName().toUpperCase(); }
}

function maskIban(value: string) {
  if (!value) return "";
  return value.length > 8 ? `${value.slice(0, 4)}********${value.slice(-4)}` : "********";
}
