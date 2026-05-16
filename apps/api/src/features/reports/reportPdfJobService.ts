import { Prisma } from "@prisma/client";
import { prisma } from "../../db";
import { buildScenarioProjection } from "../forecasting/projectionService";
import { generateCodirReport } from "../connected-finance/connectedFinanceService";
import { buildCodirPdf, buildExecutivePdf } from "./executivePdfReport";
import { serializeDates } from "../../utils/serialize";

type ReportPdfJobOptions = {
  existingJobId?: string;
  report?: string;
  scenarioId?: string;
  horizon?: number;
  month?: string;
  triggeredBy?: string;
  triggeredByUserId?: string;
  correlationId?: string;
};

export async function runReportPdfJob(options: ReportPdfJobOptions = {}) {
  const startedAt = new Date();
  const report = normalizeReport(options.report);
  const inputSummary = {
    report,
    scenarioId: options.scenarioId,
    horizon: options.horizon ?? 12,
    month: options.month
  };
  const context = await organizationContext();
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
          organizationId: context.organizationId,
          companyId: context.companyId,
          type: "report_pdf",
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
    const generated = await generatePdfBuffer(report, inputSummary);
    const finishedAt = new Date();
    const completedJob = await prisma.jobRun.update({
      where: { id: job.id },
      data: {
        status: "success",
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        progressPercent: 100,
        resultSummary: {
          report,
          filename: generated.filename,
          sizeBytes: generated.pdf.length,
          sourceEndpoint: generated.sourceEndpoint,
          generatedAt: finishedAt.toISOString()
        }
      }
    });
    return { job: serializeDates(completedJob), report, filename: generated.filename, sizeBytes: generated.pdf.length, sourceEndpoint: generated.sourceEndpoint };
  } catch (error) {
    const finishedAt = new Date();
    await prisma.jobRun.update({
      where: { id: job.id },
      data: {
        status: "failed",
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        progressPercent: 100,
        errorMessage: error instanceof Error ? error.message : "Erreur génération PDF inconnue",
        errorDetails: { name: error instanceof Error ? error.name : "UnknownError", report }
      }
    });
    throw error;
  }
}

function normalizeReport(report?: string) {
  const value = (report ?? "codir").toLowerCase();
  return value === "executive" || value === "direction" ? "executive" : "codir";
}

async function generatePdfBuffer(report: string, input: { scenarioId?: string; horizon?: number; month?: string }) {
  if (report === "executive") {
    const horizon = Number(input.horizon ?? 12) || 12;
    const projection = await buildScenarioProjection(input.scenarioId ?? "", horizon);
    return {
      pdf: buildExecutivePdf(projection as any, { horizon }),
      filename: "executive-report.pdf",
      sourceEndpoint: `/api/reports/executive.pdf?scenarioId=${encodeURIComponent(input.scenarioId ?? "")}&horizon=${horizon}`
    };
  }

  const month = input.month ?? new Date().toISOString().slice(0, 7);
  const reportPayload = await generateCodirReport(month, input.scenarioId, input.horizon);
  return {
    pdf: buildCodirPdf(reportPayload),
    filename: "codir-report.pdf",
    sourceEndpoint: `/api/reports/codir.pdf?month=${encodeURIComponent(month)}&scenarioId=${encodeURIComponent(input.scenarioId ?? "")}&horizon=${Number(input.horizon ?? 12) || 12}`
  };
}

async function organizationContext() {
  const [organization, company] = await Promise.all([
    prisma.organization.findFirst({ orderBy: { createdAt: "asc" } }),
    prisma.company.findFirst({ orderBy: { name: "asc" } })
  ]);
  return {
    organizationId: organization?.id,
    companyId: company?.id
  };
}
