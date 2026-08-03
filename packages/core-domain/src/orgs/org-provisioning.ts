// F-002 · T-002-15 ★ — every decision "create a shop" makes BEFORE a row is
// written (architecture §6.1–§6.3 · data-model §5.2 · api-spec §3.1).
//
// WHY THESE ARE HERE AND NOT IN THE SERVICE (golden rule #6)
// The transaction in `apps/api/src/orgs/system/` is mechanism: five inserts in
// one atomic step. What it inserts — which roles exist, which of them the
// creator gets, what a shop is called, when a user has too many shops — is
// policy, and policy that lives inside a `$transaction` callback can only be
// tested with a database. Here it is a table of inputs and outputs.
//
// ⛔ NOTHING in this file may read the clock, `process.env` or a random source.
// The org cap LIMIT arrives as an argument (it is env-tunable, §6.4) and the
// creation timestamps are the database's.
import {
  CAPABILITY_FULL_ACCESS,
  CAPABILITY_MANAGE_MEMBERS,
  CAPABILITY_MANAGE_ORG_SETTINGS,
} from "../auth/capabilities";
import { isOwnerRole } from "./member-authz";

// ── the fixed shape of a new org (D-013 · architecture §6.1) ────────────────

/** Phase 0 is Thailand-only; the client cannot choose (api-spec §3.1). */
export const ORG_DEFAULT_TIMEZONE = "Asia/Bangkok" as const;

/** D-013 — THB only. NOT accepted from the client, ever. */
export const ORG_DEFAULT_CURRENCY = "THB" as const;

/** The single warehouse every new org starts with (architecture §6.1 step 5). */
export const DEFAULT_WAREHOUSE_NAME = "คลังหลัก" as const;

/** api-spec §3.1 — `name` is 1–120 characters and NOT unique (shops may share a name). */
export const ORG_NAME_MIN_LENGTH = 1;
export const ORG_NAME_MAX_LENGTH = 120;

// ── the three system roles (data-model §5.2) ───────────────────────────────

/** One row of the system-role table an org is created with. */
export interface SystemRoleBlueprint {
  /** Display name. Renameable by F-003 — never an input to an authorization check. */
  readonly name: string;
  /**
   * Stable slug, used ONLY to translate the name on screen (ux Q4). It is part
   * of the API contract (changing a value is breaking) and ⛔ must never decide
   * permissions — that is `capabilities`, see {@link isOwnerRole}.
   */
  readonly key: string;
  /** `true` locks the row against edit/delete in F-003 (docs/01). */
  readonly isSystem: boolean;
  readonly capabilities: readonly string[];
}

/**
 * data-model §5.2, verbatim and in order. Capability names come from the
 * open-ended registry in docs/01 §2 — F-002 invents none and enforces only two
 * of them (`manage_members`, `manage_org_settings`); the rest are values F-003+
 * will start reading.
 */
export const SYSTEM_ROLE_BLUEPRINT: readonly SystemRoleBlueprint[] = Object.freeze([
  Object.freeze({
    name: "Owner",
    key: "owner",
    isSystem: true,
    capabilities: Object.freeze([CAPABILITY_FULL_ACCESS]),
  }),
  Object.freeze({
    name: "Admin",
    key: "admin",
    isSystem: false,
    capabilities: Object.freeze([
      CAPABILITY_MANAGE_MEMBERS,
      CAPABILITY_MANAGE_ORG_SETTINGS,
      "manage_products",
      "manage_stock",
      "manage_channels",
      "manage_orders",
      "view_financials",
    ]),
  }),
  Object.freeze({
    name: "Staff",
    key: "staff",
    isSystem: false,
    capabilities: Object.freeze(["manage_products", "manage_stock", "manage_orders"]),
  }),
]) as readonly SystemRoleBlueprint[];

/**
 * The blueprint row the CREATOR's membership must point at (architecture §6.1
 * step 3) — resolved by capability, never by name or key. If F-003 ever renames
 * "Owner", or a future blueprint reorders the list, this keeps answering
 * correctly; `SYSTEM_ROLE_BLUEPRINT[0]` would not.
 *
 * Throws rather than returning `undefined`: an org whose creator is not an Owner
 * is the unusable half-state architecture §6.1 exists to make impossible, so it
 * must fail before the transaction, loudly.
 */
export function ownerRoleBlueprint(
  blueprint: readonly SystemRoleBlueprint[] = SYSTEM_ROLE_BLUEPRINT,
): SystemRoleBlueprint {
  const owner = blueprint.filter((role) => isOwnerRole(role.capabilities));
  if (owner.length !== 1) {
    throw new Error(
      `the system-role blueprint must contain EXACTLY ONE role holding ` +
        `${CAPABILITY_FULL_ACCESS} (found ${owner.length}) — the org creator's membership ` +
        `points at it, and "which role is Owner" is decided by capability, not by name`,
    );
  }
  return owner[0];
}

// ── the per-user org cap (architecture §6.3 · I-10) ────────────────────────

/**
 * Has this user run out of shops? `activeOrgCount` counts memberships with
 * status `active` only, so leaving or being removed gives the quota back
 * immediately (§6.3).
 *
 * FAIL-CLOSED on nonsense input: a `NaN`/negative count means the caller could
 * not count, and "could not count" must never read as "has room" — that is the
 * exact difference between this check and the rate limiter it replaced (I-10:
 * the limiter fails OPEN, which is why it cannot hold a bound).
 */
export function isOrgCapReached(activeOrgCount: number, limit: number): boolean {
  if (!Number.isFinite(activeOrgCount) || activeOrgCount < 0) return true;
  if (!Number.isInteger(limit) || limit < 0) return true;
  return activeOrgCount >= limit;
}

// ── input validation (api-spec §3.1) ───────────────────────────────────────

/** A per-field validation outcome: the cleaned value, or messages per field. */
export type FieldValidation<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly fieldErrors: Readonly<Record<string, string>> };

/** Thai copy for the two `name` failures (D-029: the word is "ร้าน"). */
export const ORG_NAME_REQUIRED_MESSAGE = "กรุณาตั้งชื่อร้าน";
export const ORG_NAME_TOO_LONG_MESSAGE = `ชื่อร้านต้องยาวไม่เกิน ${ORG_NAME_MAX_LENGTH} ตัวอักษร`;
export const ORG_TIMEZONE_INVALID_MESSAGE = "ไม่รู้จักเขตเวลานี้";

/**
 * Validate + normalize a shop name. Trimmed first: `"   "` is not a name, and a
 * name with trailing spaces is the same shop with a different string.
 * Length is counted in CODE POINTS — a 120-emoji name is 120 characters to a
 * human and 240+ to `String.length`.
 */
export function validateOrgName(raw: unknown): FieldValidation<string> {
  if (typeof raw !== "string") return { ok: false, fieldErrors: { name: ORG_NAME_REQUIRED_MESSAGE } };
  const value = raw.trim();
  const length = [...value].length;
  if (length < ORG_NAME_MIN_LENGTH) {
    return { ok: false, fieldErrors: { name: ORG_NAME_REQUIRED_MESSAGE } };
  }
  if (length > ORG_NAME_MAX_LENGTH) {
    return { ok: false, fieldErrors: { name: ORG_NAME_TOO_LONG_MESSAGE } };
  }
  return { ok: true, value };
}

/**
 * IANA time zones this runtime knows (api-spec §3.4: "whitelist จาก
 * `Intl.supportedValuesOf('timeZone')`").
 *
 * Built once, lazily, and frozen. This is a lookup into the runtime's own ICU
 * table — the same input always gives the same answer within a process, so the
 * function stays pure in the sense that matters here (no clock, no env, no I/O,
 * no randomness). `Intl.supportedValuesOf` landed in Node 18; the `catch` is for
 * a stripped-ICU build, where refusing every zone but the default is the
 * fail-closed answer.
 *
 * ⚠️ The list is CANONICAL names only — link/alias names such as `"UTC"` are NOT
 * in it and are therefore refused. That is the spec's whitelist taken literally
 * (§3.4) and it is fine for a Thailand-only Phase 0 (D-013); widening it is a
 * CONTRACT change, not a quiet edit here.
 */
let timezoneWhitelist: ReadonlySet<string> | undefined;

function supportedTimezones(): ReadonlySet<string> {
  if (timezoneWhitelist) return timezoneWhitelist;
  let values: readonly string[];
  try {
    values = Intl.supportedValuesOf("timeZone");
  } catch {
    values = [ORG_DEFAULT_TIMEZONE];
  }
  timezoneWhitelist = new Set(values.length > 0 ? values : [ORG_DEFAULT_TIMEZONE]);
  return timezoneWhitelist;
}

/** Is `value` an IANA zone this runtime recognises? Case-sensitive, as IANA is. */
export function isSupportedTimezone(value: unknown): value is string {
  return typeof value === "string" && supportedTimezones().has(value);
}

/** What `POST /organizations` may actually write (api-spec §3.1). */
export interface NewOrganizationInput {
  readonly name: string;
  readonly timezone: string;
}

/**
 * The whole of `POST /organizations`' body validation.
 *
 * `timezone` is optional and defaults to Asia/Bangkok. `currency` and the plan
 * are deliberately NOT parameters: currency is fixed by D-013 and the plan is
 * resolved server-side from the env seam (§6.2) — accepting either from the
 * client would be a self-granted tier.
 */
export function validateNewOrganization(input: {
  readonly name?: unknown;
  readonly timezone?: unknown;
}): FieldValidation<NewOrganizationInput> {
  const fieldErrors: Record<string, string> = {};

  const name = validateOrgName(input.name);
  if (!name.ok) Object.assign(fieldErrors, name.fieldErrors);

  let timezone: string = ORG_DEFAULT_TIMEZONE;
  if (input.timezone !== undefined && input.timezone !== null) {
    if (isSupportedTimezone(input.timezone)) timezone = input.timezone;
    else fieldErrors.timezone = ORG_TIMEZONE_INVALID_MESSAGE;
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return { ok: true, value: { name: (name as { ok: true; value: string }).value, timezone } };
}
