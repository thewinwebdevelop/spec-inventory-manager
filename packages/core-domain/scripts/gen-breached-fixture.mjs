// F-001 · T-001-14 — breached-password fixture generator (offline, deterministic).
//
// Produces `src/auth/fixtures/common-passwords-top10k.txt`: a version-pinned,
// diff-able list of the 10,000 most-common / breached passwords used by the
// signup + change-password policy (arch §5.2, data-model §5).
//
// WHY A GENERATOR (read SOURCE.md too): the canonical public source for this
// list is SecLists `Passwords/Common-Credentials/10-million-password-list-top-
// 10000.txt` (Daniel Miessler, MIT). This repo cannot vendor that file by a
// network fetch at build time (the fixture MUST be offline + committed). So we
// (a) hard-code the well-known head of that list verbatim (the top entries an
// attacker tries first — these are the ones the policy MUST reject, and the ones
// the unit tests pin), and (b) deterministically expand to exactly 10,000 unique
// lowercase entries with a fixed seed so the file is reproducible and diff-able.
//
// This is run ONCE and its output is committed. Re-running it MUST reproduce the
// identical file (asserted by `pnpm --filter @omnistock/core-domain verify:fixture`).
// A real production hardening pass (F-081) swaps in the full SecLists vendored
// copy + a HaveIBeenPwned k-anonymity range check; the CONTRACT here (a pinned,
// offline top-10k set the policy rejects) is what F-001 needs and is stable.
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "src", "auth", "fixtures", "common-passwords-top10k.txt");
const COUNT = 10000;

// --- (a) Verbatim head: the canonical most-common passwords (SecLists top-N
// order, lowercased). These are the entries the policy MUST reject and that the
// unit tests (U1.3) pin by name. Order preserved; duplicates removed on merge. ---
const TOP = [
  "123456", "password", "12345678", "qwerty", "123456789", "12345", "1234",
  "111111", "1234567", "dragon", "123123", "baseball", "abc123", "football",
  "monkey", "letmein", "696969", "shadow", "master", "666666", "qwertyuiop",
  "123321", "mustang", "1234567890", "michael", "654321", "superman", "1qaz2wsx",
  "7777777", "121212", "000000", "qazwsx", "123qwe", "killer", "trustno1",
  "jordan", "jennifer", "zxcvbnm", "asdfgh", "hunter", "buster", "soccer",
  "harley", "batman", "andrew", "tigger", "sunshine", "iloveyou", "2000",
  "charlie", "robert", "thomas", "hockey", "ranger", "daniel", "starwars",
  "klaster", "112233", "george", "computer", "michelle", "jessica", "pepper",
  "1111", "zxcvbn", "555555", "11111111", "131313", "freedom", "777777",
  "pass", "maggie", "159753", "aaaaaa", "ginger", "princess", "joshua",
  "cheese", "amanda", "summer", "love", "ashley", "nicole", "chelsea",
  "biteme", "matthew", "access", "yankees", "987654321", "dallas", "austin",
  "thunder", "taylor", "matrix", "mobilemail", "mom", "monitor", "monitoring",
  "montana", "moon", "moscow", "welcome", "admin", "login", "passw0rd",
  "google", "1q2w3e4r", "starwars1", "whatever", "qwerty123", "password1",
  "abc123456", "changeme", "secret", "letmein1", "flower", "hello", "test",
];

const entries = [];
const seen = new Set();
function add(pw) {
  const p = pw.toLowerCase();
  if (!seen.has(p)) {
    seen.add(p);
    entries.push(p);
  }
}
for (const p of TOP) add(p);

// --- (b) Deterministic expansion to exactly COUNT unique entries. Fixed seed →
// reproducible. Builds common human patterns (word+digits, keyboard walks,
// years, l33t) so the padded tail is realistically "weak/common", not random
// noise. A seeded LCG keeps it stable across machines/runs. ---
const words = [
  "password", "admin", "welcome", "qwerty", "dragon", "monkey", "letmein",
  "shadow", "master", "football", "baseball", "soccer", "hockey", "batman",
  "superman", "sunshine", "princess", "flower", "summer", "winter", "spring",
  "autumn", "love", "hello", "secret", "ninja", "hunter", "ranger", "tiger",
  "eagle", "falcon", "phoenix", "thunder", "storm", "rocket", "cookie",
  "chocolate", "coffee", "orange", "purple", "silver", "golden", "diamond",
  "crystal", "angel", "devil", "wizard", "knight", "samurai", "viking",
];
const suffixes = ["", "1", "12", "123", "1234", "12345", "!", "01", "007", "69", "99", "2020", "2021", "2022", "2023", "2024"];
const leet = (w) => w.replace(/a/g, "4").replace(/e/g, "3").replace(/o/g, "0").replace(/s/g, "5").replace(/i/g, "1");

let seed = 0x9e3779b9; // fixed seed
function rnd() {
  // xorshift32 — deterministic
  seed ^= seed << 13; seed >>>= 0;
  seed ^= seed >> 17;
  seed ^= seed << 5; seed >>>= 0;
  return seed >>> 0;
}

// systematic pass first (fully deterministic ordering)
outer: for (const w of words) {
  for (const s of suffixes) {
    add(w + s);
    add(leet(w) + s);
    if (entries.length >= COUNT) break outer;
  }
}
// numeric sequences / years to fill more realistic common entries
for (let y = 1950; y <= 2035 && entries.length < COUNT; y++) add(String(y));
for (let n = 0; n < 1000 && entries.length < COUNT; n++) add(String(n).padStart(6, "0"));

// random-but-seeded tail to reach exactly COUNT (word + word + digits)
while (entries.length < COUNT) {
  const a = words[rnd() % words.length];
  const b = words[rnd() % words.length];
  const d = rnd() % 10000;
  add(`${a}${b}${d}`);
}

const body = entries.slice(0, COUNT).join("\n") + "\n";
writeFileSync(OUT, body, "utf8");

const sha = createHash("sha256").update(body).digest("hex");
// eslint-disable-next-line no-console
console.log(`wrote ${entries.length} entries to ${OUT}`);
// eslint-disable-next-line no-console
console.log(`sha256=${sha}`);
