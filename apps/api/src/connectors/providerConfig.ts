import type { ProviderConfig, ProviderEnvironment, ProviderName } from "./types";

const providerEnvPrefix: Record<ProviderName, string> = {
  bridge: "BRIDGE",
  powens: "POWENS",
  tink: "TINK",
  plaid: "PLAID",
  pennylane: "PENNYLANE",
  sage: "SAGE",
  cegid: "CEGID",
  odoo: "ODOO",
  quickbooks: "QUICKBOOKS"
};

export function getProviderConfig(provider: ProviderName): ProviderConfig {
  const prefix = providerEnvPrefix[provider];
  const env = (process.env[`${prefix}_ENV`] ?? "sandbox") as ProviderEnvironment;
  const clientId = process.env[`${prefix}_CLIENT_ID`];
  const clientSecret = process.env[provider === "plaid" ? "PLAID_SECRET" : `${prefix}_CLIENT_SECRET`];
  return {
    provider,
    environment: env,
    clientId,
    clientSecret,
    apiBaseUrl: process.env[`${prefix}_API_BASE_URL`] ?? defaultBaseUrl(provider),
    redirectUri: process.env[`${prefix}_REDIRECT_URI`],
    webhookSecret: process.env[`${prefix}_WEBHOOK_SECRET`],
    configuréd: Boolean(clientId && clientSecret)
  };
}

export function listProviderConfigs() {
  return (Object.keys(providerEnvPrefix) as ProviderName[]).map(getProviderConfig);
}

function defaultBaseUrl(provider: ProviderName) {
  switch (provider) {
    case "bridge":
      return "https://api.bridgeapi.io";
    case "tink":
      return "https://api.tink.com";
    case "pennylane":
      return "https://app.pennylane.com/api/external/v1";
    case "sage":
      return "https://api.accounting.sage.com/v3.1";
    case "plaid":
      return "https://sandbox.plaid.com";
    default:
      return undefined;
  }
}
