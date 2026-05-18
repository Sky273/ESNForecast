import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InfoPanel } from "./InfoPanel";

describe("InfoPanel", () => {
  it("renders a title and explanation", () => {
    const html = renderToStaticMarkup(<InfoPanel title="Source">Données calculées.</InfoPanel>);
    expect(html).toContain("Source");
    expect(html).toContain("Données calculées.");
  });
});
