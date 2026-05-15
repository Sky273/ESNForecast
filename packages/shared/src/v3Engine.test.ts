import { describe, expect, it } from "vitest";
import {
  buildV3FinancialSituation,
  calculateClientPaymentProfiles,
  calculateForecastReliability,
  calculateRunway,
  categorizeTransactions,
  detectFinancialAnomalies,
  generateReforecastSuggestions,
  generateReconciliationSuggestions
} from "./v3Engine";
import type { V3FinancialInput } from "./v3Types";

const input: V3FinancialInput = {
  organizationId: "org1",
  companyId: "company1",
  scenarioId: "reference",
  projection: {
    scenarioId: "reference",
    months: [
      {
        month: "2026-06",
        revenueGenerated: 50000,
        revenueSigned: 40000,
        revenueExpected: 10000,
        revenueWeighted: 45000,
        revenueInvoiced: 48000,
        cashInExpected: 42000,
        cashInWeighted: 38000,
        costsAccrued: 35000,
        costsPaid: 33000,
        cashOutExpected: 33000,
        employeeCosts: 18000,
        partnerCosts: 5000,
        freelancerCosts: 0,
        fixedCosts: 8000,
        variableCosts: 2000,
        taxCosts: 2000,
        totalCosts: 35000,
        grossMargin: 15000,
        netMargin: 10000,
        marginRate: 0.3,
        monthlyBalanceAccrual: 15000,
        monthlyCashBalance: 9000,
        openingCash: 75000,
        closingCash: 84000,
        cumulativeBalance: 15000,
        soldDays: 45,
        internalProducedDays: 30,
        externalProducedDays: 5,
        internalUtilizationRate: 0.82,
        benchCost: 1200,
        alerts: []
      }
    ],
    missionProfitability: [],
    resourceProfitability: [],
    cashflow: [],
    alerts: [],
    summary: {
      totalRevenueGenerated: 50000,
      totalRevenueInvoiced: 48000,
      totalCashIn: 42000,
      totalCostsAccrued: 35000,
      totalCashOut: 33000,
      totalGrossMargin: 15000,
      finalClosingCash: 84000,
      finalCumulativeBalance: 15000,
      averageMarginRate: 0.3,
      averageUtilizationRate: 0.82,
      totalBenchCost: 1200,
      riskMonths: []
    }
  },
  bankAccounts: [{ id: "ba1", organizationId: "org1", companyId: "company1", bankConnectionId: "bc1", externalAccountId: "ext-ba1", name: "Compte courant", ibanMasked: "FR76********1234", currency: "EUR", type: "checking", currentBalance: 77000, availableBalance: 76000, balanceDate: "2026-06-30", isActive: true }],
  bankTransactions: [
    { id: "tx1", organizationId: "org1", companyId: "company1", bankAccountId: "ba1", externalTransactionId: "tx-ext-1", transactionDate: "2026-06-28", bookingDate: "2026-06-28", label: "VIR Client Alpha F-2026-001", counterpartyName: "Client Alpha", amount: 24000, currency: "EUR", direction: "credit", status: "booked", categorizationStatus: "uncategorized", reconciliationStatus: "unreconciled", confidenceScore: 0 },
    { id: "tx2", organizationId: "org1", companyId: "company1", bankAccountId: "ba1", externalTransactionId: "tx-ext-2", transactionDate: "2026-06-12", bookingDate: "2026-06-12", label: "PRLV URSSAF", counterpartyName: "URSSAF", amount: -9000, currency: "EUR", direction: "debit", status: "booked", categorizationStatus: "uncategorized", reconciliationStatus: "unreconciled", confidenceScore: 0 },
    { id: "tx3", organizationId: "org1", companyId: "company1", bankAccountId: "ba1", externalTransactionId: "tx-ext-3", transactionDate: "2026-06-13", bookingDate: "2026-06-13", label: "PRLV URSSAF DUP", counterpartyName: "URSSAF", amount: -9000, currency: "EUR", direction: "debit", status: "booked", categorizationStatus: "uncategorized", reconciliationStatus: "unreconciled", confidenceScore: 0 }
  ],
  invoices: [{ id: "inv1", companyId: "company1", clientId: "client-a", missionId: "m1", invoiceNumber: "F-2026-001", invoiceDate: "2026-05-31", dueDate: "2026-06-30", amountHT: 20000, vatRate: 0.2, amountTTC: 24000, status: "issued", paidAmount: 0, source: "manual" }],
  payments: [{ id: "pay1", invoiceId: "inv1", clientId: "client-a", paymentDate: "2026-06-28", amount: 24000, paymentMethod: "wire", status: "received" }],
  categories: [{ id: "cat-urssaf", organizationId: "org1", name: "Charges sociales", type: "employer_charges", isSystem: true, isActive: true }],
  categorizationRules: [{ id: "rule-urssaf", organizationId: "org1", name: "URSSAF", priority: 1, isActive: true, condition: { labelContains: "URSSAF", direction: "debit" }, targetCategoryId: "cat-urssaf", autoApply: "always" }],
  connectors: [
    { id: "conn-bank", organizationId: "org1", companyId: "company1", type: "banking", provider: "mock_bank_provider", name: "Banque mock", status: "connected", lastSyncAt: "2026-06-30" },
    { id: "conn-err", organizationId: "org1", companyId: "company1", type: "accounting", provider: "csv", name: "Compta CSV", status: "error", errorMessage: "Mapping invalide" }
  ]
};

describe("V3 real finance engine", () => {
  it("categorizes bank transactions with deterministic rules", () => {
    const result = categorizeTransactions(input.bankTransactions, input.categorizationRules);
    expect(result.find((row) => row.transactionId === "tx2")?.categoryId).toBe("cat-urssaf");
    expect(result.find((row) => row.transactionId === "tx2")?.status).toBe("rule_categorized");
  });

  it("suggests bank reconciliation for matching invoice payments", () => {
    const suggestions = generateReconciliationSuggestions(input);
    expect(suggestions[0].transactionId).toBe("tx1");
    expect(suggestions[0].targetType).toBe("invoice");
    expect(suggestions[0].confidenceScore).toBeGreaterThan(0.8);
  });

  it("calculates client payment behavior from invoices and payments", () => {
    const profiles = calculateClientPaymentProfiles(input.invoices, input.payments);
    expect(profiles[0].clientId).toBe("client-a");
    expect(profiles[0].reliabilityScore).toBeGreaterThan(80);
  });

  it("penalizes reliability when forecast cash differs from real bank cash", () => {
    const scores = calculateForecastReliability(input);
    expect(scores[0].score).toBeLessThan(100);
    expect(scores[0].explanation).toContain("ecart de tresorerie");
  });

  it("calculates runway from real cash and burn", () => {
    const runway = calculateRunway(input);
    expect(runway.currentCash).toBe(77000);
    expect(runway.runwayWithoutNewRevenueMonths).toBeGreaterThan(0);
  });

  it("generates reforecast suggestions for material treasury variances", () => {
    const suggestions = generateReforecastSuggestions(input, 5000);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      type: "adjust_cash_balance",
      targetType: "treasury_month",
      targetId: "2026-06",
      impactAmount: -7000,
      impactMonth: "2026-06",
      status: "pending"
    });
    expect(suggestions[0].confidenceScore).toBeGreaterThan(0);
  });

  it("detects duplicate debit anomaly", () => {
    const anomalies = detectFinancialAnomalies(input);
    expect(anomalies.some((item) => item.type === "duplicate_payment")).toBe(true);
  });

  it("builds an executive V3 situation", () => {
    const situation = buildV3FinancialSituation(input);
    expect(situation.bankSummary.currentCash).toBe(77000);
    expect(situation.reconciliationSuggestions.length).toBeGreaterThan(0);
    expect(situation.dataQualityIssues.some((issue) => issue.type === "uncategorized_transactions")).toBe(true);
  });
});
