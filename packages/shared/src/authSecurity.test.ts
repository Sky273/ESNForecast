import { describe, expect, it } from "vitest";
import { assessSecurityContext, validatePasswordRules } from "./authSecurity";

describe("auth security helpers", () => {
  it("validates all minimum password rules", () => {
    const result = validatePasswordRules("Forecast-2026");

    expect(result.valid).toBe(true);
    expect(result.rules.every((rule) => rule.valid)).toBe(true);
  });

  it("rejects weak passwords with explicit failed rules", () => {
    const result = validatePasswordRules("forecast");

    expect(result.valid).toBe(false);
    expect(result.rules.filter((rule) => !rule.valid).map((rule) => rule.key)).toEqual(["minLength", "uppercase", "digit", "special"]);
  });

  it("allows local HTTP as a development context", () => {
    const result = assessSecurityContext({ protocol: "http:", hostname: "localhost", mode: "development" });

    expect(result.level).toBe("local_http");
    expect(result.blocking).toBe(false);
  });

  it("flags production HTTP as insecure", () => {
    const result = assessSecurityContext({ protocol: "http:", hostname: "82.67.69.233", mode: "production" });

    expect(result.level).toBe("insecure_http");
    expect(result.blocking).toBe(false);
  });

  it("treats HTTPS as secure", () => {
    const result = assessSecurityContext({ protocol: "https:", hostname: "app.example.com", mode: "production" });

    expect(result.level).toBe("secure");
  });
});
