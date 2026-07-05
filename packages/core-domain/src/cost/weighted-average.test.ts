import { describe, it, expect } from "vitest";
import { Decimal } from "decimal.js";
import { weightedAverageCost } from "./weighted-average";

// These tests run WITHOUT a database — pure function, pure math (proves
// test-without-DB, golden rule 6).

describe("weightedAverageCost", () => {
  it("blends old average with the incoming cost (docs/01 §3 formula)", () => {
    // 10 @ 100 + 10 @ 200 → (1000 + 2000) / 20 = 150
    const avg = weightedAverageCost({
      onHand: 10,
      oldAvg: "100",
      qtyIn: 10,
      unitCostIn: "200",
    });
    expect(avg.equals(new Decimal("150"))).toBe(true);
  });

  it("first receipt (onHand=0) yields the incoming unit cost", () => {
    const avg = weightedAverageCost({
      onHand: 0,
      oldAvg: "0",
      qtyIn: 5,
      unitCostIn: "42.50",
    });
    expect(avg.equals(new Decimal("42.50"))).toBe(true);
  });

  it("qtyIn=0 (edge) leaves the average unchanged, no divide-by-zero", () => {
    const avg = weightedAverageCost({
      onHand: 0,
      oldAvg: "0",
      qtyIn: 0,
      unitCostIn: "999",
    });
    expect(avg.equals(new Decimal("0"))).toBe(true);

    const avg2 = weightedAverageCost({
      onHand: 7,
      oldAvg: "12.3456",
      qtyIn: 0,
      unitCostIn: "999",
    });
    expect(avg2.equals(new Decimal("12.3456"))).toBe(true);
  });

  it("keeps satang precision that a JS float would lose (Decimal, not float)", () => {
    // 1 @ 0.1 + 2 @ 0.2 → (0.1 + 0.4) / 3 = 0.5 / 3 = 0.16666...
    const avg = weightedAverageCost({
      onHand: 1,
      oldAvg: "0.10",
      qtyIn: 2,
      unitCostIn: "0.20",
    });
    // Decimal keeps full precision; assert to schema precision (4dp).
    expect(avg.toDecimalPlaces(4).toString()).toBe("0.1667");

    // Why Decimal and not float (golden rule 7): the canonical IEEE-754 drift
    // that would silently corrupt money if we summed costs as JS numbers.
    expect(0.1 + 0.2).not.toBe(0.3); // 0.30000000000000004
    // Decimal is exact for the same operation:
    expect(new Decimal("0.1").plus("0.2").equals(new Decimal("0.3"))).toBe(true);
  });

  it("does not prematurely round intermediate averages (chained receipts)", () => {
    // Two receipts; if we rounded to 4dp mid-way, the second blend would drift.
    const first = weightedAverageCost({
      onHand: 3,
      oldAvg: "1",
      qtyIn: 1,
      unitCostIn: "2",
    }); // (3 + 2)/4 = 1.25
    expect(first.toString()).toBe("1.25");

    const second = weightedAverageCost({
      onHand: 4,
      oldAvg: first,
      qtyIn: 3,
      unitCostIn: "10.3333",
    });
    // (4*1.25 + 3*10.3333)/7 = (5 + 30.9999)/7 = 35.9999/7 = 5.142842857...
    expect(second.toDecimalPlaces(4).toString()).toBe("5.1428");
  });

  it("rejects non-integer stock quantities (golden rule 7: stock is integer)", () => {
    expect(() =>
      weightedAverageCost({
        onHand: 1.5,
        oldAvg: "1",
        qtyIn: 1,
        unitCostIn: "1",
      }),
    ).toThrow(/integer stock quantity/);
    expect(() =>
      weightedAverageCost({
        onHand: 1,
        oldAvg: "1",
        qtyIn: -2,
        unitCostIn: "1",
      }),
    ).toThrow(/>= 0/);
  });
});
