// F-003 · T-003-B15 — G3-11 (test-plan §5.2): the other direction of
// src/orgs/system/org-lock-callsites.test.ts. That file pins every LISTED
// operation to the org-lock anchor; this one finds every production write that
// grants a role and demands it sits in a listed operation.
import { describe, it, expect } from "vitest";
import * as ts from "typescript";
import { ORG_LOCK_REQUIRED_OPERATIONS } from "@omnistock/db";
import { balancedArgs, lineOf, productionFiles, readCode, topLevelEntries } from "./scan";

// ── G3-11 (test-plan §5.2) — membership writes that GRANT access sit under the lock ──
//
// The list above pins listed methods to the anchor. G3-11 closes the other
// direction: every production write that sets `Membership.roleId` or moves a
// membership to `status: "active"` must be inside a method that IS listed —
// otherwise a new endpoint can hand out a role with no org lock and no Owner
// ≥ 1 / revoke ‖ accept serialization at all.

const MEMBERSHIP_WRITE = /\.membership\.(update|updateMany|upsert|create|createMany)\s*\(/g;
const RAW_MEMBERSHIP_WRITE = /\b(?:UPDATE|INSERT\s+INTO)\s+(?:"?public"?\s*\.\s*)?"Membership"/gi;
const GRANTS = /\broleId\b|\bstatus\s*:\s*["'`]active["'`]/;

/** Writes that are correct WITHOUT the anchor, each with its reason. */
const UNLOCKED_ALLOWLIST: ReadonlyMap<string, string> = new Map([
  [
    "OrgProvisioningService.create",
    "creates the Organization row the anchor locks — nothing else can see the shop yet (org-provisioning.service.ts header)",
  ],
]);

interface MembershipWrite {
  readonly file: string;
  readonly line: number;
  readonly owner: string;
}

/** `Class.method` enclosing `pos`, or `<module>` when there is none. */
function enclosingMethod(code: string, pos: number): string {
  const sf = ts.createSourceFile("s.ts", code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let owner = "<module>";
  const visit = (node: ts.Node): void => {
    if (pos < node.getStart(sf) || pos >= node.getEnd()) return;
    if (ts.isMethodDeclaration(node) && ts.isClassDeclaration(node.parent) && node.parent.name) {
      owner = `${node.parent.name.text}.${node.name.getText(sf)}`;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return owner;
}

/** Membership writes in `code` that set roleId / status active (the data payload decides). */
export function grantingMembershipWrites(file: string, code: string): MembershipWrite[] {
  const out: MembershipWrite[] = [];
  for (const m of code.matchAll(MEMBERSHIP_WRITE)) {
    const args = balancedArgs(code, m.index! + m[0].length - 1);
    const payload = topLevelEntries(
      args.trim().startsWith("{") ? balancedArgs(args.trim(), 0) : args,
    )
      .filter((e) => ["data", "create", "update"].includes(e.key))
      .map((e) => e.value);
    // Not a literal (a variable/spread we cannot read) ⇒ assume it grants: fail-closed.
    const opaque =
      payload.length === 0 || payload.some((v) => !v.startsWith("{") && !v.startsWith("["));
    if (opaque || payload.some((v) => GRANTS.test(v)))
      out.push({ file, line: lineOf(code, m.index!), owner: enclosingMethod(code, m.index!) });
  }
  for (const m of code.matchAll(RAW_MEMBERSHIP_WRITE))
    out.push({ file, line: lineOf(code, m.index!), owner: enclosingMethod(code, m.index!) });
  return out;
}

const LOCKED = new Set(ORG_LOCK_REQUIRED_OPERATIONS.map((op) => op.serviceMethod));
const offenders = (writes: readonly MembershipWrite[]) =>
  writes.filter((w) => !LOCKED.has(w.owner) && !UNLOCKED_ALLOWLIST.has(w.owner));

describe("G3-11 · every membership write that grants a role runs under the org lock", () => {
  const writes = productionFiles().flatMap((f) => grantingMembershipWrites(f, readCode(f)));

  it("non-vacuity: the scan finds the known granting writes (PATCH member · accept ×2 · provisioning)", () => {
    expect(writes.map((w) => w.owner).sort()).toEqual([
      "InvitationsService.accept",
      "InvitationsService.accept",
      "MembersService.updateRole",
      "OrgProvisioningService.create",
    ]);
  });

  it("★ none sits outside an ORG_LOCK_REQUIRED_OPERATIONS method (or the reasoned allowlist)", () => {
    expect(offenders(writes)).toEqual([]);
  });

  it("the allowlist has no stale entry", () => {
    const owners = new Set(writes.map((w) => w.owner));
    for (const owner of UNLOCKED_ALLOWLIST.keys()) expect(owners.has(owner), owner).toBe(true);
  });

  it("FIXTURE: a role write in an unlisted method / a raw UPDATE / an opaque payload → red", () => {
    const fixture = [
      "class RolesService {",
      "  async reassignHolders(tx, from, to) {",
      "    await tx.membership.updateMany({ where: { roleId: from }, data: { roleId: to } });",
      "  }",
      "  async reactivate(tx, id) {",
      "    await tx.$executeRaw`UPDATE \"Membership\" SET status = 'active' WHERE id = ${id}`;",
      "  }",
      "  async copy(tx, data) {",
      "    await tx.membership.create({ data });",
      "  }",
      "}",
    ].join("\n");
    expect(offenders(grantingMembershipWrites("x.ts", fixture)).map((w) => w.owner)).toEqual([
      "RolesService.reassignHolders",
      "RolesService.copy",
      "RolesService.reactivate",
    ]);
  });

  it("SELF-CHECK: a revoke (status revoked, no roleId) is not a granting write; a listed method is fine", () => {
    const fixture = [
      "class MembersService {",
      "  async helper(tx, at) {",
      '    await tx.membership.update({ where: { id: 1 }, data: { status: "revoked", revokedAt: at } });',
      "  }",
      "  async updateRole(tx, roleId) {",
      "    await tx.membership.update({ where: { id: 1 }, data: { roleId } });",
      "  }",
      "}",
    ].join("\n");
    const found = grantingMembershipWrites("x.ts", fixture);
    expect(found.map((w) => w.owner)).toEqual(["MembersService.updateRole"]);
    expect(offenders(found)).toEqual([]);
  });
});
