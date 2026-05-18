import { Router } from "express";
import { calculateFloorRate, calculateRecommendedRate } from "@esn-forecast/shared";
import { prisma } from "../../db";
import { ApiError } from "../../middleware/requestContext";
import { buildPricingMarginPdf } from "../reports/executivePdfReport";
import {
  calculateMissionProfile,
  createPricingSimulation,
  enrichMissionLabels,
  ensurePricingSettings,
  getPricingContext,
  listUnderpricedMissions,
  previewPricingSimulation,
  pricingDashboard,
  recalculateRenegotiationCandidates,
  toMissionPricingRow
} from "./pricingService";

const db = prisma as any;
export const pricingRouter = Router();

pricingRouter.get("/pricing/settings", async (_req, res, next) => {
  try {
    res.json(await ensurePricingSettings());
  } catch (error) {
    next(error);
  }
});

pricingRouter.put("/pricing/settings", async (req, res, next) => {
  try {
    const settings = await ensurePricingSettings();
    const { id, organizationId, companyId, createdAt, updatedAt, ...data } = req.body;
    res.json(await db.pricingSettings.update({ where: { id: settings.id }, data }));
  } catch (error) {
    next(error);
  }
});

pricingRouter.get("/pricing/dashboard", async (_req, res, next) => {
  try {
    res.json(await pricingDashboard());
  } catch (error) {
    next(error);
  }
});

pricingRouter.get("/pricing/missions/:missionId", async (req, res, next) => {
  try {
    const analysis = await calculateMissionProfile(req.params.missionId);
    res.json(toMissionPricingRow(analysis));
  } catch (error) {
    next(error);
  }
});

pricingRouter.post("/pricing/missions/:missionId/recalculate", async (req, res, next) => {
  try {
    const analysis = await calculateMissionProfile(req.params.missionId);
    res.json(toMissionPricingRow(analysis));
  } catch (error) {
    next(error);
  }
});

pricingRouter.put("/pricing/missions/:missionId/profile", async (req, res, next) => {
  try {
    await calculateMissionProfile(req.params.missionId);
    res.json(await db.missionPricingProfile.update({ where: { missionId: req.params.missionId }, data: req.body }));
  } catch (error) {
    next(error);
  }
});

pricingRouter.post("/pricing/calculate-floor-rate", (req, res) => {
  res.json({ floorDailyRate: calculateFloorRate(Number(req.body?.fullDailyCost ?? 0), Number(req.body?.minimumMarginRate ?? 0.2), req.body?.roundingMode ?? "nearest_10") });
});

pricingRouter.post("/pricing/calculate-recommended-rate", (req, res) => {
  res.json({ recommendedDailyRate: calculateRecommendedRate(Number(req.body?.fullDailyCost ?? 0), Number(req.body?.targetMarginRate ?? 0.3), req.body?.roundingMode ?? "nearest_10") });
});

pricingRouter.post("/pricing/simulate", async (req, res, next) => {
  try {
    const missionId = req.body?.missionId;
    if (!missionId) throw new ApiError(400, "VALIDATION_ERROR", "missionId est requis.");
    res.status(201).json(await createPricingSimulation(missionId, req.body));
  } catch (error) {
    next(error);
  }
});
pricingRouter.post("/pricing/simulate-preview", async (req, res, next) => {
  try {
    const missionId = req.body?.missionId;
    if (!missionId) throw new ApiError(400, "VALIDATION_ERROR", "missionId est requis.");
    res.json(await previewPricingSimulation(missionId, req.body));
  } catch (error) {
    next(error);
  }
});
pricingRouter.post("/pricing/simulate-discount", async (req, res, next) => { req.body.name = req.body.name ?? "Simulation remise"; return createPricingSimulation(req.body?.missionId, req.body).then((value) => res.status(201).json(value)).catch(next); });
pricingRouter.post("/pricing/simulate-resource-change", async (req, res, next) => { req.body.name = req.body.name ?? "Simulation changement ressource"; return createPricingSimulation(req.body?.missionId, req.body).then((value) => res.status(201).json(value)).catch(next); });
pricingRouter.post("/pricing/simulate-cost-increase", async (req, res, next) => { req.body.name = req.body.name ?? "Simulation hausse cout"; return createPricingSimulation(req.body?.missionId, req.body).then((value) => res.status(201).json(value)).catch(next); });
pricingRouter.get("/pricing/simulations", async (_req, res, next) => {
  try {
    const rows = await db.pricingSimulation.findMany({ include: { variants: true }, orderBy: { createdAt: "desc" } });
    res.json(await enrichMissionLabels(rows));
  } catch (error) {
    next(error);
  }
});
pricingRouter.get("/pricing/simulations/:id", async (req, res, next) => {
  try {
    const simulation = await db.pricingSimulation.findUnique({ where: { id: req.params.id }, include: { variants: true } });
    if (!simulation) throw new ApiError(404, "NOT_FOUND", "Simulation introuvable.");
    res.json(simulation);
  } catch (error) {
    next(error);
  }
});
pricingRouter.put("/pricing/simulations/:id", async (req, res, next) => {
  try {
    const { id, organizationId, companyId, missionId, createdAt, updatedAt, variants, ...data } = req.body;
    res.json(await db.pricingSimulation.update({ where: { id: req.params.id }, data }));
  } catch (error) {
    next(error);
  }
});
pricingRouter.delete("/pricing/simulations/:id", async (req, res, next) => {
  try {
    await db.pricingSimulation.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

pricingRouter.get("/pricing/underpriced-missions", async (_req, res, next) => {
  try {
    res.json(await listUnderpricedMissions());
  } catch (error) {
    next(error);
  }
});

pricingRouter.get("/pricing/renegotiation-candidates", async (_req, res, next) => {
  try {
    const rows = await db.renegotiationCandidate.findMany({ orderBy: [{ priorityScore: "desc" }, { createdAt: "desc" }] });
    res.json(await enrichMissionLabels(rows.length ? rows : await recalculateRenegotiationCandidates()));
  } catch (error) {
    next(error);
  }
});
pricingRouter.get("/pricing/renegotiation-candidates/:id", async (req, res, next) => { try { const row = await db.renegotiationCandidate.findUnique({ where: { id: req.params.id } }); if (!row) throw new ApiError(404, "NOT_FOUND", "Candidat introuvable."); res.json((await enrichMissionLabels([row]))[0]); } catch (error) { next(error); } });
pricingRouter.post("/pricing/renegotiation-candidates/recalculate", async (_req, res, next) => { try { res.json(await recalculateRenegotiationCandidates()); } catch (error) { next(error); } });
pricingRouter.put("/pricing/renegotiation-candidates/:id", async (req, res, next) => { try { res.json(await db.renegotiationCandidate.update({ where: { id: req.params.id }, data: req.body })); } catch (error) { next(error); } });
pricingRouter.delete("/pricing/renegotiation-candidates/:id", async (req, res, next) => { try { await db.renegotiationCandidate.delete({ where: { id: req.params.id } }); res.status(204).send(); } catch (error) { next(error); } });
pricingRouter.post("/pricing/renegotiation-candidates/:id/ignore", async (req, res, next) => { try { res.json(await db.renegotiationCandidate.update({ where: { id: req.params.id }, data: { status: "ignored" } })); } catch (error) { next(error); } });
pricingRouter.post("/pricing/renegotiation-candidates/:id/mark-renegotiated", async (req, res, next) => { try { res.json(await db.renegotiationCandidate.update({ where: { id: req.params.id }, data: { status: "renegotiated", targetDailyRate: req.body?.targetDailyRate } })); } catch (error) { next(error); } });

pricingRouter.post("/pricing/renegotiation-candidates/:id/create-action", async (req, res, next) => {
  try {
    const candidate = await db.renegotiationCandidate.findUnique({ where: { id: req.params.id } });
    if (!candidate) throw new ApiError(404, "NOT_FOUND", "Candidat introuvable.");
    const { organization, company } = await getPricingContext();
    const plan = await db.actionPlan.findFirst({ where: { organizationId: organization.id, status: "active", title: { contains: "renegociation" } } }) ??
      await db.actionPlan.create({ data: { organizationId: organization.id, companyId: company.id, fiscalYear: new Date().getFullYear(), title: "Plan de renegociation pricing", status: "active", ownerUserId: "direction" } });
    const action = await db.actionItem.create({
      data: {
        actionPlanId: plan.id,
        title: req.body?.title ?? "Renégocier le TJM de la mission",
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

pricingRouter.get("/pricing/decisions", async (_req, res, next) => { try { res.json(await enrichMissionLabels(await db.pricingDecision.findMany({ orderBy: { decidedAt: "desc" } }))); } catch (error) { next(error); } });
pricingRouter.post("/pricing/decisions", async (req, res, next) => { try { const { organization, company } = await getPricingContext(); res.status(201).json(await db.pricingDecision.create({ data: { organizationId: organization.id, companyId: company.id, ...req.body } })); } catch (error) { next(error); } });
pricingRouter.put("/pricing/decisions/:id", async (req, res, next) => { try { const { id, organizationId, companyId, createdAt, updatedAt, ...data } = req.body; res.json(await db.pricingDecision.update({ where: { id: req.params.id }, data })); } catch (error) { next(error); } });
pricingRouter.delete("/pricing/decisions/:id", async (req, res, next) => { try { await db.pricingDecision.delete({ where: { id: req.params.id } }); res.status(204).send(); } catch (error) { next(error); } });
pricingRouter.get("/pricing/missions/:missionId/decisions", async (req, res, next) => { try { res.json(await enrichMissionLabels(await db.pricingDecision.findMany({ where: { missionId: req.params.missionId }, orderBy: { decidedAt: "desc" } }))); } catch (error) { next(error); } });

pricingRouter.get("/pricing/margin-exceptions", async (_req, res, next) => { try { res.json(await enrichMissionLabels(await db.marginException.findMany({ orderBy: { targetReviewDate: "asc" } }))); } catch (error) { next(error); } });
pricingRouter.post("/pricing/margin-exceptions", async (req, res, next) => { try { const { organization, company } = await getPricingContext(); res.status(201).json(await db.marginException.create({ data: { organizationId: organization.id, companyId: company.id, ...req.body } })); } catch (error) { next(error); } });
pricingRouter.put("/pricing/margin-exceptions/:id", async (req, res, next) => { try { res.json(await db.marginException.update({ where: { id: req.params.id }, data: req.body })); } catch (error) { next(error); } });
pricingRouter.delete("/pricing/margin-exceptions/:id", async (req, res, next) => { try { await db.marginException.delete({ where: { id: req.params.id } }); res.status(204).send(); } catch (error) { next(error); } });
pricingRouter.post("/pricing/margin-exceptions/:id/revoke", async (req, res, next) => { try { res.json(await db.marginException.update({ where: { id: req.params.id }, data: { status: "revoked" } })); } catch (error) { next(error); } });

pricingRouter.get("/reports/pricing-margin.json", async (_req, res, next) => { try { res.json({ generatedAt: new Date().toISOString(), dashboard: await pricingDashboard(), candidates: await enrichMissionLabels(await db.renegotiationCandidate.findMany({ orderBy: { priorityScore: "desc" } })), exceptions: await enrichMissionLabels(await db.marginException.findMany()) }); } catch (error) { next(error); } });
pricingRouter.get("/reports/pricing-margin.csv", async (_req, res, next) => { try { const rows = await listUnderpricedMissions(); res.type("text/csv").send(["mission,client,status,currentRate,floorRate,recommendedRate,monthlyImpact,annualImpact", ...rows.map((row) => `${row.missionTitle},${row.clientName},${row.pricingStatus},${row.currentDailyRate},${row.calculatedFloorDailyRate},${row.recommendedDailyRate},${row.monthlyImpactAmount},${row.annualizedImpactAmount}`)].join("\n")); } catch (error) { next(error); } });
pricingRouter.get("/reports/pricing-margin.pdf", async (_req, res, next) => {
  try {
    const payload = {
      generatedAt: new Date().toISOString(),
      dashboard: await pricingDashboard(),
      candidates: await enrichMissionLabels(await db.renegotiationCandidate.findMany({ orderBy: { priorityScore: "desc" } })),
      exceptions: await enrichMissionLabels(await db.marginException.findMany())
    };
    res.type("application/pdf").send(buildPricingMarginPdf(payload));
  } catch (error) {
    next(error);
  }
});
pricingRouter.get("/reports/pricing-margin.demo.pdf", (_req, res) => res.type("application/pdf").send(Buffer.from("PDF démo Pricing Margin")));

pricingRouter.post("/ai/pricing/analyze-mission", async (req, res, next) => { try { const row = toMissionPricingRow(await calculateMissionProfile(req.body?.missionId)); res.json({ facts: row, summary: `Mission ${row.missionTitle}: TJM actuel ${row.currentDailyRate}, recommandé ${row.recommendedDailyRate}.`, guardrail: "Analyse limitée aux données pricing calculées." }); } catch (error) { next(error); } });
pricingRouter.post("/ai/pricing/generate-renegotiation-argument", async (req, res, next) => { try { const row = toMissionPricingRow(await calculateMissionProfile(req.body?.missionId)); res.json({ argument: `Le cout complet et la marge cible justifient un TJM cible de ${row.recommendedDailyRate} EUR. L'Ecart actuel represente ${row.monthlyImpactAmount} EUR par mois.`, sources: [row.missionId, row.profileId] }); } catch (error) { next(error); } });
pricingRouter.post("/ai/pricing/create-action-draft", (_req, res) => res.json({ title: "Brouillon action renegociation", actionType: "client_renegotiation", status: "draft" }));
