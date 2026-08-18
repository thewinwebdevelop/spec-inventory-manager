// F-002 · T-002-01 — the tenancy register must never drift from the schema.
//
// These tests read Prisma's generated DMMF (the datamodel as Prisma itself sees
// it), so they fail on the REAL schema, not on a copy of it. No database and no
// network: the point is that this goes red in `pnpm test`, before CI even
// reaches a migration.
//
// The failure this suite exists to prevent: someone adds a tenant table, forgets
// to register it, and the org-scoping layer (T-002-02) silently treats it as
// "not tenant data" — a cross-org leak that no test would otherwise notice.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Prisma } from "../generated/client";
import {
  isOrgScopedModel,
  ORGANIZATION_MODEL,
  ORG_AGNOSTIC_MODELS,
  ORG_SCOPED_MODELS,
} from "./org-models";

const models = Prisma.dmmf.datamodel.models;
const modelNames = models.map((m) => m.name).sort();
const hasOrgIdColumn = (name: string) =>
  models.find((m) => m.name === name)?.fields.some((f) => f.name === "organizationId") ?? false;

const modelsWithOrgId = models
  .filter((m) => m.fields.some((f) => f.name === "organizationId"))
  .map((m) => m.name)
  .sort();

describe("org-scope register vs. the real Prisma datamodel", () => {
  it("registers EXACTLY the models that carry an organizationId (two-sided)", () => {
    // Two-sided on purpose: a one-sided "every registered model has the column"
    // check would still pass if a new tenant table were never registered.
    expect([...ORG_SCOPED_MODELS].sort()).toEqual(modelsWithOrgId);
  });

  it("every model is classified exactly once: scoped | agnostic | tenant root", () => {
    const classified = [...ORG_SCOPED_MODELS, ...ORG_AGNOSTIC_MODELS, ORGANIZATION_MODEL].sort();
    expect(classified).toEqual(modelNames);
    expect(new Set(classified).size).toBe(classified.length); // disjoint
  });

  it("keeps the org-agnostic allowlist honest — none of them has an organizationId", () => {
    for (const name of ORG_AGNOSTIC_MODELS) {
      expect(hasOrgIdColumn(name), `${name} is allowlisted but HAS organizationId`).toBe(false);
    }
  });

  it("treats Organization as the tenant root (scoped by its own id, not a column)", () => {
    expect(hasOrgIdColumn(ORGANIZATION_MODEL)).toBe(false);
    expect(isOrgScopedModel(ORGANIZATION_MODEL)).toBe(false);
    expect([...ORG_AGNOSTIC_MODELS] as string[]).not.toContain(ORGANIZATION_MODEL);
  });

  it("classifies the F-002 models the way F-002 relies on", () => {
    // Spot-checks that state the intent in words, so a future bulk edit of the
    // list has to argue with a named expectation, not just a diff.
    expect(isOrgScopedModel("Membership")).toBe(true);
    expect(isOrgScopedModel("Invitation")).toBe(true);
    expect(isOrgScopedModel("Role")).toBe(true);
    expect(isOrgScopedModel("OrgEntitlement")).toBe(true);
    expect(isOrgScopedModel("User")).toBe(false); // C-3: auth is org-agnostic
    expect(isOrgScopedModel("RefreshToken")).toBe(false);
    expect(isOrgScopedModel("PlanDefinition")).toBe(false); // system catalog
  });

  it("gives every org-scoped model an index that can serve the org filter", () => {
    // Filtering by organizationId on an unindexed table is golden rule 3 obeyed
    // in letter and violated in practice (a seq scan per request). Every
    // org-scoped model must have organizationId as the FIRST column of some
    // index or unique constraint.
    const schema = readSchema();
    for (const model of ORG_SCOPED_MODELS) {
      const block = modelBlock(schema, model);
      const leadsWithOrgId =
        /@@index\(\[organizationId[,\]]/.test(block) ||
        /@@unique\(\[organizationId[,\]]/.test(block);
      expect(leadsWithOrgId, `${model} has no index leading with organizationId`).toBe(true);
    }
  });
});

// ── helpers (schema text — DMMF does not expose @@index) ─────────────────────

function readSchema(): string {
  return readFileSync(join(__dirname, "..", "prisma", "schema.prisma"), "utf8");
}

function modelBlock(schema: string, model: string): string {
  const start = schema.indexOf(`model ${model} {`);
  expect(start, `model ${model} not found in schema.prisma`).toBeGreaterThan(-1);
  const end = schema.indexOf("\n}", start);
  return schema.slice(start, end);
}
