// F-003 · T-003-DV05 (G3-07) — tool/ci/warn-nvmrc-changed.mjs really warns on a
// `.nvmrc` change, stays quiet otherwise, fails loud on a git error, and ci.yml
// actually runs it. Runs the real script against a throw-away git repo.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..", "..", "..");
const SCRIPT = join(ROOT, "tool", "ci", "warn-nvmrc-changed.mjs");

function sh(cwd: string, cmd: string, args: string[]) {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8" });
  if (r.status !== 0 && cmd === "git") throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r;
}
function repo(): string {
  const d = mkdtempSync(join(tmpdir(), "nvmrc-"));
  sh(d, "git", ["init", "-q"]);
  sh(d, "git", ["config", "user.email", "t@t"]);
  sh(d, "git", ["config", "user.name", "t"]);
  sh(d, "git", ["config", "commit.gpgsign", "false"]);
  writeFileSync(join(d, ".nvmrc"), "22\n");
  writeFileSync(join(d, "a.txt"), "1\n");
  sh(d, "git", ["add", "."]);
  sh(d, "git", ["commit", "-qm", "base"]);
  return d;
}
const run = (cwd: string, ...args: string[]) => sh(cwd, process.execPath, [SCRIPT, ...args]);

describe("G3-07 .nvmrc-changed warning", () => {
  it("warns (::warning::) with old -> new when .nvmrc changed", () => {
    const d = repo();
    writeFileSync(join(d, ".nvmrc"), "24\n");
    sh(d, "git", ["commit", "-qam", "bump"]);
    const r = run(d, "--base", "HEAD~1");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("::warning title=.nvmrc changed::");
    expect(r.stdout).toContain("(22 -> 24)");
  });

  it("control: stays quiet when only another file changed", () => {
    const d = repo();
    writeFileSync(join(d, "a.txt"), "2\n");
    sh(d, "git", ["commit", "-qam", "other"]);
    const r = run(d, "--base", "HEAD~1");
    expect(r.status).toBe(0);
    expect(r.stdout).not.toContain("::warning");
    expect(r.stdout).toContain("unchanged");
  });

  it("fails loud (exit 2) on an unknown base, never a silent 'no warning'", () => {
    const d = repo();
    const r = run(d, "--base", "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef");
    expect(r.status).toBe(2);
    expect(r.stdout + r.stderr).not.toContain("unchanged");
  });

  it("ci.yml runs the script on pull_request with the PR base sha", () => {
    const ci = readFileSync(join(ROOT, ".github", "workflows", "ci.yml"), "utf8");
    const at = ci.indexOf("tool/ci/warn-nvmrc-changed.mjs");
    expect(at, "ci.yml does not call warn-nvmrc-changed.mjs").toBeGreaterThan(0);
    const step = ci.slice(ci.lastIndexOf("      - name:", at), at + 200);
    expect(step).toContain("github.event_name == 'pull_request'");
    expect(step).toContain("github.event.pull_request.base.sha");
  });
});
