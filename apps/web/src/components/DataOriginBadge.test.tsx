import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DataOriginBadge, DataOriginLegend, inferOriginFromRow, normalizeOriginKind } from "./DataOriginBadge";

describe("DataOriginBadge", () => {
  it("normalizes provider and mock origins", () => {
    expect(normalizeOriginKind("bridge")).toBe("provider");
    expect(normalizeOriginKind("sandbox")).toBe("mock");
  });

  it("infers source from row metadata", () => {
    expect(inferOriginFromRow({ source: "manual" }).kind).toBe("manual");
    expect(inferOriginFromRow({ provider: "bridge" }).kind).toBe("provider");
    expect(inferOriginFromRow({ primarySource: "bank_provider" }).kind).toBe("provider");
    expect(inferOriginFromRow({ sourceType: "invoice" }).kind).toBe("calculated");
    expect(inferOriginFromRow({ calculatedAt: "2026-05-18T10:00:00Z" }).kind).toBe("calculated");
  });

  it("renders a readable badge", () => {
    const html = renderToStaticMarkup(<DataOriginBadge kind="manual" />);
    expect(html).toContain("Saisie");
  });

  it("renders the shared legend", () => {
    const html = renderToStaticMarkup(<DataOriginLegend compact />);
    expect(html).toContain("Provider");
    expect(html).toContain("Calculé");
    expect(html).toContain("Méthode");
  });

  it("explains calculated origins with a short method", () => {
    const html = renderToStaticMarkup(<DataOriginBadge kind="calculated" label="Écart" details={["Budget 100 EUR", "Réel 80 EUR"]} />);
    expect(html).toContain("Écart");
    expect(html).toContain("Méthode");
    expect(html).toContain("Calculé à partir");
    expect(html).toContain("Budget 100 EUR");
  });
});
