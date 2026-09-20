// F-002 — the gate over the BUILD defect pack (`build-defects.ts`).
//
// Same machinery as the §9 regression gate and for the same reason: a list of
// closed defects is worth nothing if the tests it points at can be deleted,
// renamed or emptied without anybody noticing. What makes this list different
// is where its rows came from — not a review, but a browser and an emulator
// driving the real thing against a real API, with a green unit suite on top of
// every one of them at the time.
//
// The open rows are gated too, differently: they must name an owner and say
// what the decision is. An "open" row with nobody's name on it is how a
// finding becomes folklore.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BUILD_DEFECTS, type BuildDefect } from "./build-defects";

/** cwd is `apps/api` under vitest; the pins are repo-root relative. */
const REPO_ROOT = join(process.cwd(), "..", "..");

function unresolvedPins(entry: BuildDefect): string[] {
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

describe("the build-defect pack is intact", () => {
  it("has rows, and no duplicates", () => {
    // A gate over an empty list is the failure mode this project has met
    // repeatedly: green because it never ran.
    expect(BUILD_DEFECTS.length).toBeGreaterThan(5);
    const ids = BUILD_DEFECTS.map((d) => d.finding);
    expect(ids).toHaveLength(new Set(ids).size);
  });

  it("★ every pinned test still exists, and still carries its marker", () => {
    const problems = BUILD_DEFECTS.flatMap(unresolvedPins);
    expect(problems, "a closed defect is only closed while its test is there").toEqual([]);
  });

  it("★ no blank rows: a defect either pins a test or says why it has none", () => {
    const blanks = BUILD_DEFECTS.filter(
      (d) => (d.pins ?? []).length === 0 && !(d.noTest && d.noTest.trim().length > 40),
    ).map((d) => d.finding);
    expect(blanks, "same rule as §17.11(ก) — a gap must be written down, not left empty").toEqual(
      [],
    );
  });

  it("★ every OPEN row names the team that decides", () => {
    // The point of the row is that somebody owns the decision. Without a name
    // it is a note, and notes are how findings evaporate.
    const unowned = BUILD_DEFECTS.filter((d) => d.tier === "none" && !d.owner).map(
      (d) => d.finding,
    );
    expect(unowned).toEqual([]);
  });

  it("every row records HOW it was found — the instrument, not the story", () => {
    // This is the list's argument for keeping the lanes that produced it: two
    // of these were total failures that every unit suite agreed with.
    const silent = BUILD_DEFECTS.filter((d) => !d.foundBy || d.foundBy.length < 10);
    expect(silent.map((d) => d.finding)).toEqual([]);
  });

  it("SELF-CHECK: the resolver fails on a pin that does not resolve", () => {
    // Both halves — a missing file and a present file with a missing marker —
    // because those are the two ways coverage rots.
    expect(
      unresolvedPins({
        finding: "SELF",
        title: "x",
        tier: "full",
        foundBy: "the self-check",
        pins: [{ file: "apps/api/test/does-not-exist.ts", must: ["anything"] }],
      }),
    ).toHaveLength(1);

    expect(
      unresolvedPins({
        finding: "SELF",
        title: "x",
        tier: "full",
        foundBy: "the self-check",
        pins: [
          { file: "apps/api/test/build-defects.ts", must: ["a marker no file would ever hold"] },
        ],
      }),
    ).toHaveLength(1);
  });
});
