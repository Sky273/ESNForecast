import { Router } from "express";
import { prisma } from "../db";
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
} from "../services/v4ConnectorService";
import { serializeDates } from "../utils/serialize";
import type { ProviderName } from "../connectors/types";

export const v4Router = Router();

v4Router.get("/providers", (_req, res) => res.json(listProviders()));
v4Router.get("/providers/:provider/capabilities", (req, res) => {
  const row = listProviders().find((item) => item.provider === req.params.provider);
  if (!row) return res.status(404).json({ error: "Provider not found" });
  res.json(row.capabilities);
});
v4Router.get("/providers/:provider/config-status", (req, res) => {
  const row = listProviders().find((item) => item.provider === req.params.provider);
  if (!row) return res.status(404).json({ error: "Provider not found" });
  res.json(row.configStatus);
});

v4Router.post("/connectors/:provider/oauth/start", async (req, res, next) => {
  try {
    res.status(201).json(await startOAuth(req.params.provider as ProviderName, req.body));
  } catch (error) {
    next(error);
  }
});
v4Router.get("/connectors/:provider/oauth/callback", async (req, res, next) => {
  try {
    res.json(await handleOAuthCallback(req.params.provider as ProviderName, req.query));
  } catch (error) {
    next(error);
  }
});
v4Router.post("/connectors/:id/reconnect", async (req, res, next) => {
  try {
    res.json(await reconnectConnector(req.params.id));
  } catch (error) {
    next(error);
  }
});
v4Router.post("/connectors/:id/revoke", async (req, res, next) => {
  try {
    res.json(await revokeConnector(req.params.id));
  } catch (error) {
    next(error);
  }
});

v4Router.post("/providers/plaid/link-token", async (req, res, next) => {
  try {
    res.json(await createPlaidLinkToken(req.body));
  } catch (error) {
    next(error);
  }
});
v4Router.post("/providers/plaid/exchange-public-token", async (req, res, next) => {
  try {
    res.status(201).json(await exchangePlaidPublicToken(req.body));
  } catch (error) {
    next(error);
  }
});

v4Router.post("/connectors/:id/sync", async (req, res, next) => {
  try {
    res.json(serializeDates(await syncConnector(req.params.id, req.body.mode ?? "incremental")));
  } catch (error) {
    next(error);
  }
});
v4Router.post("/connectors/:id/full-sync", async (req, res, next) => {
  try {
    res.json(serializeDates(await syncConnector(req.params.id, "full")));
  } catch (error) {
    next(error);
  }
});
v4Router.post("/connectors/:id/incremental-sync", async (req, res, next) => {
  try {
    res.json(serializeDates(await syncConnector(req.params.id, "incremental")));
  } catch (error) {
    next(error);
  }
});
v4Router.get("/connectors/:id/cursors", async (req, res, next) => {
  try {
    res.json(serializeDates(await prisma.syncCursor.findMany({ where: { connectorId: req.params.id } })));
  } catch (error) {
    next(error);
  }
});

for (const provider of ["bridge", "powens", "tink", "plaid", "pennylane", "sage"] as ProviderName[]) {
  v4Router.post(`/providers/${provider}/connect`, async (req, res, next) => {
    try {
      res.status(201).json(await startOAuth(provider, req.body));
    } catch (error) {
      next(error);
    }
  });
  v4Router.get(`/providers/${provider}/callback`, async (req, res, next) => {
    try {
      res.json(await handleOAuthCallback(provider, req.query));
    } catch (error) {
      next(error);
    }
  });
  v4Router.post(`/providers/${provider}/sync/:connectorId`, async (req, res, next) => {
    try {
      res.json(serializeDates(await syncConnector(req.params.connectorId, req.body.mode ?? "incremental")));
    } catch (error) {
      next(error);
    }
  });
  v4Router.post(`/providers/${provider}/webhook`, async (req, res, next) => {
    try {
      res.status(202).json(serializeDates(await ingestWebhook(provider, req.body, req.headers["x-provider-signature"] as string | undefined)));
    } catch (error) {
      next(error);
    }
  });
  v4Router.post(`/webhooks/${provider}`, async (req, res, next) => {
    try {
      res.status(202).json(serializeDates(await ingestWebhook(provider, req.body, req.headers["x-provider-signature"] as string | undefined)));
    } catch (error) {
      next(error);
    }
  });
}

v4Router.get("/provider-errors", async (_req, res, next) => {
  try {
    res.json(serializeDates(await prisma.providerError.findMany({ orderBy: { createdAt: "desc" } })));
  } catch (error) {
    next(error);
  }
});
v4Router.post("/provider-errors/:id/resolve", async (req, res, next) => {
  try {
    res.json(serializeDates(await prisma.providerError.update({ where: { id: req.params.id }, data: { resolvedAt: new Date() } })));
  } catch (error) {
    next(error);
  }
});
v4Router.post("/provider-errors/:id/retry", async (req, res, next) => {
  try {
    const error = await prisma.providerError.findUnique({ where: { id: req.params.id } });
    if (!error?.connectorId) return res.status(400).json({ error: "No connector attached to error" });
    res.json(serializeDates(await syncConnector(error.connectorId, "incremental")));
  } catch (caught) {
    next(caught);
  }
});

v4Router.get("/data-source-policies", async (_req, res, next) => {
  try {
    res.json(serializeDates(await prisma.dataSourcePolicy.findMany({ orderBy: { domain: "asc" } })));
  } catch (error) {
    next(error);
  }
});
v4Router.put("/data-source-policies/:domain", async (req, res, next) => {
  try {
    const organization = await prisma.organization.findFirst();
    if (!organization) return res.status(404).json({ error: "Organization not found" });
    res.json(serializeDates(await prisma.dataSourcePolicy.upsert({
      where: { organizationId_domain: { organizationId: organization.id, domain: req.params.domain } },
      create: { organizationId: organization.id, domain: req.params.domain, primarySource: req.body.primarySource, conflictResolution: req.body.conflictResolution ?? "manual" },
      update: { primarySource: req.body.primarySource, conflictResolution: req.body.conflictResolution ?? "manual" }
    })));
  } catch (error) {
    next(error);
  }
});

v4Router.get("/duplicates", async (_req, res, next) => {
  try {
    const rows = await prisma.duplicateCandidate.findMany({ orderBy: { createdAt: "desc" } });
    res.json(serializeDates(rows.length ? rows : await detectDuplicates()));
  } catch (error) {
    next(error);
  }
});
v4Router.post("/duplicates/:id/merge", (req, res, next) => updateDuplicate(req.params.id, "merged", res, next));
v4Router.post("/duplicates/:id/ignore", (req, res, next) => updateDuplicate(req.params.id, "ignored", res, next));
v4Router.post("/duplicates/:id/not-duplicate", (req, res, next) => updateDuplicate(req.params.id, "not_duplicate", res, next));

v4Router.get("/connector-health", async (_req, res, next) => {
  try {
    res.json(serializeDates(await connectorHealth()));
  } catch (error) {
    next(error);
  }
});
v4Router.get("/connector-health/providers", async (_req, res) => res.json(listProviders()));
v4Router.get("/connector-health/syncs", async (_req, res, next) => {
  try {
    res.json(serializeDates(await prisma.connectorSyncRun.findMany({ orderBy: { startedAt: "desc" }, take: 100 })));
  } catch (error) {
    next(error);
  }
});
v4Router.get("/connector-health/webhooks", async (_req, res, next) => {
  try {
    res.json(serializeDates(await prisma.providerWebhookEvent.findMany({ orderBy: { receivedAt: "desc" }, take: 100 })));
  } catch (error) {
    next(error);
  }
});
v4Router.get("/connector-health/rate-limits", async (_req, res, next) => {
  try {
    res.json(serializeDates(await prisma.providerRateLimitState.findMany()));
  } catch (error) {
    next(error);
  }
});

v4Router.get("/compliance/connectors", async (_req, res, next) => {
  try {
    const [connectors, tokens] = await Promise.all([prisma.connector.findMany(), prisma.providerToken.findMany()]);
    res.json(serializeDates({ connectors, tokens: tokens.map((token) => ({ ...token, accessTokenEncrypted: "masked", refreshTokenEncrypted: "masked" })) }));
  } catch (error) {
    next(error);
  }
});
v4Router.get("/compliance/consents", async (_req, res, next) => {
  try {
    res.json(serializeDates(await prisma.bankConsent.findMany({ orderBy: { expiresAt: "asc" } })));
  } catch (error) {
    next(error);
  }
});
v4Router.post("/compliance/consents/:id/revoke", async (req, res, next) => {
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
