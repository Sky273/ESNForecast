import { describe, expect, it } from "vitest";
import { buildCodirPdf } from "./executivePdfReport";

describe("buildCodirPdf", () => {
  it("renders the monthly cash variance from the treasury rows", () => {
    const pdf = buildCodirPdf({
      payload: {
        month: "2026-06",
        generatedAt: "2026-06-30T00:00:00.000Z",
        bankSummary: { currentCash: 77000 },
        treasury: [
          { month: "2026-06", forecastClosingCash: 84000, actualClosingCash: 77000, variance: -7000 }
        ],
        runway: { runwayWeightedMonths: 6, recommendedActions: [] },
        anomalies: [],
        dataQualityIssues: [],
        connectorHealth: { connectors: [] },
        recommendations: []
      }
    });

    const rawPdf = pdf.toString("utf8");
    expect(rawPdf).toContain("Ecart cash");
    expect(rawPdf).toContain("-7 000 EUR");
    expect(rawPdf).not.toContain("(0 EUR) Tj");
  });
});
