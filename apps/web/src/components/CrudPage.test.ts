import { describe, expect, it } from "vitest";
import type { Field } from "../types";
import { normalizeListResponse, pickEditableFields, updateDraftSelectValue } from "./CrudPage";

describe("CrudPage helpers", () => {
  const fields: Field[] = [
    { name: "clientId", label: "Client", type: "select" },
    { name: "missionId", label: "Mission", type: "select", optionDependsOn: "clientId" },
    { name: "amount", label: "Montant", type: "number" }
  ];

  it("keeps only editable fields in submitted payloads", () => {
    expect(pickEditableFields(fields, {
      id: "row-1",
      clientId: "client-1",
      missionId: "mission-1",
      amount: 1200,
      createdAt: "2026-05-16"
    })).toEqual({
      clientId: "client-1",
      missionId: "mission-1",
      amount: 1200
    });
  });

  it("normalizes common API list wrappers", () => {
    expect(normalizeListResponse([{ id: "a" }])).toEqual([{ id: "a" }]);
    expect(normalizeListResponse({ rows: [{ id: "b" }] })).toEqual([{ id: "b" }]);
    expect(normalizeListResponse({ data: [{ id: "c" }] })).toEqual([{ id: "c" }]);
    expect(normalizeListResponse({ items: [{ id: "d" }] })).toEqual([{ id: "d" }]);
    expect(normalizeListResponse({ connectors: [{ id: "e" }] })).toEqual([{ id: "e" }]);
    expect(normalizeListResponse({ unexpected: true })).toEqual([]);
  });

  it("clears dependent select values when a parent select changes", () => {
    expect(updateDraftSelectValue(fields, { clientId: "client-1", missionId: "mission-1", amount: 1200 }, "clientId", "client-2")).toEqual({
      clientId: "client-2",
      missionId: "",
      amount: 1200
    });
  });
});
