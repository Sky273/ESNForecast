import { describe, expect, it } from "vitest";
import { cashForecastStatusOptions } from "./pages";

describe("cash forecast status options", () => {
  it("matches the backend enum accepted by cash-in and cash-out forecasts", () => {
    expect(cashForecastStatusOptions).toEqual(["planned", "paid", "late", "cancelled"]);
  });
});
