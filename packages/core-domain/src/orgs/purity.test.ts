import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// F-002 · T-002-08 — U-CD-12 (test-plan §3), the part that can live in this
// package: the new orgs pure fns must not read the clock or a random source.
// `now` is passed in (data-model §3.2), otherwise the "exactly at expiresAt"
// boundary cases below could not be written at all — and a fn that reads the
// clock is not a pure fn (golden rule #6).

const SOURCE_FILES = [
  "owner-invariant.ts",
  "member-authz.ts",
  "thai-tax-id.ts",
  "invitation-status.ts",
  "invitation-email.ts",
  // T-002-08b — the two files data-model §6 asks for on top of T-002-08.
  "invitation-policy.ts",
  "tax-id-mask.ts",
  // T-002-09 — the admin-reset gate (C-2 + NEW-1).
  "admin-reset-authz.ts",
  // T-002-15/16 — org creation policy + the profile/switcher mappers.
  "org-provisioning.ts",
  "org-profile.ts",
  "index.ts",
] as const;

/** Anything that would make the same inputs produce a different answer. */
const IMPURE_PATTERNS: readonly [string, RegExp][] = [
  ["Date.now()", /\bDate\.now\s*\(/],
  ["new Date()", /\bnew\s+Date\s*\(/],
  ["Math.random()", /\bMath\.random\s*\(/],
  ["performance.now()", /\bperformance\.now\s*\(/],
  ["process.env", /\bprocess\.env\b/],
];

function impurities(source: string): string[] {
  // Comments may legitimately mention `Date.now()`; only real code counts.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
  return IMPURE_PATTERNS.filter(([, re]) => re.test(code)).map(([label]) => label);
}

describe("orgs pure fns — no clock, no randomness, no env", () => {
  it.each(SOURCE_FILES)("%s has no impure call", (file) => {
    const source = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
    expect(impurities(source)).toEqual([]);
  });

  it("the scanner itself actually detects a violation (self-check)", () => {
    expect(impurities("const now = Date.now();")).toEqual(["Date.now()"]);
    expect(impurities("const d = new Date();")).toEqual(["new Date()"]);
    expect(impurities("// a comment about Date.now() is fine")).toEqual([]);
  });
});
