// F-000 · T-000-05 — unit tests for the Layer-1 ledger guard decision primitive.
// Golden rule 2: the ledger is immutable. These assert the app-side guard's pure
// decision function rejects UPDATE/DELETE-family ops on ledger models and lets
// appends + reads (and everything on non-ledger models) through. The DB trigger
// (Layer 2) is proven separately against real Postgres (AC8).

import { describe, expect, it } from "vitest";
import {
  FORBIDDEN_LEDGER_OPERATIONS,
  isForbiddenLedgerMutation,
  LEDGER_MODELS,
  LedgerImmutableError,
} from "./ledger-guard";

describe("isForbiddenLedgerMutation", () => {
  it("rejects every forbidden mutating op on every ledger model", () => {
    for (const model of LEDGER_MODELS) {
      for (const op of FORBIDDEN_LEDGER_OPERATIONS) {
        expect(isForbiddenLedgerMutation(model, op)).toBe(true);
      }
    }
  });

  it("allows appends and reads on ledger models", () => {
    const allowed = [
      "create",
      "createMany",
      "findUnique",
      "findFirst",
      "findMany",
      "count",
      "aggregate",
      "groupBy",
    ];
    for (const model of LEDGER_MODELS) {
      for (const op of allowed) {
        expect(isForbiddenLedgerMutation(model, op)).toBe(false);
      }
    }
  });

  it("never blocks non-ledger models, even for mutating ops", () => {
    for (const op of FORBIDDEN_LEDGER_OPERATIONS) {
      expect(isForbiddenLedgerMutation("StockLevel", op)).toBe(false);
      expect(isForbiddenLedgerMutation("InventoryItem", op)).toBe(false);
      expect(isForbiddenLedgerMutation("Product", op)).toBe(false);
    }
  });

  it("is a no-op for raw/$-level calls that carry no model", () => {
    expect(isForbiddenLedgerMutation(undefined, "update")).toBe(false);
    expect(isForbiddenLedgerMutation(undefined, "delete")).toBe(false);
  });

  it("forbids upsert on the ledger (it can update an existing row)", () => {
    expect(isForbiddenLedgerMutation("StockMovement", "upsert")).toBe(true);
    expect(isForbiddenLedgerMutation("UsageEvent", "upsert")).toBe(true);
  });
});

describe("LedgerImmutableError", () => {
  it("names the model + operation and points to append-instead guidance", () => {
    const err = new LedgerImmutableError("StockMovement", "update");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("LedgerImmutableError");
    expect(err.message).toContain("StockMovement");
    expect(err.message).toContain("update");
    expect(err.message).toContain("append a new row");
  });
});
