// F-003 · T-003-B04 — what a role may be written with (architecture §1 rows
// validate* · data-model §2.1 · api-spec §2/§5 · AC-3.4/3.5/3.6 · D-032 (1)).
// Pure: the API layer maps each result to its HTTP error; nothing here throws
// for a user mistake, and nothing here reads a database.
import { canonicalizeCapabilities } from "./canonical";
import { CAPABILITY_FULL_ACCESS, CAPABILITY_REGISTRY, type CapabilityDef } from "./registry";
import { byKey } from "./expand";

// ── capabilities ───────────────────────────────────────────────────────────

declare const validatedBrand: unique symbol;

/**
 * A capability list that passed {@link validateRoleCapabilities} and is in
 * canonical form (api-spec §2). The ONLY value a `Role.capabilities` write may
 * take (data-model §2 · architecture §G-15 (ข)). The brand symbol is not
 * exported, so no other module can build one without a cast — and casts
 * outside `rbac/` are refused by gate G3-02.
 */
export type ValidatedCapabilities = readonly string[] & { readonly [validatedBrand]: true };

/** The registry fields validation reads. `CAPABILITY_REGISTRY` satisfies it. */
export type ValidatableRegistry = readonly Pick<
  CapabilityDef,
  "key" | "implies" | "tier" | "selectable"
>[];

export type RoleCapabilitiesValidation =
  | { readonly ok: true; readonly capabilities: ValidatedCapabilities }
  | { readonly ok: false; readonly code: "ROLE_EMPTY" }
  | { readonly ok: false; readonly code: "FULL_ACCESS_RESERVED" }
  | {
      readonly ok: false;
      readonly code: "UNKNOWN_CAPABILITY";
      /** Every refused key, deduped + sorted — `details.capabilities` (api-spec §5). */
      readonly capabilities: readonly string[];
    };

/**
 * Validate the capabilities of a role create/update, in the fixed order of
 * api-spec §2: empty → `ROLE_EMPTY` (AC-3.6) · contains `full_access` →
 * `FULL_ACCESS_RESERVED` (D-032 (1), even if junk keys are present too) · any
 * key that is not in the registry, is tier `full` (hidden until F-007, AC-7.4)
 * or is `selectable=false` → `UNKNOWN_CAPABILITY`. Upcoming keys pass (AC-7.5).
 *
 * On success the list is canonicalized by B03's {@link canonicalizeCapabilities}
 * and returned frozen as the sole constructor of {@link ValidatedCapabilities}.
 */
export function validateRoleCapabilities(
  capabilities: readonly string[],
  registry: ValidatableRegistry = CAPABILITY_REGISTRY,
): RoleCapabilitiesValidation {
  if (capabilities.length === 0) return { ok: false, code: "ROLE_EMPTY" };
  if (capabilities.includes(CAPABILITY_FULL_ACCESS)) {
    return { ok: false, code: "FULL_ACCESS_RESERVED" };
  }
  const grantable = new Set(
    registry.filter((c) => c.selectable && c.tier === "all").map((c) => c.key),
  );
  const refused = [...new Set(capabilities.filter((k) => !grantable.has(k)))].sort(byKey);
  if (refused.length > 0) {
    return { ok: false, code: "UNKNOWN_CAPABILITY", capabilities: Object.freeze(refused) };
  }
  const canonical = Object.freeze(canonicalizeCapabilities(capabilities, registry));
  return { ok: true, capabilities: canonical as unknown as ValidatedCapabilities };
}

// ── name ───────────────────────────────────────────────────────────────────

/** AC-3.4 — counted in code points, after {@link normalizeRoleName}. */
export const ROLE_NAME_MAX_LENGTH = 50;

/**
 * Every code point a role name may not contain after normalize — THE single
 * set; the DB CHECK `Role_name_shape` (B10) must equal it (parity gate G3-07):
 *
 * - Cc (control) · Cf (format: zero-width, bidi overrides, word joiner …) — SR-04
 * - Default_Ignorable_Code_Point — renders as nothing: CGJ U+034F, variation
 *   selectors U+FE00–FE0F / U+E0100–E01EF, Hangul fillers U+115F/1160/3164/FFA0 …
 * - U+2800 braille blank — not ignorable, but draws as empty space
 * - Co (private use) — no agreed glyph; shows as blank or tofu
 * - Cs (lone surrogate) — not valid UTF-8, so the stored name would differ
 *
 * Without this, `"เจ้าของร้าน" + U+3164` renders as the Owner label yet passes
 * the exact reserved-name check (security review of B04, Medium). Visible
 * homoglyphs (`"ผู้ดูเเล"`) stay out of scope: ux decided on no fuzzy matching.
 */
export const ROLE_NAME_FORBIDDEN_CHARACTER =
  /[\p{Cc}\p{Cf}\p{Default_Ignorable_Code_Point}\p{Co}\p{Cs}\u{115F}\u{1160}\u{3164}\u{FFA0}\u{2800}]/u;

/**
 * NFC → trim → collapse every `\s+` run to one U+0020 (data-model §2.1). JS
 * `\s` includes tab/newline/NBSP/U+FEFF, so those are collapsed here rather
 * than refused later.
 */
export function normalizeRoleName(raw: string): string {
  return raw.normalize("NFC").trim().replace(/\s+/gu, " ");
}

/** The form every name comparison uses: `lower(normalizeRoleName(x))`. */
export function roleNameComparisonKey(raw: string): string {
  return normalizeRoleName(raw).toLowerCase();
}

/** ux translations of the system-role keys — also what the clients show. */
export const SYSTEM_ROLE_LABELS = Object.freeze({
  owner: "เจ้าของร้าน",
  admin: "ผู้ดูแล",
  staff: "พนักงาน",
} as const);

export type SystemRoleLabels = Readonly<Record<keyof typeof SYSTEM_ROLE_LABELS, string>>;

export interface ReservedRoleNamesContext {
  /** The org's LIVE roles (`deletedAt IS NULL`, read in the tx) that carry a key. */
  readonly liveSystemRoles: readonly {
    readonly key: string | null;
    readonly nameCustomized: boolean;
  }[];
  /** Key of the role being renamed; `null` for create / a custom role. */
  readonly selfKey: string | null;
  /** Test seam; defaults to {@link SYSTEM_ROLE_LABELS}. */
  readonly labels?: SystemRoleLabels;
}

/**
 * Names a role may not take because a client would display a system role that
 * way (AC-3.5), in {@link roleNameComparisonKey} form:
 * `เจ้าของร้าน` always ∪ the label of `admin`/`staff` while that role is live
 * and `nameCustomized=false`, minus the label of `selfKey` (a role may be named
 * back to its own translation).
 *
 * The Owner label stays reserved even for `selfKey="owner"`: the Owner role is
 * `ROLE_LOCKED` before this runs, so exempting it could only ever widen a hole.
 */
export function reservedRoleNames(ctx: ReservedRoleNamesContext): ReadonlySet<string> {
  const labels = ctx.labels ?? SYSTEM_ROLE_LABELS;
  const out = new Set([roleNameComparisonKey(labels.owner)]);
  for (const role of ctx.liveSystemRoles) {
    if (role.nameCustomized || role.key === ctx.selfKey) continue;
    if (role.key === "admin" || role.key === "staff") {
      out.add(roleNameComparisonKey(labels[role.key]));
    }
  }
  return out;
}

export type RoleNameValidation =
  | { readonly ok: true; /** normalized — what is stored and returned */ readonly name: string }
  | {
      readonly ok: false;
      readonly code: "VALIDATION_FAILED";
      readonly reason: "forbidden_character" | "empty" | "too_long";
    }
  | { readonly ok: false; readonly code: "ROLE_NAME_TAKEN"; readonly reason: "reserved" };

/**
 * Validate a role name (architecture §1): {@link normalizeRoleName} → refuse any
 * remaining Cc/Cf code point (SR-04 — refused, never silently stripped, so the
 * stored name is the one the user typed) → 1–{@link ROLE_NAME_MAX_LENGTH} code
 * points → exact match against {@link reservedRoleNames} → `ROLE_NAME_TAKEN`.
 *
 * Uniqueness against other live roles is NOT checked here: the DB's
 * `Role_org_name_ci_live_key` index decides it (P2002 → `ROLE_NAME_TAKEN`).
 */
export function validateRoleName(raw: string, ctx: ReservedRoleNamesContext): RoleNameValidation {
  const name = normalizeRoleName(raw);
  if (ROLE_NAME_FORBIDDEN_CHARACTER.test(name)) {
    return { ok: false, code: "VALIDATION_FAILED", reason: "forbidden_character" };
  }
  const length = [...name].length;
  if (length === 0) return { ok: false, code: "VALIDATION_FAILED", reason: "empty" };
  if (length > ROLE_NAME_MAX_LENGTH) {
    return { ok: false, code: "VALIDATION_FAILED", reason: "too_long" };
  }
  if (reservedRoleNames(ctx).has(name.toLowerCase())) {
    return { ok: false, code: "ROLE_NAME_TAKEN", reason: "reserved" };
  }
  return { ok: true, name };
}
