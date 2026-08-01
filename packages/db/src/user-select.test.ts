// F-002 · T-002-02 — U-DB-11 ★ (security review NEW-8 + C-4).
//
// `USER_SELECT` is the ONLY way a feature module may touch `User`. It exists
// because two findings cannot be closed by discipline or grep:
//   C-4  — `include: { user: true }` + a spread mapper puts `passwordHash` on
//          the wire.
//   NEW-8 — `membership.findMany({ select: { user: { select: { memberships } } } })`
//          starts at an org-scoped model, walks THROUGH org-agnostic `User`, and
//          comes back down into other orgs' `Membership` rows. `withOrgScope`
//          cannot see nested reads at all (architecture §2.2, C-3).
//
// So the shape is frozen and asserted against the REAL datamodel: adding a
// relation to `User` in schema.prisma and sneaking it into this constant is red
// here, regardless of what any grep gate does. Per test-plan I-35(c) this is one
// of three required layers (U-DB-11 + G-02 + I-09ช) — not a substitute for them.

import { describe, expect, it } from "vitest";
import { Prisma } from "./generated/client";
import { USER_SELECT } from "./user-select";

const userModel = Prisma.dmmf.datamodel.models.find((m) => m.name === "User");

describe("U-DB-11 · USER_SELECT is a frozen, relation-free projection of User", () => {
  it("(ค) is exactly { id, email, createdAt }", () => {
    // Widening this is a deliberate act that has to be argued for in a PR:
    // every field here reaches the wire on every endpoint that shows a member.
    expect(USER_SELECT).toEqual({ id: true, email: true, createdAt: true });
    expect(Object.keys(USER_SELECT).sort()).toEqual(["createdAt", "email", "id"]);
  });

  it("(ก) is frozen, at every level, and mutation throws in strict mode", () => {
    expect(Object.isFrozen(USER_SELECT)).toBe(true);
    for (const [key, value] of Object.entries(USER_SELECT)) {
      if (value !== null && typeof value === "object") {
        expect(Object.isFrozen(value), `${key} is a mutable nested value`).toBe(true);
      }
    }
    // ESM modules are strict mode: assignment to a frozen object throws.
    expect(() => {
      (USER_SELECT as Record<string, unknown>).memberships = true;
    }).toThrow(TypeError);
    expect(() => {
      delete (USER_SELECT as Record<string, unknown>).email;
    }).toThrow(TypeError);
    expect((USER_SELECT as Record<string, unknown>).memberships).toBeUndefined();
  });

  it("(ข) shares no key with any RELATION field of User (read from the real DMMF)", () => {
    expect(userModel, "User model missing from the datamodel").toBeDefined();
    const relationFields = userModel!.fields.filter((f) => f.kind === "object").map((f) => f.name);
    // Guard the guard: if this ever becomes empty the assertion below is vacuous.
    expect(relationFields.length).toBeGreaterThan(0);
    expect(relationFields).toEqual(expect.arrayContaining(["memberships", "refreshTokens"]));

    const overlap = Object.keys(USER_SELECT).filter((k) => relationFields.includes(k));
    expect(overlap, `USER_SELECT exposes relation(s): ${overlap.join(", ")}`).toEqual([]);
  });

  it("(ง) never contains passwordHash — nor any other unlisted scalar of User (C-4)", () => {
    expect((USER_SELECT as Record<string, unknown>).passwordHash).toBeUndefined();

    const scalars = userModel!.fields.filter((f) => f.kind !== "object").map((f) => f.name);
    const exposed = Object.keys(USER_SELECT);
    // Every key is a real column (typos would silently select nothing) …
    expect(scalars).toEqual(expect.arrayContaining(exposed));
    // … and the sensitive ones are provably absent.
    for (const secret of ["passwordHash", "verified", "updatedAt"]) {
      expect(exposed).not.toContain(secret);
    }
  });
});
