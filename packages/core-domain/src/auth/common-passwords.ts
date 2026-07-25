// F-001 · T-001-01 / T-001-14 — breached/common password set loader (pure).
//
// Loads the version-pinned top-10k fixture (arch §5.2, data-model §5) into an
// in-memory Set for O(1) membership checks. The fixture is offline + committed
// (no external call on the signup hot path). SOURCE.md records provenance +
// SHA-256; FIXTURE_VERSION below is asserted by the unit test (U1.3) so a
// silent fixture swap is caught.
//
// The fixture is imported as a PURE, committed data module
// (`common-passwords.generated.ts`, produced from the SHA-pinned .txt by
// scripts/gen-breached-fixture.mjs). core-domain must stay framework/fs-free
// (golden rule #6) and build under a tsc with no Node types, so there is NO
// `node:fs`/`__dirname` read here — the data is a plain string constant the
// bundler/tsc resolves like any other import.
import { COMMON_PASSWORDS_RAW } from "./common-passwords.generated";

/**
 * Pinned fixture version — must match SOURCE.md's "Version / date". Bumping the
 * fixture MUST bump this constant (and the U1.3 test asserts it), so the
 * breached check can never drift to an unpinned list unnoticed.
 */
export const FIXTURE_VERSION = "v1";

let cached: ReadonlySet<string> | null = null;

/**
 * The breached/common-password set (lowercased entries). Parsed once from the
 * committed data module and cached. Entries are compared case-insensitively by
 * the policy (it lowercases the candidate first), matching how the fixture is
 * stored (all lowercase).
 */
export function loadCommonPasswords(): ReadonlySet<string> {
  if (cached) return cached;
  const set = new Set<string>();
  for (const line of COMMON_PASSWORDS_RAW.split("\n")) {
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
