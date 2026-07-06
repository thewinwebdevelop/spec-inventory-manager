// F-001 · T-001-01 / T-001-14 — breached/common password set loader (pure).
//
// Loads the version-pinned top-10k fixture (arch §5.2, data-model §5) into an
// in-memory Set for O(1) membership checks. The fixture is offline + committed
// (no external call on the signup hot path). SOURCE.md records provenance +
// SHA-256; FIXTURE_VERSION below is asserted by the unit test (U1.3) so a
// silent fixture swap is caught.
//
// Reading the file with `readFileSync` at module load is the ONE fs touch in
// core-domain — it is a build-time-committed asset, not I/O against a live
// system, and it is synchronous + deterministic (no DB, no network, no clock),
// so it does not violate the "pure, framework-free" spirit of golden rule #6
// (the policy fns that consume it are pure). The dependency-cruiser purity gate
// forbids DB/framework imports, not reading a committed data file.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Pinned fixture version — must match SOURCE.md's "Version / date". Bumping the
 * fixture MUST bump this constant (and the U1.3 test asserts it), so the
 * breached check can never drift to an unpinned list unnoticed.
 */
export const FIXTURE_VERSION = "v1";

/** Absolute path to the committed fixture (top-10k common passwords).
 *  Uses CJS `__dirname` (this package compiles to CommonJS) so the path
 *  resolves under vitest (ts source, `src/auth`). When compiled to
 *  `dist/auth`, the build copies the `fixtures/` dir alongside (see the
 *  `build` script), so `__dirname/fixtures` resolves there too; as a
 *  belt-and-braces fallback we also probe the `src` sibling so a partial
 *  build never fails the lookup. */
export function fixturePath(): string {
  const local = join(__dirname, "fixtures", "common-passwords-top10k.txt");
  if (existsSync(local)) return local;
  // Fallback: from dist/auth → ../../src/auth/fixtures (source of truth).
  const fromSrc = join(__dirname, "..", "..", "src", "auth", "fixtures", "common-passwords-top10k.txt");
  return fromSrc;
}

let cached: ReadonlySet<string> | null = null;

/**
 * The breached/common-password set (lowercased entries). Loaded once and
 * cached. Entries are compared case-insensitively by the policy (it lowercases
 * the candidate first), matching how the fixture is stored (all lowercase).
 */
export function loadCommonPasswords(): ReadonlySet<string> {
  if (cached) return cached;
  const raw = readFileSync(fixturePath(), "utf8");
  const set = new Set<string>();
  for (const line of raw.split("\n")) {
    const p = line.trim();
    if (p.length > 0) set.add(p);
  }
  cached = set;
  return set;
}

/**
 * True if `password` is present in the breached/common set. Case-insensitive:
 * the candidate is lowercased so `Password` matches the stored `password`
 * (breach lists are case-normalized; an attacker's guess of a trivial variant
 * must be rejected just the same).
 */
export function isBreachedPassword(
  password: string,
  set: ReadonlySet<string> = loadCommonPasswords(),
): boolean {
  return set.has(password.toLowerCase());
}
