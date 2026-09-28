// F-003 · T-003-B01 — the role/capability component schemas (api-spec §2, §3).
//
// B01 publishes SHAPES only, so web and mobile can compile against the types
// before the routes exist. The routes (and the error codes they answer with)
// arrive with B21/B23/B24/B25 — Q-T1: the router↔spec parity gate compares
// paths/operations, and a path published before its controller is a promise
// the server cannot keep.
//
// What this file pins, and why each one matters to a consumer:
// - the exact field sets (a missing field is a client that cannot render;
//   an extra one on `lastEdited.by` — `displayName` — is a field F-003 never
//   sends, which api-spec §3 refused on purpose);
// - every OPEN SET stays `type: string` with no `enum` (api-spec §3: a client
//   must fall back on an unknown value, and an `enum` makes both generators
//   refuse it at parse time);
// - the request bodies carry nothing a client could use to set `key`,
//   `isSystem` or (on create) `version`.
//
// It reads the COMMITTED bundle — what both generators consume — converted to
// JSON by the same `redocly` the package already runs, so no YAML dependency.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, it, expect, expectTypeOf } from "vitest";
import type { components } from "./client.js";

const PACKAGE_ROOT = (() => {
  let dir = resolve(process.cwd());
  for (;;) {
    if (existsSync(join(dir, "openapi", "root.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(`f003-role-schemas: no openapi/root.yaml above ${process.cwd()}`);
    }
    dir = parent;
  }
})();
const BUNDLE = join(PACKAGE_ROOT, "openapi", "openapi.yaml");
const REDOCLY = join(PACKAGE_ROOT, "node_modules", ".bin", "redocly");

type Schema = {
  type?: string | string[];
  required?: string[];
  properties?: Record<string, Schema>;
  items?: Schema;
  enum?: unknown[];
  oneOf?: Schema[];
  $ref?: string;
  format?: string;
  minimum?: number;
  maxItems?: number;
  maxLength?: number;
  default?: unknown;
};

function loadSchemas(): Record<string, Schema> {
  const dir = mkdtempSync(join(tmpdir(), "omnistock-f003-schemas-"));
  const out = join(dir, "bundle.json");
  try {
    execFileSync(REDOCLY, ["bundle", BUNDLE, "-o", out, "--ext", "json"], {
      cwd: PACKAGE_ROOT,
      stdio: "pipe",
    });
    const doc = JSON.parse(readFileSync(out, "utf8")) as {
      components?: { schemas?: Record<string, Schema> };
    };
    return doc.components?.schemas ?? {};
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const SCHEMAS = loadSchemas();
const ref = (name: string) => `#/components/schemas/${name}`;
const schema = (name: string): Schema => {
  const s = SCHEMAS[name];
  if (!s) throw new Error(`components.schemas.${name} is not in the bundle`);
  return s;
};
const props = (name: string) => Object.keys(schema(name).properties ?? {}).sort();
const required = (name: string) => [...(schema(name).required ?? [])].sort();
const prop = (name: string, field: string): Schema => {
  const p = schema(name).properties?.[field];
  if (!p) throw new Error(`${name}.${field} is not declared`);
  return p;
};
const types = (s: Schema) => (Array.isArray(s.type) ? [...s.type].sort() : [s.type]);

const F003_SCHEMAS = [
  "CapabilityCatalog",
  "CapabilityEntry",
  "CapabilityGroup",
  "CreateRoleRequest",
  "DeletedRole",
  "RoleDetail",
  "RoleDetailListPage",
  "RoleDetailListViewer",
  "RoleDetailViewer",
  "RoleLastEdited",
  "RoleLastEditedBy",
  "RoleUsage",
  "RoleWriteVerdict",
  "UpdateRoleRequest",
] as const;

describe("F-003 role/capability component schemas (T-003-B01)", () => {
  it("the bundle was actually read — it has the F-002 schemas it has always had", () => {
    // Non-vacuity: every assertion below is about keys of SCHEMAS; an empty
    // object would make the absence checks pass for nothing.
    expect(Object.keys(SCHEMAS).length).toBeGreaterThan(40);
    expect(SCHEMAS).toHaveProperty("RoleRow");
  });

  it.each(F003_SCHEMAS)("publishes components.schemas.%s", (name) => {
    expect(SCHEMAS, `${name} must be in the bundle so both generators emit it`).toHaveProperty(name);
  });

  it("RoleDetail — every field of api-spec §3, all required, key nullable", () => {
    const fields = [
      "capabilities",
      "createdAt",
      "grantsOwnership",
      "id",
      "isSystem",
      "key",
      "lastEdited",
      "name",
      "nameCustomized",
      "usage",
      "version",
      "viewer",
    ];
    expect(props("RoleDetail")).toEqual(fields);
    expect(required("RoleDetail")).toEqual(fields);
    expect(types(prop("RoleDetail", "key"))).toEqual(["null", "string"]);
    expect(prop("RoleDetail", "capabilities")).toMatchObject({ type: "array", items: { type: "string" } });
    expect(prop("RoleDetail", "version").type).toBe("integer");
    expect(prop("RoleDetail", "createdAt")).toMatchObject({ type: "string", format: "date-time" });
    expect(prop("RoleDetail", "usage").$ref).toBe(ref("RoleUsage"));
    expect(prop("RoleDetail", "viewer").$ref).toBe(ref("RoleDetailViewer"));
  });

  it("RoleDetail.lastEdited is RoleLastEdited or null (null = system default, AC-9.6)", () => {
    const lastEdited = prop("RoleDetail", "lastEdited");
    expect(lastEdited.oneOf).toEqual([{ $ref: ref("RoleLastEdited") }, { type: "null" }]);
    expect(required("RoleLastEdited")).toEqual(["at", "by"]);
    expect(prop("RoleLastEdited", "at")).toMatchObject({ type: "string", format: "date-time" });
    expect(prop("RoleLastEdited", "by").$ref).toBe(ref("RoleLastEditedBy"));
  });

  it("lastEdited.by = { kind, roleName?, roleKey?, roleNameCustomized? } — no displayName, no identity", () => {
    expect(props("RoleLastEditedBy")).toEqual(["kind", "roleKey", "roleName", "roleNameCustomized"]);
    expect(required("RoleLastEditedBy")).toEqual(["kind"]);
    expect(schema("RoleLastEditedBy").properties).not.toHaveProperty("displayName");
    expect(types(prop("RoleLastEditedBy", "roleKey"))).toEqual(["null", "string"]);
    expect(prop("RoleLastEditedBy", "roleNameCustomized").type).toBe("boolean");
  });

  it("RoleUsage — two integers, nothing that names a holder", () => {
    expect(props("RoleUsage")).toEqual(["activeMembers", "pendingInvitations"]);
    expect(required("RoleUsage")).toEqual(["activeMembers", "pendingInvitations"]);
    expect(prop("RoleUsage", "activeMembers").type).toBe("integer");
    expect(prop("RoleUsage", "pendingInvitations").type).toBe("integer");
  });

  it("viewer verdicts — { allowed, reason|null } on canEdit/canDelete/canClone and the list's canCreate + limit", () => {
    expect(required("RoleWriteVerdict")).toEqual(["allowed", "reason"]);
    expect(prop("RoleWriteVerdict", "allowed").type).toBe("boolean");
    expect(types(prop("RoleWriteVerdict", "reason"))).toEqual(["null", "string"]);

    expect(required("RoleDetailViewer")).toEqual(["canClone", "canDelete", "canEdit"]);
    for (const verb of ["canEdit", "canDelete", "canClone"]) {
      expect(prop("RoleDetailViewer", verb).$ref).toBe(ref("RoleWriteVerdict"));
    }

    expect(props("RoleDetailListViewer")).toEqual(["canCreate", "limit"]);
    expect(required("RoleDetailListViewer")).toEqual(["canCreate", "limit"]);
    expect(prop("RoleDetailListViewer", "canCreate").$ref).toBe(ref("RoleWriteVerdict"));
    expect(prop("RoleDetailListViewer", "limit").type).toBe("integer");
  });

  it("RoleDetailListPage — { items: RoleDetail[], nextCursor: string|null, viewer }", () => {
    expect(props("RoleDetailListPage")).toEqual(["items", "nextCursor", "viewer"]);
    expect(required("RoleDetailListPage")).toEqual(["items", "nextCursor", "viewer"]);
    expect(prop("RoleDetailListPage", "items")).toEqual(
      expect.objectContaining({ type: "array", items: { $ref: ref("RoleDetail") } }),
    );
    expect(types(prop("RoleDetailListPage", "nextCursor"))).toEqual(["null", "string"]);
    expect(prop("RoleDetailListPage", "viewer").$ref).toBe(ref("RoleDetailListViewer"));
  });

  it("CreateRoleRequest — name + capabilities only; nothing sets key/isSystem/version", () => {
    expect(props("CreateRoleRequest")).toEqual(["capabilities", "name"]);
    expect(required("CreateRoleRequest")).toEqual(["capabilities", "name"]);
    expect(prop("CreateRoleRequest", "name").type).toBe("string");
    expect(prop("CreateRoleRequest", "capabilities")).toMatchObject({
      type: "array",
      maxItems: 64,
      items: { type: "string", maxLength: 64 },
    });
  });

  it("UpdateRoleRequest — version required (integer ≥ 1), name/capabilities optional", () => {
    expect(props("UpdateRoleRequest")).toEqual(["capabilities", "name", "version"]);
    expect(required("UpdateRoleRequest")).toEqual(["version"]);
    expect(prop("UpdateRoleRequest", "version")).toMatchObject({ type: "integer", minimum: 1 });
    expect(prop("UpdateRoleRequest", "capabilities")).toMatchObject({
      type: "array",
      maxItems: 64,
      items: { type: "string", maxLength: 64 },
    });
  });

  it("no F-003 request field carries a default (generator-hostile — see generator-hostile-shapes)", () => {
    for (const name of ["CreateRoleRequest", "UpdateRoleRequest"]) {
      for (const [field, s] of Object.entries(schema(name).properties ?? {})) {
        expect(s, `${name}.${field}`).not.toHaveProperty("default");
      }
    }
  });

  it("DeletedRole — { id, deletedAt }", () => {
    expect(props("DeletedRole")).toEqual(["deletedAt", "id"]);
    expect(required("DeletedRole")).toEqual(["deletedAt", "id"]);
    expect(prop("DeletedRole", "deletedAt")).toMatchObject({ type: "string", format: "date-time" });
  });

  it("CapabilityCatalog — groups + items; an entry exposes neither tier nor scope (AC-7.4)", () => {
    expect(required("CapabilityCatalog")).toEqual(["groups", "items"]);
    expect(prop("CapabilityCatalog", "groups").items?.$ref).toBe(ref("CapabilityGroup"));
    expect(prop("CapabilityCatalog", "items").items?.$ref).toBe(ref("CapabilityEntry"));

    expect(props("CapabilityGroup")).toEqual(["key", "labelTh"]);
    expect(required("CapabilityGroup")).toEqual(["key", "labelTh"]);

    const entry = ["descriptionTh", "group", "implies", "key", "labelTh", "selectable", "status"];
    expect(props("CapabilityEntry")).toEqual(entry);
    expect(required("CapabilityEntry")).toEqual(entry);
    expect(types(prop("CapabilityEntry", "group"))).toEqual(["null", "string"]);
    expect(prop("CapabilityEntry", "implies")).toMatchObject({ type: "array", items: { type: "string" } });
    expect(prop("CapabilityEntry", "selectable").type).toBe("boolean");
  });

  it("★ every open set is a plain string — no enum (api-spec §3: unknown value ⇒ generic copy)", () => {
    const openSets: [string, string][] = [
      ["RoleWriteVerdict", "reason"],
      ["RoleLastEditedBy", "kind"],
      ["RoleLastEditedBy", "roleKey"],
      ["RoleDetail", "key"],
      ["CapabilityEntry", "group"],
      ["CapabilityEntry", "status"],
      ["CapabilityEntry", "key"],
      ["CapabilityGroup", "key"],
    ];
    for (const [name, field] of openSets) {
      const s = prop(name, field);
      expect(types(s), `${name}.${field}`).toContain("string");
      expect(s, `${name}.${field} is an OPEN set`).not.toHaveProperty("enum");
    }
  });
});

// ── the generated TS client sees the same shapes ────────────────────────────
// Compile-time: `pnpm --filter @omnistock/contracts typecheck` fails if the
// generated `schema.d.ts` drifts from what api-spec §3 promises.
type S = components["schemas"];

describe("generated TS types (checked by tsc)", () => {
  it("lastEdited.by has exactly kind + three optional role fields", () => {
    expectTypeOf<S["RoleLastEditedBy"]>().toEqualTypeOf<{
      kind: string;
      roleName?: string;
      roleKey?: string | null;
      roleNameCustomized?: boolean;
    }>();
  });

  it("a verdict is { allowed: boolean; reason: string | null }", () => {
    expectTypeOf<S["RoleWriteVerdict"]>().toEqualTypeOf<{ allowed: boolean; reason: string | null }>();
  });

  it("RoleDetail.lastEdited is nullable and viewer carries the three verbs", () => {
    expectTypeOf<S["RoleDetail"]["lastEdited"]>().toEqualTypeOf<S["RoleLastEdited"] | null>();
    expectTypeOf<S["RoleDetail"]["viewer"]>().toEqualTypeOf<S["RoleDetailViewer"]>();
    expectTypeOf<keyof S["RoleDetailViewer"]>().toEqualTypeOf<"canEdit" | "canDelete" | "canClone">();
  });

  it("UpdateRoleRequest requires version only", () => {
    expectTypeOf<S["UpdateRoleRequest"]>().toEqualTypeOf<{
      version: number;
      name?: string;
      capabilities?: string[];
    }>();
  });

  it("RoleDetailListPage.viewer = { canCreate, limit }", () => {
    expectTypeOf<S["RoleDetailListPage"]["viewer"]>().toEqualTypeOf<{
      canCreate: S["RoleWriteVerdict"];
      limit: number;
    }>();
  });
});
