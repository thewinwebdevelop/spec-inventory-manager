// F-002 · T-002-Q4 — the gate over the regression pack (test-plan §9, §16, §17.11(ก)).
//
// §16 calls §9 the "permanent pack": removing a member needs a D-XXX. §17.11(ก)
// makes it a verdict condition — every finding has a test OR a written reason,
// and a blank is red. Both sentences lived only in markdown; the tests lived in
// the tree; nothing compared them, so a pinned test could be deleted, renamed
// or moved and the pack would go on claiming the finding was covered.
//
// That is the shape of the failure the delta review found as NEW-1: a rule
// believed closed because a document said so.
//
// This gate walks the registry and fails when a pin no longer resolves. Read
// `regression-pack.ts`'s header for what it deliberately does NOT prove.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REGRESSION_PACK, type RegressionEntry } from "./regression-pack";

/** cwd is `apps/api` under vitest; the pins are repo-root relative. */
const REPO_ROOT = join(process.cwd(), "..", "..");

/** §9 registers 41 findings; NEW-5 occupies two rows (ก) and (ข). */
const EXPECTED_FINDINGS = 41;

function unresolvedPins(entry: RegressionEntry): string[] {
  const problems: string[] = [];
  for (const pin of entry.pins ?? []) {
    const absolute = join(REPO_ROOT, pin.file);
    if (!existsSync(absolute)) {
      problems.push(`${entry.finding}: pinned file is gone — ${pin.file}`);
      continue;
    }
    const source = readFileSync(absolute, "utf8");
    for (const marker of pin.must) {
      if (!source.includes(marker)) {
        problems.push(`${entry.finding}: ${pin.file} no longer contains "${marker}"`);
      }
    }
  }
  return problems;
}

describe("the regression pack is intact (test-plan §9 · §16 permanent pack)", () => {
  it("registers every finding — 41, counting NEW-5's two halves as one", () => {
    const findings = new Set(REGRESSION_PACK.map((e) => e.finding.replace(/\(.*\)$/, "")));
    expect(
      findings.size,
      `the pack lists ${findings.size} distinct findings; §9 registers ${EXPECTED_FINDINGS}`,
    ).toBe(EXPECTED_FINDINGS);
    // And no duplicate rows — two rows for one finding would let one of them
    // rot unnoticed behind the other.
    expect(REGRESSION_PACK.map((e) => e.finding)).toHaveLength(
      new Set(REGRESSION_PACK.map((e) => e.finding)).size,
    );
  });

  it("★ no blank rows: every finding has a pin or a written reason (§17.11(ก))", () => {
    const blanks = REGRESSION_PACK.filter(
      (e) => (e.pins ?? []).length === 0 && !(e.noTest && e.noTest.trim().length > 40),
    ).map((e) => e.finding);
    expect(
      blanks,
      "a finding with neither a test nor a stated reason is the exact gap §17.11(ก) calls red — " +
        "and a one-word reason is a blank with punctuation.",
    ).toEqual([]);
  });

  it("★ every pinned test still exists, and still carries its marker", () => {
    const problems = REGRESSION_PACK.flatMap(unresolvedPins);
    expect(
      problems,
      "a pinned test moved, was renamed or lost its marker. §16 makes the pack permanent: " +
        "removing a member needs a D-XXX, not a green build. If the coverage genuinely moved, " +
        "update the pin in the same commit.",
    ).toEqual([]);
  });

  it("a row that claims no test says WHY, and is not tiered as runnable", () => {
    for (const entry of REGRESSION_PACK) {
      if ((entry.pins ?? []).length > 0) continue;
      expect(entry.tier, `${entry.finding} has no test but is tiered "${entry.tier}"`).toBe("none");
    }
    // …and the converse: a row with tests is not filed under `none`.
    for (const entry of REGRESSION_PACK) {
      if ((entry.pins ?? []).length === 0) continue;
      expect(entry.tier, `${entry.finding} has pins but is tiered "none"`).not.toBe("none");
    }
  });

  it("the smoke tier holds the findings §16 names, and holds them by NAME not by count", () => {
    // §16: "ถ้าอันนี้พัง = ข้อมูลรั่ว/สิทธิ์หลุด/ยึดบัญชี Owner/ล็อกตัวเองออกจากร้าน".
    // Listed explicitly so demoting one to `full` is a visible edit here rather
    // than an invisible drop in a CI script — §16 requires a D-XXX for that,
    // and NEW-1 is called out as permanent.
    const mustBeSmoke = [
      "C-1",
      "C-2",
      "C-3",
      "C-4",
      "I-1",
      "I-2",
      "I-3",
      "I-4",
      "I-5",
      "I-8",
      "I-9",
      "M-8",
      "M-9",
      "N-4",
      "NEW-1",
      "NEW-2",
      "NEW-3",
      "NEW-4",
      "NEW-5(ก)",
      "NEW-6",
      "NEW-7",
      "NEW-8",
      "NEW-11",
    ];
    for (const finding of mustBeSmoke) {
      const entry = REGRESSION_PACK.find((e) => e.finding === finding);
      expect(entry, `${finding} is not in the pack at all`).toBeDefined();
      expect(entry!.tier, `${finding} left the smoke tier — §16 requires a D-XXX for that`).toBe(
        "smoke",
      );
    }
  });

  it("NEW-1 is pinned on BOTH layers, permanently (§16 · Q16 · D-030)", () => {
    // The finding that produced this whole discipline: a Critical that looked
    // closed. §17.11(ข) demands red→green evidence on the unit AND the
    // integration layer, so a pin on only one of them is not the pack §16
    // describes.
    const entry = REGRESSION_PACK.find((e) => e.finding === "NEW-1")!;
    const files = entry.pins!.map((p) => p.file);
    expect(files.some((f) => f.includes("core-domain")), files.join(",")).toBe(true);
    expect(files.some((f) => f.includes("int.test")), files.join(",")).toBe(true);
  });

  it("SELF-CHECK: the resolver fails on a pin that does not resolve", () => {
    // Without this, a broken path join or a silently-caught error would make
    // every row pass by finding nothing — the failure mode this codebase has
    // already shipped once and caught twice.
    expect(
      unresolvedPins({
        finding: "FAKE-1",
        title: "a file that does not exist",
        tier: "smoke",
        pins: [{ file: "apps/api/src/does-not-exist.ts", must: ["anything"] }],
      }),
    ).toHaveLength(1);

    expect(
      unresolvedPins({
        finding: "FAKE-2",
        title: "a real file missing its marker",
        tier: "smoke",
        pins: [
          {
            file: "apps/api/test/regression-pack.ts",
            must: ["a string that is certainly not in that file — ZZZ-9999"],
          },
        ],
      }),
    ).toHaveLength(1);

    // And passes on one that does resolve, so the checker is not simply
    // failing everything.
    expect(
      unresolvedPins({
        finding: "FAKE-3",
        title: "a real file with a real marker",
        tier: "smoke",
        pins: [{ file: "apps/api/test/regression-pack.ts", must: ["REGRESSION_PACK"] }],
      }),
    ).toEqual([]);
  });
});
