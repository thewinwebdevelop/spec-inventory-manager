// F-003 · T-003-B15 — G3-11 (test-plan §5.2) + the method-scoped half of the
// org-lock registry (security review B15 M-1).
//
// Two directions, both resolved with the TypeScript AST, never by name-grep:
//   (1) REGISTRY → CODE: every built row of ORG_LOCK_REQUIRED_OPERATIONS names a
//       real method DECLARATION, and THAT method's own body calls
//       `runInOrgLockTransaction(…, { operation: "<its key>" })`. A key that
//       appears only elsewhere in the file does not count.
//   (2) CODE → REGISTRY: every production write that grants a role
//       (`Membership.roleId`, `status → active`, relation connect, nested
//       `memberships: { create… }`) and EVERY `Role` write must sit in a listed
//       method AND inside that method's lock callback with the method's own
//       key — or in the reasoned allowlist. A write after the callback returns
//       holds no lock, so it is red even in a listed method.
import { describe, it, expect } from "vitest";
import { ORG_LOCK_REQUIRED_OPERATIONS, type OrgLockRequiredOperation } from "@omnistock/db";
import {
  balancedArgs,
  classMethods,
  enclosingMethod,
  fixture,
  fixtureNames,
  lineOf,
  lockCallsIn,
  productionFiles,
  readCode,
  topLevelEntries,
} from "./scan";

/** `Service` → the file that must declare its methods. */
const SERVICE_FILES: Readonly<Record<string, string>> = Object.freeze({
  MembersService: "apps/api/src/orgs/members.service.ts",
  InvitationsService: "apps/api/src/orgs/invitations.service.ts",
  RolesService: "apps/api/src/orgs/roles.service.ts",
});

// ── (2) what counts as a write ─────────────────────────────────────────────

const MEMBERSHIP_WRITE = /\.membership\.(update|updateMany|upsert|create|createMany)\s*\(/g;
const RAW_MEMBERSHIP_WRITE = /\b(?:UPDATE|INSERT\s+INTO)\s+(?:"?public"?\s*\.\s*)?"Membership"/gi;
/** Nested relation writes reach Membership without `.membership.` (review L-1). */
const NESTED_MEMBERSHIP_WRITE =
  /\bmemberships\s*:\s*\{\s*(?:create|createMany|update|updateMany|upsert|connect|connectOrCreate|set)\b/g;
const ROLE_WRITE = /\.role\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/g;
const RAW_ROLE_WRITE =
  /\b(?:UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+(?:ONLY\s+)?(?:"?public"?\s*\.\s*)?"Role"/gi;
const NESTED_ROLE_WRITE =
  /\broles\s*:\s*\{\s*(?:create|createMany|update|updateMany|upsert|delete|deleteMany|set)\b/g;
/** roleId · relation `role: { connect }` · any status that is not a literal revoke (review L-1). */
const GRANTS = /\broleId\b|\brole\s*:|\bstatus\s*:(?!\s*["'`](?:revoked|invited)["'`])/;

/** Writes that are correct WITHOUT the anchor, each with its reason. */
const UNLOCKED_ALLOWLIST: ReadonlyMap<string, string> = new Map([
  [
    "OrgProvisioningService.create",
    "creates the Organization row the anchor locks (and its Role×3 + Owner membership) — nothing else can see the shop yet (org-provisioning.service.ts header)",
  ],
]);

export interface GuardedWrite {
  readonly file: string;
  readonly line: number;
  readonly pos: number;
  readonly model: "Membership" | "Role";
  readonly owner: string;
}

function membershipGrants(code: string, open: number): boolean {
  const args = balancedArgs(code, open).trim();
  const payload = topLevelEntries(args.startsWith("{") ? balancedArgs(args, 0) : args)
    .filter((e) => ["data", "create", "update"].includes(e.key))
    .map((e) => e.value);
  // Not a literal (a variable/spread we cannot read) ⇒ assume it grants: fail-closed.
  const opaque =
    payload.length === 0 || payload.some((v) => !v.startsWith("{") && !v.startsWith("["));
  return opaque || payload.some((v) => GRANTS.test(v));
}

export function guardedWrites(file: string, code: string): GuardedWrite[] {
  const out: GuardedWrite[] = [];
  const add = (pos: number, model: GuardedWrite["model"]) =>
    out.push({ file, line: lineOf(code, pos), pos, model, owner: enclosingMethod(code, pos) });
  for (const m of code.matchAll(MEMBERSHIP_WRITE))
    if (membershipGrants(code, m.index! + m[0].length - 1)) add(m.index!, "Membership");
  for (const re of [RAW_MEMBERSHIP_WRITE, NESTED_MEMBERSHIP_WRITE])
    for (const m of code.matchAll(re)) add(m.index!, "Membership");
  for (const re of [ROLE_WRITE, RAW_ROLE_WRITE, NESTED_ROLE_WRITE])
    for (const m of code.matchAll(re)) add(m.index!, "Role");
  return out.sort((a, b) => a.pos - b.pos);
}

const keyOf = (ops: readonly OrgLockRequiredOperation[], serviceMethod: string) =>
  ops.find((op) => op.serviceMethod === serviceMethod)?.operationKey;

/** Why `w` is not protected, or null when it sits inside its own method's lock callback. */
export function writeViolation(
  code: string,
  w: GuardedWrite,
  ops: readonly OrgLockRequiredOperation[] = ORG_LOCK_REQUIRED_OPERATIONS,
): string | null {
  if (UNLOCKED_ALLOWLIST.has(w.owner)) return null;
  const key = keyOf(ops, w.owner);
  if (!key) return `${w.model} write in ${w.owner}, which is not in ORG_LOCK_REQUIRED_OPERATIONS`;
  const method = classMethods(code).find((m) => m.name === w.owner)!;
  const inside = lockCallsIn(method).some(
    (c) => c.operation === key && c.callback && w.pos >= c.callback[0] && w.pos < c.callback[1],
  );
  return inside
    ? null
    : `${w.model} write in ${w.owner} is outside its runInOrgLockTransaction callback (operation "${key}")`;
}

// ── (1) registry → the method's own body ───────────────────────────────────

/** Why `op` is not anchored in `code`, or null. */
export function registryViolation(op: OrgLockRequiredOperation, code: string): string | null {
  const method = classMethods(code).find((m) => m.name === op.serviceMethod);
  if (!method) return `${op.serviceMethod} is not declared`;
  const calls = lockCallsIn(method);
  if (calls.length === 0) return `${op.serviceMethod} never calls runInOrgLockTransaction`;
  const wrong = calls.filter((c) => c.operation !== op.operationKey);
  if (wrong.length > 0)
    return `${op.serviceMethod} calls runInOrgLockTransaction without operation "${op.operationKey}"`;
  return null;
}

const fileFor = (serviceMethod: string) => SERVICE_FILES[serviceMethod.split(".")[0]!];

describe("ORG_LOCK registry — method-scoped (review B15 M-1)", () => {
  it("★ every built row: the method is DECLARED and its own body takes the lock with its own key", () => {
    const built = ORG_LOCK_REQUIRED_OPERATIONS.filter((op) => !op.pendingTask);
    expect(built.length).toBeGreaterThanOrEqual(7); // non-vacuity: the F-002 seven
    for (const op of built) {
      const file = fileFor(op.serviceMethod);
      expect(file, `no file mapped for ${op.serviceMethod}`).toBeDefined();
      expect(registryViolation(op, readCode(file!)), op.serviceMethod).toBeNull();
    }
  });

  it("★ PENDING rows are honest: the method is not declared yet (a CALL named create/update/delete does not count)", () => {
    const pending = ORG_LOCK_REQUIRED_OPERATIONS.filter((op) => op.pendingTask);
    for (const op of pending) {
      const declared = classMethods(readCode(fileFor(op.serviceMethod)!)).map((m) => m.name);
      expect(
        declared,
        `${op.serviceMethod} exists — delete its pendingTask (${op.pendingTask}) so the method-scoped check applies`,
      ).not.toContain(op.serviceMethod);
    }
  });

  it("FIXTURE: the operation key only elsewhere in the file → red; the twin method → green", () => {
    const code = fixture("g3-11-op-key-elsewhere.fixture");
    const op = (serviceMethod: string, operationKey: string) =>
      ({ operationKey, method: "PATCH", path: "/x", serviceMethod }) as OrgLockRequiredOperation;
    expect(registryViolation(op("RolesService.update", "updateRole"), code)).toMatch(
      /without operation "updateRole"/,
    );
    expect(registryViolation(op("RolesService.delete", "deleteRole"), code)).toMatch(
      /never calls runInOrgLockTransaction/,
    );
    expect(registryViolation(op("RolesService.create", "createRole"), code)).toBeNull();
  });

  it("SELF-CHECK: a Prisma CALL `tx.role.update(` is not a declaration of `RolesService.update`", () => {
    const code = "class RolesService {\n  async list(tx) {\n    await tx.role.update({});\n  }\n}";
    expect(classMethods(code).map((m) => m.name)).toEqual(["RolesService.list"]);
  });
});

describe("G3-11 · every role-granting Membership write and every Role write runs under the org lock", () => {
  const files = productionFiles();
  const all = files.flatMap((f) => guardedWrites(f, readCode(f)).map((w) => ({ w, f })));

  it("non-vacuity: at least the known writes (PATCH member · accept ×2 · provisioning membership + role)", () => {
    const seen = all.map(({ w }) => `${w.model} ${w.owner}`);
    for (const known of [
      "Membership MembersService.updateRole",
      "Membership InvitationsService.accept",
      "Membership OrgProvisioningService.create",
      "Role OrgProvisioningService.create",
    ])
      expect(seen, known).toContain(known);
    expect(seen.filter((s) => s === "Membership InvitationsService.accept")).toHaveLength(2);
    // the in-callback check actually ran on locked writes (not only allowlisted ones)
    expect(all.filter(({ w }) => !UNLOCKED_ALLOWLIST.has(w.owner)).length).toBeGreaterThanOrEqual(
      3,
    );
  });

  it("★ none sits outside its own method's lock callback (or the reasoned allowlist)", () => {
    const bad = all
      .map(({ w, f }) => ({ at: `${f}:${w.line}`, why: writeViolation(readCode(f), w) }))
      .filter((v) => v.why !== null);
    expect(bad).toEqual([]);
  });

  it("the allowlist has no stale entry", () => {
    const owners = new Set(all.map(({ w }) => w.owner));
    for (const owner of UNLOCKED_ALLOWLIST.keys()) expect(owners.has(owner), owner).toBe(true);
  });

  const FIXTURE_OPS: readonly OrgLockRequiredOperation[] = [...ORG_LOCK_REQUIRED_OPERATIONS].map(
    (op) => ({ ...op, pendingTask: undefined }),
  );

  it("FIXTURE: a Role write AFTER the lock callback in a listed method → red", () => {
    const code = fixture("g3-11-role-write-outside-callback.fixture");
    const why = guardedWrites("x.ts", code).map((w) => writeViolation(code, w, FIXTURE_OPS));
    expect(why).toEqual([
      null,
      'Role write in RolesService.update is outside its runInOrgLockTransaction callback (operation "updateRole")',
    ]);
  });

  it("FIXTURE: a Role write in an unlisted method (clone) → red, even under a lock", () => {
    const code = fixture("g3-11-role-write-unlisted-method.fixture");
    const why = guardedWrites("x.ts", code).map((w) => writeViolation(code, w, FIXTURE_OPS));
    expect(why).toEqual([
      "Role write in RolesService.clone, which is not in ORG_LOCK_REQUIRED_OPERATIONS",
    ]);
  });

  it("FIXTURE: unlisted membership writes — roleId · raw UPDATE · opaque payload · relation connect · nested create → red", () => {
    const code = fixture("g3-11-membership-grants.fixture");
    const found = guardedWrites("x.ts", code);
    expect(found.map((w) => w.owner)).toEqual([
      "RolesService.reassignHolders",
      "RolesService.reactivate",
      "RolesService.copy",
      "RolesService.connect",
      "RolesService.nested",
    ]);
    expect(found.every((w) => writeViolation(code, w, FIXTURE_OPS) !== null)).toBe(true);
  });

  it("every g3-11 fixture on disk is exercised above", () => {
    expect(fixtureNames("g3-11-")).toEqual([
      "g3-11-membership-grants.fixture",
      "g3-11-op-key-elsewhere.fixture",
      "g3-11-role-write-outside-callback.fixture",
      "g3-11-role-write-unlisted-method.fixture",
    ]);
  });

  it("SELF-CHECK: a revoke (literal status revoked) is not a granting write; in-callback write of a listed method is fine", () => {
    const code = [
      "class MembersService {",
      "  async helper(tx, at) {",
      '    await tx.membership.update({ where: { id: 1 }, data: { status: "revoked", revokedAt: at } });',
      "  }",
      "  async updateRole(input) {",
      "    return runInOrgLockTransaction(this.prisma, async (tx) => {",
      "      await tx.membership.update({ where: { id: 1 }, data: { roleId: input.roleId } });",
      '    }, { operation: "updateMemberRole" });',
      "  }",
      "}",
    ].join("\n");
    const found = guardedWrites("x.ts", code);
    expect(found.map((w) => w.owner)).toEqual(["MembersService.updateRole"]);
    expect(writeViolation(code, found[0]!)).toBeNull();
  });
});
