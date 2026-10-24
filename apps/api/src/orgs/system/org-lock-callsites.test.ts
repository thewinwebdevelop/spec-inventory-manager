// ★ B-5 — the org-lock list, checked against the CODE instead of itself.
//
// `ORG_LOCK_REQUIRED_OPERATIONS` says of itself:
//
//     qa's U-API-09 enumerates this instead of re-declaring the list, so a new
//     membership/invitation write that forgets the anchor is a red test, not
//     an undetected concurrency hole.
//
// The reviewer grepped the repo for that constant and found four hits: the
// declaration, an `index.ts` re-export, a test that asserts the list equals a
// literal copy of itself, and a comment. Nothing walked from the list to a
// call site. The list pinned itself perfectly and pinned no code at all.
//
// What DOES bite today is the per-method test: removing
// `runInOrgLockTransaction` from `MembersService.leave()` fails a specific
// case. The gap is a NEW method — F-003's role editing, the next membership
// endpoint — for which nobody happens to write that test. There, the claim
// above is simply false.
//
// This closes the reachable half: every row must name a real service method,
// and that method's source must open its transaction through
// `runInOrgLockTransaction`. It is a source scan, like the SYSTEM_PRISMA and
// raw-SQL allowlists, because that is the level at which "did you use the
// anchoring helper" is answerable without booting the app.
//
// What it deliberately does NOT claim: that `SET LOCAL lock_timeout` is the
// first statement on the wire. That needs the running app and a spy on the
// driver, and pretending otherwise here would repeat the mistake this test
// exists to fix.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ORG_LOCK_REQUIRED_OPERATIONS } from "@omnistock/db";

const SRC = join(process.cwd(), "src");

/** `MembersService.updateRole` → the file that should define it. */
const SERVICE_FILES: Readonly<Record<string, string>> = Object.freeze({
  MembersService: "orgs/members.service.ts",
  InvitationsService: "orgs/invitations.service.ts",
  RolesService: "orgs/roles.service.ts",
});

/**
 * F-003 · T-003-B15 — rows registered ahead of the method that implements them
 * (arch §3 lists the operations; tasks B23/B24/B25 build the methods). Exempt
 * ONLY from "the method exists" — and only while it does not: the moment a
 * method lands, the row below must be deleted (test "pending list is honest").
 */
const PENDING_METHODS: ReadonlyMap<string, string> = new Map([
  ["RolesService.create", "T-003-B23"],
  ["RolesService.update", "T-003-B24"],
  ["RolesService.delete", "T-003-B25"],
]);

const methodDeclared = (source: string, method: string): boolean =>
  new RegExp(`\\b(async\\s+)?${method}\\s*\\(`).test(source);

describe("every org-lock operation names a real, anchored call site (B-5)", () => {
  it("the list is not empty (a list that is empty pins nothing)", () => {
    expect(ORG_LOCK_REQUIRED_OPERATIONS.length).toBeGreaterThanOrEqual(10);
  });

  it("★ the pending list is honest: every row is listed, and none has been built yet", () => {
    const listed = new Set(ORG_LOCK_REQUIRED_OPERATIONS.map((op) => op.serviceMethod));
    for (const [serviceMethod, task] of PENDING_METHODS) {
      expect(listed.has(serviceMethod), `${serviceMethod} (${task}) is not in the list`).toBe(true);
      const [service, method] = serviceMethod.split(".");
      const source = readFileSync(join(SRC, SERVICE_FILES[service]!), "utf8");
      expect(
        methodDeclared(source, method!),
        `${serviceMethod} exists now — delete its PENDING_METHODS row (${task}) so the checks below apply`,
      ).toBe(false);
    }
  });

  it("★ every built operation passes its operationKey to runInOrgLockTransaction (ORG_TX_TIMEOUTS busy mapping + metric label)", () => {
    // `{ operation: "<key>" }` is what labels `org_tx_lock_timeout_total` and
    // the 409/busy diagnostic; the timeouts themselves come from ORG_TX_TIMEOUTS
    // inside the helper, never per call site.
    for (const op of ORG_LOCK_REQUIRED_OPERATIONS) {
      if (PENDING_METHODS.has(op.serviceMethod)) continue;
      const [service] = op.serviceMethod.split(".");
      const source = readFileSync(join(SRC, SERVICE_FILES[service]!), "utf8");
      expect(source, op.serviceMethod).toContain(`operation: "${op.operationKey}"`);
    }
  });

  it("★ every `serviceMethod` exists, in a file this test knows how to find", () => {
    for (const op of ORG_LOCK_REQUIRED_OPERATIONS) {
      if (PENDING_METHODS.has(op.serviceMethod)) continue;
      const [service, method] = op.serviceMethod.split(".");
      const file = SERVICE_FILES[service];
      expect(
        file,
        `no file mapped for ${service} — add it here rather than dropping the check`,
      ).toBeDefined();
      const path = join(SRC, file);
      expect(existsSync(path), `${file} does not exist`).toBe(true);
      const source = readFileSync(path, "utf8");
      // `async updateRole(` / `private async accept(` — the declaration, not a
      // mention in a comment.
      expect(
        new RegExp(`\\b(async\\s+)?${method}\\s*\\(`).test(source),
        `${op.serviceMethod} is listed as taking the org lock, but ${file} defines no such method`,
      ).toBe(true);
    }
  });

  it("★ every listed service opens its transactions through runInOrgLockTransaction", () => {
    // The anchor helper is what issues `SET LOCAL lock_timeout` and takes the
    // row lock. A service that reached for a bare `$transaction` instead would
    // be doing the write with no lock at all. (A service whose every row is
    // still PENDING has no transaction to open yet.)
    const built = new Set(
      ORG_LOCK_REQUIRED_OPERATIONS.filter((op) => !PENDING_METHODS.has(op.serviceMethod)).map(
        (op) => SERVICE_FILES[op.serviceMethod.split(".")[0]!]!,
      ),
    );
    for (const file of built) {
      const source = readFileSync(join(SRC, file), "utf8");
      expect(source, `${file} never calls runInOrgLockTransaction`).toContain(
        "runInOrgLockTransaction",
      );
    }
  });

  it("★ no listed service opens a bare `$transaction` — that is the shape with no lock", () => {
    // The failure mode is not "forgot to write a transaction", it is "wrote one
    // without the anchor". `this.prisma.$transaction(` in one of these files is
    // exactly that shape, and it is what the reviewer saw in the working tree
    // during the review round.
    const offenders: string[] = [];
    for (const file of new Set(Object.values(SERVICE_FILES))) {
      const source = readFileSync(join(SRC, file), "utf8");
      const code = source
        .split("\n")
        .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
        .join("\n");
      if (/\.\$transaction\s*\(/.test(code)) offenders.push(file);
    }
    expect(
      offenders,
      "a membership/invitation write must go through `runInOrgLockTransaction`, " +
        "which anchors the org row lock and sets `lock_timeout`. A bare `$transaction` " +
        "is a write with no lock — the concurrency hole architecture §5.1 is about.",
    ).toEqual([]);
  });

  it("SELF-CHECK: the method matcher would notice a missing definition", () => {
    const method = "definitelyNotAMethodName";
    const source = readFileSync(join(SRC, "orgs/members.service.ts"), "utf8");
    expect(new RegExp(`\\b(async\\s+)?${method}\\s*\\(`).test(source)).toBe(false);
    expect(new RegExp(`\\b(async\\s+)?revoke\\s*\\(`).test(source)).toBe(true);
  });
});

// G3-11 (every membership write that grants a role sits in a method of this
// list) lives in test/static-gates/g3-11-membership-write-under-lock.test.ts:
// it needs the shared static-gate scanner, which `src/` tests cannot import
// (tsconfig rootDir).
