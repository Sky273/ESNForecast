import cors from "cors";
import express from "express";
import { prisma } from "./db";
import { assignmentsRouter } from "./routes/assignments";
import { crudRouter } from "./routes/crud";
import { csvRouter } from "./routes/csv";
import { projectionsRouter } from "./routes/projections";
import { settingsRouter } from "./routes/settings";
import { v1Router } from "./routes/v1";
import { v2Router } from "./routes/v2";

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true, name: "ESN Forecast API" }));
app.use("/api/employees", crudRouter(prisma, "employee"));
app.use("/api/partners", crudRouter(prisma, "partner", { include: { resources: true } }));
app.use("/api/partner-resources", crudRouter(prisma, "partnerResource", { include: { partner: true } }));
app.use("/api/freelancers", crudRouter(prisma, "freelancer"));
app.use("/api/clients", crudRouter(prisma, "client", { include: { missions: true } }));
app.use("/api/missions", crudRouter(prisma, "mission", { include: { client: true, assignments: true } }));
app.use("/api", assignmentsRouter);
app.use("/api/fixed-costs", crudRouter(prisma, "fixedCost"));
app.use("/api/variable-costs", crudRouter(prisma, "variableCost"));
app.use("/api/projections", projectionsRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/export", csvRouter);
app.use("/api/import", csvRouter);
app.use("/api", v1Router);
app.use("/api", v2Router);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ error: error instanceof Error ? error.message : "Unexpected error" });
});

app.listen(port, () => {
  console.log(`ESN Forecast API listening on http://localhost:${port}`);
});
