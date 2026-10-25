// F-003 · T-003-QA02 — G-11 (F-002 test-plan §10 / U-CD-10 · F-003 test-plan §5.2 · AC-3.7).
//
// One rule decides whether two addresses are the same person:
// `normalizeEmail` in core-domain. A second, hand-rolled copy (`.trim()` here,
// `.toLowerCase()` there) is how an invitation for "New@Example.com " stops
// matching the account "new@example.com" — or, worse, starts matching one it
// should not. G-11 fails on any case/whitespace normalisation applied to an
// email-named value outside that function.
//
// ⚠️ Heuristic: it follows names containing "email". An address copied into a
// variable called `x` first is not seen — the behavioural half is U-CD-10.
import { describe, it, expect } from "vitest";
import { fixture, fixtureNames, lineOf, productionFiles, readCode, type Violation } from "./scan";

const CANONICAL = "packages/core-domain/src/auth/email.ts";
const NORMALISE = String.raw`\s*\??\.\s*(?:trim|trimStart|trimEnd|toLowerCase|toLocaleLowerCase|toUpperCase|toLocaleUpperCase)\s*\(`;
/** `email.trim()` · `dto.email?.toLowerCase()` · `inviteeEmail.trim()` */
const ON_EMAIL = new RegExp(String.raw`\b[\w$]*email[\w$]*` + NORMALISE, "gi");
/** `String(dto.email).toLowerCase()` · `(dto.email ?? "").trim()` */
const ON_WRAPPED_EMAIL = new RegExp(
  String.raw`\(\s*[\w$.?]*email[\w$]*\s*(?:(?:\?\?|\|\|)\s*(?:""|''|\x60\x60)\s*)?\)` + NORMALISE,
  "gi",
);

/**
 * Known offenders, pinned by file AND exact snippet AND count, so this can
 * only shrink. Each one is a defect routed to its owner, not a permission.
 */
const KNOWN_OFFENDERS: readonly { file: string; snippet: string; owner: string; why: string }[] = [
  // (empty) T-003-B18 removed the last row: `invitations.controller.ts` create()
  // now calls `normalizeEmail(dto.email)` instead of `dto.email.trim()`.
];

function g11(file: string, code: string): Violation[] {
  const out: Violation[] = [];
  for (const re of [ON_EMAIL, ON_WRAPPED_EMAIL]) {
    for (const m of code.matchAll(re)) {
      out.push({
        gate: "G-11",
        rule: "hand-normalised-email",
        file,
        line: lineOf(code, m.index!),
        snippet: m[0],
      });
    }
  }
  return out;
}

const isKnown = (v: Violation) =>
  KNOWN_OFFENDERS.some((k) => k.file === v.file && v.snippet.replace(/\s+/g, "") === k.snippet);
const files = productionFiles();

describe("G-11 · email is normalised only by normalizeEmail", () => {
  it("non-vacuity: the canonical rule exists and the real call sites use it", () => {
    expect(files).toContain(CANONICAL);
    expect(readCode(CANONICAL)).toMatch(
      /export function normalizeEmail\(raw: string\): string \{\s*return raw\.trim\(\)\.toLowerCase\(\);/,
    );
    for (const f of [
      "apps/api/src/auth/auth.service.ts",
      "apps/api/src/auth/auth.controller.ts",
      "apps/api/src/orgs/invitations.service.ts",
      "apps/api/src/orgs/invitations.controller.ts", // B18 — was the last KNOWN_OFFENDER
    ]) {
      expect(readCode(f), `${f} no longer calls normalizeEmail`).toMatch(/\bnormalizeEmail\s*\(/);
    }
    // The scan must see email-named values at all, or it is checking nothing.
    const emailRefs = files.flatMap((f) => [...readCode(f).matchAll(/\b[\w$]*email[\w$]*\b/gi)]);
    expect(emailRefs.length).toBeGreaterThan(50);
  });

  it("★ no production code normalises an email by hand", () => {
    const offenders = files.flatMap((f) => g11(f, readCode(f))).filter((v) => !isKnown(v));
    expect(offenders).toEqual([]);
  });

  it("known offenders are still exactly as pinned (the list can only shrink)", () => {
    for (const k of KNOWN_OFFENDERS) {
      const hits = g11(k.file, readCode(k.file)).filter(isKnown);
      expect(hits.length, `${k.file}: "${k.snippet}" fixed? remove it from KNOWN_OFFENDERS`).toBe(
        1,
      );
    }
  });

  it.each(["g11-trim-lowercase.fixture", "g11-wrapped-email.fixture"])(
    "FIXTURE %s turns the gate red",
    (name) => {
      expect(g11(name, fixture(name)).map((v) => v.rule)).toContain("hand-normalised-email");
    },
  );

  it("every g11 fixture on disk is exercised above", () => {
    expect(fixtureNames("g11-")).toEqual([
      "g11-trim-lowercase.fixture",
      "g11-wrapped-email.fixture",
    ]);
  });

  it("SELF-CHECK: flags hand normalisation, clears the canonical call and non-email strings", () => {
    for (const s of [
      "email.trim()",
      "dto.email.toLowerCase()",
      "input.email?.trim()",
      "user.email\n  .toLocaleLowerCase()",
      "inviteeEmail.trimEnd()",
      "row.EMAIL.toUpperCase()",
      "String(dto.email).toLowerCase()",
      "(dto.email ?? '').trim()",
      '(email || "").trim()',
    ]) {
      expect(g11("self", s).length, `NOT FLAGGED: ${s}`).toBeGreaterThan(0);
    }
    for (const s of [
      "const email = normalizeEmail(dto.email);",
      "const token = header.slice(7).trim();",
      "const roleId = dto.roleId.trim();",
      "if (email === '') throw err;",
      "isValidEmailShape(email)",
    ]) {
      expect(g11("self", s), `FALSE POSITIVE: ${s}`).toEqual([]);
    }
    expect(g11(CANONICAL, "return raw.trim().toLowerCase();")).toEqual([]);
  });
});
