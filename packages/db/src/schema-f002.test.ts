// F-002 · T-002-01 — the schema delta and the two migrations, pinned.
// Spec: docs/features/F-002/data-model.md §1/§2/§4.
//
// Two layers are checked, because they can drift from each other:
//   1. the Prisma datamodel (DMMF) — what application code will be able to write
//   2. the migration SQL — what actually reaches PostgreSQL, including the two
//      PARTIAL UNIQUE indexes and the precondition guard, neither of which the
//      Prisma DSL can express and therefore neither of which DMMF can see.
// No database needed: this runs in `pnpm --filter @omnistock/db test`.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Prisma } from "../generated/client";

const MIGRATIONS = join(__dirname, "..", "prisma", "migrations");
const EXPAND = readFileSync(
  join(MIGRATIONS, "20260731000000_f002_expand", "migration.sql"),
  "utf8",
);
const DROP_TOKEN = readFileSync(
  join(MIGRATIONS, "20260731000100_f002_drop_invitation_token", "migration.sql"),
  "utf8",
);
/** SQL with comment lines stripped — so an assertion can't be satisfied by prose. */
const sqlOnly = (sql: string) =>
  sql
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("--"))
    .join("\n");
const EXPAND_SQL = sqlOnly(EXPAND);
const DROP_SQL = sqlOnly(DROP_TOKEN);

const model = (name: string) => {
  const m = Prisma.dmmf.datamodel.models.find((x) => x.name === name);
  if (!m) throw new Error(`model ${name} missing from datamodel`);
  return m;
};
const field = (m: string, f: string) => model(m).fields.find((x) => x.name === f);

describe("F-002 datamodel delta", () => {
  it("InvitationStatus gained `cancelled` and kept `expired` as a read-time-only value", () => {
    const values =
      Prisma.dmmf.datamodel.enums
        .find((e) => e.name === "InvitationStatus")
        ?.values.map((v) => v.name) ?? [];
    expect(values).toEqual(["pending", "accepted", "expired", "cancelled"]);
  });

  it("Organization records its creator without an FK to the org-agnostic User", () => {
    const f = field("Organization", "createdByUserId");
    expect(f?.type).toBe("String");
    expect(f?.isRequired).toBe(false);
    // No relation: User may be deleted/anonymized (PDPA) without locking the
    // tenant table — same call as StockMovement.createdBy.
    expect(model("Organization").fields.some((x) => x.relationName && x.type === "User")).toBe(
      false,
    );
  });

  it("keeps taxId indexed but NOT unique (a unique taxId is a cross-tenant oracle — §3.4)", () => {
    const schema = readSchema();
    const block = modelBlock(schema, "Organization");
    expect(block).toContain("@@index([taxId])");
    expect(block).not.toMatch(/@@unique\(\[taxId\]\)/);
    expect(field("Organization", "taxId")?.isUnique).toBe(false);
    expect(EXPAND_SQL).toMatch(
      /CREATE INDEX "Organization_taxId_idx" ON "Organization"\("taxId"\)/,
    );
    expect(EXPAND_SQL).not.toMatch(/CREATE UNIQUE INDEX \S*taxId/i);
  });

  it("Membership can evidence a revocation instead of deleting the row (AC US-5)", () => {
    for (const name of ["activatedAt", "revokedAt"]) {
      expect(field("Membership", name)?.type).toBe("DateTime");
      expect(field("Membership", name)?.isRequired).toBe(false);
    }
    expect(field("Membership", "revokedByUserId")?.type).toBe("String");
    expect(field("Membership", "revokedByUserId")?.isRequired).toBe(false);
    const block = modelBlock(readSchema(), "Membership");
    expect(block).toContain("@@index([userId, status])");
    expect(block).toContain("@@index([organizationId, status, createdAt])");
  });

  it("Role.key is a nullable per-org slug (ux Q4) — display only, never authorization", () => {
    const f = field("Role", "key");
    expect(f?.type).toBe("String");
    expect(f?.isRequired).toBe(false);
    // Nullable is load-bearing: F-003's custom roles carry key = null, and
    // PostgreSQL treats each NULL as distinct so the unique index lets any
    // number of them coexist.
    expect(model("Role").uniqueFields).toContainEqual(["organizationId", "key"]);
    // The rule `key` must never be used for permission decisions can't be
    // enforced here (it lives in apps/api's grep gate); what IS enforced here is
    // that capabilities remains the field that carries authority.
    expect(field("Role", "capabilities")?.isList).toBe(true);
  });

  it("Invitation stores a hash, never the raw token (D-018)", () => {
    expect(field("Invitation", "token")).toBeUndefined();
    const hash = field("Invitation", "tokenHash");
    expect(hash?.isRequired).toBe(true);
    expect(hash?.isUnique).toBe(true);
  });

  it("Invitation carries the full lifecycle F-002 needs to answer questions later", () => {
    expect(field("Invitation", "tokenIssuedAt")?.isRequired).toBe(true);
    for (const name of ["acceptedAt", "acceptedUserCreatedAt", "cancelledAt"]) {
      expect(field("Invitation", name)?.type, name).toBe("DateTime");
      expect(field("Invitation", name)?.isRequired, name).toBe(false);
    }
    for (const name of ["invitedByUserId", "acceptedByUserId"]) {
      expect(field("Invitation", name)?.type, name).toBe("String");
      expect(field("Invitation", name)?.isRequired, name).toBe(false);
    }
    // acceptedUserCreatedAt is a SNAPSHOT, not a join: it must survive the user
    // being deleted, so it may not be a relation.
    expect(model("Invitation").fields.some((x) => x.relationName && x.type === "User")).toBe(false);
    expect(field("Invitation", "updatedAt")?.isUpdatedAt).toBe(true);
    const block = modelBlock(readSchema(), "Invitation");
    expect(block).toContain("@@index([organizationId, status, createdAt])");
    expect(block).toContain("@@index([organizationId, email, status])");
  });
});

describe("F-002 migrations — what only SQL can express", () => {
  it("creates the two partial unique indexes the Prisma DSL cannot", () => {
    expect(EXPAND_SQL).toMatch(
      /CREATE UNIQUE INDEX "Invitation_org_email_pending_key" ON "Invitation"\("organizationId", "email"\) WHERE "status" = 'pending'/,
    );
    expect(EXPAND_SQL).toMatch(
      /CREATE UNIQUE INDEX "Warehouse_org_default_key" ON "Warehouse"\("organizationId"\) WHERE "isDefault"/,
    );
  });

  it("adds the enum value in the expand migration and never uses it there", () => {
    // PostgreSQL permits ALTER TYPE ... ADD VALUE inside a transaction (PG12+),
    // but the new value cannot be USED until that transaction commits — and
    // Prisma runs a migration file as one transaction. So: added here, used
    // nowhere here.
    expect(EXPAND_SQL).toMatch(/ALTER TYPE "InvitationStatus" ADD VALUE 'cancelled';/);
    // Exactly one mention, and it is the ADD VALUE itself.
    expect(EXPAND_SQL.match(/'cancelled'/g)).toHaveLength(1);
    const addValueAt = EXPAND_SQL.indexOf("ADD VALUE 'cancelled'");
    const firstOtherStatement = EXPAND_SQL.search(/ALTER TABLE|CREATE (UNIQUE )?INDEX/);
    expect(addValueAt).toBeGreaterThan(-1);
    expect(addValueAt).toBeLessThan(firstOtherStatement);
  });

  it("expands without destroying anything — no DROP/TRUNCATE in the expand step", () => {
    expect(EXPAND_SQL).not.toMatch(/DROP\s+(TABLE|COLUMN)|TRUNCATE/i);
    // The one DROP it does contain is dropping a temporary DEFAULT, which
    // removes no data.
    expect(EXPAND_SQL).toMatch(/ALTER COLUMN "updatedAt" DROP DEFAULT/);
  });

  it("guards the destructive migration with a precondition placed BEFORE any DDL", () => {
    expect(DROP_SQL).toMatch(
      /RAISE EXCEPTION 'F-002 migration aborted: Invitation table is not empty/,
    );
    expect(DROP_SQL).toMatch(/SELECT count\(\*\) FROM "Invitation"/);
    const guardAt = DROP_SQL.indexOf("RAISE EXCEPTION");
    const firstDdl = DROP_SQL.search(/ALTER TABLE/);
    expect(guardAt).toBeGreaterThan(-1);
    expect(firstDdl).toBeGreaterThan(guardAt);
  });

  it("keeps the destructive step to exactly the token retirement", () => {
    expect(DROP_SQL).toMatch(/ALTER TABLE "Invitation" ALTER COLUMN "tokenHash" SET NOT NULL;/);
    expect(DROP_SQL).toMatch(/ALTER TABLE "Invitation" DROP COLUMN "token";/);
    expect(DROP_SQL.match(/DROP COLUMN/g)).toHaveLength(1);
    expect(DROP_SQL).not.toMatch(/DROP TABLE|TRUNCATE/i);
  });

  it("states a rollback path in both migration files (skill: prisma-migration)", () => {
    for (const [name, sql] of [
      ["f002_expand", EXPAND],
      ["f002_drop_invitation_token", DROP_TOKEN],
    ] as const) {
      expect(sql, name).toMatch(/ROLLBACK PATH/);
    }
    // The destructive one must say out loud that it is not a data rollback.
    expect(DROP_TOKEN).toMatch(/FORWARD-ONLY/);
  });

  it("does not touch the ledger, money or stock anywhere in the F-002 set", () => {
    // Golden rule 2 + data-model §1: F-002 declares it changes no ledger/money/
    // stock column. This asserts the declaration instead of trusting it.
    const forbidden = [
      "StockMovement",
      "UsageEvent",
      "StockLevel",
      "InventoryItem",
      "SellableSku",
      "BundleComponent",
      "avgUnitCost",
      "basePrice",
      "unitCost",
      "balanceAfter",
      "onHand",
      "reserved",
    ];
    for (const [name, sql] of [
      ["f002_expand", EXPAND_SQL],
      ["f002_drop_invitation_token", DROP_SQL],
    ] as const) {
      for (const token of forbidden) {
        expect(sql.includes(token), `${name} must not reference ${token}`).toBe(false);
      }
    }
    // Warehouse appears, but only as an index — no column of it is altered.
    expect(EXPAND_SQL).toMatch(/CREATE UNIQUE INDEX "Warehouse_org_default_key"/);
    expect(EXPAND_SQL).not.toMatch(/ALTER TABLE "Warehouse"/);
  });
});

// ── helpers ──────────────────────────────────────────────────────────────────

function readSchema(): string {
  return readFileSync(join(__dirname, "..", "prisma", "schema.prisma"), "utf8");
}

function modelBlock(schema: string, name: string): string {
  const start = schema.indexOf(`model ${name} {`);
  expect(start, `model ${name} not found in schema.prisma`).toBeGreaterThan(-1);
  return schema.slice(start, schema.indexOf("\n}", start));
}
