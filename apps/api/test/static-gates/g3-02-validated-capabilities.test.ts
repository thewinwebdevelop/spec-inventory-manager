// F-003 · T-003-B23 ★ — G3-02 (G-15 (ข) replacement · test-plan §5.2 · architecture §13.2 (ข)).
//
// `ValidatedCapabilities` is a brand only `validateRoleCapabilities` can mint.
// The brand protects nothing unless the function that WRITES `Role.capabilities`
// refuses anything else — so the gate has three legs:
//
//   1. GREP — no `as ValidatedCapabilities` / `<ValidatedCapabilities>` cast in
//      production code outside `core-domain/src/rbac/` (where the one
//      constructor lives). Comments are blanked first; a red fixture proves the
//      matcher fires.
//   2. TYPE — `roleCreateData` / `roleUpdateData` (the only builders of the
//      `data` RolesService.create / .update write) take `ValidatedCapabilities`
//      (update: or `null` = unchanged): a plain `string[]` and a literal array
//      do NOT compile, a `validateRoleCapabilities` result does. Checked with the
//      real compiler (control snippets prove the harness can pass).
//   3. WIRING — `RolesService.create` / `.update` really build their writes with
//      those builders, so leg 2 is about the code that runs.
//
// Provisioning is deliberately NOT under leg 2: it writes the frozen
// `SYSTEM_ROLE_BLUEPRINT`, whose Owner row holds `full_access` and therefore
// can never be a `ValidatedCapabilities` (FULL_ACCESS_RESERVED). Its safety
// argument is G3-03's allowlist reason, not the brand.
import { join } from "node:path";
import * as ts from "typescript";
import { describe, it, expect } from "vitest";
import {
  REPO,
  classMethods,
  fixture,
  lineOf,
  productionFiles,
  readCode,
  type Violation,
} from "./scan";

const RBAC = "packages/core-domain/src/rbac/";
/** `x as ValidatedCapabilities`, `x as unknown as ValidatedCapabilities`, `<ValidatedCapabilities>x`. */
/** The angle form only when it is a CAST — `Array<ValidatedCapabilities>` (a generic) is not. */
const CAST = /\bas\s+ValidatedCapabilities\b|(?<![\w$\])>]\s*)<\s*ValidatedCapabilities\s*>/g;

export function g302(file: string, code: string): Violation[] {
  if (file.startsWith(RBAC)) return [];
  return [...code.matchAll(CAST)].map((m) => ({
    gate: "G3-02",
    rule: "brand-cast-outside-rbac",
    file,
    line: lineOf(code, m.index!),
    snippet: m[0],
  }));
}

describe("G3-02 (1) · no ValidatedCapabilities cast outside core-domain/rbac", () => {
  const files = productionFiles();

  it("non-vacuity: the scan reached the writer and the rbac module", () => {
    expect(files).toContain("apps/api/src/orgs/role-write-data.ts");
    expect(files).toContain("packages/core-domain/src/rbac/role-validation.ts");
    // …and the one legitimate cast really is there (the scan can see one).
    expect(
      [...readCode("packages/core-domain/src/rbac/role-validation.ts").matchAll(CAST)].length,
    ).toBe(1);
  });

  it("★ production code: no cast outside rbac/", () => {
    expect(files.flatMap((f) => g302(f, readCode(f)))).toEqual([]);
  });

  it("FIXTURE: both cast shapes are red; a comment or a generic mentioning the type is not", () => {
    const found = g302("apps/api/src/orgs/evil.ts", fixture("g3-02-brand-cast.fixture"));
    expect(found.map((v) => v.snippet)).toEqual([
      "as ValidatedCapabilities",
      "as ValidatedCapabilities",
      "<ValidatedCapabilities>",
    ]);
    // The same text inside rbac/ is the constructor's home — not a violation.
    expect(g302(`${RBAC}x.ts`, fixture("g3-02-brand-cast.fixture"))).toEqual([]);
  });
});

// ── leg 1b (security review B23 L-2): escape casts into the writer ──────────
//
// Leg 1 only sees the brand's NAME. `as never` / `as any` / `as unknown as X`
// inside a `roleCreateData(…)` / `roleUpdateData(…)` argument mint the same
// bypass without naming it. So: the writers may be CALLED only from
// `roles.service.ts`, and no call's argument text may contain an escape cast.

const WRITER_DEF = "apps/api/src/orgs/role-write-data.ts";
const WRITER_CALLERS = new Set(["apps/api/src/orgs/roles.service.ts"]);
const ESCAPE = /\bas\s+(?:never|any|unknown)\b/;

/** The argument text of every `roleCreateData(` / `roleUpdateData(` / `roleDeleteData(` call — balanced parens. */
function writerCalls(code: string): { index: number; name: string; args: string }[] {
  const out: { index: number; name: string; args: string }[] = [];
  for (const m of code.matchAll(/\b(roleCreateData|roleUpdateData|roleDeleteData)\s*\(/g)) {
    let depth = 1;
    let i = m.index! + m[0].length;
    const start = i;
    for (; i < code.length && depth > 0; i++) {
      if (code[i] === "(") depth++;
      else if (code[i] === ")") depth--;
    }
    out.push({ index: m.index!, name: m[1]!, args: code.slice(start, i - 1) });
  }
  return out;
}

export function g302b(file: string, code: string): Violation[] {
  if (file === WRITER_DEF) return [];
  return writerCalls(code).flatMap(({ index, name, args }) => {
    const v: Violation[] = [];
    if (!WRITER_CALLERS.has(file)) {
      v.push({
        gate: "G3-02",
        rule: "writer-called-outside-roles-service",
        file,
        line: lineOf(code, index),
        snippet: `${name}(`,
      });
    }
    const esc = args.match(ESCAPE);
    if (esc) {
      v.push({
        gate: "G3-02",
        rule: "escape-cast-into-writer",
        file,
        line: lineOf(code, index),
        snippet: esc[0],
      });
    }
    return v;
  });
}

describe("G3-02 (1b) · no escape cast into roleCreateData / roleUpdateData, no caller outside RolesService", () => {
  const files = productionFiles();

  it("non-vacuity: the real call sites of ALL THREE writers are seen", () => {
    const names = writerCalls(readCode("apps/api/src/orgs/roles.service.ts")).map((c) => c.name);
    expect(names).toContain("roleCreateData");
    expect(names).toContain("roleUpdateData");
    expect(names).toContain("roleDeleteData"); // T-003-B25
  });

  it("★ production code: clean", () => {
    expect(files.flatMap((f) => g302b(f, readCode(f)))).toEqual([]);
  });

  it("FIXTURE: as never / as any / as unknown as are red; a validated value is not", () => {
    const found = g302b("apps/api/src/orgs/roles.service.ts", fixture("g3-02-escape-cast.fixture"));
    expect(found.map((v) => v.snippet)).toEqual(["as never", "as any", "as unknown"]);
    // …and the same clean call from another file is red for WHERE it is.
    const elsewhere = g302b("apps/api/src/orgs/evil.ts", fixture("g3-02-escape-cast.fixture"));
    expect(elsewhere.filter((v) => v.rule === "writer-called-outside-roles-service")).toHaveLength(
      4,
    );
  });

  it("FIXTURE (B24): the same three escape casts into roleUpdateData are red; validated / null are not", () => {
    const found = g302b(
      "apps/api/src/orgs/roles.service.ts",
      fixture("g3-02-escape-cast-update.fixture"),
    );
    expect(found.map((v) => v.snippet)).toEqual(["as never", "as any", "as unknown"]);
    const elsewhere = g302b(
      "apps/api/src/orgs/evil.ts",
      fixture("g3-02-escape-cast-update.fixture"),
    );
    expect(
      elsewhere
        .filter((v) => v.rule === "writer-called-outside-roles-service")
        .map((v) => v.snippet),
    ).toEqual(Array(5).fill("roleUpdateData("));
  });
});

// ── leg 2: the type-level check, with the real compiler ─────────────────────

const PROBE = join(REPO, "apps/api/src/orgs/__brand_probe__.ts");

function typeErrors(body: string): string[] {
  const source =
    `import { validateRoleCapabilities } from "@omnistock/core-domain";\n` +
    `import { roleCreateData, roleDeleteData, roleUpdateData } from "./role-write-data";\n` +
    `const base = { organizationId: "o", name: "n", actorUserId: "u", now: new Date() };\n` +
    `const upd = { name: null, actorUserId: "u", now: new Date() };\n` +
    body;
  const options: ts.CompilerOptions = {
    strict: true,
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    skipLibCheck: true,
    types: [],
  };
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (name, lang, ...rest) =>
    name === PROBE ? ts.createSourceFile(name, source, lang) : getSourceFile(name, lang, ...rest);
  const fileExists = host.fileExists.bind(host);
  host.fileExists = (name) => name === PROBE || fileExists(name);
  const program = ts.createProgram([PROBE], options, host);
  return ts
    .getPreEmitDiagnostics(program)
    .filter((d) => d.file?.fileName === PROBE)
    .map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
}

describe("G3-02 (2) · the Role.capabilities writer accepts ValidatedCapabilities only", () => {
  it("CONTROL: a validateRoleCapabilities result compiles (the harness can pass)", () => {
    expect(
      typeErrors(
        `const r = validateRoleCapabilities(["view_products"]);\n` +
          `if (r.ok) roleCreateData({ ...base, capabilities: r.capabilities });\n`,
      ),
    ).toEqual([]);
  });

  it("★ a plain string[] does NOT compile", () => {
    const errors = typeErrors(
      `const s: string[] = ["manage_members"];\nroleCreateData({ ...base, capabilities: s });\n`,
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join("\n")).toMatch(/ValidatedCapabilities|not assignable/);
  });

  it("★ a literal array does NOT compile", () => {
    expect(
      typeErrors(`roleCreateData({ ...base, capabilities: ["view_products"] });\n`).length,
    ).toBeGreaterThan(0);
  });

  it("★ an unchecked validation result (ok not narrowed) does NOT compile", () => {
    expect(
      typeErrors(
        `const r = validateRoleCapabilities(["view_products"]);\n` +
          `roleCreateData({ ...base, capabilities: (r as { capabilities: string[] }).capabilities });\n`,
      ).length,
    ).toBeGreaterThan(0);
  });
});

describe("G3-02 (2) · the UPDATE writer accepts ValidatedCapabilities or null only (T-003-B24)", () => {
  it("CONTROL: a validateRoleCapabilities result, and null (= unchanged), compile", () => {
    expect(
      typeErrors(
        `const r = validateRoleCapabilities(["view_products"]);\n` +
          `if (r.ok) roleUpdateData({ ...upd, capabilities: r.capabilities });\n` +
          `roleUpdateData({ ...upd, capabilities: null });\n`,
      ),
    ).toEqual([]);
  });

  it("★ a plain string[] does NOT compile", () => {
    const errors = typeErrors(
      `const s: string[] = ["manage_members"];\nroleUpdateData({ ...upd, capabilities: s });\n`,
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join("\n")).toMatch(/ValidatedCapabilities|not assignable/);
  });

  it("★ a literal array does NOT compile", () => {
    expect(
      typeErrors(`roleUpdateData({ ...upd, capabilities: ["view_products"] });\n`).length,
    ).toBeGreaterThan(0);
  });

  it("★ it has no way to write key / isSystem / organizationId (unknown property does not compile)", () => {
    expect(
      typeErrors(`roleUpdateData({ ...upd, capabilities: null, isSystem: true });\n`).length,
    ).toBeGreaterThan(0);
  });
});

describe("G3-02 (3) · RolesService.create writes through roleCreateData", () => {
  it("the create method's role.create call takes its data from roleCreateData(…)", () => {
    const code = readCode("apps/api/src/orgs/roles.service.ts");
    const create = classMethods(code).find((m) => m.name === "RolesService.create");
    expect(create, "RolesService.create is not declared").toBeDefined();
    const body = code.slice(create!.start, create!.end);
    expect(body).toMatch(/\.role\.create\s*\(\s*\{\s*data\s*:\s*roleCreateData\s*\(/);
  });
});

describe("G3-02 (3) · RolesService.update writes through roleUpdateData (T-003-B24)", () => {
  it("the update method's only Role write is role.updateMany({ where, data: roleUpdateData(…) })", () => {
    const code = readCode("apps/api/src/orgs/roles.service.ts");
    const update = classMethods(code).find((m) => m.name === "RolesService.update");
    expect(update, "RolesService.update is not declared").toBeDefined();
    const body = code.slice(update!.start, update!.end);
    expect(body).toMatch(
      /\.role\.updateMany\s*\(\s*\{\s*where\s*:[\s\S]*?data\s*:\s*roleUpdateData\s*\(/,
    );
    expect(body.match(/\.role\.(create|update|updateMany|upsert|delete|deleteMany)\s*\(/g)).toEqual(
      [".role.updateMany("],
    );
  });
});

describe("G3-02 (2) · the DELETE writer can write nothing but the soft-delete columns (T-003-B25)", () => {
  it("CONTROL: actor + now compile", () => {
    expect(typeErrors(`roleDeleteData({ actorUserId: "u", now: new Date() });\n`)).toEqual([]);
  });

  it("★ it has no way to write capabilities / name / isSystem (unknown property does not compile)", () => {
    for (const extra of [`capabilities: ["manage_members"]`, `name: "x"`, `isSystem: true`]) {
      expect(
        typeErrors(`roleDeleteData({ actorUserId: "u", now: new Date(), ${extra} });\n`).length,
        extra,
      ).toBeGreaterThan(0);
    }
  });
});

describe("G3-02 (3) · RolesService.delete is a SOFT delete through roleDeleteData (T-003-B25)", () => {
  it("★ the delete method's only Role write is role.updateMany({ where: {…, ...LIVE_ROLE_WHERE}, data: roleDeleteData(…) }) — never role.delete / deleteMany", () => {
    const code = readCode("apps/api/src/orgs/roles.service.ts");
    const del = classMethods(code).find((m) => m.name === "RolesService.delete");
    expect(del, "RolesService.delete is not declared").toBeDefined();
    const body = code.slice(del!.start, del!.end);
    expect(body).toMatch(
      /\.role\.updateMany\s*\(\s*\{\s*where\s*:\s*\{[^}]*\.\.\.LIVE_ROLE_WHERE\s*\}\s*,\s*data\s*:\s*roleDeleteData\s*\(/,
    );
    expect(body.match(/\.role\.(create|update|updateMany|upsert|delete|deleteMany)\s*\(/g)).toEqual(
      [".role.updateMany("],
    );
    // …and no raw SQL path around it.
    expect(body).not.toMatch(/\$(?:executeRaw|queryRaw)(?:Unsafe)?\s*[(`]/);
  });
});
