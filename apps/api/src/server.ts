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
import { v3Router } from "./routes/v3";
import { v4Router } from "./routes/v4";
import { v5Router } from "./routes/v5";
import { errorHandler, notFoundHandler, requestContext } from "./middleware/requestContext";

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(requestContext);

app.get("/api/health", (_req, res) => res.json({ ok: true, name: "ESN Forecast API", timestamp: new Date().toISOString() }));
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
app.use("/api", v4Router);
app.use("/api", v3Router);
app.use("/api", v5Router);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`ESN Forecast API listening on http://localhost:${port}`);
});
