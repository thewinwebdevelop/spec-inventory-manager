// T-003-W07 · CW3-01 — what R3a (confirm before save) and R3b (409
// ROLE_CHANGED) show about a capability change.
//
// ⛔ The golden vectors are READ from the file the server's U-RB-09 reads
// (`packages/core-domain/src/rbac/fixtures/lost-capabilities.vectors.json`) —
// never copied here (test-plan CW3-01). A vector added there is checked here
// on the next run with no edit to this file.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { RegistryLike } from "@omnistock/core-domain";
import type { CapabilityCatalog } from "./api/use-role-details";
import {
  buildSaveConfirmation,
  capabilityChange,
  capabilityLines,
  comparisonRegistry,
  draftDiff,
  reapplyDraft,
} from "./role-change-summary";

/** cwd is `apps/web` under vitest (same convention as copy-lint.test.ts). */
const VECTORS_FILE = join(
  process.cwd(),
  "..",
  "..",
  "packages/core-domain/src/rbac/fixtures/lost-capabilities.vectors.json",
);

interface VectorFile {
  registries: Record<string, { key: string; implies: string[] }[]>;
  vectors: { name: string; registry: string; before: string[]; after: string[]; lost: string[] }[];
}
const golden = JSON.parse(readFileSync(VECTORS_FILE, "utf8")) as VectorFile;

const entry = (
  key: string,
  labelTh: string,
  group: string | null,
  over: Partial<CapabilityCatalog["items"][number]> = {},
) => ({
  key,
  labelTh,
  descriptionTh: `คำอธิบาย ${labelTh}`,
  group,
  status: "live",
  implies: [] as string[],
  selectable: true,
  ...over,
});

/** What a tier-`all` shop's catalog looks like: `access_accounting` (tier full) is absent. */
const CATALOG: CapabilityCatalog = {
  groups: [
    { key: "team", labelTh: "ทีมงาน" },
    { key: "catalog_stock", labelTh: "สินค้าและสต๊อก" },
    { key: "finance", labelTh: "การเงิน" },
  ],
  items: [
    entry("full_access", "ทำได้ทุกอย่าง (เฉพาะเจ้าของร้าน)", null, { selectable: false }),
    entry("manage_members", "จัดการสมาชิกและคำเชิญ", "team"),
    entry("manage_roles", "จัดการบทบาทและสิทธิ์", "team"),
    entry("manage_products", "จัดการสินค้า", "catalog_stock", { implies: ["view_products"] }),
    entry("view_products", "ดูสินค้า", "catalog_stock"),
    entry("manage_stock", "จัดการสต๊อก", "catalog_stock"),
    entry("view_financials", "ดูต้นทุนและกำไร", "finance"),
  ],
};

describe("CW3-01 · golden vectors (the server's file, read — not copied)", () => {
  it("the file is there and is not vacuous", () => {
    expect(golden.vectors.length).toBeGreaterThanOrEqual(8);
    // Non-vacuity: at least one vector loses something and one loses nothing.
    expect(golden.vectors.some((v) => v.lost.length > 0)).toBe(true);
    expect(golden.vectors.some((v) => v.lost.length === 0)).toBe(true);
  });

  it.each(golden.vectors.map((v) => [v.name, v] as const))(
    "%s → removed = the vector's `lost`",
    (_name, v) => {
      const registry: RegistryLike = golden.registries[v.registry]!;
      expect(capabilityChange(v.before, v.after, registry).removed).toEqual(v.lost);
    },
  );

  it.each(golden.vectors.map((v) => [v.name, v] as const))(
    "%s → added is the same rule the other way round",
    (_name, v) => {
      const registry: RegistryLike = golden.registries[v.registry]!;
      const swapped = capabilityChange(v.after, v.before, registry);
      expect(swapped.added).toEqual(v.lost);
    },
  );
});

describe("comparisonRegistry — catalog edges first, bundled keys the catalog hides kept", () => {
  it("uses the catalog's implies (server truth) and still knows hidden tier-full keys", () => {
    const reg = comparisonRegistry(CATALOG);
    expect(reg.find((r) => r.key === "manage_products")!.implies).toEqual(["view_products"]);
    expect(reg.some((r) => r.key === "access_accounting")).toBe(true);
    expect(new Set(reg.map((r) => r.key)).size).toBe(reg.length);
  });

  it("full_access → manage_stock loses every other key, including the hidden tier-full one", () => {
    const { removed } = capabilityChange(
      ["full_access"],
      ["manage_stock"],
      comparisonRegistry(CATALOG),
    );
    expect(removed).toContain("full_access");
    expect(removed).toContain("access_accounting");
    expect(removed).not.toContain("manage_stock");
  });
});

describe("capabilityLines (UX01 · ux §0.4) — what a list of keys reads as", () => {
  it("catalog labels, in catalog order (not key order)", () => {
    expect(capabilityLines(["view_financials", "manage_members"], CATALOG)).toEqual({
      labels: ["จัดการสมาชิกและคำเชิญ", "ดูต้นทุนและกำไร"],
      otherCount: 0,
    });
  });

  it("full_access present = ONE line 'ทำได้ทุกอย่าง (เฉพาะเจ้าของร้าน)', nothing else listed or counted", () => {
    const v = golden.vectors.find(
      (x) =>
        x.registry === "live" && x.before.includes("full_access") && x.lost.includes("full_access"),
    )!;
    expect(v, "the golden file must keep a full_access-lost vector").toBeTruthy();
    expect(capabilityLines(v.lost, CATALOG)).toEqual({
      labels: ["ทำได้ทุกอย่าง (เฉพาะเจ้าของร้าน)"],
      otherCount: 0,
    });
  });

  it("a tier-full key the catalog hides (access_accounting) is not shown and NOT counted", () => {
    expect(capabilityLines(["manage_members", "access_accounting"], CATALOG)).toEqual({
      labels: ["จัดการสมาชิกและคำเชิญ"],
      otherCount: 0,
    });
  });

  it("a really unknown key still counts as 'อื่นอีก n' (golden vector: unknown key is kept and can be lost)", () => {
    const v = golden.vectors.find(
      (x) =>
        x.registry === "live" &&
        x.lost.some((k) => !golden.registries.live!.some((r) => r.key === k)),
    )!;
    expect(v, "the golden file must keep an unknown-key-lost vector").toBeTruthy();
    const lines = capabilityLines(
      capabilityChange(v.before, v.after, comparisonRegistry(CATALOG)).removed,
      CATALOG,
    );
    expect(lines.otherCount).toBe(
      v.lost.filter((k) => !CATALOG.items.some((i) => i.key === k)).length,
    );
    expect(lines.otherCount).toBeGreaterThan(0);
  });

  it("control: a tier-ALL key the catalog does not list (stale catalog) is counted, not hidden", () => {
    // manage_channels is tier `all` in the bundled registry but not in this catalog.
    expect(capabilityLines(["manage_channels"], CATALOG)).toEqual({ labels: [], otherCount: 1 });
  });

  it("empty → nothing", () => {
    expect(capabilityLines([], CATALOG)).toEqual({ labels: [], otherCount: 0 });
  });
});

describe("buildSaveConfirmation — R3a", () => {
  const base = {
    roleName: "ผู้ดูแล",
    catalog: CATALOG,
    usage: { activeMembers: 2, pendingInvitations: 1 },
  };

  it("added / removed compare the EXPANDED sets (implied view_products is not 'removed' when manage_products → view_products)", () => {
    const c = buildSaveConfirmation({
      ...base,
      before: ["manage_members", "manage_products"],
      after: ["manage_members", "view_products", "view_financials"],
      isMine: false,
    });
    expect(c.added.labels).toEqual(["ดูต้นทุนและกำไร"]);
    expect(c.removed.labels).toEqual(["จัดการสินค้า"]);
    expect(c.selfLoss).toBeNull();
    expect(c.usage).toEqual({ activeMembers: 2, pendingInvitations: 1 });
  });

  it("not my role → no self-loss warning even when something is lost", () => {
    const c = buildSaveConfirmation({
      ...base,
      before: ["manage_members", "manage_roles"],
      after: ["manage_members"],
      isMine: false,
    });
    expect(c.removed.labels).toEqual(["จัดการบทบาทและสิทธิ์"]);
    expect(c.selfLoss).toBeNull();
  });

  it("my role, losing manage_roles → self-loss with losesManageRoles", () => {
    const c = buildSaveConfirmation({
      ...base,
      before: ["manage_members", "manage_roles"],
      after: ["manage_members"],
      isMine: true,
    });
    expect(c.selfLoss).toEqual({
      lines: { labels: ["จัดการบทบาทและสิทธิ์"], otherCount: 0 },
      losesManageRoles: true,
    });
  });

  it("my role, losing something else → self-loss without losesManageRoles", () => {
    const c = buildSaveConfirmation({
      ...base,
      before: ["manage_members", "manage_roles"],
      after: ["manage_roles"],
      isMine: true,
    });
    expect(c.selfLoss).toEqual({
      lines: { labels: ["จัดการสมาชิกและคำเชิญ"], otherCount: 0 },
      losesManageRoles: false,
    });
  });

  it("my role, gains only → no self-loss", () => {
    const c = buildSaveConfirmation({
      ...base,
      before: ["manage_roles"],
      after: ["manage_roles", "manage_stock"],
      isMine: true,
    });
    expect(c.selfLoss).toBeNull();
    expect(c.added.labels).toEqual(["จัดการสต๊อก"]);
    expect(c.removed).toEqual({ labels: [], otherCount: 0 });
  });
});

describe("draftDiff / reapplyDraft — R3b", () => {
  const start = { name: "ผู้ดูแล", capabilities: ["manage_members", "manage_stock"] };

  it("the user's diff against the version they STARTED from: name + added + removed", () => {
    const d = draftDiff(
      start,
      { name: " ผู้ช่วยเจ้าของร้าน ", capabilities: ["manage_members", "view_financials"] },
      CATALOG,
    );
    expect(d.name).toEqual({ from: "ผู้ดูแล", to: "ผู้ช่วยเจ้าของร้าน" });
    expect(d.added.labels).toEqual(["ดูต้นทุนและกำไร"]);
    expect(d.removed.labels).toEqual(["จัดการสต๊อก"]);
    expect(d.addedKeys).toEqual(["view_financials"]);
    expect(d.removedKeys).toEqual(["manage_stock"]);
  });

  it("an unchanged (only re-spaced) name is not part of the diff", () => {
    const d = draftDiff(start, { name: "ผู้ดูแล  ", capabilities: ["manage_members"] }, CATALOG);
    expect(d.name).toBeNull();
  });

  it("reapply puts the diff onto the LATEST version (not the old one), keeping what others changed", () => {
    const d = draftDiff(
      start,
      { name: "ผู้ช่วย", capabilities: ["manage_members", "view_financials"] },
      CATALOG,
    );
    // Someone else meanwhile renamed it and added manage_roles.
    const latest = {
      name: "หัวหน้า",
      selection: new Set(["manage_members", "manage_stock", "manage_roles"]),
    };
    const r = reapplyDraft(latest, d, CATALOG, () => true);
    expect(r.name).toBe("ผู้ช่วย");
    expect([...r.selection].sort()).toEqual(["manage_members", "manage_roles", "view_financials"]);
    expect(r.skipped).toBe(false);
  });

  it("no name change in the draft → the latest name stays", () => {
    const d = draftDiff(start, { name: "ผู้ดูแล", capabilities: ["manage_members"] }, CATALOG);
    const r = reapplyDraft(
      { name: "หัวหน้า", selection: new Set(["manage_members", "manage_stock"]) },
      d,
      CATALOG,
      () => true,
    );
    expect(r.name).toBe("หัวหน้า");
    expect([...r.selection]).toEqual(["manage_members"]);
  });

  it("an addition the viewer can no longer grant is skipped and reported", () => {
    const d = draftDiff(
      start,
      {
        name: "ผู้ดูแล",
        capabilities: ["manage_members", "manage_stock", "view_financials", "manage_roles"],
      },
      CATALOG,
    );
    const r = reapplyDraft(
      { name: "ผู้ดูแล", selection: new Set(["manage_members", "manage_stock"]) },
      d,
      CATALOG,
      (k) => k !== "view_financials",
    );
    expect([...r.selection].sort()).toEqual(["manage_members", "manage_roles", "manage_stock"]);
    expect(r.skipped).toBe(true);
  });

  it("an added manage_X brings its implied view_X like a tick would", () => {
    const d = draftDiff(
      start,
      { name: "ผู้ดูแล", capabilities: ["manage_members", "manage_stock", "manage_products"] },
      CATALOG,
    );
    const r = reapplyDraft(
      { name: "ผู้ดูแล", selection: new Set(["manage_members"]) },
      d,
      CATALOG,
      () => true,
    );
    expect(r.selection.has("manage_products")).toBe(true);
    expect(r.selection.has("view_products")).toBe(true);
  });
});
