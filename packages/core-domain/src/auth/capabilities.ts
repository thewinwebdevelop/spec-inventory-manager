// F-001 · T-001-01 / T-001-07 — capability constants + check.
//
// F-003 (T-003-B03) moved both into `rbac/` (registry + expand); this module
// keeps the names F-001/F-002 call sites import, as re-exports of the SAME
// bindings (architecture §1: "export ชื่อเดิมคงไว้"). String values never
// change — they are compared against `Role.capabilities` rows in the database.
//
// `hasCapability` now runs through `expandCapabilities`: `full_access` grants
// every registered key and `manage_X` grants `view_X` (AC-7.3).
export {
  CAPABILITY_MANAGE_MEMBERS,
  CAPABILITY_MANAGE_ORG_SETTINGS,
  CAPABILITY_FULL_ACCESS,
} from "../rbac/registry";
export { hasCapability } from "../rbac/expand";
