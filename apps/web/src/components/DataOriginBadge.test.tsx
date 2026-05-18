import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DataOriginBadge, inferOriginFromRow, normalizeOriginKind } from "./DataOriginBadge";

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
});
