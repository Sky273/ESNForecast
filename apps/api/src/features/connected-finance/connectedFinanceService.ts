import {
  buildConnectedFinanceSituation,
  calculateClientPaymentProfiles,
  calculateDataQualityIssues,
  calculateForecastReliability,
  calculateRunway,
  categorizeTransactions,
  generateReforecastSuggestions,
  generateReconciliationSuggestions
} from "@esn-forecast/shared";
import { Prisma } from "@prisma/client";
import type { ConnectedFinanceInput } from "@esn-forecast/shared";
import { prisma } from "../../db";
import { serializeDates } from "../../utils/serialize";
import { buildScenarioProjection } from "../forecasting/projectionService";

export async function buildConnectedFinanceInput(scenarioId?: string, horizon?: number): Promise<ConnectedFinanceInput> {
  const [organization, company, scenario, projection, bankAccounts, bankTransactions, invoices, payments, categories, rules, connectors] =
    await Promise.all([
      prisma.organization.findFirst(),
      prisma.company.findFirst(),
      prisma.scenario.findFirst({ where: scenarioId ? { id: scenarioId } : { isActive: true } }),
      buildScenarioProjection(scenarioId, horizon),
      prisma.bankAccount.findMany(),
      prisma.bankTransaction.findMany(),
      prisma.invoice.findMany(),
      prisma.payment.findMany(),
      prisma.financialCategory.findMany(),
      prisma.bankCategorizationRule.findMany(),
      prisma.connector.findMany()
    ]);

  return {
    organizationId: organization?.id ?? "org-démo",
    companyId: company?.id ?? "company-démo",
    scenarioId: scenario?.id ?? scenarioId ?? "reference",
    projection,
    bankAccounts: serializeDates(bankAccounts) as any,
    bankTransactions: serializeDates(bankTransactions) as any,
    invoices: serializeDates(invoices) as any,
    payments: serializeDates(payments) as any,
    categories: serializeDates(categories) as any,
    categorizationRules: rules.map((rule) => ({ ...serializeDates(rule), condition: rule.condition as any })) as any,
    connectors: serializeDates(connectors) as any
  };
}

export async function buildConnectedFinanceOverview(scenarioId?: string, horizon?: number) {
  return buildConnectedFinanceSituation(await buildConnectedFinanceInput(scenarioId, horizon));
}

export async function runReforecastJob(options: {
  scenarioId?: string;
  horizon?: number;
  materialityThreshold?: number;
  triggeredBy?: string;
  triggeredByUserId?: string;
  correlationId?: string;
  existingJobId?: string;
} = {}) {
  const startedAt = new Date();
  const threshold = Number(options.materialityThreshold ?? 5000);
  const input = await buildConnectedFinanceInput(options.scenarioId, options.horizon);
  const inputSummary = {
    scenarioId: input.scenarioId,
    horizon: options.horizon,
    materialityThreshold: threshold
  };
  const job = options.existingJobId
    ? await prisma.jobRun.update({
        where: { id: options.existingJobId },
        data: {
          status: "running",
          startedAt,
          finishedAt: null,
          durationMs: null,
          progressPercent: 10,
          inputSummary,
          resultSummary: Prisma.DbNull,
          errorMessage: null,
          errorDetails: Prisma.DbNull,
          correlationId: options.correlationId
        }
      })
    : await prisma.jobRun.create({
        data: {
          organizationId: input.organizationId,
          companyId: input.companyId,
          type: "reforecast",
          status: "running",
          startedAt,
          progressPercent: 10,
          inputSummary,
          triggeredBy: options.triggeredBy ?? "user",
          triggeredByUserId: options.triggeredByUserId,
          correlationId: options.correlationId
        }
      });

  try {
    const suggestions = generateReforecastSuggestions(input, threshold);
    await prisma.$transaction([
      prisma.reforecastSuggestion.deleteMany({
        where: {
          organizationId: input.organizationId,
          scenarioId: input.scenarioId,
          status: "pending"
        }
      }),
      ...suggestions.map((suggestion) =>
        prisma.reforecastSuggestion.create({
          data: {
            organizationId: input.organizationId,
            scenarioId: input.scenarioId,
            type: suggestion.type,
            targetType: suggestion.targetType,
            targetId: suggestion.targetId,
            currentValue: suggestion.currentValue,
            suggestedValue: suggestion.suggestedValue,
            impactAmount: suggestion.impactAmount,
            impactMonth: suggestion.impactMonth,
            explanation: suggestion.explanation,
            confidenceScore: suggestion.confidenceScore,
            status: suggestion.status
          }
        })
      )
    ]);

    const finishedAt = new Date();
    const resultSummary = {
      suggestionsCount: suggestions.length,
      totalImpactAmount: suggestions.reduce((total, suggestion) => total + suggestion.impactAmount, 0),
      impactMonths: suggestions.map((suggestion) => suggestion.impactMonth)
    };
    const completedJob = await prisma.jobRun.update({
      where: { id: job.id },
      data: {
        status: "success",
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        progressPercent: 100,
        resultSummary
      }
    });
    return { job: serializeDates(completedJob), suggestions };
  } catch (error) {
    const finishedAt = new Date();
    await prisma.jobRun.update({
      where: { id: job.id },
      data: {
        status: "failed",
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        progressPercent: 100,
        errorMessage: error instanceof Error ? error.message : "Erreur reforecast inconnue",
        errorDetails: { name: error instanceof Error ? error.name : "UnknownError" }
      }
    });
    throw error;
  }
}

export async function evaluateBankCategorization() {
  const input = await buildConnectedFinanceInput();
  const results = categorizeTransactions(input.bankTransactions, input.categorizationRules);
  for (const result of results.filter((row) => row.categoryId)) {
    await prisma.bankTransaction.update({
      where: { id: result.transactionId },
      data: {
        categoryId: result.categoryId,
        categorizationStatus: result.status,
        confidenceScore: result.confidenceScore
      }
    });
    const rule = input.categorizationRules.find((candidate) => result.explanation.includes(candidate.name));
    if (rule) {
      await prisma.ruleEvaluationLog.create({
        data: {
          ruleId: rule.id,
          transactionId: result.transactionId,
          matched: true,
          applied: true,
          confidenceScore: result.confidenceScore,
          explanation: result.explanation
        }
      });
    }
  }
  return results;
}

export async function refreshReconciliationSuggestions() {
  const input = await buildConnectedFinanceInput();
  const suggestions = generateReconciliationSuggestions(input);
  await prisma.reconciliationSuggestion.deleteMany({ where: { organizationId: input.organizationId, status: "pending" } });
  for (const suggestion of suggestions) {
    await prisma.reconciliationSuggestion.create({
      data: {
        organizationId: suggestion.organizationId,
        transactionId: suggestion.transactionId,
        targetType: suggestion.targetType,
        targetId: suggestion.targetId,
        confidenceScore: suggestion.confidenceScore,
        reason: suggestion.reason,
        status: suggestion.status
      }
    });
  }
  return suggestions;
}

export async function recalculateClientPaymentProfiles() {
  const input = await buildConnectedFinanceInput();
  const profiles = calculateClientPaymentProfiles(input.invoices, input.payments);
  for (const profile of profiles) {
    await prisma.clientPaymentProfile.upsert({
      where: { clientId: profile.clientId },
      create: { ...profile, lastCalculatedAt: new Date() },
      update: { ...profile, lastCalculatedAt: new Date() }
    });
  }
  return profiles;
}

export async function recalculateForecastReliability(scenarioId?: string, horizon?: number) {
  const input = await buildConnectedFinanceInput(scenarioId, horizon);
  const scores = calculateForecastReliability(input);
  for (const score of scores) {
    await prisma.forecastReliabilityScore.upsert({
      where: { scenarioId_month: { scenarioId: score.scenarioId, month: score.month } },
      create: { ...score, factors: score.factors as any },
      update: { score: score.score, confidenceLevel: score.confidenceLevel, factors: score.factors as any, explanation: score.explanation, calculatedAt: new Date() }
    });
  }
  return scores;
}

export async function detectAndStoreAnomalies() {
  const input = await buildConnectedFinanceInput();
  const anomalies = buildConnectedFinanceSituation(input).anomalies;
  await prisma.financialAnomaly.deleteMany({ where: { organizationId: input.organizationId, status: "new" } });
  for (const anomaly of anomalies) {
    await prisma.financialAnomaly.create({ data: { ...anomaly } });
  }
  return anomalies;
}

export async function recalculateDataQuality() {
  const input = await buildConnectedFinanceInput();
  const issues = calculateDataQualityIssues(input);
  await prisma.dataQualityIssue.deleteMany({ where: { organizationId: input.organizationId, status: "open" } });
  for (const issue of issues) {
    await prisma.dataQualityIssue.create({ data: { ...issue } });
  }
  return issues;
}

export async function buildRunway(scenarioId?: string, horizon?: number) {
  return calculateRunway(await buildConnectedFinanceInput(scenarioId, horizon));
}

export async function generateCodirReport(month: string, scenarioId?: string, horizon?: number) {
  const input = await buildConnectedFinanceInput(scenarioId, horizon);
  const situation = buildConnectedFinanceSituation(input);
  const payload = {
    month,
    generatedAt: new Date().toISOString(),
    bankSummary: situation.bankSummary,
    treasury: situation.treasury,
    runway: situation.runway,
    reliabilityScores: situation.reliabilityScores,
    anomalies: situation.anomalies,
    dataQualityIssues: situation.dataQualityIssues,
    connectorHealth: situation.connectorHealth,
    recommendations: situation.runway.recommendedActions
  };
  const row = await prisma.codirReport.create({
    data: {
      organizationId: input.organizationId,
      companyId: input.companyId,
      scenarioId: input.scenarioId,
      month,
      format: "json",
      payload: payload as any
    }
  });
  return { report: serializeDates(row), payload };
}
