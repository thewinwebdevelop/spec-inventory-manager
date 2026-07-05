/**
 * F-000 T-000-11 · AC verification suite (qa-authored, run by CI db-migrate job).
 * Asserts the schema/ledger ACs against a LIVE Postgres (post `migrate deploy`):
 *   AC5  — 19 tables present + boundary tables absent + required @@unique sets
 *   AC6  — organizationId on every domain table, exact no-org allowlist (two-sided)
 *   AC7  — money = numeric(18,4), stock = integer, no float creep
 *   AC8  — StockMovement & UsageEvent physically append-only (DB trigger Layer 2
 *          + Prisma guard Layer 1); INSERT ok, UPDATE/DELETE/TRUNCATE/updateMany/
 *          deleteMany throw; rejected mutations leave the row byte-identical
 * Spec: docs/features/F-000/test-plan.md §3–5. Needs DATABASE_URL.
 * Exit 0 = all pass; exit 1 = one or more AC failed (prints an AC-by-AC verdict).
 */
import { PrismaClient } from "./generated/client";
import { ledgerGuardExtension, LedgerImmutableError } from "./ledger-guard";

const prisma = new PrismaClient();
const guarded = new PrismaClient().$extends(ledgerGuardExtension);

const failures: string[] = [];
function check(ac: string, ok: boolean, detail: string) {
  if (ok) console.log(`  ✓ ${ac} — ${detail}`);
  else {
    console.error(`  ✗ ${ac} — ${detail}`);
    failures.push(`${ac}: ${detail}`);
  }
}

const DOMAIN_TABLES = [
  "User",
  "Organization",
  "Membership",
  "Role",
  "RefreshToken",
  "Invitation",
  "Product",
  "SellableSku",
  "InventoryItem",
  "BundleComponent",
  "Warehouse",
  "StockLevel",
  "StockMovement",
  "Channel",
  "ChannelAccount",
  "ChannelListing",
  "PlanDefinition",
  "OrgEntitlement",
  "UsageEvent",
];
const BOUNDARY_ABSENT = [
  "Order",
  "OrderItem",
  "PurchaseDocument",
  "PurchaseItem",
  "AccountingDocument",
  "Subscription",
  "Payment",
];
const NO_ORG_ALLOWLIST = ["User", "Channel", "PlanDefinition", "RefreshToken"];
// Organization is the tenant root — satisfies the rule via its own id.
const REQUIRED_UNIQUES: Array<[string, string[]]> = [
  ["StockLevel", ["warehouseId", "inventoryItemId"]],
  ["BundleComponent", ["sellableSkuId", "inventoryItemId"]],
  ["ChannelListing", ["channelAccountId", "externalSkuId"]],
  ["Membership", ["organizationId", "userId"]],
  ["Role", ["organizationId", "name"]],
  ["Product", ["organizationId", "code"]],
  ["SellableSku", ["organizationId", "code"]],
  ["InventoryItem", ["organizationId", "sku"]],
  ["ChannelAccount", ["organizationId", "channelKey", "externalShopId"]],
  ["OrgEntitlement", ["organizationId"]],
  ["User", ["email"]],
  ["Channel", ["key"]],
  ["Invitation", ["token"]],
  ["PlanDefinition", ["key"]],
];
const MONEY_COLS: Array<[string, string]> = [
  ["SellableSku", "basePrice"],
  ["InventoryItem", "avgUnitCost"],
  ["StockMovement", "unitCost"],
  ["UsageEvent", "cost"],
  ["ChannelListing", "priceOverride"],
  ["ChannelListing", "lastSyncedPrice"],
];
const STOCK_COLS: Array<[string, string]> = [
  ["StockLevel", "onHand"],
  ["StockLevel", "reserved"],
  ["BundleComponent", "quantity"],
  ["StockMovement", "quantity"],
  ["StockMovement", "balanceAfter"],
  ["UsageEvent", "quantity"],
  ["InventoryItem", "lowStockThreshold"],
  ["ChannelListing", "allocationValue"],
  ["ChannelListing", "lastSyncedStock"],
];

async function ac5() {
  console.log("AC5 — tables + unique constraints");
  const rows = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_type='BASE TABLE'`,
  );
  const present = new Set(rows.map((r) => r.table_name));
  for (const t of DOMAIN_TABLES) check("AC5", present.has(t), `table ${t} present`);
  for (const t of BOUNDARY_ABSENT) check("AC5", !present.has(t), `boundary table ${t} absent`);

  // unique constraints (incl. unique indexes) → set of column sets per table
  const uniq = await prisma.$queryRawUnsafe<{ table_name: string; cols: string }[]>(
    `SELECT t.relname AS table_name,
            string_agg(a.attname, ',' ORDER BY a.attname) AS cols
     FROM pg_index i
     JOIN pg_class t ON t.oid = i.indrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(i.indkey)
     WHERE i.indisunique AND n.nspname='public'
     GROUP BY t.relname, i.indexrelid`,
  );
  const byTable = new Map<string, Set<string>>();
  for (const r of uniq) {
    if (!byTable.has(r.table_name)) byTable.set(r.table_name, new Set());
    byTable.get(r.table_name)!.add(r.cols.split(",").sort().join(","));
  }
  for (const [tbl, cols] of REQUIRED_UNIQUES) {
    const key = [...cols].sort().join(",");
    check("AC5", byTable.get(tbl)?.has(key) ?? false, `${tbl} unique(${cols.join(", ")})`);
  }
}

async function ac6() {
  console.log("AC6 — organizationId tenant seam (two-sided allowlist)");
  const rows = await prisma.$queryRawUnsafe<{ table_name: string; has_org: boolean }[]>(
    `SELECT t.table_name,
            EXISTS (SELECT 1 FROM information_schema.columns c
                    WHERE c.table_schema='public' AND c.table_name=t.table_name
                      AND c.column_name='organizationId') AS has_org
     FROM information_schema.tables t
     WHERE t.table_schema='public' AND t.table_type='BASE TABLE'
       AND t.table_name <> '_prisma_migrations'`,
  );
  const hasOrg = new Map(rows.map((r) => [r.table_name, r.has_org]));
  for (const t of DOMAIN_TABLES) {
    if (t === "Organization") continue; // tenant root, satisfied via id
    const allow = NO_ORG_ALLOWLIST.includes(t);
    const org = hasOrg.get(t) ?? false;
    check(
      "AC6",
      allow ? !org : org,
      allow ? `${t} correctly has NO organizationId (allowlist)` : `${t} has organizationId`,
    );
  }
}

async function ac7() {
  console.log("AC7 — money numeric / stock integer / no float creep");
  const cols = await prisma.$queryRawUnsafe<
    {
      table_name: string;
      column_name: string;
      data_type: string;
      p: number | null;
      s: number | null;
    }[]
  >(`SELECT table_name, column_name, data_type,
            numeric_precision AS p, numeric_scale AS s
     FROM information_schema.columns WHERE table_schema='public'`);
  const type = new Map(cols.map((c) => [`${c.table_name}.${c.column_name}`, c]));
  for (const [t, c] of MONEY_COLS) {
    const col = type.get(`${t}.${c}`);
    check(
      "AC7",
      col?.data_type === "numeric" && col?.p === 18 && col?.s === 4,
      `${t}.${c} = numeric(18,4) (got ${col?.data_type}${col ? `(${col.p},${col.s})` : ""})`,
    );
  }
  for (const [t, c] of STOCK_COLS) {
    const col = type.get(`${t}.${c}`);
    check("AC7", col?.data_type === "integer", `${t}.${c} = integer (got ${col?.data_type})`);
  }
  const floats = cols.filter(
    (c) =>
      DOMAIN_TABLES.includes(c.table_name) && ["double precision", "real"].includes(c.data_type),
  );
  check(
    "AC7",
    floats.length === 0,
    `no float in domain schema${floats.length ? ` (found ${floats.map((f) => `${f.table_name}.${f.column_name}`).join(", ")})` : ""}`,
  );
}

/**
 * Two distinct assertion modes, matched precisely so each layer's own failure
 * mode is what's actually checked (otherwise deleting the Layer-1 guard could
 * still "pass" via the Layer-2 trigger's unrelated error and mask a regression):
 *   "guard"    — Layer 1 (Prisma extension) must throw exactly LedgerImmutableError.
 *   "restrict" — Layer 2 (DB trigger) must throw the trigger's RESTRICT/raise error.
 */
type ExpectMode = "guard" | "restrict";

async function expectThrow(label: string, fn: () => Promise<unknown>, mode: ExpectMode) {
  try {
    await fn();
    check("AC8", false, `${label} should have thrown but succeeded`);
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    const ok =
      mode === "guard"
        ? e?.name === "LedgerImmutableError" || e instanceof LedgerImmutableError
        : /ledger is immutable/i.test(msg) || /restrict_violation/.test(msg);
    check(
      "AC8",
      ok,
      `${label} rejected (${mode === "guard" ? "LedgerImmutableError" : "trigger restrict_violation"})${ok ? "" : ` — got: ${msg}`}`,
    );
  }
}

async function ac8() {
  console.log("AC8 — ledger immutability (Layer 2 trigger + Layer 1 guard)");
  // seed FK chain + one row per ledger table
  const org = await prisma.organization.create({ data: { name: "AC8 Org" } });
  const wh = await prisma.warehouse.create({ data: { organizationId: org.id, name: "AC8 WH" } });
  const item = await prisma.inventoryItem.create({
    data: { organizationId: org.id, sku: "AC8-SKU", name: "AC8 Item", avgUnitCost: "10.0000" },
  });
  const sm = await prisma.stockMovement.create({
    data: {
      organizationId: org.id,
      inventoryItemId: item.id,
      warehouseId: wh.id,
      type: "ADJUST",
      quantity: 5,
      balanceAfter: 5,
    },
  });
  const ue = await prisma.usageEvent.create({
    data: { organizationId: org.id, meter: "orders", quantity: 1 },
  });
  check("AC8", true, "INSERT StockMovement + UsageEvent succeeded");

  for (const [tbl, id] of [
    ["StockMovement", sm.id],
    ["UsageEvent", ue.id],
  ] as const) {
    // full row snapshot BEFORE the rejected mutations (Layer 2 — DB trigger)
    const before = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "${tbl}" WHERE id=$1`, id);

    // Layer 2 — raw SQL hits the DB trigger directly
    await expectThrow(
      `raw UPDATE ${tbl}`,
      () => prisma.$executeRawUnsafe(`UPDATE "${tbl}" SET "quantity"=999 WHERE id=$1`, id),
      "restrict",
    );
    await expectThrow(
      `raw DELETE ${tbl}`,
      () => prisma.$executeRawUnsafe(`DELETE FROM "${tbl}" WHERE id=$1`, id),
      "restrict",
    );
    await expectThrow(
      `TRUNCATE ${tbl}`,
      () => prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tbl}" CASCADE`),
      "restrict",
    );
    // atomicity — full row byte-identical (deep-equal) after rejected mutations,
    // not just the one column that the attack targeted.
    const after = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "${tbl}" WHERE id=$1`, id);
    check(
      "AC8",
      after.length === 1 &&
        before.length === 1 &&
        JSON.stringify(after[0]) === JSON.stringify(before[0]),
      `${tbl} row byte-identical (full-row deep-equal) after rejects`,
    );
  }
  // Layer 1 — Prisma guard blocks bulk app-path mutation. Must reject with the
  // guard's own LedgerImmutableError specifically (not merely "threw something"),
  // otherwise deleting the Layer-1 extension would still "pass" via the Layer-2
  // trigger's restrict_violation and mask the regression.
  await expectThrow(
    "guard updateMany StockMovement",
    () => guarded.stockMovement.updateMany({ data: { quantity: 0 } }),
    "guard",
  );
  await expectThrow(
    "guard deleteMany UsageEvent",
    () => guarded.usageEvent.deleteMany({}),
    "guard",
  );
}

async function main() {
  await prisma.$connect();
  await ac5();
  await ac6();
  await ac7();
  await ac8();
  await prisma.$disconnect();
  await guarded.$disconnect();
  console.log("");
  if (failures.length) {
    console.error(`FAILED — ${failures.length} AC check(s):\n  - ${failures.join("\n  - ")}`);
    process.exit(1);
  }
  console.log("All AC5/6/7/8 checks passed.");
}

main().catch((e) => {
  console.error("verify:ac crashed:", e);
  process.exit(1);
});
