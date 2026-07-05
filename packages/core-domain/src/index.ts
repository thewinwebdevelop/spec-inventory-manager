// @omnistock/core-domain — pure business logic (golden rule 6).
// No framework, no DB, no I/O. Money = Decimal (never float), stock = integer
// (golden rule 7). The core-domain-is-pure dependency-cruiser rule
// (packages/config/depcruise) enforces this boundary in CI.
export {
  weightedAverageCost,
  type Money,
  type WeightedAverageInput,
} from "./cost/weighted-average";
