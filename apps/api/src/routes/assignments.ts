import { Router } from "express";
import { prisma } from "../db";
import { coerceDates, serializeDates } from "../utils/serialize";

export const assignmentsRouter = Router();

const relationData = (data: Record<string, unknown>) => {
  const clean = { ...data };
  clean.employeeId = clean.resourceType === "employee" ? clean.resourceId : null;
  clean.partnerResourceId = clean.resourceType === "partner" ? clean.resourceId : null;
  clean.freelancerId = clean.resourceType === "freelancer" ? clean.resourceId : null;
  return clean;
};

assignmentsRouter.get("/missions/:id/assignments", async (req, res, next) => {
  try {
    const rows = await prisma.missionAssignment.findMany({ where: { missionId: req.params.id }, orderBy: { createdAt: "desc" } });
    res.json(serializeDates(rows));
  } catch (error) {
    next(error);
  }
});

assignmentsRouter.post("/missions/:id/assignments", async (req, res, next) => {
  try {
    const data = relationData(coerceDates({ ...req.body, missionId: req.params.id }, ["startDate", "estimatedEndDate"]));
    const row = await prisma.missionAssignment.create({ data: data as any });
    res.status(201).json(serializeDates(row));
  } catch (error) {
    next(error);
  }
});

assignmentsRouter.put("/assignments/:id", async (req, res, next) => {
  try {
    const data = relationData(coerceDates(req.body, ["startDate", "estimatedEndDate"]));
    delete data.id;
    const row = await prisma.missionAssignment.update({ where: { id: req.params.id }, data: data as any });
    res.json(serializeDates(row));
  } catch (error) {
    next(error);
  }
});

assignmentsRouter.delete("/assignments/:id", async (req, res, next) => {
  try {
    await prisma.missionAssignment.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
