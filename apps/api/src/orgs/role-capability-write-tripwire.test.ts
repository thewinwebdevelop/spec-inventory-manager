// F-002 · T-002-Q4 — G-15, the NEW-10 tripwire (test-plan §9.1, §17.11(ฉ)).
//
// NEW-10: `canAssignRole` does not stop a privilege SUPERSET. An Admin may not
// grant Owner, because Owner is recognised by `full_access` — but nothing stops
// an Admin from granting a role that happens to carry MORE capabilities than
// their own, as long as it is not the one flagged capability.
//
// §9.1 marks NEW-10 untestable in F-002, and that is correct: the three system
// roles are fixed, there is no role CRUD, so there is no surface to fire at.
// A test asserting "an Admin cannot escalate through a custom role" would be
// asserting something about code that does not exist — it would pass forever
// and prove nothing, which is the exact shape of gate this project keeps
// finding in its own reviews.
//
// So this is a TRIPWIRE, not a promise. It fails the moment somebody opens a
// write path to `Role.capabilities` — which is F-003's whole job — and its
// failure message is the requirement: the privilege-superset rule and its test
// come WITH that path, not after it. That turns "F-003 should handle this" into
// "F-003 cannot merge without handling this".
//
// ⚠️ What this does NOT prove: that today's assignment rules are complete. It
// proves only that the surface NEW-10 needs is still closed.
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const SRC = join(process.cwd(), "src");

/**
 * The ONE place allowed to write `Role` rows today, with the reason.
 *
 * Provisioning writes the three system roles from `SYSTEM_ROLE_BLUEPRINT`, a
 * frozen constant in `core-domain` — it does not take capabilities from a
 * request, so no caller can choose them. That is what makes it safe, and it is
 * also what a new entry here has to be able to say.
 */
const ALLOWED_ROLE_WRITE_FILES: readonly string[] = Object.freeze([
  "orgs/system/org-provisioning.service.ts",
]);

/** Prisma writes against the `role` model. */
const ROLE_WRITE = /\brole\s*\.\s*(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/;

/** Raw SQL that could reach the same column without going through Prisma. */
const RAW_ROLE_WRITE = /(INSERT\s+INTO|UPDATE)\s+"?Role"?/i;

/**
 * A request-shaped capability list — the actual danger. `capabilities` arriving
 * from a DTO, a body or a parameter is how a caller starts choosing its own
 * privileges.
 */
const CAPABILITIES_FROM_INPUT =
  /capabilities\s*[:=]\s*(?!SYSTEM_ROLE_BLUEPRINT|blueprint)(dto|body|input|req|request|params|payload)\b/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
      continue;
    }
    if (full.endsWith(".ts")) out.push(full);
  }
  return out;
}

/** Strip comments so a file EXPLAINING the rule is not reported as breaking it. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

const TRIPWIRE_MESSAGE =
  "A write path to Role/Role.capabilities is opening. NEW-10 (test-plan §9.1) is " +
  "unclosed: `canAssignRole` refuses to grant `full_access`, but nothing refuses a role " +
  "that carries MORE capabilities than the actor's own. Before this ships, F-003 owes a " +
  "privilege-superset rule in `core-domain` AND its test — then add the file here with a " +
  "note saying which rule protects it.";

describe("G-15 · the Role.capabilities write surface is still closed (NEW-10 tripwire)", () => {
  const files = walk(SRC)
    .map((f) => relative(SRC, f).split(sep).join("/"))
    .filter((f) => !f.endsWith(".test.ts") && !f.endsWith(".int.test.ts"))
    .filter((f) => !f.startsWith("__boundary_fixtures__/"));

  it("the scan walked the real source tree", () => {
    expect(existsSync(SRC), `expected the api source tree at ${SRC}`).toBe(true);
    expect(files.length).toBeGreaterThan(20);
    expect(files).toContain("orgs/system/org-provisioning.service.ts");
  });

  it("★ no file outside the allowlist writes a Role row", () => {
    const offenders = files.filter((file) => {
      const source = code(readFileSync(join(SRC, file), "utf8"));
      return (
        (ROLE_WRITE.test(source) || RAW_ROLE_WRITE.test(source)) &&
        !ALLOWED_ROLE_WRITE_FILES.includes(file)
      );
    });
    expect(offenders, TRIPWIRE_MESSAGE).toEqual([]);
  });

  it("★ no file takes `capabilities` from request input", () => {
    // Narrower and sharper than the rule above: a role write from a frozen
    // blueprint is safe; a role write whose capability list came off the wire
    // is the escalation itself, wherever it lives.
    const offenders = files.filter((file) =>
      CAPABILITIES_FROM_INPUT.test(code(readFileSync(join(SRC, file), "utf8"))),
    );
    expect(offenders, TRIPWIRE_MESSAGE).toEqual([]);
  });

  it("the one allowed writer still takes its capabilities from the frozen blueprint", () => {
    // The allowlist entry is only safe for as long as its REASON holds. If
    // provisioning starts reading capabilities from anywhere else, the entry
    // stops meaning what it says — and an allowlist that outlives its reason is
    // a permission nobody revisits.
    const source = code(readFileSync(join(SRC, ALLOWED_ROLE_WRITE_FILES[0]), "utf8"));
    expect(source, "provisioning no longer builds roles from SYSTEM_ROLE_BLUEPRINT").toContain(
      "SYSTEM_ROLE_BLUEPRINT",
    );
    expect(CAPABILITIES_FROM_INPUT.test(source)).toBe(false);
  });

  it("the allowlist has no stale entries", () => {
    for (const file of ALLOWED_ROLE_WRITE_FILES) {
      expect(existsSync(join(SRC, file)), `${file} is allowlisted but does not exist`).toBe(true);
      expect(
        ROLE_WRITE.test(code(readFileSync(join(SRC, file), "utf8"))),
        `${file} is allowlisted for Role writes but no longer performs one — remove it`,
      ).toBe(true);
    }
  });

  it("SELF-CHECK: the tripwire fires on the shapes F-003 will actually write", () => {
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
      expect(CAPABILITIES_FROM_INPUT.test(snippet), `NOT FLAGGED: ${snippet}`).toBe(true);
    }

    // ── and clears what is legitimate today ──────────────────────────────
    expect(ROLE_WRITE.test("await this.prisma.role.findMany({ where })")).toBe(false);
    expect(ROLE_WRITE.test("await this.prisma.membership.update({ where, data })")).toBe(false);
    expect(CAPABILITIES_FROM_INPUT.test("capabilities: blueprint.capabilities")).toBe(false);
    expect(CAPABILITIES_FROM_INPUT.test("capabilities: [...SYSTEM_ROLE_BLUEPRINT[0].capabilities]")).toBe(
      false,
    );
    // Prose about the rule is not the rule being broken.
    expect(ROLE_WRITE.test(code("// F-003 will add role.update() here"))).toBe(false);
  });
});
