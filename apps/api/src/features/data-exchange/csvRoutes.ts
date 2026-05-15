import { Router } from "express";
import { prisma } from "../../db";
import { buildProjection } from "../forecasting/projectionService";

export const csvRouter = Router();

const csv = (rows: Record<string, unknown>[]) => {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => JSON.stringify(row[header] ?? "")).join(","))
  ].join("\n");
};

csvRouter.get("/projection.csv", async (_req, res, next) => {
  try {
    const projection = await buildProjection();
    const rows = projection.months.map((month: any) => ({
      month: month.month,
      revenue: month.revenue.total,
      costs: month.costs.total,
      grossMargin: month.margins.gross,
      monthlyBalance: month.balance.monthly,
      cumulativeBalance: month.balance.cumulative,
      marginRate: month.margins.rate
    }));
    res.type("text/csv").send(csv(rows));
  } catch (error) {
    next(error);
  }
});

csvRouter.get("/missions.csv", async (_req, res, next) => {
  try {
    res.type("text/csv").send(csv(await prisma.mission.findMany() as any));
  } catch (error) {
    next(error);
  }
});

csvRouter.get("/resources.csv", async (_req, res, next) => {
  try {
    const [employees, partnerResources, freelancers] = await Promise.all([
      prisma.employee.findMany(),
      prisma.partnerResource.findMany(),
      prisma.freelancer.findMany()
    ]);
    res.type("text/csv").send(csv([
      ...employees.map((item) => ({ type: "employee", name: `${item.firstName} ${item.lastName}`, cost: item.monthlyGrossSalary })),
      ...partnerResources.map((item) => ({ type: "partner", name: `${item.firstName} ${item.lastName}`, cost: item.dailyCost })),
      ...freelancers.map((item) => ({ type: "freelancer", name: `${item.firstName} ${item.lastName}`, cost: item.dailyCost }))
    ]));
  } catch (error) {
    next(error);
  }
});

csvRouter.post("/csv", async (_req, res) => {
  res.status(202).json({ message: "Import CSV basique prévu: validez les colonnes puis mappez-les vers salariés, missions ou coûts." });
});
