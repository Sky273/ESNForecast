import { Router } from "express";
import { buildProjection } from "./projectionService";

export const projectionsRouter = Router();

projectionsRouter.get("/monthly", async (req, res, next) => {
  try {
    res.json(await buildProjection(Number(req.query.horizon) || undefined));
  } catch (error) {
    next(error);
  }
});

projectionsRouter.get("/month/:month", async (req, res, next) => {
  try {
    const projection = await buildProjection(24);
    const month = projection.months.find((item: any) => item.month === req.params.month);
    if (!month) return res.status(404).json({ error: "Month not found" });
    res.json(month);
  } catch (error) {
    next(error);
  }
});

projectionsRouter.get("/missions/:missionId", async (req, res, next) => {
  try {
    const projection = await buildProjection(24);
    res.json(
      projection.months.map((month: any) => ({
        month: month.month,
        mission: month.details.missions.find((mission: any) => mission.missionId === req.params.missionId) ?? null
      }))
    );
  } catch (error) {
    next(error);
  }
});

projectionsRouter.post("/recalculate", async (_req, res, next) => {
  try {
    res.json(await buildProjection());
  } catch (error) {
    next(error);
  }
});
