import { Router } from "express";
import { calculateFloorRate, calculateRecommendedRate } from "@esn-forecast/shared";
import { prisma } from "../db";
import { ApiError } from "../middleware/requestContext";
import {
  calculateMissionProfile,
  createPricingSimulation,
  ensurePricingSettings,
  getPricingContext,
  listUnderpricedMissions,
  pricingDashboard,
  recalculateRenegotiationCandidates,
  toMissionPricingRow
} from "../services/v7PricingService";

const db = prisma as any;
export const v7Router = Router();

v7Router.get("/pricing/settings", async (_req, res, next) => {
  try {
    res.json(await ensurePricingSettings());
  } catch (error) {
    next(error);
  }
});

v7Router.put("/pricing/settings", async (req, res, next) => {
  try {
    const settings = await ensurePricingSettings();
    res.json(await db.pricingSettings.update({ where: { id: settings.id }, data: req.body }));
  } catch (error) {
    next(error);
  }
});

v7Router.get("/pricing/dashboard", async (_req, res, next) => {
  try {
    res.json(await pricingDashboard());
  } catch (error) {
    next(error);
  }
});

v7Router.get("/pricing/missions/:missionId", async (req, res, next) => {
  try {
    const analysis = await calculateMissionProfile(req.params.missionId);
    res.json(toMissionPricingRow(analysis));
  } catch (error) {
    next(error);
  }
});

v7Router.post("/pricing/missions/:missionId/recalculate", async (req, res, next) => {
  try {
    const analysis = await calculateMissionProfile(req.params.missionId);
    res.json(toMissionPricingRow(analysis));
  } catch (error) {
    next(error);
  }
});

v7Router.put("/pricing/missions/:missionId/profile", async (req, res, next) => {
  try {
    await calculateMissionProfile(req.params.missionId);
    res.json(await db.missionPricingProfile.update({ where: { missionId: req.params.missionId }, data: req.body }));
  } catch (error) {
    next(error);
  }
});

v7Router.post("/pricing/calculate-floor-rate", (req, res) => {
  res.json({ floorDailyRate: calculateFloorRate(Number(req.body?.fullDailyCost ?? 0), Number(req.body?.minimumMarginRate ?? 0.2), req.body?.roundingMode ?? "nearest_10") });
});

v7Router.post("/pricing/calculate-recommended-rate", (req, res) => {
  res.json({ recommendedDailyRate: calculateRecommendedRate(Number(req.body?.fullDailyCost ?? 0), Number(req.body?.targetMarginRate ?? 0.3), req.body?.roundingMode ?? "nearest_10") });
});

v7Router.post("/pricing/simulate", async (req, res, next) => {
  try {
    const missionId = req.body?.missionId;
    if (!missionId) throw new ApiError(400, "VALIDATION_ERROR", "missionId est requis.");
    res.status(201).json(await createPricingSimulation(missionId, req.body));
  } catch (error) {
    next(error);
  }
});
v7Router.post("/pricing/simulate-discount", async (req, res, next) => { req.body.name = req.body.name ?? "Simulation remise"; return createPricingSimulation(req.body?.missionId, req.body).then((value) => res.status(201).json(value)).catch(next); });
v7Router.post("/pricing/simulate-resource-change", async (req, res, next) => { req.body.name = req.body.name ?? "Simulation changement ressource"; return createPricingSimulation(req.body?.missionId, req.body).then((value) => res.status(201).json(value)).catch(next); });
v7Router.post("/pricing/simulate-cost-increase", async (req, res, next) => { req.body.name = req.body.name ?? "Simulation hausse cout"; return createPricingSimulation(req.body?.missionId, req.body).then((value) => res.status(201).json(value)).catch(next); });

v7Router.get("/pricing/underpriced-missions", async (_req, res, next) => {
  try {
    res.json(await listUnderpricedMissions());
  } catch (error) {
    next(error);
  }
});

v7Router.get("/pricing/renegotiation-candidates", async (_req, res, next) => {
  try {
    const rows = await db.renegotiationCandidate.findMany({ orderBy: [{ priorityScore: "desc" }, { createdAt: "desc" }] });
    res.json(rows.length ? rows : await recalculateRenegotiationCandidates());
  } catch (error) {
    next(error);
  }
});
v7Router.get("/pricing/renegotiation-candidates/:id", async (req, res, next) => { try { const row = await db.renegotiationCandidate.findUnique({ where: { id: req.params.id } }); if (!row) throw new ApiError(404, "NOT_FOUND", "Candidat introuvable."); res.json(row); } catch (error) { next(error); } });
v7Router.post("/pricing/renegotiation-candidates/recalculate", async (_req, res, next) => { try { res.json(await recalculateRenegotiationCandidates()); } catch (error) { next(error); } });
v7Router.put("/pricing/renegotiation-candidates/:id", async (req, res, next) => { try { res.json(await db.renegotiationCandidate.update({ where: { id: req.params.id }, data: req.body })); } catch (error) { next(error); } });
v7Router.post("/pricing/renegotiation-candidates/:id/ignore", async (req, res, next) => { try { res.json(await db.renegotiationCandidate.update({ where: { id: req.params.id }, data: { status: "ignored" } })); } catch (error) { next(error); } });
v7Router.post("/pricing/renegotiation-candidates/:id/mark-renegotiated", async (req, res, next) => { try { res.json(await db.renegotiationCandidate.update({ where: { id: req.params.id }, data: { status: "renegotiated", targetDailyRate: req.body?.targetDailyRate } })); } catch (error) { next(error); } });

v7Router.post("/pricing/renegotiation-candidates/:id/create-action", async (req, res, next) => {
  try {
    const candidate = await db.renegotiationCandidate.findUnique({ where: { id: req.params.id } });
    if (!candidate) throw new ApiError(404, "NOT_FOUND", "Candidat introuvable.");
    const { organization, company } = await getPricingContext();
    const plan = await db.actionPlan.findFirst({ where: { organizationId: organization.id, status: "active", title: { contains: "renegociation" } } }) ??
      await db.actionPlan.create({ data: { organizationId: organization.id, companyId: company.id, fiscalYear: new Date().getFullYear(), title: "Plan de renegociation pricing", status: "active", ownerUserId: "direction" } });
    const action = await db.actionItem.create({
      data: {
        actionPlanId: plan.id,
        title: req.body?.title ?? "Renegocier TJM mission",
        description: `TJM cible ${candidate.targetDailyRate} EUR, gain mensuel attendu ${candidate.monthlyImpactAmount} EUR.`,
        actionType: "client_renegotiation",
        status: "todo",
        priority: candidate.severity,
        relatedMissionId: candidate.missionId,
        expectedImpactAmount: candidate.monthlyImpactAmount,
        expectedImpactMonth: new Date().toISOString().slice(0, 7)
      }
    });
    await db.renegotiationCandidate.update({ where: { id: candidate.id }, data: { status: "action_planned" } });
    res.status(201).json(action);
  } catch (error) {
    next(error);
  }
});

v7Router.get("/pricing/decisions", async (_req, res, next) => { try { res.json(await db.pricingDecision.findMany({ orderBy: { decidedAt: "desc" } })); } catch (error) { next(error); } });
v7Router.post("/pricing/decisions", async (req, res, next) => { try { const { organization, company } = await getPricingContext(); res.status(201).json(await db.pricingDecision.create({ data: { organizationId: organization.id, companyId: company.id, ...req.body } })); } catch (error) { next(error); } });
v7Router.get("/pricing/missions/:missionId/decisions", async (req, res, next) => { try { res.json(await db.pricingDecision.findMany({ where: { missionId: req.params.missionId }, orderBy: { decidedAt: "desc" } })); } catch (error) { next(error); } });

v7Router.get("/pricing/margin-exceptions", async (_req, res, next) => { try { res.json(await db.marginException.findMany({ orderBy: { targetReviewDate: "asc" } })); } catch (error) { next(error); } });
v7Router.post("/pricing/margin-exceptions", async (req, res, next) => { try { const { organization, company } = await getPricingContext(); res.status(201).json(await db.marginException.create({ data: { organizationId: organization.id, companyId: company.id, ...req.body } })); } catch (error) { next(error); } });
v7Router.put("/pricing/margin-exceptions/:id", async (req, res, next) => { try { res.json(await db.marginException.update({ where: { id: req.params.id }, data: req.body })); } catch (error) { next(error); } });
v7Router.post("/pricing/margin-exceptions/:id/revoke", async (req, res, next) => { try { res.json(await db.marginException.update({ where: { id: req.params.id }, data: { status: "revoked" } })); } catch (error) { next(error); } });

v7Router.get("/reports/pricing-margin.json", async (_req, res, next) => { try { res.json({ generatedAt: new Date().toISOString(), dashboard: await pricingDashboard(), candidates: await db.renegotiationCandidate.findMany({ orderBy: { priorityScore: "desc" } }), exceptions: await db.marginException.findMany() }); } catch (error) { next(error); } });
v7Router.get("/reports/pricing-margin.csv", async (_req, res, next) => { try { const rows = await listUnderpricedMissions(); res.type("text/csv").send(["mission,client,status,currentRate,floorRate,recommendedRate,monthlyImpact,annualImpact", ...rows.map((row) => `${row.missionTitle},${row.clientName},${row.pricingStatus},${row.currentDailyRate},${row.calculatedFloorDailyRate},${row.recommendedDailyRate},${row.monthlyImpactAmount},${row.annualizedImpactAmount}`)].join("\n")); } catch (error) { next(error); } });
v7Router.get("/reports/pricing-margin.pdf", (_req, res) => res.type("application/pdf").send(Buffer.from("PDF demo V7 Pricing Margin")));

v7Router.post("/ai/pricing/analyze-mission", async (req, res, next) => { try { const row = toMissionPricingRow(await calculateMissionProfile(req.body?.missionId)); res.json({ facts: row, summary: `Mission ${row.missionTitle}: TJM actuel ${row.currentDailyRate}, recommande ${row.recommendedDailyRate}.`, guardrail: "Analyse limitee aux donnees pricing calculees." }); } catch (error) { next(error); } });
v7Router.post("/ai/pricing/generate-renegotiation-argument", async (req, res, next) => { try { const row = toMissionPricingRow(await calculateMissionProfile(req.body?.missionId)); res.json({ argument: `Le cout complet et la marge cible justifient un TJM cible de ${row.recommendedDailyRate} EUR. L'ecart actuel represente ${row.monthlyImpactAmount} EUR par mois.`, sources: [row.missionId, row.profileId] }); } catch (error) { next(error); } });
v7Router.post("/ai/pricing/create-action-draft", (_req, res) => res.json({ title: "Brouillon action renegociation", actionType: "client_renegotiation", status: "draft" }));
