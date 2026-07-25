// @omnistock/core-domain — pure business logic (golden rule 6).
// No framework, no DB, no I/O. Money = Decimal (never float), stock = integer
// (golden rule 7). The core-domain-is-pure dependency-cruiser rule
// (packages/config/depcruise) enforces this boundary in CI.
export {
  weightedAverageCost,
  type Money,
  type WeightedAverageInput,
} from "./cost/weighted-average";

// F-001 auth pure fns (T-001-01) — password policy, email normalize,
// reuse-decision, backoff curve, access-claim builder, token-lifetime/cap,
// capability constants. Pure, framework-free (golden rules #4/#6).
export * from "./auth";
