import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const routesSource = readFileSync(fileURLToPath(new URL("./routes.ts", import.meta.url)), "utf8");

describe("pricing decisions routes", () => {
  it("uses the Prisma pricingDecision delegate", () => {
    expect(routesSource).toContain("db.pricingDecision.findMany");
    expect(routesSource).toContain("db.pricingDecision.create");
    expect(routesSource).toContain("db.pricingDecision.update");
    expect(routesSource).toContain("db.pricingDecision.delete");
    expect(routesSource).not.toContain("pricingDécision");
  });

  it("strips immutable fields before update", () => {
    expect(routesSource).toContain("const { id, organizationId, companyId, createdAt, updatedAt, ...data } = req.body");
  });
});
