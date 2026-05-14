import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { coerceDates, serializeDates } from "../utils/serialize";

type ModelName = keyof Pick<
  PrismaClient,
  "employee" | "partner" | "partnerResource" | "freelancer" | "client" | "mission" | "fixedCost" | "variableCost"
>;

const dateFields = ["startDate", "endDate", "availableFrom", "availableTo", "estimatedEndDate", "actualEndDate", "date"];

export function crudRouter(prisma: PrismaClient, modelName: ModelName, options: { include?: object } = {}) {
  const router = Router();
  const model = prisma[modelName] as any;

  router.get("/", async (_req, res, next) => {
    try {
      const rows = await model.findMany({ orderBy: { createdAt: "desc" }, include: options.include });
      res.json(serializeDates(rows));
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const row = await model.findUnique({ where: { id: req.params.id }, include: options.include });
      if (!row) return res.status(404).json({ error: "Not found" });
      res.json(serializeDates(row));
    } catch (error) {
      next(error);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      const data = coerceDates(req.body, dateFields);
      const row = await model.create({ data });
      res.status(201).json(serializeDates(row));
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
      const row = await model.update({ where: { id: req.params.id }, data });
      res.json(serializeDates(row));
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
}
