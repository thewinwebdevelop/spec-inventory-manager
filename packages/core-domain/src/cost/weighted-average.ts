import { Decimal } from "decimal.js";

/**
 * Weighted-average cost recalculation on a stock receipt (PURCHASE_IN / RETURN-in).
 *
 * Golden rule 7: money is Decimal (never JS float); stock is integer.
 * Golden rule 6: this is a PURE function — no framework, no DB, no I/O.
 *
 * Formula (docs/01-data-model.md §3):
 *   newAvg = (onHand * oldAvg + qtyIn * unitCostIn) / (onHand + qtyIn)
 *
 * `onHand` / `qtyIn` are integer stock quantities. `oldAvg` / `unitCostIn`
 * are money values passed as strings or Decimal so no precision is lost across
 * the boundary (a JS `number` money value would already be a golden-rule
 * violation before it reached here).
 */

/** A money value accepted at the boundary: string (canonical), or Decimal. */
export type Money = string | Decimal;

export interface WeightedAverageInput {
  /** Units already on hand before the receipt. Integer, >= 0. */
  onHand: number;
  /** Current weighted-average unit cost. Money. */
  oldAvg: Money;
  /** Units received in this movement. Integer, >= 0. */
  qtyIn: number;
  /** Unit cost of the received units. Money. */
  unitCostIn: Money;
}

function assertInteger(name: string, v: number): void {
  if (!Number.isInteger(v)) {
    throw new RangeError(`${name} must be an integer stock quantity, got ${v}`);
  }
  if (v < 0) {
    throw new RangeError(`${name} must be >= 0, got ${v}`);
  }
}

/**
 * Recompute the weighted-average unit cost after receiving `qtyIn` units at
 * `unitCostIn`. Returns a Decimal — the caller decides how to round/persist
 * (schema stores Decimal(18,4)); we do NOT prematurely round here so that
 * chained receipts don't accumulate rounding error.
 *
 * Edge cases:
 *  - qtyIn === 0            → no change; returns oldAvg unchanged.
 *  - onHand === 0, qtyIn>0  → newAvg === unitCostIn (first receipt).
 *  - onHand === 0 && qtyIn===0 → nothing to average → returns oldAvg (0-safe).
 */
export function weightedAverageCost(input: WeightedAverageInput): Decimal {
  const { onHand, qtyIn } = input;
  assertInteger("onHand", onHand);
  assertInteger("qtyIn", qtyIn);

  const oldAvg = new Decimal(input.oldAvg);
  const unitCostIn = new Decimal(input.unitCostIn);

  // No units received → average is unchanged. Avoids divide-by-(onHand+0)
  // producing a spurious result when onHand is also 0.
  if (qtyIn === 0) {
    return oldAvg;
  }

  const totalUnits = onHand + qtyIn; // integer, > 0 here
  const totalCost = oldAvg.times(onHand).plus(unitCostIn.times(qtyIn));

  return totalCost.dividedBy(totalUnits);
}
