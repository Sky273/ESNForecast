import { BaseProvider } from "./baseProvider";
import { getProviderConfig } from "./providerConfig";
import type { ProviderCapabilities, ProviderName } from "./types";

const bankingCapabilities: ProviderCapabilities = {
  supportsOAuth: true,
  supportsRefreshToken: true,
  supportsWebhooks: true,
  supportsIncrementalSync: true,
  supportsAccounts: true,
  supportsBalances: true,
  supportsTransactions: true,
  supportsInvoices: false,
  supportsPayments: false,
  supportsSupplierInvoices: false,
  supportsCustomerInvoices: false,
  supportsSandbox: true,
  supportsBusinessAccounts: true
};

const accountingCapabilities: ProviderCapabilities = {
  supportsOAuth: true,
  supportsRefreshToken: true,
  supportsWebhooks: true,
  supportsIncrementalSync: true,
  supportsAccounts: false,
  supportsBalances: false,
  supportsTransactions: false,
  supportsInvoices: true,
  supportsPayments: true,
  supportsSupplierInvoices: true,
  supportsCustomerInvoices: true,
  supportsSandbox: true,
  supportsBusinessAccounts: true
};

class BridgeProvider extends BaseProvider {
  getProviderName(): ProviderName { return "bridge"; }
  getProviderCapabilities() { return bankingCapabilities; }
  protected authorizationEndpoint() { return `${this.config.apiBaseUrl}/v2/authorize`; }
  protected accountsEndpoint() { return `${this.config.apiBaseUrl}/v2/accounts`; }
  protected transactionsEndpoint(cursor?: string) { return `${this.config.apiBaseUrl}/v2/transactions${cursor ? `?since=${encodeURIComponent(cursor)}` : ""}`; }
}

class PowensProvider extends BaseProvider {
  getProviderName(): ProviderName { return "powens"; }
  getProviderCapabilities() { return bankingCapabilities; }
  protected authorizationEndpoint() { return `https://${process.env.POWENS_DOMAIN || "sandbox.powens.com"}/auth/webview/connect`; }
  protected accountsEndpoint() { return `https://${process.env.POWENS_DOMAIN || "sandbox.powens.com"}/api/2.0/users/me/accounts`; }
  protected transactionsEndpoint(cursor?: string) { return `https://${process.env.POWENS_DOMAIN || "sandbox.powens.com"}/api/2.0/users/me/transactions${cursor ? `?min_date=${encodeURIComponent(cursor)}` : ""}`; }
}

class TinkProvider extends BaseProvider {
  getProviderName(): ProviderName { return "tink"; }
  getProviderCapabilities() { return bankingCapabilities; }
  protected authorizationEndpoint() { return `${this.config.apiBaseUrl}/api/v1/oauth/authorize`; }
  protected tokenEndpoint() { return `${this.config.apiBaseUrl}/api/v1/oauth/token`; }
  protected accountsEndpoint() { return `${this.config.apiBaseUrl}/data/v2/accounts`; }
  protected transactionsEndpoint(cursor?: string) { return `${this.config.apiBaseUrl}/data/v2/transactions${cursor ? `?pageToken=${encodeURIComponent(cursor)}` : ""}`; }
}

class PlaidProvider extends BaseProvider {
  getProviderName(): ProviderName { return "plaid"; }
  getProviderCapabilities() { return bankingCapabilities; }
  async createAuthorizationUrl(input: { state: string; redirectUri: string }) {
    return `plaid-link://open?state=${encodeURIComponent(input.state)}&redirect_uri=${encodeURIComponent(input.redirectUri)}`;
  }
  protected tokenEndpoint() { return `${this.config.apiBaseUrl}/item/public_token/exchange`; }
  protected accountsEndpoint() { return `${this.config.apiBaseUrl}/accounts/get`; }
  protected transactionsEndpoint() { return `${this.config.apiBaseUrl}/transactions/sync`; }
}

class PennylaneProvider extends BaseProvider {
  getProviderName(): ProviderName { return "pennylane"; }
  getProviderCapabilities() { return accountingCapabilities; }
  protected defaultScopes() { return ["customer_invoices", "supplier_invoices", "payments"]; }
  protected invoicesEndpoint(cursor?: string) { return `${this.config.apiBaseUrl}/customer_invoices${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`; }
  protected paymentsEndpoint(cursor?: string) { return `${this.config.apiBaseUrl}/payments${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`; }
}

class SageProvider extends BaseProvider {
  getProviderName(): ProviderName { return "sage"; }
  getProviderCapabilities() { return accountingCapabilities; }
  protected authorizationEndpoint() { return "https://www.sageone.com/oauth2/auth/central"; }
  protected tokenEndpoint() { return "https://oauth.accounting.sage.com/token"; }
  protected invoicesEndpoint(cursor?: string) { return `${this.config.apiBaseUrl}/sales_invoices${cursor ? `?updated_or_created_since=${encodeURIComponent(cursor)}` : ""}`; }
  protected paymentsEndpoint(cursor?: string) { return `${this.config.apiBaseUrl}/contact_payments${cursor ? `?updated_or_created_since=${encodeURIComponent(cursor)}` : ""}`; }
}

class SkeletonProvider extends BaseProvider {
  constructor(private name: ProviderName) {
    super(getProviderConfig(name));
  }
  getProviderName() { return this.name; }
  getProviderCapabilities(): ProviderCapabilities {
    return { ...accountingCapabilities, supportsOAuth: false, supportsWebhooks: false, supportsIncrementalSync: false };
  }
}

export function getProvider(provider: ProviderName) {
  switch (provider) {
    case "bridge": return new BridgeProvider(getProviderConfig("bridge"));
    case "powens": return new PowensProvider(getProviderConfig("powens"));
    case "tink": return new TinkProvider(getProviderConfig("tink"));
    case "plaid": return new PlaidProvider(getProviderConfig("plaid"));
    case "pennylane": return new PennylaneProvider(getProviderConfig("pennylane"));
    case "sage": return new SageProvider(getProviderConfig("sage"));
    case "cegid":
    case "odoo":
    case "quickbooks":
      return new SkeletonProvider(provider);
    default:
      throw new Error(`Unsupported provider ${provider}`);
  }
}

export const providerNames: ProviderName[] = ["bridge", "powens", "tink", "plaid", "pennylane", "sage", "cegid", "odoo", "quickbooks"];
