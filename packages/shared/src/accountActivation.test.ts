import { describe, expect, it } from "vitest";
import { buildAccountActivationEmail } from "./accountActivation";

describe("account activation email", () => {
  it("builds a first-login email with the activation link", () => {
    const email = buildAccountActivationEmail({
      appName: "ESN Forecast",
      baseUrl: "https://forecast.example.com/",
      token: "abc123",
      userName: "Marie Finance"
    });

    expect(email.subject).toContain("ESN Forecast");
    expect(email.html).toContain("https://forecast.example.com/#/first-login?token=abc123");
    expect(email.text).toContain("https://forecast.example.com/#/first-login?token=abc123");
    expect(email.html).toContain("Marie Finance");
  });
});
