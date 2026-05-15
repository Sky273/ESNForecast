import cors from "cors";
import express from "express";
import { prisma } from "./db";
import { settingsRouter } from "./features/administration";
import { budgetRouter } from "./features/budget";
import { connectedFinanceRouter } from "./features/connected-finance";
import { csvRouter } from "./features/data-exchange";
import { deliveryRouter } from "./features/delivery";
import { forecastingRouter, projectionsRouter } from "./features/forecasting";
import { platformRouter } from "./features/platform";
import { pricingRouter } from "./features/pricing";
import { providersRouter } from "./features/providers";
import { assignmentsRouter } from "./features/staffing";
import { crudRouter } from "./routes/crud";
import { errorHandler, notFoundHandler, requestContext } from "./middleware/requestContext";

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(requestContext);

app.get("/api/health", (_req, res) => res.json({ ok: true, name: "ESN Forecast API", timestamp: new Date().toISOString() }));
app.use("/api/organizations", crudRouter(prisma, "organization"));
app.use("/api/companies", crudRouter(prisma, "company"));
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
app.use("/api", forecastingRouter);
app.use("/api", providersRouter);
app.use("/api", connectedFinanceRouter);
app.use("/api", deliveryRouter);
app.use("/api", platformRouter);
app.use("/api", budgetRouter);
app.use("/api", pricingRouter);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`ESN Forecast API listening on http://localhost:${port}`);
});
