import { Router } from "express";
import { prisma } from "../../db";
import {
  connectorHealth,
  createPlaidLinkToken,
  detectDuplicates,
  exchangePlaidPublicToken,
  handleOAuthCallback,
  ingestWebhook,
  listProviders,
  reconnectConnector,
  revokeConnector,
  startOAuth,
  syncConnector
} from "./providerConnectorService";
import { serializeDates } from "../../utils/serialize";
import type { ProviderName } from "../../connectors/types";

export const providersRouter = Router();

providersRouter.get("/providers", (_req, res) => res.json(listProviders()));
providersRouter.get("/providers/:provider/capabilities", (req, res) => {
  const row = listProviders().find((item) => item.provider === req.params.provider);
  if (!row) return res.status(404).json({ error: "Provider not found" });
  res.json(row.capabilities);
});
providersRouter.get("/providers/:provider/config-status", (req, res) => {
  const row = listProviders().find((item) => item.provider === req.params.provider);
  if (!row) return res.status(404).json({ error: "Provider not found" });
  res.json(row.configStatus);
});

providersRouter.post("/connectors/:provider/oauth/start", async (req, res, next) => {
  try {
    res.status(201).json(await startOAuth(req.params.provider as ProviderName, req.body));
  } catch (error) {
    next(error);
  }
});
providersRouter.get("/connectors/:provider/oauth/callback", async (req, res, next) => {
  try {
    res.json(await handleOAuthCallback(req.params.provider as ProviderName, req.query));
  } catch (error) {
    next(error);
  }
});
providersRouter.post("/connectors/:id/reconnect", async (req, res, next) => {
  try {
    res.json(await reconnectConnector(req.params.id));
  } catch (error) {
    next(error);
  }
});
providersRouter.post("/connectors/:id/revoke", async (req, res, next) => {
  try {
    res.json(await revokeConnector(req.params.id));
  } catch (error) {
    next(error);
  }
});

providersRouter.post("/providers/plaid/link-token", async (req, res, next) => {
  try {
    res.json(await createPlaidLinkToken(req.body));
  } catch (error) {
    next(error);
  }
});
providersRouter.post("/providers/plaid/exchange-public-token", async (req, res, next) => {
  try {
    res.status(201).json(await exchangePlaidPublicToken(req.body));
  } catch (error) {
    next(error);
  }
});

providersRouter.post("/connectors/:id/sync", async (req, res, next) => {
  try {
    res.json(serializeDates(await syncConnector(req.params.id, req.body.mode ?? "incremental")));
  } catch (error) {
    next(error);
  }
});
providersRouter.post("/connectors/:id/full-sync", async (req, res, next) => {
  try {
    res.json(serializeDates(await syncConnector(req.params.id, "full")));
  } catch (error) {
    next(error);
  }
});
providersRouter.post("/connectors/:id/incremental-sync", async (req, res, next) => {
  try {
    res.json(serializeDates(await syncConnector(req.params.id, "incremental")));
  } catch (error) {
    next(error);
  }
});
providersRouter.get("/connectors/:id/cursors", async (req, res, next) => {
  try {
    res.json(serializeDates(await prisma.syncCursor.findMany({ where: { connectorId: req.params.id } })));
  } catch (error) {
    next(error);
  }
});

for (const provider of ["bridge", "powens", "tink", "plaid", "pennylane", "sage"] as ProviderName[]) {
  providersRouter.post(`/providers/${provider}/connect`, async (req, res, next) => {
    try {
      res.status(201).json(await startOAuth(provider, req.body));
    } catch (error) {
      next(error);
    }
  });
  providersRouter.get(`/providers/${provider}/callback`, async (req, res, next) => {
    try {
      res.json(await handleOAuthCallback(provider, req.query));
    } catch (error) {
      next(error);
    }
  });
  providersRouter.post(`/providers/${provider}/sync/:connectorId`, async (req, res, next) => {
    try {
      res.json(serializeDates(await syncConnector(req.params.connectorId, req.body.mode ?? "incremental")));
    } catch (error) {
      next(error);
    }
  });
  providersRouter.post(`/providers/${provider}/webhook`, async (req, res, next) => {
    try {
      res.status(202).json(serializeDates(await ingestWebhook(provider, req.body, req.headers["x-provider-signature"] as string | undefined)));
    } catch (error) {
      next(error);
    }
  });
  providersRouter.post(`/webhooks/${provider}`, async (req, res, next) => {
    try {
      res.status(202).json(serializeDates(await ingestWebhook(provider, req.body, req.headers["x-provider-signature"] as string | undefined)));
    } catch (error) {
      next(error);
    }
  });
}

providersRouter.get("/provider-errors", async (_req, res, next) => {
  try {
    res.json(serializeDates(await prisma.providerError.findMany({ orderBy: { createdAt: "desc" } })));
  } catch (error) {
    next(error);
  }
});
providersRouter.post("/provider-errors/:id/resolve", async (req, res, next) => {
  try {
    res.json(serializeDates(await prisma.providerError.update({ where: { id: req.params.id }, data: { resolvedAt: new Date() } })));
  } catch (error) {
    next(error);
  }
});
providersRouter.post("/provider-errors/:id/retry", async (req, res, next) => {
  try {
    const error = await prisma.providerError.findUnique({ where: { id: req.params.id } });
    if (!error?.connectorId) return res.status(400).json({ error: "No connector attached to error" });
    res.json(serializeDates(await syncConnector(error.connectorId, "incremental")));
  } catch (caught) {
    next(caught);
  }
});

providersRouter.get("/data-source-policies", async (_req, res, next) => {
  try {
    res.json(serializeDates(await prisma.dataSourcePolicy.findMany({ orderBy: { domain: "asc" } })));
  } catch (error) {
    next(error);
  }
});
providersRouter.post("/data-source-policies", async (req, res, next) => {
  try {
    const organization = await prisma.organization.findFirst();
    if (!organization) return res.status(404).json({ error: "Organization not found" });
    const organizationId = req.body.organizationId || organization.id;
    res.json(serializeDates(await prisma.dataSourcePolicy.upsert({
      where: { organizationId_domain: { organizationId, domain: req.body.domain } },
      create: { organizationId, domain: req.body.domain, primarySource: req.body.primarySource, conflictResolution: req.body.conflictResolution ?? "manual" },
      update: { primarySource: req.body.primarySource, conflictResolution: req.body.conflictResolution ?? "manual" }
    })));
  } catch (error) {
    next(error);
  }
});
providersRouter.put("/data-source-policies/:idOrDomain", async (req, res, next) => {
  try {
    const organization = await prisma.organization.findFirst();
    if (!organization) return res.status(404).json({ error: "Organization not found" });
    const existing = await prisma.dataSourcePolicy.findFirst({ where: { OR: [{ id: req.params.idOrDomain }, { domain: req.params.idOrDomain }] } });
    if (!existing) return res.status(404).json({ error: "Data source policy not found" });
    res.json(serializeDates(await prisma.dataSourcePolicy.update({
      where: { id: existing.id },
      data: {
        domain: req.body.domain ?? existing.domain,
        primarySource: req.body.primarySource ?? existing.primarySource,
        conflictResolution: req.body.conflictResolution ?? existing.conflictResolution
      }
    })));
  } catch (error) {
    next(error);
  }
});
providersRouter.delete("/data-source-policies/:id", async (req, res, next) => {
  try {
    await prisma.dataSourcePolicy.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

providersRouter.get("/duplicates", async (_req, res, next) => {
  try {
    const rows = await prisma.duplicateCandidate.findMany({ orderBy: { createdAt: "desc" } });
    res.json(serializeDates(rows.length ? rows : await detectDuplicates()));
  } catch (error) {
    next(error);
  }
});
providersRouter.post("/duplicates/:id/merge", (req, res, next) => updateDuplicate(req.params.id, "merged", res, next));
providersRouter.post("/duplicates/:id/ignore", (req, res, next) => updateDuplicate(req.params.id, "ignored", res, next));
providersRouter.post("/duplicates/:id/not-duplicate", (req, res, next) => updateDuplicate(req.params.id, "not_duplicate", res, next));

providersRouter.get("/connector-health", async (_req, res, next) => {
  try {
    res.json(serializeDates(await connectorHealth()));
  } catch (error) {
    next(error);
  }
});
providersRouter.get("/connector-health/providers", async (_req, res) => res.json(listProviders()));
providersRouter.get("/connector-health/syncs", async (_req, res, next) => {
  try {
    res.json(serializeDates(await prisma.connectorSyncRun.findMany({ orderBy: { startedAt: "desc" }, take: 100 })));
  } catch (error) {
    next(error);
  }
});
providersRouter.get("/connector-health/webhooks", async (_req, res, next) => {
  try {
    res.json(serializeDates(await prisma.providerWebhookEvent.findMany({ orderBy: { receivedAt: "desc" }, take: 100 })));
  } catch (error) {
    next(error);
  }
});
providersRouter.get("/connector-health/rate-limits", async (_req, res, next) => {
  try {
    res.json(serializeDates(await prisma.providerRateLimitState.findMany()));
  } catch (error) {
    next(error);
  }
});

providersRouter.get("/compliance/connectors", async (_req, res, next) => {
  try {
    const [connectors, tokens] = await Promise.all([prisma.connector.findMany(), prisma.providerToken.findMany()]);
    res.json(serializeDates({ connectors, tokens: tokens.map((token) => ({ ...token, accessTokenEncrypted: "masked", refreshTokenEncrypted: "masked" })) }));
  } catch (error) {
    next(error);
  }
});
providersRouter.get("/compliance/consents", async (_req, res, next) => {
  try {
    res.json(serializeDates(await prisma.bankConsent.findMany({ orderBy: { expiresAt: "asc" } })));
  } catch (error) {
    next(error);
  }
});
providersRouter.post("/compliance/consents/:id/revoke", async (req, res, next) => {
  try {
    res.json(serializeDates(await prisma.bankConsent.update({ where: { id: req.params.id }, data: { status: "revoked", revokedAt: new Date() } })));
  } catch (error) {
    next(error);
  }
});

async function updateDuplicate(id: string, status: string, res: any, next: any) {
  try {
    res.json(serializeDates(await prisma.duplicateCandidate.update({ where: { id }, data: { status, resolvedAt: new Date() } })));
  } catch (error) {
    next(error);
  }
}
