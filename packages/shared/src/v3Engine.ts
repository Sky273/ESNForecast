import type {
  BankCategorizationRule,
  BankTransaction,
  CategorizationResult,
  ClientPaymentProfile,
  DataQualityIssue,
  FinancialAnomaly,
  ForecastReliabilityScore,
  ReforecastSuggestionV3,
  ReconciliationSuggestionV3,
  RunwayAnalysis,
  TreasuryActualVsForecastRow,
  V3FinancialInput,
  V3FinancialSituation
} from "./v3Types";
import type { Invoice, Payment } from "./v2Types";

export function categorizeTransactions(
  transactions: BankTransaction[],
  rules: BankCategorizationRule[]
): CategorizationResult[] {
  const activeRules = [...rules].filter((rule) => rule.isActive).sort((a, b) => a.priority - b.priority);
  return transactions.map((transaction) => {
    const rule = activeRules.find((candidate) => matchesCategorizationRule(transaction, candidate));
    if (!rule) {
      return {
        transactionId: transaction.id,
        status: transaction.categorizationStatus,
        confidenceScore: 0,
        explanation: "Aucune regle applicable"
      };
    }
    const confidenceScore = rule.autoApply === "always" ? 0.95 : 0.8;
    return {
      transactionId: transaction.id,
      categoryId: rule.targetCategoryId,
      status: "rule_categorized",
      confidenceScore,
      explanation: `Regle ${rule.name} appliquee`
    };
  });
}

export function generateReconciliationSuggestions(input: V3FinancialInput): ReconciliationSuggestionV3[] {
  const suggestions: ReconciliationSuggestionV3[] = [];

  for (const transaction of input.bankTransactions.filter((item) => item.reconciliationStatus === "unreconciled")) {
    if (transaction.direction !== "credit") continue;
    const invoice = input.invoices.find((candidate) => {
      const amountMatches = Math.abs(candidate.amountTTC - transaction.amount) <= Math.max(1, candidate.amountTTC * 0.01);
      const labelMatches = transaction.label.toLowerCase().includes(candidate.invoiceNumber.toLowerCase());
      return amountMatches || labelMatches;
    });
    if (!invoice) continue;

    const dateVariance = daysBetween(transaction.transactionDate, invoice.dueDate);
    const exactAmount = Math.abs(invoice.amountTTC - transaction.amount) < 1;
    const confidenceScore = clamp((exactAmount ? 0.55 : 0.3) + (Math.abs(dateVariance) <= 7 ? 0.25 : 0.1) + (transaction.label.includes(invoice.invoiceNumber) ? 0.2 : 0.05), 0, 0.99);

    suggestions.push({
      id: `suggestion-${transaction.id}-${invoice.id}`,
      organizationId: input.organizationId,
      transactionId: transaction.id,
      targetType: "invoice",
      targetId: invoice.id,
      confidenceScore: roundRatio(confidenceScore),
      reason: `Montant ${exactAmount ? "exact" : "proche"} et date a ${Math.abs(dateVariance)} jour(s) de l'echeance`,
      status: "pending"
    });
  }

  return suggestions.sort((a, b) => b.confidenceScore - a.confidenceScore);
}

export function calculateClientPaymentProfiles(invoices: Invoice[], payments: Payment[]): ClientPaymentProfile[] {
  const paymentsByInvoice = groupBy(payments.filter((payment) => payment.status === "received"), (payment) => payment.invoiceId);
  const rowsByClient = new Map<string, Array<{ delay: number; late: number; amount: number }>>();

  for (const invoice of invoices) {
    const invoicePayments = paymentsByInvoice.get(invoice.id) ?? [];
    if (!invoicePayments.length) continue;
    const lastPaymentDate = invoicePayments.map((payment) => payment.paymentDate).sort().at(-1)!;
    const delay = daysBetween(lastPaymentDate, invoice.invoiceDate);
    const late = Math.max(0, daysBetween(lastPaymentDate, invoice.dueDate));
    const rows = rowsByClient.get(invoice.clientId) ?? [];
    rows.push({ delay, late, amount: invoice.amountTTC });
    rowsByClient.set(invoice.clientId, rows);
  }

  return Array.from(rowsByClient.entries()).map(([clientId, rows]) => {
    const delays = rows.map((row) => row.delay);
    const lates = rows.map((row) => row.late);
    const lateRows = rows.filter((row) => row.late > 0);
    const latePaymentRate = rows.length ? lateRows.length / rows.length : 0;
    const averageLateDays = average(lates);
    const reliabilityScore = clamp(100 - latePaymentRate * 40 - averageLateDays * 2, 0, 100);
    return {
      clientId,
      averagePaymentDelayDays: roundRatio(average(delays)),
      medianPaymentDelayDays: median(delays),
      averageLateDays: roundRatio(averageLateDays),
      latePaymentRate: roundRatio(latePaymentRate),
      totalLateAmount: roundCurrency(lateRows.reduce((total, row) => total + row.amount, 0)),
      reliabilityScore: roundRatio(reliabilityScore),
      recommendedForecastDelayDays: Math.ceil(average(delays))
    };
  });
}

export function calculateForecastReliability(input: V3FinancialInput): ForecastReliabilityScore[] {
  const bankCash = sum(input.bankAccounts.filter((account) => account.isActive), (account) => account.currentBalance);
  const uncategorized = input.bankTransactions.filter((transaction) => transaction.categorizationStatus === "uncategorized").length;
  const unreconciled = input.bankTransactions.filter((transaction) => transaction.reconciliationStatus === "unreconciled").length;
  const connectorPenalty = input.connectors.filter((connector) => connector.status === "error" || connector.status === "expired").length * 12;

  return input.projection.months.map((month, index) => {
    const forecastCash = month.closingCash;
    const cashVarianceRate = forecastCash ? Math.abs(bankCash - forecastCash) / Math.abs(forecastCash) : 0;
    const expectedRevenueShare = month.revenueWeighted ? month.revenueExpected / month.revenueWeighted : 0;
    const score = clamp(100 - cashVarianceRate * 30 - expectedRevenueShare * 20 - uncategorized * 2 - unreconciled * 1.5 - connectorPenalty - index * 2, 0, 100);
    const rounded = roundRatio(score);
    return {
      scenarioId: input.scenarioId,
      month: month.month,
      score: rounded,
      confidenceLevel: rounded >= 75 ? "high" : rounded >= 50 ? "medium" : "low",
      factors: {
        cashVarianceRate: roundRatio(cashVarianceRate),
        unsignedRevenueShare: roundRatio(expectedRevenueShare),
        uncategorizedTransactions: uncategorized,
        unreconciledTransactions: unreconciled,
        connectorPenalty
      },
      explanation: `Score penalise par un ecart de tresorerie de ${roundRatio(cashVarianceRate * 100)}%, ${uncategorized} transaction(s) non categorisee(s) et ${unreconciled} non rapprochee(s).`
    };
  });
}

export function calculateTreasuryActualVsForecast(input: V3FinancialInput): TreasuryActualVsForecastRow[] {
  const bankCash = sum(input.bankAccounts.filter((account) => account.isActive), (account) => account.currentBalance);
  const reliability = calculateForecastReliability(input);
  return input.projection.months.map((month, index) => {
    const actualClosingCash = index === 0 ? bankCash : bankCash + sum(input.projection.months.slice(0, index + 1), (item) => item.monthlyCashBalance);
    return {
      month: month.month,
      forecastClosingCash: roundCurrency(month.closingCash),
      actualClosingCash: roundCurrency(actualClosingCash),
      recalibratedClosingCash: roundCurrency(actualClosingCash + (month.cashInWeighted - month.cashOutExpected)),
      variance: roundCurrency(actualClosingCash - month.closingCash),
      reliabilityScore: reliability[index]?.score ?? 0
    };
  });
}

export function generateReforecastSuggestions(input: V3FinancialInput, materialityThreshold = 5000): ReforecastSuggestionV3[] {
  return calculateTreasuryActualVsForecast(input)
    .filter((row) => Math.abs(row.variance) > materialityThreshold)
    .map((row) => ({
      type: "adjust_cash_balance",
      targetType: "treasury_month",
      targetId: row.month,
      currentValue: {
        forecastClosingCash: row.forecastClosingCash,
        actualClosingCash: row.actualClosingCash
      },
      suggestedValue: {
        recalibratedClosingCash: row.recalibratedClosingCash
      },
      impactAmount: row.variance,
      impactMonth: row.month,
      explanation: `Ecart de tresorerie de ${roundCurrency(row.variance)} EUR entre le solde bancaire reel et la prevision.`,
      confidenceScore: roundRatio(Math.max(0.2, Math.min(0.95, row.reliabilityScore / 100))),
      status: "pending"
    }));
}

export function calculateRunway(input: V3FinancialInput): RunwayAnalysis {
  const currentCash = roundCurrency(sum(input.bankAccounts.filter((account) => account.isActive), (account) => account.currentBalance));
  const debits = input.bankTransactions.filter((transaction) => transaction.direction === "debit").map((transaction) => Math.abs(transaction.amount));
  const averageMonthlyBurn = roundCurrency(debits.length ? sum(debits, (value) => value) : Math.max(input.projection.summary.totalCashOut / Math.max(1, input.projection.months.length), 1));
  const weightedMonthlyNet = average(input.projection.months.map((month) => month.cashInWeighted - month.cashOutExpected));
  const runwayWithoutNewRevenueMonths = averageMonthlyBurn > 0 ? currentCash / averageMonthlyBurn : 24;
  const monthlyBurnAfterWeightedRevenue = Math.max(1, averageMonthlyBurn - Math.max(0, weightedMonthlyNet));
  const runwayWeightedMonths = currentCash / monthlyBurnAfterWeightedRevenue;
  const criticalDate = addMonths(input.projection.months[0]?.month ?? new Date().toISOString().slice(0, 7), Math.floor(runwayWeightedMonths));

  return {
    currentCash,
    averageMonthlyBurn,
    runwayWithoutNewRevenueMonths: roundRatio(runwayWithoutNewRevenueMonths),
    runwayWeightedMonths: roundRatio(runwayWeightedMonths),
    criticalDate,
    assumptions: ["Burn calcule sur les transactions debit importees", "CA futur pris en compte via cash-in pondere"],
    recommendedActions: runwayWeightedMonths < 3
      ? ["Relancer les clients en retard", "Reporter les depenses non essentielles", "Verifier les missions a forte dependance client"]
      : ["Maintenir le rapprochement bancaire hebdomadaire", "Surveiller les connecteurs et transactions non categorisees"]
  };
}

export function detectFinancialAnomalies(input: V3FinancialInput): FinancialAnomaly[] {
  const anomalies: FinancialAnomaly[] = [];
  const debitTransactions = input.bankTransactions.filter((item) => item.direction === "debit");
  const duplicatePairs: BankTransaction[][] = [];
  for (let index = 0; index < debitTransactions.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < debitTransactions.length; otherIndex += 1) {
      const left = debitTransactions[index];
      const right = debitTransactions[otherIndex];
      const sameCounterparty = (left.counterpartyName ?? "").toLowerCase() === (right.counterpartyName ?? "").toLowerCase();
      const sameAmount = Math.abs(Math.abs(left.amount) - Math.abs(right.amount)) < 1;
      const closeDate = Math.abs(daysBetween(left.transactionDate, right.transactionDate)) <= 3;
      if (sameCounterparty && sameAmount && closeDate) duplicatePairs.push([left, right]);
    }
  }

  for (const rows of duplicatePairs) {
      anomalies.push({
        id: `anomaly-duplicate-${rows[0].id}`,
        organizationId: input.organizationId,
        type: "duplicate_payment",
        severity: "warning",
        entityType: "bank_transaction",
        entityId: rows[0].id,
        amount: Math.abs(rows[0].amount),
        explanation: "Deux debits proches ont le meme montant, la meme date et la meme contrepartie.",
        suggestedAction: "Verifier s'il s'agit d'un double paiement avant rapprochement.",
        status: "new"
      });
  }

  const largeThreshold = Math.max(10000, average(input.bankTransactions.map((transaction) => Math.abs(transaction.amount))) * 2.5);
  for (const transaction of input.bankTransactions.filter((item) => Math.abs(item.amount) >= largeThreshold)) {
    anomalies.push({
      id: `anomaly-large-${transaction.id}`,
      organizationId: input.organizationId,
      type: "large_transaction",
      severity: Math.abs(transaction.amount) > largeThreshold * 2 ? "critical" : "warning",
      entityType: "bank_transaction",
      entityId: transaction.id,
      amount: Math.abs(transaction.amount),
      explanation: "Transaction significativement superieure au niveau habituel.",
      suggestedAction: "Categoriser et rapprocher la transaction.",
      status: "new"
    });
  }

  return anomalies;
}

export function calculateDataQualityIssues(input: V3FinancialInput): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];
  const uncategorized = input.bankTransactions.filter((transaction) => transaction.categorizationStatus === "uncategorized");
  const unreconciled = input.bankTransactions.filter((transaction) => transaction.reconciliationStatus === "unreconciled");
  const connectorErrors = input.connectors.filter((connector) => connector.status === "error" || connector.status === "expired");

  if (uncategorized.length) {
    issues.push({
      id: "dq-uncategorized",
      organizationId: input.organizationId,
      type: "uncategorized_transactions",
      severity: uncategorized.length > 10 ? "critical" : "warning",
      entityType: "bank_transaction",
      entityId: "multiple",
      message: `${uncategorized.length} transaction(s) non categorisee(s).`,
      suggestedFix: "Executer les regles de categorisation puis traiter les exceptions.",
      status: "open"
    });
  }
  if (unreconciled.length) {
    issues.push({
      id: "dq-unreconciled",
      organizationId: input.organizationId,
      type: "unreconciled_transactions",
      severity: unreconciled.length > 10 ? "critical" : "warning",
      entityType: "bank_transaction",
      entityId: "multiple",
      message: `${unreconciled.length} transaction(s) non rapprochee(s).`,
      suggestedFix: "Valider ou rejeter les suggestions de rapprochement.",
      status: "open"
    });
  }
  for (const connector of connectorErrors) {
    issues.push({
      id: `dq-connector-${connector.id}`,
      organizationId: input.organizationId,
      type: "connector_health",
      severity: connector.status === "expired" ? "critical" : "warning",
      entityType: "connector",
      entityId: connector.id,
      message: `Connecteur ${connector.name} en statut ${connector.status}.`,
      suggestedFix: connector.status === "expired" ? "Renouveler le consentement ou reconnecter." : "Consulter les logs de synchronisation.",
      status: "open"
    });
  }
  return issues;
}

export function buildV3FinancialSituation(input: V3FinancialInput): V3FinancialSituation {
  const activeAccounts = input.bankAccounts.filter((account) => account.isActive);
  const currentCash = roundCurrency(sum(activeAccounts, (account) => account.currentBalance));
  const connectorHealth = {
    active: input.connectors.filter((connector) => connector.status === "connected").length,
    errors: input.connectors.filter((connector) => connector.status === "error").length,
    expired: input.connectors.filter((connector) => connector.status === "expired").length,
    stale: input.connectors.filter((connector) => connector.lastSyncAt && daysBetween(new Date().toISOString().slice(0, 10), connector.lastSyncAt) > 7).length
  };

  return {
    bankSummary: {
      currentCash,
      accounts: activeAccounts.length,
      lastBalanceDate: activeAccounts.map((account) => account.balanceDate).sort().at(-1)
    },
    treasury: calculateTreasuryActualVsForecast(input),
    reconciliationSuggestions: generateReconciliationSuggestions(input),
    clientPaymentProfiles: calculateClientPaymentProfiles(input.invoices, input.payments),
    reliabilityScores: calculateForecastReliability(input),
    runway: calculateRunway(input),
    anomalies: detectFinancialAnomalies(input),
    dataQualityIssues: calculateDataQualityIssues(input),
    connectorHealth
  };
}

function matchesCategorizationRule(transaction: BankTransaction, rule: BankCategorizationRule) {
  const condition = rule.condition;
  if (condition.direction && transaction.direction !== condition.direction) return false;
  if (condition.labelContains && !transaction.label.toLowerCase().includes(condition.labelContains.toLowerCase())) return false;
  if (condition.counterpartyContains && !(transaction.counterpartyName ?? "").toLowerCase().includes(condition.counterpartyContains.toLowerCase())) return false;
  const absoluteAmount = Math.abs(transaction.amount);
  if (condition.minAmount !== undefined && absoluteAmount < condition.minAmount) return false;
  if (condition.maxAmount !== undefined && absoluteAmount > condition.maxAmount) return false;
  return true;
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const value = key(item);
    grouped.set(value, [...(grouped.get(value) ?? []), item]);
  }
  return grouped;
}

function daysBetween(a: string, b: string) {
  const left = new Date(`${a.slice(0, 10)}T00:00:00.000Z`).getTime();
  const right = new Date(`${b.slice(0, 10)}T00:00:00.000Z`).getTime();
  return Math.round((left - right) / 86400000);
}

function addMonths(month: string, months: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + months, 1));
  return date.toISOString().slice(0, 7);
}

function average(values: number[]) {
  return values.length ? sum(values, (value) => value) / values.length : 0;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : roundRatio((sorted[middle - 1] + sorted[middle]) / 2);
}

function sum<T>(items: T[], selector: (item: T) => number) {
  return items.reduce((total, item) => total + selector(item), 0);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundRatio(value: number) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}
