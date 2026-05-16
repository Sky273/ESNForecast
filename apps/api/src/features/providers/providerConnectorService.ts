import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../../db";
import { getProvider, providerNames } from "../../connectors/providers";
import { listProviderConfigs } from "../../connectors/providerConfig";
import { secretManager } from "../../connectors/secretManager";
import type { NormalizedAccountingInvoice, NormalizedAccountingPayment, NormalizedBankAccount, NormalizedBankTransaction, ProviderName } from "../../connectors/types";

export function listProviders() {
  return providerNames.map((name) => {
    const provider = getProvider(name);
    const config = provider.validateConfig();
    return { provider: name, capabilities: provider.getProviderCapabilities(), configStatus: config };
  });
}

export async function startOAuth(providerName: ProviderName, body: { organizationId?: string; companyId?: string; connectorType?: string; redirectUri?: string; returnUrl?: string }) {
  const provider = getProvider(providerName);
  const company = body.companyId ? await prisma.company.findUnique({ where: { id: body.companyId } }) : await prisma.company.findFirst();
  const organization = body.organizationId ? await prisma.organization.findUnique({ where: { id: body.organizationId } }) : await prisma.organization.findFirst();
  if (!company || !organization) throw new Error("Company or organization missing");
  const state = randomBytes(24).toString("hex");
  const redirectUri =
    body.redirectUri ??
    buildPublicRedirectUri(providerName) ??
    process.env[`${providerName.toUpperCase()}_REDIRECT_URI`] ??
    `http://localhost:4000/api/connectors/${providerName}/oauth/callback`;
  const callbackRedirectUri = appendReturnUrl(redirectUri, body.returnUrl);
  const session = await prisma.oAuthConnectionSession.create({
    data: {
      organizationId: organization.id,
      companyId: company.id,
      provider: providerName,
      connectorType: body.connectorType ?? (provider.getProviderCapabilities().supportsTransactions ? "banking" : "accounting"),
      state,
      redirectUri: callbackRedirectUri,
      status: "created",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    }
  });
  const authorizationUrl = await provider.createAuthorizationUrl({ state, redirectUri: callbackRedirectUri });
  await prisma.oAuthConnectionSession.update({ where: { id: session.id }, data: { status: "redirected" } });
  return { sessionId: session.id, authorizationUrl, state, provider: providerName, environment: provider.validateConfig().environment };
}

export async function handleOAuthCallback(providerName: ProviderName, query: Record<string, unknown>) {
  const state = String(query.state ?? "");
  const session = await prisma.oAuthConnectionSession.findUnique({ where: { state } });
  if (!session || session.provider !== providerName) throw new Error("Invalid OAuth state");
  if (session.expiresAt < new Date()) {
    await prisma.oAuthConnectionSession.update({ where: { id: session.id }, data: { status: "expired", error: "Session expired" } });
    throw new Error("OAuth session expired");
  }
  const provider = getProvider(providerName);
  await prisma.oAuthConnectionSession.update({ where: { id: session.id }, data: { status: "callback_received" } });
  const token = await provider.handleOAuthCallback({
    code: query.code ? String(query.code) : query.item_id ? String(query.item_id) : undefined,
    publicToken: query.public_token ? String(query.public_token) : undefined,
    state
  });
  const connector = await findOrCreateConnectorForProviderAccount({
    organizationId: session.organizationId,
    companyId: session.companyId,
    connectorType: session.connectorType,
    providerName,
    providerAccountId: token.providerAccountId,
    environment: provider.validateConfig().environment
  });
  await ensureBankConnection(connector, token.providerAccountId, { consentExpiresAt: token.expiresInSeconds ? new Date(Date.now() + token.expiresInSeconds * 1000) : undefined });
  await secretManager.storeProviderToken({
    organizationId: session.organizationId,
    companyId: session.companyId,
    connectorId: connector.id,
    provider: providerName,
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    expiresAt: token.expiresInSeconds ? new Date(Date.now() + token.expiresInSeconds * 1000) : undefined,
    scopes: token.scopes,
    tokenType: token.tokenType,
    providerAccountId: token.providerAccountId
  });
  await prisma.oAuthConnectionSession.update({ where: { id: session.id }, data: { status: "token_exchanged" } });
  const initialSync = await syncConnector(connector.id, "full");
  return {
    connectorId: connector.id,
    provider: providerName,
    status: connector.status,
    initialSyncStatus: initialSync.status,
    importedCount: initialSync.importedCount,
    updatedCount: initialSync.updatedCount,
    errorCount: initialSync.errorCount
  };
}

async function findOrCreateConnectorForProviderAccount(input: {
  organizationId: string;
  companyId: string;
  connectorType: string;
  providerName: ProviderName;
  providerAccountId?: string;
  environment: string;
}) {
  if (input.providerAccountId) {
    const existingToken = await prisma.providerToken.findFirst({
      where: {
        organizationId: input.organizationId,
        companyId: input.companyId,
        provider: input.providerName,
        providerAccountId: input.providerAccountId,
        revokedAt: null
      },
      orderBy: { createdAt: "desc" }
    });
    if (existingToken) {
      const existingConnector = await prisma.connector.findFirst({
        where: {
          id: existingToken.connectorId,
          organizationId: input.organizationId,
          companyId: input.companyId,
          provider: input.providerName
        }
      });
      if (existingConnector) {
        return prisma.connector.update({
          where: { id: existingConnector.id },
          data: {
            type: input.connectorType,
            status: "connected",
            configuration: { environment: input.environment, providerAccountId: input.providerAccountId },
            errorMessage: null
          }
        });
      }
    }
  }

  return prisma.connector.create({
    data: {
      organizationId: input.organizationId,
      companyId: input.companyId,
      type: input.connectorType,
      provider: input.providerName,
      name: `${input.providerName} ${input.environment}`,
      status: "connected",
      configuration: { environment: input.environment, providerAccountId: input.providerAccountId },
      lastSyncAt: null
    }
  });
}

export async function exchangePlaidPublicToken(body: { organizationId?: string; companyId?: string; publicToken: string }) {
  const start = await startOAuth("plaid", { organizationId: body.organizationId, companyId: body.companyId, connectorType: "banking" });
  return handleOAuthCallback("plaid", { state: start.state, public_token: body.publicToken });
}

export async function createPlaidLinkToken(body: { organizationId?: string; companyId?: string }) {
  const provider = getProvider("plaid");
  return {
    link_token: `link-sandbox-${createHash("sha256").update(`${Date.now()}-${body.organizationId ?? ""}`).digest("hex")}`,
    expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    provider: "plaid",
    configStatus: provider.validateConfig()
  };
}

export async function syncConnector(connectorId: string, mode: "full" | "incremental" = "incremental") {
  const connector = await prisma.connector.findUnique({ where: { id: connectorId } });
  if (!connector) throw new Error("Connector not found");
  const providerName = resolveProviderName(connector.provider);
  const provider = getProvider(providerName);
  const run = await prisma.connectorSyncRun.create({ data: { connectorId, status: "running", startedAt: new Date(), logs: [] } });
  try {
    let importedCount = 0;
    let updatedCount = 0;
    const logs: unknown[] = [];
    if (connector.type === "banking") {
      const accounts = await provider.syncAccounts(connectorId);
      const accountIdByExternalId = new Map<string, string>();
      for (const account of accounts) {
        const result = await upsertBankAccount(connector, account);
        accountIdByExternalId.set(account.externalAccountId, result.accountId);
        importedCount += result.created ? 1 : 0;
        updatedCount += result.created ? 0 : 1;
      }
      const cursor = await getCursor(connectorId, "transactions");
      const transactions = await provider.syncTransactions(connectorId, mode === "full" ? undefined : cursor?.cursor ?? undefined);
      for (const transaction of transactions.transactions) {
        const result = await upsertBankTransaction(connector, transaction, accountIdByExternalId.get(transaction.externalAccountId));
        importedCount += result.created ? 1 : 0;
        updatedCount += result.created ? 0 : 1;
      }
      await saveCursor(connectorId, "transactions", transactions.nextCursor);
      await prisma.bankConnection.updateMany({ where: { connectorId }, data: { status: "connected", lastSyncAt: new Date() } });
      logs.push({ accounts: accounts.length, transactions: transactions.transactions.length });
    } else {
      const invoiceCursor = await getCursor(connectorId, "invoices");
      const paymentCursor = await getCursor(connectorId, "payments");
      const invoices = await provider.syncInvoices(connectorId, mode === "full" ? undefined : invoiceCursor?.cursor ?? undefined);
      const payments = await provider.syncPayments(connectorId, mode === "full" ? undefined : paymentCursor?.cursor ?? undefined);
      for (const invoice of invoices.invoices) {
        await upsertAccountingInvoice(connectorId, invoice);
        importedCount += 1;
      }
      for (const payment of payments.payments) {
        await upsertAccountingPayment(connectorId, payment);
        importedCount += 1;
      }
      await saveCursor(connectorId, "invoices", invoices.nextCursor);
      await saveCursor(connectorId, "payments", payments.nextCursor);
      logs.push({ invoices: invoices.invoices.length, payments: payments.payments.length });
    }
    await prisma.connector.update({ where: { id: connectorId }, data: { status: "connected", lastSyncAt: new Date(), errorMessage: null } });
    return prisma.connectorSyncRun.update({ where: { id: run.id }, data: { status: "success", finishedAt: new Date(), importedCount, updatedCount, logs: logs as any } });
  } catch (error) {
    const mapped = provider.mapError(error);
    await prisma.providerError.create({ data: { connectorId, provider: providerName, errorCategory: mapped.category, providerErrorCode: mapped.providerErrorCode, providerErrorMessage: mapped.providerErrorMessage, userMessage: mapped.userMessage, technicalDetails: mapped.technicalDetails as any, retryable: mapped.retryable, requiresUserAction: mapped.requiresUserAction } });
    await prisma.connector.update({ where: { id: connectorId }, data: { status: mapped.requiresUserAction ? "expired" : "error", errorMessage: mapped.userMessage } });
    return prisma.connectorSyncRun.update({ where: { id: run.id }, data: { status: "failed", finishedAt: new Date(), errorCount: 1, errors: [mapped] as any } });
  }
}

export async function revokeConnector(connectorId: string) {
  await secretManager.revokeProviderToken(connectorId);
  await prisma.connector.update({ where: { id: connectorId }, data: { status: "disconnected" } });
  await prisma.bankConnection.updateMany({ where: { connectorId }, data: { status: "revoked" } });
  return { connectorId, revoked: true };
}

export async function reconnectConnector(connectorId: string, body: { redirectUri?: string; publicApiBaseUrl?: string } = {}) {
  const connector = await prisma.connector.findUnique({ where: { id: connectorId } });
  if (!connector) throw new Error("Connector not found");
  const provider = resolveProviderName(connector.provider);
  const redirectUri = body.redirectUri ?? (body.publicApiBaseUrl ? `${body.publicApiBaseUrl}/connectors/${provider}/oauth/callback` : undefined);
  return startOAuth(provider, { organizationId: connector.organizationId, companyId: connector.companyId, connectorType: connector.type, redirectUri });
}

export async function ingestWebhook(providerName: ProviderName, payload: unknown, signature?: string) {
  const provider = getProvider(providerName);
  const event = await provider.handleWebhook(payload, signature);
  const row = await prisma.providerWebhookEvent.upsert({
    where: { provider_externalEventId: { provider: providerName, externalEventId: event.externalEventId ?? `${event.eventType}-${Date.now()}` } },
    create: { provider: providerName, eventType: event.eventType, externalEventId: event.externalEventId, payload: payload as any, signatureValid: event.signatureValid, status: event.signatureValid ? "received" : "failed", error: event.signatureValid ? null : "Invalid signature" },
    update: { payload: payload as any, signatureValid: event.signatureValid, status: event.signatureValid ? "received" : "failed" }
  });
  return row;
}

export async function detectDuplicates(organizationId?: string) {
  const where = organizationId ? { organizationId } : undefined;
  const [transactions, invoices, payments] = await Promise.all([
    prisma.bankTransaction.findMany({ where }),
    prisma.invoice.findMany(),
    prisma.payment.findMany()
  ]);
  const candidates = [];
  for (let i = 0; i < transactions.length; i += 1) {
    for (let j = i + 1; j < transactions.length; j += 1) {
      const a = transactions[i];
      const b = transactions[j];
      if (Math.abs(a.amount - b.amount) < 1 && a.transactionDate.toISOString().slice(0, 10) === b.transactionDate.toISOString().slice(0, 10)) {
        candidates.push({ organizationId: a.organizationId, entityType: "bank_transaction", sourceAType: "bank", sourceAId: a.id, sourceBType: "bank", sourceBId: b.id, confidenceScore: 0.9, reason: "Même date et même montant", status: "pending" });
      }
    }
    const invoice = invoices.find((candidate) => Math.abs(candidate.amountTTC - Math.abs(transactions[i].amount)) < 1);
    if (invoice) candidates.push({ organizationId: transactions[i].organizationId, entityType: "invoice_payment", sourceAType: "bank_transaction", sourceAId: transactions[i].id, sourceBType: "invoice", sourceBId: invoice.id, confidenceScore: 0.85, reason: "Montant transaction égal facture", status: "pending" });
    const payment = payments.find((candidate) => Math.abs(candidate.amount - Math.abs(transactions[i].amount)) < 1);
    if (payment) candidates.push({ organizationId: transactions[i].organizationId, entityType: "payment", sourceAType: "bank_transaction", sourceAId: transactions[i].id, sourceBType: "payment", sourceBId: payment.id, confidenceScore: 0.85, reason: "Montant transaction égal paiement", status: "pending" });
  }
  await prisma.duplicateCandidate.deleteMany({ where: { organizationId: organizationId ?? undefined, status: "pending" } });
  for (const candidate of candidates) await prisma.duplicateCandidate.create({ data: candidate });
  return candidates;
}

export async function connectorHealth() {
  const [connectors, runs, errors, webhooks, rateLimits] = await Promise.all([
    prisma.connector.findMany(),
    prisma.connectorSyncRun.findMany({ orderBy: { startedAt: "desc" }, take: 20 }),
    prisma.providerError.findMany({ where: { resolvedAt: null }, orderBy: { createdAt: "desc" } }),
    prisma.providerWebhookEvent.findMany({ orderBy: { receivedAt: "desc" }, take: 20 }),
    prisma.providerRateLimitState.findMany()
  ]);
  return {
    providers: listProviderConfigs().map((config) => ({ provider: config.provider, environment: config.environment, configured: config.configured })),
    summary: {
      connected: connectors.filter((connector) => connector.status === "connected").length,
      errors: connectors.filter((connector) => connector.status === "error").length,
      expired: connectors.filter((connector) => connector.status === "expired").length,
      disconnected: connectors.filter((connector) => connector.status === "disconnected").length
    },
    connectors,
    runs,
    errors,
    webhooks,
    rateLimits
  };
}

function resolveProviderName(provider: string): ProviderName {
  if (provider === "mock_bank_provider" || provider === "csv_bank_import") return "bridge";
  if (provider === "mock_accounting_provider" || provider === "csv-accounting") return "pennylane";
  return provider as ProviderName;
}

async function upsertBankAccount(connector: any, account: NormalizedBankAccount) {
  const bankConnection = await ensureBankConnection(connector, account.externalConnectionId);
  const existing = await findBankAccountForProvider(connector, account.externalAccountId, account, bankConnection.id);
  const data = {
    bankConnectionId: bankConnection.id,
    name: account.name,
    ibanMasked: account.ibanMasked,
    currency: account.currency,
    type: account.type,
    currentBalance: account.currentBalance,
    availableBalance: account.availableBalance,
    balanceDate: new Date(`${account.balanceDate}T00:00:00.000Z`),
    rawPayload: account.rawPayload as any
  };
  if (existing) {
    const updated = await prisma.bankAccount.update({ where: { id: existing.id }, data });
    return { created: false, accountId: updated.id };
  }
  const created = await prisma.bankAccount.create({
    data: { organizationId: connector.organizationId, companyId: connector.companyId, externalAccountId: account.externalAccountId, ...data }
  });
  return { created: true, accountId: created.id };
}

async function upsertBankTransaction(connector: any, transaction: NormalizedBankTransaction, resolvedBankAccountId?: string) {
  const account = resolvedBankAccountId
    ? await prisma.bankAccount.findUnique({ where: { id: resolvedBankAccountId } })
    : await findBankAccountForProvider(connector, transaction.externalAccountId);
  const bankConnection = account ? undefined : await ensureBankConnection(connector);
  const targetAccount = account ?? await prisma.bankAccount.create({ data: { organizationId: connector.organizationId, companyId: connector.companyId, bankConnectionId: bankConnection!.id, externalAccountId: transaction.externalAccountId, name: transaction.externalAccountId, ibanMasked: "", currency: transaction.currency, type: "checking", currentBalance: 0, availableBalance: 0, balanceDate: new Date() } });
  const existing = await findBankTransactionForProvider(targetAccount.id, transaction);
  const transactionDate = new Date(`${transaction.transactionDate}T00:00:00.000Z`);
  const bookingDate = new Date(`${transaction.bookingDate}T00:00:00.000Z`);
  const valueDate = transaction.valueDate ? new Date(`${transaction.valueDate}T00:00:00.000Z`) : null;
  const data = { transactionDate, bookingDate, valueDate, label: transaction.label, counterpartyName: transaction.counterpartyName, counterpartyIbanMasked: transaction.counterpartyIbanMasked, amount: transaction.amount, currency: transaction.currency, direction: transaction.direction, status: transaction.status, rawPayload: transaction.rawPayload as any };
  if (existing) {
    await prisma.bankTransaction.update({ where: { id: existing.id }, data });
    return { created: false };
  }
  await prisma.bankTransaction.create({
    data: { organizationId: connector.organizationId, companyId: connector.companyId, bankAccountId: targetAccount.id, externalTransactionId: transaction.externalTransactionId, ...data }
  });
  return { created: true };
}

async function findBankAccountForProvider(connector: any, externalAccountId: string, incomingAccount?: NormalizedBankAccount, bankConnectionId?: string) {
  if (bankConnectionId) {
    const accountForBankConnection = await prisma.bankAccount.findUnique({
      where: { bankConnectionId_externalAccountId: { bankConnectionId, externalAccountId } }
    });
    if (accountForBankConnection) return accountForBankConnection;
  }
  const legacyAccountForConnector = await prisma.bankAccount.findUnique({
    where: { bankConnectionId_externalAccountId: { bankConnectionId: connector.id, externalAccountId } }
  });
  if (legacyAccountForConnector) return legacyAccountForConnector;

  const candidates = await prisma.bankAccount.findMany({
    where: {
      organizationId: connector.organizationId,
      companyId: connector.companyId
    }
  });
  if (candidates.length === 0) return undefined;

  const bankConnectionIds = candidates.map((candidate) => candidate.bankConnectionId);
  const matchingBankConnection = await prisma.bankConnection.findFirst({
    where: {
      id: { in: bankConnectionIds },
      organizationId: connector.organizationId,
      companyId: connector.companyId,
      connectorId: connector.id,
      provider: connector.provider
    },
    orderBy: { createdAt: "desc" }
  });
  const providerCandidates = matchingBankConnection
    ? candidates.filter((candidate) => candidate.bankConnectionId === matchingBankConnection.id)
    : candidates;
  const sameExternalId = providerCandidates.find((candidate) => candidate.externalAccountId === externalAccountId);
  if (sameExternalId) return sameExternalId;

  const sourceName = normalizeText(incomingAccount?.name ?? "");
  const sourceIban = incomingAccount?.ibanMasked && incomingAccount.ibanMasked !== "********" ? incomingAccount.ibanMasked : undefined;
  if (sourceIban) {
    const sameIban = providerCandidates.find((candidate) => candidate.ibanMasked === sourceIban && candidate.currency === incomingAccount?.currency);
    if (sameIban) return sameIban;
  }

  const nameToMatch = sourceName || normalizeText(externalAccountId);
  return providerCandidates.find((candidate) =>
    normalizeText(candidate.name) === nameToMatch &&
    (!incomingAccount?.currency || candidate.currency === incomingAccount.currency) &&
    (!incomingAccount?.type || candidate.type === incomingAccount.type)
  );
}

async function ensureBankConnection(connector: any, externalConnectionId?: string, options: { consentExpiresAt?: Date } = {}) {
  const configuration = connector.configuration && typeof connector.configuration === "object" ? connector.configuration as Record<string, unknown> : {};
  const resolvedExternalConnectionId = externalConnectionId ?? String(configuration.providerAccountId ?? connector.id);
  const exactMatch = await prisma.bankConnection.findFirst({
    where: { connectorId: connector.id, externalConnectionId: resolvedExternalConnectionId },
    orderBy: { createdAt: "desc" }
  });
  const existing = exactMatch ?? (!externalConnectionId ? await prisma.bankConnection.findFirst({
    where: { connectorId: connector.id },
    orderBy: { createdAt: "desc" }
  }) : null);
  const data = {
    organizationId: connector.organizationId,
    companyId: connector.companyId,
    connectorId: connector.id,
    provider: connector.provider,
    externalConnectionId: resolvedExternalConnectionId,
    status: "connected",
    consentExpiresAt: options.consentExpiresAt ?? existing?.consentExpiresAt ?? null
  };
  const bankConnection = existing
    ? await prisma.bankConnection.update({ where: { id: existing.id }, data })
    : await prisma.bankConnection.create({ data });
  const activeConsent = await prisma.bankConsent.findFirst({
    where: { bankConnectionId: bankConnection.id, status: "active" },
    orderBy: { createdAt: "desc" }
  });
  if (!activeConsent) {
    await prisma.bankConsent.create({
      data: {
        organizationId: connector.organizationId,
        bankConnectionId: bankConnection.id,
        provider: connector.provider,
        status: "active",
        grantedAt: new Date(),
        expiresAt: options.consentExpiresAt,
        scopes: ["accounts", "transactions"]
      }
    });
  }
  return bankConnection;
}

async function findBankTransactionForProvider(bankAccountId: string, transaction: NormalizedBankTransaction) {
  const byExternalId = await prisma.bankTransaction.findUnique({
    where: { bankAccountId_externalTransactionId: { bankAccountId, externalTransactionId: transaction.externalTransactionId } }
  });
  if (byExternalId) return byExternalId;

  const transactionDate = new Date(`${transaction.transactionDate}T00:00:00.000Z`);
  const candidates = await prisma.bankTransaction.findMany({
    where: { bankAccountId, transactionDate, amount: transaction.amount, currency: transaction.currency }
  });
  if (candidates.length === 0) return undefined;

  const incomingFingerprint = transactionFingerprint({
    bookingDate: transaction.bookingDate,
    valueDate: transaction.valueDate,
    amount: transaction.amount,
    currency: transaction.currency,
    label: transaction.label,
    rawPayload: transaction.rawPayload
  });
  return candidates.find((candidate) =>
    transactionFingerprint({
      bookingDate: candidate.bookingDate.toISOString().slice(0, 10),
      valueDate: candidate.valueDate?.toISOString().slice(0, 10),
      amount: candidate.amount,
      currency: candidate.currency,
      label: candidate.label,
      rawPayload: candidate.rawPayload
    }) === incomingFingerprint
  );
}

function transactionFingerprint(input: { bookingDate?: string; valueDate?: string; amount: number; currency: string; label?: string; rawPayload?: any }) {
  const description = normalizeText(input.rawPayload?.clean_description ?? input.rawPayload?.provider_description ?? input.label ?? "");
  return [
    input.bookingDate ?? "",
    input.valueDate ?? "",
    input.amount.toFixed(2),
    input.currency,
    description
  ].join("|");
}

function normalizeText(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

async function upsertAccountingInvoice(connectorId: string, invoice: NormalizedAccountingInvoice) {
  return prisma.accountingInvoiceImport.upsert({
    where: { connectorId_externalId: { connectorId, externalId: invoice.externalInvoiceId } },
    create: { connectorId, externalId: invoice.externalInvoiceId, invoiceNumber: invoice.invoiceNumber, type: invoice.invoiceType, clientOrSupplierName: invoice.customerOrSupplierName, invoiceDate: new Date(`${invoice.invoiceDate}T00:00:00.000Z`), dueDate: invoice.dueDate ? new Date(`${invoice.dueDate}T00:00:00.000Z`) : null, amountHT: invoice.amountHT, vatAmount: invoice.vatAmount, amountTTC: invoice.amountTTC, paidAmount: invoice.paidAmount, status: invoice.status, rawPayload: invoice.rawPayload as any },
    update: { paidAmount: invoice.paidAmount, status: invoice.status, rawPayload: invoice.rawPayload as any }
  });
}

async function upsertAccountingPayment(connectorId: string, payment: NormalizedAccountingPayment) {
  return prisma.accountingPaymentImport.upsert({
    where: { connectorId_externalId: { connectorId, externalId: payment.externalPaymentId } },
    create: { connectorId, externalId: payment.externalPaymentId, invoiceExternalId: payment.externalInvoiceId, paymentDate: new Date(`${payment.paymentDate}T00:00:00.000Z`), amount: payment.amount, payerOrPayeeName: payment.payerOrPayeeName, paymentMethod: payment.method, rawPayload: payment.rawPayload as any },
    update: { amount: payment.amount, rawPayload: payment.rawPayload as any }
  });
}

async function getCursor(connectorId: string, resourceType: string) {
  return prisma.syncCursor.findUnique({ where: { connectorId_resourceType: { connectorId, resourceType } } });
}

async function saveCursor(connectorId: string, resourceType: string, cursor?: string) {
  return prisma.syncCursor.upsert({
    where: { connectorId_resourceType: { connectorId, resourceType } },
    create: { connectorId, resourceType, cursor, lastSuccessfulSyncAt: new Date() },
    update: { cursor, lastSuccessfulSyncAt: new Date(), lastFailedSyncAt: null }
  });
}

function buildPublicRedirectUri(providerName: ProviderName) {
  const publicApiBaseUrl = process.env.PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  return publicApiBaseUrl ? `${publicApiBaseUrl}/connectors/${providerName}/oauth/callback` : undefined;
}

function appendReturnUrl(redirectUri: string, returnUrl?: string) {
  if (!returnUrl) return redirectUri;
  const url = new URL(redirectUri);
  url.searchParams.set("returnUrl", returnUrl);
  return url.toString();
}
