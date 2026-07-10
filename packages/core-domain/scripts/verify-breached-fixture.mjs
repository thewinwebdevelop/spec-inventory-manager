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
const MODULE = join(__dirname, "..", "src", "auth", "common-passwords.generated.ts");
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

// The generated .ts data module (imported by core-domain at runtime) must embed
// exactly the committed .txt body — otherwise the pure module and the pinned
// source could silently diverge.
const moduleSrc = readFileSync(MODULE, "utf8");
check(
  moduleSrc.includes(JSON.stringify(committed.toString("utf8"))),
  "common-passwords.generated.ts does not embed the committed fixture body verbatim — run gen:fixture",
);

// Reproducibility: re-run the generator (writes both the .txt and the .ts in
// place) and assert BOTH outputs are byte-identical to what's committed.
const beforeTxt = readFileSync(FIXTURE);
const beforeModule = readFileSync(MODULE);
execFileSync("node", [join(__dirname, "gen-breached-fixture.mjs")], { stdio: "ignore" });
const afterTxt = readFileSync(FIXTURE);
const afterModule = readFileSync(MODULE);
check(beforeTxt.equals(afterTxt), "generator is not reproducible — regen produced a different .txt");
check(beforeModule.equals(afterModule), "generator is not reproducible — regen produced a different .generated.ts");

if (!ok) process.exit(1);
// eslint-disable-next-line no-console
console.log(`fixture OK: 10000 unique entries, sha256=${committedSha} (pinned)`);
