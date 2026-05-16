import { Prisma } from "@prisma/client";
import { prisma } from "../../db";
import { serializeDates } from "../../utils/serialize";
import { syncConnector } from "./providerConnectorService";

type ConnectorSyncJobOptions = {
  existingJobId?: string;
  organizationId?: string;
  connectorId?: string;
  mode?: "full" | "incremental";
  triggeredBy?: string;
  triggeredByUserId?: string;
  correlationId?: string;
};

export async function runConnectorSyncJob(options: ConnectorSyncJobOptions = {}) {
  const startedAt = new Date();
  const mode = options.mode ?? "incremental";
  const connectors = await resolveConnectors(options);
  const inputSummary = {
    organizationId: options.organizationId,
    connectorId: options.connectorId,
    connectorCount: connectors.length,
    mode
  };
  const context = await organizationContext(options.organizationId);
  const job = options.existingJobId
    ? await prisma.jobRun.update({
        where: { id: options.existingJobId },
        data: {
          status: "running",
          startedAt,
          finishedAt: null,
          durationMs: null,
          progressPercent: 5,
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
          type: "connector_sync",
          status: "running",
          startedAt,
          progressPercent: 5,
          inputSummary,
          triggeredBy: options.triggeredBy ?? "user",
          triggeredByUserId: options.triggeredByUserId,
          correlationId: options.correlationId
        }
      });

  try {
    const runs = [];
    for (const [index, connector] of connectors.entries()) {
      runs.push(await syncConnector(connector.id, mode));
      await prisma.jobRun.update({
        where: { id: job.id },
        data: { progressPercent: Math.round(((index + 1) / Math.max(connectors.length, 1)) * 95) }
      });
    }

    const failed = runs.filter((run) => run.status === "failed").length;
    const status = failed === 0 ? "success" : failed === runs.length ? "failed" : "partial_success";
    const finishedAt = new Date();
    const resultSummary = {
      connectorCount: connectors.length,
      successCount: runs.length - failed,
      failedCount: failed,
      importedCount: runs.reduce((total, run) => total + (run.importedCount ?? 0), 0),
      updatedCount: runs.reduce((total, run) => total + (run.updatedCount ?? 0), 0),
      syncRunIds: runs.map((run) => run.id)
    };
    const completedJob = await prisma.jobRun.update({
      where: { id: job.id },
      data: {
        status,
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        progressPercent: 100,
        resultSummary,
        errorMessage: failed ? `${failed} connecteur(s) en échec` : null
      }
    });
    return { job: serializeDates(completedJob), syncRuns: serializeDates(runs) };
  } catch (error) {
    const finishedAt = new Date();
    await prisma.jobRun.update({
      where: { id: job.id },
      data: {
        status: "failed",
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        progressPercent: 100,
        errorMessage: error instanceof Error ? error.message : "Erreur synchronisation connecteur inconnue",
        errorDetails: { name: error instanceof Error ? error.name : "UnknownError" }
      }
    });
    throw error;
  }
}

async function resolveConnectors(options: ConnectorSyncJobOptions) {
  if (options.connectorId) {
    const connector = await prisma.connector.findUnique({ where: { id: options.connectorId } });
    if (!connector) throw new Error("Connector not found");
    return [connector];
  }
  const organizationId = options.organizationId ?? (await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } }))?.id;
  const connectors = await prisma.connector.findMany({
    where: organizationId ? { organizationId, status: { not: "disconnected" } } : { status: { not: "disconnected" } },
    orderBy: { createdAt: "asc" }
  });
  if (!connectors.length) throw new Error("Aucun connecteur synchronisable");
  return connectors;
}

async function organizationContext(organizationId?: string) {
  const organization = organizationId
    ? await prisma.organization.findUnique({ where: { id: organizationId } })
    : await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
  const company = await prisma.company.findFirst({
    where: organization?.id ? { organizationId: organization.id } : undefined,
    orderBy: { name: "asc" }
  });
  return {
    organizationId: organization?.id,
    companyId: company?.id
  };
}
