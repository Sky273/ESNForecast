import { Router } from "express";
import { scryptSync, timingSafeEqual } from "node:crypto";
import { prisma } from "../db";
import { buildScenarioProjection } from "../services/projectionService";
import { coerceDates, serializeDates } from "../utils/serialize";

export const v1Router = Router();
const dateFields = ["invoiceDate", "dueDate", "expectedPaymentDate", "expectedDate", "startDate", "endDate"];

const crud = (modelName: keyof typeof prisma) => {
  const router = Router();
  const model = (prisma as any)[modelName];
  router.get("/", async (req, res, next) => {
    try {
      const where = req.query.scenarioId ? { scenarioId: String(req.query.scenarioId) } : undefined;
      res.json(serializeDates(await model.findMany({ where, orderBy: { createdAt: "desc" } })));
    } catch (error) {
      next(error);
    }
  });
  router.post("/", async (req, res, next) => {
    try {
      res.status(201).json(serializeDates(await model.create({ data: coerceDates(req.body, dateFields) })));
    } catch (error) {
      next(error);
    }
  });
  router.put("/:id", async (req, res, next) => {
    try {
      const data = coerceDates(req.body, dateFields);
      delete data.id;
      delete data.createdAt;
      delete data.updatedAt;
      res.json(serializeDates(await model.update({ where: { id: req.params.id }, data })));
    } catch (error) {
      next(error);
    }
  });
  router.delete("/:id", async (req, res, next) => {
    try {
      await model.delete({ where: { id: req.params.id } });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });
  return router;
};

v1Router.use("/invoice-forecasts", crud("invoiceForecast" as any));
v1Router.use("/cash-in-forecasts", crud("cashInForecast" as any));
v1Router.use("/cash-out-forecasts", crud("cashOutForecast" as any));
v1Router.use("/simulation-events", crud("simulationEvent" as any));
v1Router.use("/users", crud("user" as any));

v1Router.get("/scenarios", async (_req, res, next) => {
  try {
    const rows = await prisma.scenario.findMany({ orderBy: [{ isActive: "desc" }, { createdAt: "desc" }] });
    const enriched = await Promise.all(rows.map(async (scenario) => {
      const projection = await buildScenarioProjection(scenario.id);
      return {
        ...serializeDates(scenario),
        totalRevenue: projection.summary.totalRevenueGenerated,
        totalCosts: projection.summary.totalCostsAccrued,
        grossMargin: projection.summary.totalGrossMargin,
        finalBalance: projection.summary.finalClosingCash,
        riskMonths: projection.summary.riskMonths.length
      };
    }));
    res.json(enriched);
  } catch (error) {
    next(error);
  }
});

v1Router.post("/scenarios", async (req, res, next) => {
  try {
    const row = await prisma.scenario.create({ data: req.body });
    await audit("scenario", row.id, "create", null, row);
    res.status(201).json(serializeDates(row));
  } catch (error) {
    next(error);
  }
});

v1Router.get("/scenarios/:id", async (req, res, next) => {
  try {
    if (req.params.id === "compare") {
      const scenarioA = String(req.query.scenarioA);
      const scenarioB = String(req.query.scenarioB);
      const [a, b] = await Promise.all([buildScenarioProjection(scenarioA, Number(req.query.horizon) || undefined), buildScenarioProjection(scenarioB, Number(req.query.horizon) || undefined)]);
      return res.json({
        scenarioA: a,
        scenarioB: b,
        deltas: a.months.map((month: any, index: number) => ({
          month: month.month,
          revenueDelta: month.revenueGenerated - (b.months[index]?.revenueGenerated ?? 0),
          costDelta: month.costsAccrued - (b.months[index]?.costsAccrued ?? 0),
          cashDelta: month.closingCash - (b.months[index]?.closingCash ?? 0)
        }))
      });
    }
    const row = await prisma.scenario.findUnique({ where: { id: req.params.id } });
    if (!row) return res.status(404).json({ error: "Scenario not found" });
    res.json(serializeDates(row));
  } catch (error) {
    next(error);
  }
});

v1Router.put("/scenarios/:id", async (req, res, next) => {
  try {
    const before = await prisma.scenario.findUnique({ where: { id: req.params.id } });
    const row = await prisma.scenario.update({ where: { id: req.params.id }, data: req.body });
    await audit("scenario", row.id, "update", before, row);
    res.json(serializeDates(row));
  } catch (error) {
    next(error);
  }
});

v1Router.delete("/scenarios/:id", async (req, res, next) => {
  try {
    await prisma.scenario.update({ where: { id: req.params.id }, data: { archivedAt: new Date(), isActive: false } });
    await audit("scenario", req.params.id, "archive", null, { archivedAt: new Date() });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

v1Router.post("/scenarios/:id/duplicate", async (req, res, next) => {
  try {
    const source = await prisma.scenario.findUnique({ where: { id: req.params.id } });
    if (!source) return res.status(404).json({ error: "Scenario not found" });
    const copy = await prisma.scenario.create({
      data: {
        name: req.body.name ?? `${source.name} copie`,
        type: req.body.type ?? "custom",
        riskLevel: source.riskLevel,
        notes: source.notes,
        author: source.author
      }
    });
    await audit("scenario", copy.id, "duplicate", source, copy);
    res.status(201).json(serializeDates(copy));
  } catch (error) {
    next(error);
  }
});

v1Router.post("/scenarios/:id/set-active", async (req, res, next) => {
  try {
    await prisma.scenario.updateMany({ data: { isActive: false } });
    const row = await prisma.scenario.update({ where: { id: req.params.id }, data: { isActive: true } });
    res.json(serializeDates(row));
  } catch (error) {
    next(error);
  }
});

v1Router.get("/scenarios/compare/pairs", async (req, res, next) => {
  try {
    const scenarioA = String(req.query.scenarioA);
    const scenarioB = String(req.query.scenarioB);
    const [a, b] = await Promise.all([buildScenarioProjection(scenarioA, Number(req.query.horizon) || undefined), buildScenarioProjection(scenarioB, Number(req.query.horizon) || undefined)]);
    res.json({
      scenarioA: a,
      scenarioB: b,
      deltas: a.months.map((month: any, index: number) => ({
        month: month.month,
        revenueDelta: month.revenueGenerated - (b.months[index]?.revenueGenerated ?? 0),
        costDelta: month.costsAccrued - (b.months[index]?.costsAccrued ?? 0),
        cashDelta: month.closingCash - (b.months[index]?.closingCash ?? 0)
      }))
    });
  } catch (error) {
    next(error);
  }
});

v1Router.get("/projections/scenario/:scenarioId", async (req, res, next) => {
  try {
    res.json(await buildScenarioProjection(req.params.scenarioId, Number(req.query.horizon) || undefined));
  } catch (error) {
    next(error);
  }
});

v1Router.get("/projections/scenario/:scenarioId/month/:month", async (req, res, next) => {
  try {
    const projection = await buildScenarioProjection(req.params.scenarioId, 24);
    const month = projection.months.find((item: any) => item.month === req.params.month);
    if (!month) return res.status(404).json({ error: "Month not found" });
    res.json(month);
  } catch (error) {
    next(error);
  }
});

v1Router.post("/projections/scenario/:scenarioId/recalculate", async (req, res, next) => {
  try {
    res.json(await buildScenarioProjection(req.params.scenarioId, Number(req.query.horizon) || undefined));
  } catch (error) {
    next(error);
  }
});

v1Router.get("/profitability/missions", async (req, res, next) => {
  try {
    res.json((await buildScenarioProjection(String(req.query.scenarioId || ""), Number(req.query.horizon) || undefined)).missionProfitability);
  } catch (error) {
    next(error);
  }
});

v1Router.get("/profitability/resources", async (req, res, next) => {
  try {
    res.json((await buildScenarioProjection(String(req.query.scenarioId || ""), Number(req.query.horizon) || undefined)).resourceProfitability);
  } catch (error) {
    next(error);
  }
});

v1Router.get("/bench", async (req, res, next) => {
  try {
    const projection = await buildScenarioProjection(String(req.query.scenarioId || ""), Number(req.query.horizon) || undefined);
    res.json({
      totalBenchCost: projection.summary.totalBenchCost,
      months: projection.months.map((month: any) => ({ month: month.month, benchCost: month.benchCost, utilizationRate: month.internalUtilizationRate }))
    });
  } catch (error) {
    next(error);
  }
});

v1Router.get("/alerts", async (req, res, next) => {
  try {
    const projection = await buildScenarioProjection(String(req.query.scenarioId || ""), Number(req.query.horizon) || undefined);
    const persisted = await prisma.alert.findMany({ where: req.query.scenarioId ? { scenarioId: String(req.query.scenarioId) } : undefined, orderBy: { createdAt: "desc" } });
    res.json([...projection.alerts, ...serializeDates(persisted) as any[]]);
  } catch (error) {
    next(error);
  }
});

v1Router.put("/alerts/:id/status", async (req, res, next) => {
  try {
    res.json(await prisma.alert.update({ where: { id: req.params.id }, data: { status: req.body.status } }));
  } catch (error) {
    next(error);
  }
});

v1Router.get("/reports/executive.json", async (req, res, next) => {
  try {
    const projection = await buildScenarioProjection(String(req.query.scenarioId || ""), Number(req.query.horizon) || 12);
    res.json({
      generatedAt: new Date().toISOString(),
      summary: projection.summary,
      alerts: projection.alerts.slice(0, 10),
      topMissions: projection.missionProfitability.slice().sort((a: any, b: any) => b.grossMargin - a.grossMargin).slice(0, 5),
      monthly: projection.months
    });
  } catch (error) {
    next(error);
  }
});

v1Router.get("/reports/executive.pdf", async (req, res, next) => {
  try {
    const projection = await buildScenarioProjection(String(req.query.scenarioId || ""), Number(req.query.horizon) || 12);
    const body = [
      "ESN Forecast - Rapport direction",
      `Scenario: ${projection.scenarioId}`,
      `CA genere: ${projection.summary.totalRevenueGenerated}`,
      `Cash-in: ${projection.summary.totalCashIn}`,
      `Cash-out: ${projection.summary.totalCashOut}`,
      `Tresorerie finale: ${projection.summary.finalClosingCash}`,
      `Mois a risque: ${projection.summary.riskMonths.join(", ")}`
    ].join("\n");
    const pdf = `%PDF-1.1\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj\n4 0 obj << /Length ${body.length + 60} >> stream\nBT /F1 12 Tf 50 740 Td (${body.replace(/[()]/g, "")}) Tj ET\nendstream endobj\ntrailer << /Root 1 0 R >>\n%%EOF`;
    res.type("application/pdf").send(Buffer.from(pdf));
  } catch (error) {
    next(error);
  }
});

v1Router.get("/audit-logs", async (_req, res, next) => {
  try {
    res.json(serializeDates(await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { user: true } })));
  } catch (error) {
    next(error);
  }
});

v1Router.post("/auth/login", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { email: req.body.email } });
    if (!user || !verifyPassword(String(req.body.password ?? ""), user.passwordHash)) return res.status(401).json({ error: "Invalid credentials" });
    res.json({ token: Buffer.from(JSON.stringify({ userId: user.id, role: user.role })).toString("base64url"), user: maskUser(user) });
  } catch (error) {
    next(error);
  }
});

v1Router.post("/auth/logout", (_req, res) => res.status(204).send());
v1Router.get("/auth/me", async (_req, res) => {
  const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  res.json(user ? maskUser(user) : null);
});

async function audit(entityType: string, entityId: string, action: string, before: unknown, after: unknown) {
  await prisma.auditLog.create({ data: { entityType, entityId, action, before: before as any, after: after as any } });
}

function maskUser(user: any) {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}

function verifyPassword(password: string, stored?: string | null) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const actual = Buffer.from(scryptSync(password, salt, 64).toString("hex"));
  const expected = Buffer.from(hash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
