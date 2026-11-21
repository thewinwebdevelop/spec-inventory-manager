/**
 * T-003-W07 — what R3a (confirm before save) and R3b (409 ROLE_CHANGED) say
 * about a capability change. Pure.
 *
 * ⛔ Nothing here decides a permission. The comparison rule is core-domain's
 * `lostCapabilities` (= `expand(before) \ expand(after)`), the same function
 * the server pins with its golden vectors (U-RB-09 · CW3-01); "added" is that
 * rule the other way round. The client never compares two sets with ⊆ here
 * (test-plan CW3-03) — this only DESCRIBES a change the person is about to
 * make, and the server still decides the write.
 *
 * Display rules (UX01 · ux §0.4):
 *  - `full_access` in a list → ONE line, its label ("ทำได้ทุกอย่าง (เฉพาะเจ้าของร้าน)");
 *    the expansion it brought with it is not listed or counted.
 *  - a key the catalog hides because it is tier `full` (e.g. `access_accounting`
 *    in a tier-all shop) is not shown and NOT counted — the shop cannot see it.
 *  - any other key the catalog does not list (a really unknown key) counts
 *    towards "และสิทธิ์อื่นอีก {n} รายการ…" — never dropped silently.
 */
import {
  CAPABILITY_FULL_ACCESS,
  CAPABILITY_MANAGE_ROLES,
  CAPABILITY_REGISTRY,
  lostCapabilities,
  type CapabilityDef,
  type RegistryLike,
} from "@omnistock/core-domain";
import type { CapabilityCatalog } from "./api/use-role-details";
import { toggleCapability } from "./role-form-model";

/**
 * The registry the comparison expands against: the catalog's entries first
 * (the server's current `implies` edges), then bundled registry keys the
 * catalog does not list (tier-full keys it hides), so `full_access` still
 * expands to everything the server would expand it to.
 */
export function comparisonRegistry(catalog: CapabilityCatalog): RegistryLike {
  const seen = new Set(catalog.items.map((i) => i.key));
  return [
    ...catalog.items.map((i) => ({ key: i.key, implies: i.implies })),
    ...CAPABILITY_REGISTRY.filter((d) => !seen.has(d.key)).map((d) => ({
      key: d.key,
      implies: d.implies,
    })),
  ];
}

export interface CapabilityChange {
  /** In `after`'s expansion, not in `before`'s — sorted by key. */
  readonly added: string[];
  /** In `before`'s expansion, not in `after`'s — sorted by key (= `lostCapabilities`). */
  readonly removed: string[];
}

export function capabilityChange(
  before: readonly string[],
  after: readonly string[],
  registry: RegistryLike,
): CapabilityChange {
  return {
    added: lostCapabilities(after, before, registry),
    removed: lostCapabilities(before, after, registry),
  };
}

export interface CapabilityLines {
  /** Thai labels from the catalog, in catalog order. */
  readonly labels: string[];
  /** Keys the page cannot show by name ("และสิทธิ์อื่นอีก {n} รายการ…"). */
  readonly otherCount: number;
}

const EMPTY_LINES: CapabilityLines = { labels: [], otherCount: 0 };

export function capabilityLines(
  keys: readonly string[],
  catalog: CapabilityCatalog,
  bundled: readonly CapabilityDef[] = CAPABILITY_REGISTRY,
): CapabilityLines {
  if (keys.length === 0) return EMPTY_LINES;
  const set = new Set(keys);
  if (set.has(CAPABILITY_FULL_ACCESS)) {
    const label =
      catalog.items.find((i) => i.key === CAPABILITY_FULL_ACCESS)?.labelTh ??
      bundled.find((d) => d.key === CAPABILITY_FULL_ACCESS)?.labelTh;
    return { labels: label ? [label] : [], otherCount: label ? 0 : 1 };
  }
  const labels = catalog.items.filter((i) => set.has(i.key)).map((i) => i.labelTh);
  const inCatalog = new Set(catalog.items.map((i) => i.key));
  const tierFull = new Set(bundled.filter((d) => d.tier === "full").map((d) => d.key));
  let otherCount = 0;
  for (const k of set) if (!inCatalog.has(k) && !tierFull.has(k)) otherCount++;
  return { labels, otherCount };
}

export const hasLines = (l: CapabilityLines): boolean => l.labels.length > 0 || l.otherCount > 0;

// ── R3a ─────────────────────────────────────────────────────────────────────

export interface SaveConfirmation {
  readonly roleName: string;
  readonly added: CapabilityLines;
  readonly removed: CapabilityLines;
  /** From the server (`RoleDetail.usage`) — AC-3.11: N is never counted on the client. */
  readonly usage: { readonly activeMembers: number; readonly pendingInvitations: number };
  /** Only for the viewer's OWN role, and only when something is lost (AC-3.10). */
  readonly selfLoss: { readonly lines: CapabilityLines; readonly losesManageRoles: boolean } | null;
}

export function buildSaveConfirmation(input: {
  roleName: string;
  before: readonly string[];
  after: readonly string[];
  catalog: CapabilityCatalog;
  usage: { activeMembers: number; pendingInvitations: number };
  isMine: boolean;
}): SaveConfirmation {
  const change = capabilityChange(input.before, input.after, comparisonRegistry(input.catalog));
  const removed = capabilityLines(change.removed, input.catalog);
  return {
    roleName: input.roleName,
    added: capabilityLines(change.added, input.catalog),
    removed,
    usage: {
      activeMembers: input.usage.activeMembers,
      pendingInvitations: input.usage.pendingInvitations,
    },
    selfLoss:
      input.isMine && change.removed.length > 0
        ? { lines: removed, losesManageRoles: change.removed.includes(CAPABILITY_MANAGE_ROLES) }
        : null,
  };
}

// ── R3b ─────────────────────────────────────────────────────────────────────

export interface DraftDiff {
  readonly name: { readonly from: string; readonly to: string } | null;
  readonly added: CapabilityLines;
  readonly removed: CapabilityLines;
  readonly addedKeys: readonly string[];
  readonly removedKeys: readonly string[];
}

/** The person's own edits: the version they STARTED from → what they had in the form. */
export function draftDiff(
  start: { name: string; capabilities: readonly string[] },
  draft: { name: string; capabilities: readonly string[] },
  catalog: CapabilityCatalog,
): DraftDiff {
  const from = start.name.trim();
  const to = draft.name.trim();
  const change = capabilityChange(
    start.capabilities,
    draft.capabilities,
    comparisonRegistry(catalog),
  );
  return {
    name: from !== to ? { from, to } : null,
    added: capabilityLines(change.added, catalog),
    removed: capabilityLines(change.removed, catalog),
    addedKeys: change.added,
    removedKeys: change.removed,
  };
}

/**
 * "ใส่การแก้ของฉันกลับเข้าไป" — the diff laid over the LATEST version. Fills
 * the form only; the caller never submits (SR-14). An addition the viewer
 * cannot grant now (`viewerCan` = the same UX guard as the checklist row) is
 * skipped and reported.
 */
export function reapplyDraft(
  latest: { name: string; selection: ReadonlySet<string> },
  diff: DraftDiff,
  catalog: CapabilityCatalog,
  viewerCan: (key: string) => boolean,
): { name: string; selection: Set<string>; skipped: boolean } {
  const selectable = new Set(catalog.items.filter((i) => i.selectable).map((i) => i.key));
  let selection = new Set(latest.selection);
  for (const k of diff.removedKeys) selection.delete(k);
  let skipped = false;
  for (const k of diff.addedKeys) {
    if (!selectable.has(k)) continue;
    if (!viewerCan(k)) {
      skipped = true;
      continue;
    }
    selection = toggleCapability(selection, k, true, catalog);
  }
  return { name: diff.name ? diff.name.to : latest.name, selection, skipped };
}
