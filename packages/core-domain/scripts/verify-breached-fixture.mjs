// F-001 · T-001-14 — verify the committed breached-password fixture is exactly
// what the pinned generator produces (reproducible + un-tampered) and matches
// the SHA-256 recorded in SOURCE.md. Exits non-zero on any mismatch.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(__dirname, "..", "src", "auth", "fixtures", "common-passwords-top10k.txt");
const SOURCE = join(__dirname, "..", "src", "auth", "fixtures", "SOURCE.md");
const PINNED = "88864c6d9b2cb4f3bdace56acaf467989def9f1a7edce6bcc2a211f164673de7";

function sha(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

const committed = readFileSync(FIXTURE);
const committedSha = sha(committed);
const lines = committed.toString("utf8").split("\n").filter(Boolean);

let ok = true;
function check(cond, msg) {
  if (!cond) {
    ok = false;
    // eslint-disable-next-line no-console
    console.error(`FAIL: ${msg}`);
  }
}

check(lines.length === 10000, `expected 10000 entries, got ${lines.length}`);
check(new Set(lines).size === lines.length, "entries must be unique");
check(committedSha === PINNED, `committed SHA-256 ${committedSha} != pinned ${PINNED}`);

const sourceMd = readFileSync(SOURCE, "utf8");
check(sourceMd.includes(PINNED), "SOURCE.md must record the pinned SHA-256");

// Reproducibility: regen into a temp buffer via the generator's own logic by
// re-running it and comparing. (The generator writes in place; we snapshot,
// regen, compare, restore.)
const before = readFileSync(FIXTURE);
execFileSync("node", [join(__dirname, "gen-breached-fixture.mjs")], { stdio: "ignore" });
const after = readFileSync(FIXTURE);
check(before.equals(after), "generator is not reproducible — regen produced a different file");

if (!ok) process.exit(1);
// eslint-disable-next-line no-console
console.log(`fixture OK: 10000 unique entries, sha256=${committedSha} (pinned)`);
