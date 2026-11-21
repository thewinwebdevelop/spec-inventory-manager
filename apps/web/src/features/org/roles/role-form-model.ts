/**
 * T-003-W06 — R3's form model, pure (ux-wireframe R3 + §0.4).
 *
 * ⛔ Nothing here decides a permission. The row states are UX guards only:
 *  - "ติ๊กล็อก (imply)" comes from the catalog's `implies` edges;
 *  - "คุณไม่มีสิทธิ์นี้" asks `viewerCan(key)`, which the caller wires to the ONE
 *    capability rule (`lib/org/capability.ts` → core-domain `hasCapability`).
 * The server decides every write (`ROLE_EXCEEDS_ACTOR`, …); this module never
 * compares two capability SETS (⊆/⊊) — test-plan CW3-03.
 *
 * Selection model: `selection` is the set of rows shown ticked that the user
 * owns — ticking `manage_X` also puts `view_X` in it, so unticking `manage_X`
 * later leaves `view_X` ticked-but-unlocked (ux R3: "ลดเหลือดู" is the common
 * intent). A row is LOCKED while another selected key implies it; locked rows
 * are not sent (the server would drop them anyway — api-spec §2 canonical form).
 */
import {
  canonicalizeCapabilities,
  roleNameComparisonKey,
  ROLE_NAME_MAX_LENGTH,
} from "@omnistock/core-domain";
import type { CapabilityCatalog } from "./api/use-role-details";

type Catalog = CapabilityCatalog;

/** The synthetic group for `group` values not in `groups[]` (or `null`) — ux §0.4 fallback. */
export const OTHER_GROUP_KEY = "__other__";
const OTHER_GROUP_LABEL = "อื่น ๆ";
const UPCOMING = "upcoming";

export interface ChecklistRow {
  readonly key: string;
  readonly label: string;
  readonly description: string;
  readonly upcoming: boolean;
  readonly checked: boolean;
  /** Ticked because another ticked key implies it — cannot be unticked. */
  readonly locked: boolean;
  /** The viewer lacks it and it is not ticked (UX guard only). */
  readonly disabled: boolean;
}

export interface ChecklistGroup {
  readonly key: string;
  readonly label: string;
  readonly rows: readonly ChecklistRow[];
  readonly selectedCount: number;
}

export interface ChecklistView {
  readonly groups: readonly ChecklistGroup[];
  readonly selectedCount: number;
  readonly total: number;
  readonly hasUpcoming: boolean;
}

function impliesMap(catalog: Catalog): Map<string, readonly string[]> {
  return new Map(catalog.items.map((i) => [i.key, i.implies]));
}

/** Keys in `selection` that another selected key implies. */
function lockedKeys(selection: ReadonlySet<string>, catalog: Catalog): Set<string> {
  const implies = impliesMap(catalog);
  const out = new Set<string>();
  for (const k of selection) {
    for (const v of implies.get(k) ?? []) if (v !== k) out.add(v);
  }
  return out;
}

export function buildChecklist(
  catalog: Catalog,
  selection: ReadonlySet<string>,
  viewerCan: (key: string) => boolean,
): ChecklistView {
  const locked = lockedKeys(selection, catalog);
  const known = new Set(catalog.groups.map((g) => g.key));
  const buckets = new Map<string, ChecklistRow[]>();
  let hasUpcoming = false;

  for (const item of catalog.items) {
    if (!item.selectable) continue;
    const isLocked = locked.has(item.key);
    const checked = selection.has(item.key) || isLocked;
    const upcoming = item.status === UPCOMING;
    hasUpcoming ||= upcoming;
    const groupKey = item.group !== null && known.has(item.group) ? item.group : OTHER_GROUP_KEY;
    const rows = buckets.get(groupKey) ?? [];
    rows.push({
      key: item.key,
      label: item.labelTh,
      description: item.descriptionTh,
      upcoming,
      checked,
      locked: isLocked,
      disabled: !checked && !viewerCan(item.key),
    });
    buckets.set(groupKey, rows);
  }

  const order = [
    ...catalog.groups.map((g) => ({ key: g.key, label: g.labelTh })),
    { key: OTHER_GROUP_KEY, label: OTHER_GROUP_LABEL },
  ];
  const groups: ChecklistGroup[] = [];
  for (const g of order) {
    const rows = buckets.get(g.key);
    if (!rows || rows.length === 0) continue;
    groups.push({ ...g, rows, selectedCount: rows.filter((r) => r.checked).length });
  }
  const all = groups.flatMap((g) => g.rows);
  return {
    groups,
    selectedCount: all.filter((r) => r.checked).length,
    total: all.length,
    hasUpcoming,
  };
}

/**
 * A stored set → the form's selection (implies expanded one level, like the
 * registry) + the keys the catalog does not know, which are not shown as rows
 * but are sent back on save (ux §0.4: "ห้ามทิ้งเงียบ ๆ").
 */
export function initialSelection(
  stored: readonly string[],
  catalog: Catalog,
): { selection: Set<string>; passthrough: string[] } {
  const inCatalog = new Set(catalog.items.map((i) => i.key));
  const implies = impliesMap(catalog);
  const selection = new Set<string>();
  const passthrough: string[] = [];
  for (const k of stored) {
    if (!inCatalog.has(k)) {
      passthrough.push(k);
      continue;
    }
    selection.add(k);
    for (const v of implies.get(k) ?? []) selection.add(v);
  }
  return { selection, passthrough };
}

/** Clone mode: the source's capabilities minus anything not selectable (ux R3 โหมดสำเนา). */
export function cloneSelection(stored: readonly string[], catalog: Catalog): Set<string> {
  const selectable = new Set(catalog.items.filter((i) => i.selectable).map((i) => i.key));
  const { selection } = initialSelection(
    stored.filter((k) => selectable.has(k)),
    catalog,
  );
  return selection;
}

export function toggleCapability(
  selection: ReadonlySet<string>,
  key: string,
  checked: boolean,
  catalog: Catalog,
): Set<string> {
  const next = new Set(selection);
  if (checked) {
    next.add(key);
    for (const v of impliesMap(catalog).get(key) ?? []) next.add(v);
  } else {
    next.delete(key);
  }
  return next;
}

/** What goes on the wire: ticked keys minus locked rows, plus unknown keys, canonical order. */
export function payloadCapabilities(
  selection: ReadonlySet<string>,
  passthrough: readonly string[],
  catalog: Catalog,
): string[] {
  return canonicalizeCapabilities([...selection, ...passthrough], catalog.items);
}

// ── name ────────────────────────────────────────────────────────────────────

/** ux R3: "{n}/50" counts code points after trimming. */
export function nameLength(value: string): number {
  return [...value.trim()].length;
}

/** The two checks ux gives the client; everything else is the server's (§E). */
export function validateRoleNameInput(value: string): "empty" | "too_long" | null {
  const n = nameLength(value);
  if (n === 0) return "empty";
  if (n > ROLE_NAME_MAX_LENGTH) return "too_long";
  return null;
}

function truncateCodePoints(value: string, max: number): string {
  return [...value].slice(0, max).join("");
}

/**
 * Clone mode's suggested name: "สำเนาของ {ชื่อต้นแบบ}" cut to ≤ 50 code points;
 * a clash with a live role's name (same comparison the server uses —
 * `roleNameComparisonKey`) gets " (2)", " (3)" … still within 50.
 */
export function cloneName(sourceDisplayName: string, existingNames: readonly string[]): string {
  const taken = new Set(existingNames.map(roleNameComparisonKey));
  const base = `สำเนาของ ${sourceDisplayName}`;
  const first = truncateCodePoints(base, ROLE_NAME_MAX_LENGTH).trim();
  if (!taken.has(roleNameComparisonKey(first))) return first;
  for (let n = 2; ; n++) {
    const suffix = ` (${n})`;
    const candidate =
      truncateCodePoints(base, ROLE_NAME_MAX_LENGTH - [...suffix].length).trimEnd() + suffix;
    if (!taken.has(roleNameComparisonKey(candidate))) return candidate;
  }
}

// ── request bodies ──────────────────────────────────────────────────────────

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((k) => s.has(k));
}

export function buildCreateBody(
  name: string,
  capabilities: readonly string[],
): { name: string; capabilities: string[] } {
  return { name: name.trim(), capabilities: [...capabilities] };
}

/**
 * PATCH body. ⚠️ `name` only when the trimmed value differs from what the field
 * started with — the field shows the TRANSLATION of an un-renamed system role,
 * and sending it back would mark the role renamed (ux R3 ⚠️, self-review #6).
 * `null` = nothing changed, send nothing.
 */
export function buildUpdateBody(input: {
  version: number;
  initialName: string;
  name: string;
  initialCapabilities: readonly string[];
  capabilities: readonly string[];
}): { version: number; name?: string; capabilities?: string[] } | null {
  const name = input.name.trim();
  const nameChanged = name !== input.initialName.trim();
  const capsChanged = !sameSet(input.initialCapabilities, input.capabilities);
  if (!nameChanged && !capsChanged) return null;
  return {
    version: input.version,
    ...(nameChanged ? { name } : {}),
    ...(capsChanged ? { capabilities: [...input.capabilities] } : {}),
  };
}
