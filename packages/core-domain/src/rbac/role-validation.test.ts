// F-003 · T-003-B04 — U-RB-06 (validateRoleCapabilities) · U-RB-07
// (validateRoleName) · U-RB-08 (reservedRoleNames). test-plan §3 ·
// architecture §1 · data-model §2.1 · api-spec §2/§5 · AC-3.4/3.5/3.6.
import { describe, it, expect } from "vitest";
import { dirname, join } from "node:path";
import ts from "typescript";
import {
  normalizeRoleName,
  reservedRoleNames,
  roleNameComparisonKey,
  ROLE_NAME_FORBIDDEN_CHARACTER,
  ROLE_NAME_MAX_LENGTH,
  SYSTEM_ROLE_LABELS,
  validateRoleCapabilities,
  validateRoleName,
  type ValidatableRegistry,
} from "./role-validation";
import { CAPABILITY_REGISTRY } from "./registry";

const FIXTURE: ValidatableRegistry = [
  { key: "full_access", implies: [], tier: "all", selectable: false },
  { key: "manage_members", implies: [], tier: "all", selectable: true },
  { key: "manage_widgets", implies: ["view_widgets"], tier: "all", selectable: true },
  { key: "view_widgets", implies: [], tier: "all", selectable: true },
  { key: "premium_thing", implies: [], tier: "full", selectable: true },
  // Breaks registry invariants on purpose: proves `selectable=false` is refused
  // on its own, not only because the key happens to be `full_access`.
  { key: "locked_thing", implies: [], tier: "all", selectable: false },
];

// ── U-RB-06 ────────────────────────────────────────────────────────────────

describe("U-RB-06 validateRoleCapabilities — fixed order ROLE_EMPTY → FULL_ACCESS_RESERVED → UNKNOWN_CAPABILITY", () => {
  it("[] → ROLE_EMPTY", () => {
    expect(validateRoleCapabilities([])).toEqual({ ok: false, code: "ROLE_EMPTY" });
  });

  it("full_access → FULL_ACCESS_RESERVED, even alongside junk keys (checked before UNKNOWN_CAPABILITY)", () => {
    expect(validateRoleCapabilities(["full_access"])).toEqual({
      ok: false,
      code: "FULL_ACCESS_RESERVED",
    });
    expect(validateRoleCapabilities(["bogus", "full_access", "manage_members"])).toEqual({
      ok: false,
      code: "FULL_ACCESS_RESERVED",
    });
  });

  it("a key the registry does not know → UNKNOWN_CAPABILITY with every offending key (deduped, sorted)", () => {
    expect(validateRoleCapabilities(["zeta", "manage_members", "bogus", "zeta", ""])).toEqual({
      ok: false,
      code: "UNKNOWN_CAPABILITY",
      capabilities: ["", "bogus", "zeta"],
    });
  });

  it("tier `full` (access_accounting) → UNKNOWN_CAPABILITY until F-007 (AC-7.4)", () => {
    expect(CAPABILITY_REGISTRY.find((c) => c.key === "access_accounting")?.tier).toBe("full");
    expect(validateRoleCapabilities(["manage_members", "access_accounting"])).toEqual({
      ok: false,
      code: "UNKNOWN_CAPABILITY",
      capabilities: ["access_accounting"],
    });
    expect(validateRoleCapabilities(["premium_thing"], FIXTURE)).toMatchObject({
      code: "UNKNOWN_CAPABILITY",
      capabilities: ["premium_thing"],
    });
  });

  it("selectable=false (other than full_access) → UNKNOWN_CAPABILITY", () => {
    expect(validateRoleCapabilities(["locked_thing", "manage_members"], FIXTURE)).toEqual({
      ok: false,
      code: "UNKNOWN_CAPABILITY",
      capabilities: ["locked_thing"],
    });
  });

  it("an upcoming key passes (AC-7.5) and the result is canonical + frozen", () => {
    expect(CAPABILITY_REGISTRY.find((c) => c.key === "manage_billing")?.status).toBe("upcoming");
    const r = validateRoleCapabilities(["manage_billing", "manage_members", "manage_billing"]);
    expect(r).toEqual({ ok: true, capabilities: ["manage_billing", "manage_members"] });
    if (!r.ok) throw new Error("expected ok");
    expect(Object.isFrozen(r.capabilities)).toBe(true);
  });

  it("canonicalizes with B03's function: implied view_X is dropped, lone view_X kept", () => {
    expect(
      validateRoleCapabilities(["view_widgets", "manage_widgets", "manage_members"], FIXTURE),
    ).toEqual({ ok: true, capabilities: ["manage_members", "manage_widgets"] });
    expect(validateRoleCapabilities(["view_widgets"], FIXTURE)).toEqual({
      ok: true,
      capabilities: ["view_widgets"],
    });
  });

  it("every selectable tier-`all` key of the shipped registry is accepted", () => {
    const grantable = CAPABILITY_REGISTRY.filter((c) => c.selectable && c.tier === "all").map(
      (c) => c.key,
    );
    expect(grantable.length).toBeGreaterThan(0);
    for (const key of grantable) {
      expect(validateRoleCapabilities([key]), key).toEqual({ ok: true, capabilities: [key] });
    }
  });
});

// ── U-RB-06 type level: ValidatedCapabilities has ONE constructor ───────────
// Test files are excluded from `tsc -p` in this package, so a bare
// `@ts-expect-error` here would never be checked. Compile snippets with the
// real compiler instead; the control snippet proves the harness can pass.

const HERE = dirname(__filename);

function typeErrors(body: string): string[] {
  const file = join(HERE, "__brand_probe__.ts");
  const source =
    `import { validateRoleCapabilities, type ValidatedCapabilities } from "./role-validation";\n` +
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
    name === file ? ts.createSourceFile(name, source, lang) : getSourceFile(name, lang, ...rest);
  const fileExists = host.fileExists.bind(host);
  host.fileExists = (name) => name === file || fileExists(name);
  const program = ts.createProgram([file], options, host);
  return ts
    .getPreEmitDiagnostics(program)
    .map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
}

describe("U-RB-06 ValidatedCapabilities is a brand only validateRoleCapabilities can mint", () => {
  it("control: the value from validateRoleCapabilities is assignable (0 errors)", () => {
    expect(
      typeErrors(
        `const r = validateRoleCapabilities(["manage_members"]);\n` +
          `if (r.ok) { const v: ValidatedCapabilities = r.capabilities; void v; }\n`,
      ),
    ).toEqual([]);
  }, 30_000);

  it("a hand-built array literal is NOT a ValidatedCapabilities", () => {
    const errors = typeErrors(`const v: ValidatedCapabilities = ["manage_members"]; void v;\n`);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join("\n")).toMatch(/ValidatedCapabilities|not assignable/);
  }, 30_000);

  it("a plain string[] is NOT a ValidatedCapabilities", () => {
    const errors = typeErrors(
      `const s: string[] = ["manage_members"];\nconst v: ValidatedCapabilities = s; void v;\n`,
    );
    expect(errors.length).toBeGreaterThan(0);
  }, 30_000);
});

// ── U-RB-07 ────────────────────────────────────────────────────────────────

const NO_RESERVED = { liveSystemRoles: [], selfKey: null } as const;
const nameOf = (raw: string) => validateRoleName(raw, NO_RESERVED);
const cp = (s: string) => [...s].length;

describe("U-RB-07 normalizeRoleName — NFC → trim → collapse \\s+ to one U+0020", () => {
  it("trims and collapses tab / newline / NBSP / U+FEFF runs", () => {
    expect(normalizeRoleName("  แพ็ค\t\n ของ\u00A0\u00A0หน้าร้าน  ")).toBe("แพ็ค ของ หน้าร้าน");
    expect(normalizeRoleName("Owner\uFEFF")).toBe("Owner");
  });

  it("composes to NFC", () => {
    expect(normalizeRoleName("Cafe\u0301")).toBe("Caf\u00E9");
    expect(cp(normalizeRoleName("Cafe\u0301"))).toBe(4);
  });
});

describe("U-RB-07 validateRoleName — Cc/Cf refused AFTER normalize, 1–50 code points", () => {
  it("returns the normalized name", () => {
    expect(nameOf("  ผู้ช่วย   แพ็คของ ")).toEqual({ ok: true, name: "ผู้ช่วย แพ็คของ" });
  });

  it("dm §2.1 fixtures: zero-width space / RLO / word joiner → VALIDATION_FAILED", () => {
    for (const raw of ["เจ้า\u200Bของร้าน", "\u202Eนาหร", "พนัก\u2060งาน"]) {
      expect(nameOf(raw), JSON.stringify(raw)).toEqual({
        ok: false,
        code: "VALIDATION_FAILED",
        reason: "forbidden_character",
      });
    }
  });

  it('dm §2.1 fixture: "Owner\\uFEFF" is collapsed to "Owner", not refused', () => {
    expect(nameOf("Owner\uFEFF")).toEqual({ ok: true, name: "Owner" });
  });

  it("Cc not matched by \\s (U+0000, U+0085 NEL) and Cf (soft hyphen, LRM) are refused", () => {
    for (const raw of ["a\u0000b", "a\u0085b", "a\u00ADb", "a\u200Eb", "a\u{E0001}b"]) {
      expect(nameOf(raw), JSON.stringify(raw)).toMatchObject({ reason: "forbidden_character" });
    }
  });

  it("every Cc/Cf code point of this runtime is refused unless \\s collapses it (non-vacuous)", () => {
    const ccCf = /^[\p{Cc}\p{Cf}]$/u;
    const space = /^\s$/u;
    let refused = 0;
    let collapsed = 0;
    for (let c = 0; c <= 0x10ffff; c++) {
      if (c >= 0xd800 && c <= 0xdfff) continue;
      const ch = String.fromCodePoint(c);
      if (!ccCf.test(ch)) continue;
      const r = nameOf(`a${ch}b`);
      if (space.test(ch)) {
        expect(r, c.toString(16)).toEqual({ ok: true, name: "a b" });
        collapsed++;
      } else {
        expect(r, c.toString(16)).toMatchObject({ ok: false, reason: "forbidden_character" });
        refused++;
      }
    }
    expect(refused).toBeGreaterThan(150);
    expect(collapsed).toBeGreaterThan(0);
  });

  // security review of B04 (Medium): invisible characters outside Cc/Cf let
  // "เจ้าของร้าน" + filler dodge the reserved check. Built with fromCodePoint so
  // no tool can turn the escape into a literal nobody can see in review.
  it("review probes: Hangul fillers, braille blank, CGJ, variation selectors, private use, lone surrogate → refused", () => {
    const probes = [
      0x3164, 0x115f, 0x1160, 0xffa0, 0x2800, 0x034f, 0xfe0f, 0xe0100, 0xe000, 0xf0000, 0x10fffd,
    ];
    for (const c of probes) {
      const raw = `เจ้าของร้าน${String.fromCodePoint(c)}`;
      expect(nameOf(raw), c.toString(16)).toEqual({
        ok: false,
        code: "VALIDATION_FAILED",
        reason: "forbidden_character",
      });
    }
    // lone surrogates (Cs): String.fromCharCode, not fromCodePoint
    for (const unit of [0xd800, 0xdbff, 0xdc00, 0xdfff]) {
      expect(nameOf(`ab${String.fromCharCode(unit)}`), unit.toString(16)).toMatchObject({
        reason: "forbidden_character",
      });
    }
  });

  it("ROLE_NAME_FORBIDDEN_CHARACTER = Cc ∪ Cf ∪ Default_Ignorable ∪ Co ∪ Cs ∪ {115F,1160,3164,FFA0,2800} — sweep, non-vacuous", () => {
    const expected = /^[\p{Cc}\p{Cf}\p{Default_Ignorable_Code_Point}\p{Co}]$/u;
    const extra = new Set([0x115f, 0x1160, 0x3164, 0xffa0, 0x2800]);
    const space = /^\s$/u;
    let members = 0;
    let refused = 0;
    let di = 0;
    let co = 0;
    const collapsed: number[] = [];
    for (let c = 0; c <= 0x10ffff; c++) {
      if (c >= 0xd800 && c <= 0xdfff) continue;
      const ch = String.fromCodePoint(c);
      const inSet = expected.test(ch) || extra.has(c);
      // the exported constant is exactly the set: no more, no less
      expect(ROLE_NAME_FORBIDDEN_CHARACTER.test(ch), c.toString(16)).toBe(inSet);
      if (!inSet) continue;
      members++;
      if (/^\p{Default_Ignorable_Code_Point}$/u.test(ch)) di++;
      if (/^\p{Co}$/u.test(ch)) co++;
      if (space.test(ch)) {
        collapsed.push(c); // collapsed by normalize before the check runs
        continue;
      }
      expect(nameOf(`a${ch}b`), c.toString(16)).toMatchObject({
        ok: false,
        reason: "forbidden_character",
      });
      refused++;
    }
    for (let u = 0xd800; u <= 0xdfff; u++) {
      expect(ROLE_NAME_FORBIDDEN_CHARACTER.test(String.fromCharCode(u)), u.toString(16)).toBe(true);
    }
    expect(di).toBeGreaterThan(4000);
    expect(co).toBeGreaterThan(130_000);
    // only ASCII tab..CR and U+FEFF escape by collapsing — every other member is refused
    expect(collapsed).toEqual([0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0xfeff]);
    expect(refused).toBe(members - collapsed.length);
  });

  it("empty after normalize → VALIDATION_FAILED empty", () => {
    for (const raw of ["", "   ", "\t\n", "\uFEFF"]) {
      expect(nameOf(raw), JSON.stringify(raw)).toEqual({
        ok: false,
        code: "VALIDATION_FAILED",
        reason: "empty",
      });
    }
  });

  it("length counts code points: 50 passes / 51 fails (ASCII, astral emoji, Thai marks)", () => {
    expect(ROLE_NAME_MAX_LENGTH).toBe(50);
    const tooLong = { ok: false, code: "VALIDATION_FAILED", reason: "too_long" };

    expect(nameOf("a".repeat(50))).toMatchObject({ ok: true });
    expect(nameOf("a".repeat(51))).toEqual(tooLong);

    // astral emoji = 1 code point each (2 UTF-16 units)
    const emoji50 = "\u{1F600}".repeat(50);
    expect(emoji50.length).toBe(100);
    expect(nameOf(emoji50)).toMatchObject({ ok: true });
    expect(nameOf(`${emoji50}\u{1F600}`)).toEqual(tooLong);

    // Thai with stacked vowel + tone mark: "กี่" = 3 code points, 1 grapheme
    const thai50 = "กี่".repeat(16) + "กี";
    expect(cp(thai50)).toBe(50);
    expect(nameOf(thai50)).toMatchObject({ ok: true, name: thai50 });
    const thai51 = "กี่".repeat(17); // 17 graphemes, 51 code points
    expect(cp(thai51)).toBe(51);
    expect(nameOf(thai51)).toEqual(tooLong);

    // surrounding whitespace is trimmed before counting
    expect(nameOf(`  ${"a".repeat(50)}  `)).toMatchObject({ ok: true });
  });
});

// ── U-RB-08 ────────────────────────────────────────────────────────────────

const ADMIN = { key: "admin", nameCustomized: false } as const;
const STAFF = { key: "staff", nameCustomized: false } as const;
const OWNER = { key: "owner", nameCustomized: false } as const;

describe("U-RB-08 reservedRoleNames — AC-3.5", () => {
  it("SYSTEM_ROLE_LABELS are the ux translations", () => {
    expect(SYSTEM_ROLE_LABELS).toEqual({
      owner: "เจ้าของร้าน",
      admin: "ผู้ดูแล",
      staff: "พนักงาน",
    });
    expect(Object.isFrozen(SYSTEM_ROLE_LABELS)).toBe(true);
  });

  it("เจ้าของร้าน is reserved always — even with no live system rows", () => {
    expect([...reservedRoleNames({ liveSystemRoles: [], selfKey: null })]).toEqual(["เจ้าของร้าน"]);
  });

  it("ผู้ดูแล / พนักงาน only while that role is live and nameCustomized=false", () => {
    expect(
      [...reservedRoleNames({ liveSystemRoles: [OWNER, ADMIN, STAFF], selfKey: null })].sort(),
    ).toEqual(["ผู้ดูแล", "พนักงาน", "เจ้าของร้าน"].sort());
    // admin renamed by the shop → its translation is free
    expect(
      [
        ...reservedRoleNames({
          liveSystemRoles: [OWNER, { key: "admin", nameCustomized: true }, STAFF],
          selfKey: null,
        }),
      ].sort(),
    ).toEqual(["พนักงาน", "เจ้าของร้าน"].sort());
    // staff deleted (not live → not passed in) → its translation is free
    expect(
      [...reservedRoleNames({ liveSystemRoles: [OWNER, ADMIN], selfKey: null })].sort(),
    ).toEqual(["ผู้ดูแล", "เจ้าของร้าน"].sort());
  });

  it("the role's own translation is exempt (Admin may be renamed back to ผู้ดูแล)", () => {
    const set = reservedRoleNames({ liveSystemRoles: [OWNER, ADMIN, STAFF], selfKey: "admin" });
    expect(set.has("ผู้ดูแล")).toBe(false);
    expect(set.has("พนักงาน")).toBe(true);
    expect(set.has("เจ้าของร้าน")).toBe(true);
  });

  it('selfKey "owner" does NOT exempt เจ้าของร้าน (fail-closed — Owner is ROLE_LOCKED anyway)', () => {
    const set = reservedRoleNames({ liveSystemRoles: [OWNER, ADMIN, STAFF], selfKey: "owner" });
    expect(set.has("เจ้าของร้าน")).toBe(true);
    expect(validateRoleName("เจ้าของร้าน", { liveSystemRoles: [OWNER], selfKey: "owner" })).toEqual(
      { ok: false, code: "ROLE_NAME_TAKEN", reason: "reserved" },
    );
  });

  it("rows whose key has no label (custom, key=null) reserve nothing", () => {
    expect([
      ...reservedRoleNames({
        liveSystemRoles: [{ key: null, nameCustomized: false }],
        selfKey: null,
      }),
    ]).toEqual(["เจ้าของร้าน"]);
  });
});

describe("U-RB-08 validateRoleName vs reserved — exact after normalize + lower", () => {
  const ctx = { liveSystemRoles: [OWNER, ADMIN, STAFF], selfKey: null };
  const taken = { ok: false, code: "ROLE_NAME_TAKEN", reason: "reserved" };

  it("exact label, with surrounding / inner whitespace variation → ROLE_NAME_TAKEN", () => {
    expect(validateRoleName("เจ้าของร้าน", ctx)).toEqual(taken);
    expect(validateRoleName("  ผู้ดูแล\t", ctx)).toEqual(taken);
    expect(validateRoleName("พนักงาน", ctx)).toEqual(taken);
  });

  it("NFC-equivalent spelling collides; look-alikes do NOT (ux: no fuzzy matching)", () => {
    const label = "Caf\u00E9";
    const custom = { ...ctx, labels: { owner: label, admin: "x", staff: "y" } };
    expect(validateRoleName("Cafe\u0301", custom)).toEqual(taken);
    expect(validateRoleName("เจ้าของร้าน2", ctx)).toMatchObject({ ok: true });
    expect(validateRoleName("เจ้าของ ร้าน", ctx)).toMatchObject({ ok: true });
  });

  it("comparison is case-insensitive (lower)", () => {
    const custom = { ...ctx, labels: { owner: "Owner", admin: "Admin", staff: "Staff" } };
    expect(validateRoleName("OWNER", custom)).toEqual(taken);
    expect(validateRoleName(" aDmIn ", custom)).toEqual(taken);
    expect(roleNameComparisonKey("  ADMIN\t")).toBe("admin");
  });

  it("Cc/Cf is refused before the reserved check (invisible 'เจ้าของร้าน' never reaches it)", () => {
    expect(validateRoleName("เจ้า\u200Bของร้าน", ctx)).toMatchObject({
      code: "VALIDATION_FAILED",
      reason: "forbidden_character",
    });
  });

  it("the own-key exemption flows through validateRoleName", () => {
    expect(validateRoleName("ผู้ดูแล", { ...ctx, selfKey: "admin" })).toEqual({
      ok: true,
      name: "ผู้ดูแล",
    });
  });
});
