import { Router } from "express";
import { prisma } from "../../db";

export const settingsRouter = Router();

settingsRouter.get("/projection", async (_req, res, next) => {
  try {
    res.json(await prisma.projectionSettings.findFirst());
  } catch (error) {
    next(error);
  }
});

settingsRouter.put("/projection", async (req, res, next) => {
  try {
    const existing = await prisma.projectionSettings.findFirst();
    const row = existing
      ? await prisma.projectionSettings.update({ where: { id: existing.id }, data: req.body })
      : await prisma.projectionSettings.create({ data: req.body });
    res.json(row);
  } catch (error) {
    next(error);
  }
});
