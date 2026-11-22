// F-003 · T-003-B23 ★ — G3-03 (G-15 (ค) replacement · test-plan §5.2 · architecture §13.2 (ค)).
//
// G-15 (`role-capability-write-tripwire.test.ts`, F-002 NEW-10) was a TRIPWIRE:
// it went red the day a write path to `Role.capabilities` opened, so F-003
// could not merge without the privilege-superset rule. That rule now exists
// (`decideRoleWrite` ⊆ — U-RB-12, `decideMemberAuthority` — U-RB-10) and the
// write path is B23's `RolesService.create`, so the tripwire CHANGES MEANING
// instead of being deleted (R3-02):
//
//   ROLE_WRITE / RAW_ROLE_WRITE   unchanged — a Role write is allowed only in a
//                                 file on the reasoned allowlist below.
//   CAPABILITIES_FROM_INPUT       was "never take caps from input"; is now
//                                 "a caps value from input must go through
//                                 `validateRoleCapabilities` in the same file"
//                                 (the same call path, as far as a static scan
//                                 can see — U-API3-01 + I3-04 prove the runtime).
//
// Scope is `apps/api/src` (G-15's scope): the DB package's backfill is a
// migration helper with its own gate (G3-10), not a request path.
//
// ⚠️ Heuristic, said plainly: a value renamed before it reaches the write
// (`const c = dto.capabilities; … capabilities: c`) is not seen by leg 3. The
// behavioural guarantee is the brand (G3-02): the writer only accepts
// `ValidatedCapabilities`, so an unvalidated list does not compile.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { REPO, fixture, productionFiles, readCode } from "./scan";

/**
 * The files allowed to write `Role` rows, each with the rule that makes it safe.
 * A new entry must be able to say the same kind of sentence.
 */
const ALLOWED_ROLE_WRITE_FILES: ReadonlyMap<string, string> = new Map([
  [
    "apps/api/src/orgs/roles.service.ts",
    "POST/PATCH/DELETE role — caps go through validateRoleCapabilities (ValidatedCapabilities brand, " +
      "G3-02) and the write through decideRoleWrite (⊆ actor — U-RB-12) + assertOwnerRemains, " +
      "under the org lock (G3-11), behind @RoleWrite() (G3-01)",
  ],
  [
    "apps/api/src/orgs/system/org-provisioning.service.ts",
    "creates the three system roles from the frozen SYSTEM_ROLE_BLUEPRINT — no caller chooses " +
      "the capabilities",
  ],
]);

/** Prisma writes against the `role` model (unchanged from G-15). */
const ROLE_WRITE =
  /\brole\s*\.\s*(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/;
/** Raw SQL that could reach the same column without going through Prisma. */
const RAW_ROLE_WRITE = /(INSERT\s+INTO|UPDATE)\s+"?Role"?/i;
/** A request-shaped capability list — captures the expression (`dto.capabilities`). */
const CAPABILITIES_FROM_INPUT =
  /capabilities\s*[:=]\s*(?!SYSTEM_ROLE_BLUEPRINT|blueprint)((?:dto|body|input|req|request|params|payload)\b(?:\.[\w$]+)*)/g;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Input-shaped caps expressions in `code` that no `validateRoleCapabilities(<expr>` call in the same file covers. */
export function unvalidatedInputCapabilities(code: string): string[] {
  const out: string[] = [];
  for (const m of code.matchAll(CAPABILITIES_FROM_INPUT)) {
    const expr = m[1]!;
    const validated = new RegExp(`\\bvalidateRoleCapabilities\\s*\\(\\s*${escape(expr)}\\b`).test(
      code,
    );
    if (!validated) out.push(expr);
  }
  return out;
}

const writesRole = (code: string) => ROLE_WRITE.test(code) || RAW_ROLE_WRITE.test(code);

describe("G3-03 · the Role write surface (G-15 replaced — NEW-10 now has a real rule)", () => {
  const files = productionFiles().filter((f) => f.startsWith("apps/api/src/"));

  it("non-vacuity: the scan walked the real tree and sees both allowed writers write", () => {
    expect(files.length).toBeGreaterThan(20);
    for (const file of ALLOWED_ROLE_WRITE_FILES.keys()) expect(files).toContain(file);
    expect(files.filter((f) => writesRole(readCode(f))).sort()).toEqual(
      [...ALLOWED_ROLE_WRITE_FILES.keys()].sort(),
    );
  });

  it("★ no file outside the allowlist writes a Role row", () => {
    const offenders = files.filter(
      (f) => writesRole(readCode(f)) && !ALLOWED_ROLE_WRITE_FILES.has(f),
    );
    expect(
      offenders,
      "a new Role write path: it must decide with decideRoleWrite + assertOwnerRemains under the " +
        "org lock and carry @RoleWrite() — then add it here WITH the sentence that makes it safe",
    ).toEqual([]);
  });

  it("★ a capabilities value taken from input is validated in the same file (CAPABILITIES_FROM_INPUT, new meaning)", () => {
    const offenders = files
      .map((f) => ({ f, exprs: unvalidatedInputCapabilities(readCode(f)) }))
      .filter((o) => o.exprs.length > 0)
      .map((o) => `${o.f}: ${o.exprs.join(", ")}`);
    expect(offenders).toEqual([]);
  });

  it("the role writer really validates (non-vacuity of the meaning change)", () => {
    const code = readCode("apps/api/src/orgs/roles.service.ts");
    expect(code).toMatch(/\bvalidateRoleCapabilities\s*\(/);
    expect(code).toMatch(/\bassertOwnerRemainsInTx\s*\(/);
    expect(code).toMatch(/\bthis\.decide\s*\(/);
  });

  it("provisioning still takes its capabilities from the frozen blueprint (its allowlist reason)", () => {
    const code = readCode("apps/api/src/orgs/system/org-provisioning.service.ts");
    expect(code).toContain("SYSTEM_ROLE_BLUEPRINT");
    expect(unvalidatedInputCapabilities(code)).toEqual([]);
    expect([...code.matchAll(CAPABILITIES_FROM_INPUT)]).toEqual([]);
  });

  it("the allowlist has no stale entries, and every entry carries a reason", () => {
    for (const [file, reason] of ALLOWED_ROLE_WRITE_FILES) {
      expect(existsSync(join(REPO, file)), `${file} is allowlisted but does not exist`).toBe(true);
      expect(writesRole(readCode(file)), `${file} no longer writes Role — remove it`).toBe(true);
      expect(reason.length, `${file}: a one-word reason is a blank`).toBeGreaterThan(40);
    }
  });

  it("SELF-CHECK (G-15's 5 + 2 + 4 shapes are still red)", () => {
    for (const snippet of [
      "await this.prisma.role.create({ data: { name, capabilities } });",
      "await tx.role.update({ where: { id }, data: { capabilities } });",
      "await this.prisma.role.updateMany({ where, data });",
      "await this.prisma.role.upsert({ where, create, update });",
      "await this.prisma.role.delete({ where: { id } });",
    ]) {
      expect(ROLE_WRITE.test(snippet), `NOT FLAGGED: ${snippet}`).toBe(true);
    }
    expect(RAW_ROLE_WRITE.test('UPDATE "Role" SET capabilities = $1')).toBe(true);
    expect(RAW_ROLE_WRITE.test('INSERT INTO "Role" (id) VALUES ($1)')).toBe(true);
    for (const snippet of [
      "capabilities: dto.capabilities",
      "capabilities = body.capabilities",
      "capabilities: input.capabilities",
      "capabilities: req.body.capabilities",
    ]) {
      expect(unvalidatedInputCapabilities(snippet), `NOT FLAGGED: ${snippet}`).toHaveLength(1);
    }
    // …and clears what is legitimate.
    expect(ROLE_WRITE.test("await this.prisma.role.findMany({ where })")).toBe(false);
    expect(ROLE_WRITE.test("await this.prisma.membership.update({ where, data })")).toBe(false);
    expect(unvalidatedInputCapabilities("capabilities: blueprint.capabilities")).toEqual([]);
    expect(
      unvalidatedInputCapabilities(
        "const v = validateRoleCapabilities(input.capabilities); x = { capabilities: input.capabilities };",
      ),
      "validated in the same file ⇒ allowed (the new meaning)",
    ).toEqual([]);
  });

  it("FIXTURE: a new service writing Role with caps straight off the body is red on BOTH legs", () => {
    const code = fixture("g3-03-new-role-writer.fixture");
    expect(writesRole(code)).toBe(true);
    expect(ALLOWED_ROLE_WRITE_FILES.has("apps/api/src/orgs/role-templates.service.ts")).toBe(false);
    expect(unvalidatedInputCapabilities(code)).toEqual(["dto.capabilities"]);
  });
});
