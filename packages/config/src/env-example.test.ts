// F-002 · T-002-D2 ★ — `.env.example` and the schema cannot drift apart.
//
// `env.ts`'s header says the required vars "mirror .env.example at the repo
// root exactly". Nothing checked it. `env.test.ts`'s positive case is a
// HAND-WRITTEN copy of that file, so it stays green while the two drift — and
// the drift only surfaces as a service that will not boot, in whichever
// environment somebody deployed from the stale file.
//
// The direction that hurts is specific: a new REQUIRED var lands in the schema
// and not in the file operators copy. Every environment set up from that file
// then fails `loadEnv` at boot — after the deploy, not during review. This is
// the M-5 finding one layer out: M-5 asks that a new env var reach the zod
// schema; D2 asks that it also reach the people who have to set it.
//
// ⚠️ It reads the FILE, never `process.env` — so it says nothing about whether
// any particular environment is configured correctly. That is what boot-time
// validation is for, and it is already there.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { envObjectSchema } from "./env";

/** cwd is `packages/config` under vitest. */
const ENV_EXAMPLE = join(process.cwd(), "..", "..", ".env.example");

/**
 * Vars documented in `.env.example` that this schema deliberately does not
 * validate, each with the reason. An entry here is a claim that somebody ELSE
 * reads the value.
 */
const NOT_VALIDATED_HERE: Readonly<Record<string, string>> = Object.freeze({
  API_ORIGIN:
    "read by apps/web's next.config.mjs (the dev proxy target), never by the API — " +
    "`packages/config` validates the API's env, not the web build's",
  TRUSTED_PROXY_IPS:
    "⚠️ documented for operators and read by NOTHING today (F-001's defense-in-depth knob; " +
    "only TRUST_PROXY_HOPS has a consumer). Kept so the deployment note stays accurate — " +
    "@devops decides whether to wire it or drop it, but it must not be silently validated " +
    "into looking implemented",
});

/** `KEY="value"` / `KEY=value` on a line that is not commented out. */
export function parseEnvExample(contents: string): string[] {
  const keys: string[] = [];
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
    const match = /^([A-Z][A-Z0-9_]*)\s*=/.exec(trimmed);
    if (match) keys.push(match[1]);
  }
  return keys;
}

/** Schema keys with no default and no `.optional()` — a boot needs these. */
function requiredSchemaKeys(): string[] {
  const shape = envObjectSchema.shape as Record<string, { isOptional(): boolean }>;
  return Object.entries(shape)
    .filter(([, field]) => !field.isOptional())
    .map(([key]) => key);
}

describe("★ .env.example is the deployment contract, and it matches the schema (T-002-D2)", () => {
  const contents = (() => {
    expect(existsSync(ENV_EXAMPLE), `.env.example is missing at ${ENV_EXAMPLE}`).toBe(true);
    return readFileSync(ENV_EXAMPLE, "utf8");
  })();
  const documented = parseEnvExample(contents);
  const required = requiredSchemaKeys();

  it("the file was actually read (an empty parse would pass every check below)", () => {
    expect(documented.length).toBeGreaterThan(8);
    expect(documented).toContain("DATABASE_URL");
    expect(required.length).toBeGreaterThan(5);
  });

  it("★ every REQUIRED var is documented — the direction that breaks a deploy", () => {
    const missing = required.filter((key) => !documented.includes(key));
    expect(
      missing,
      "these are required at boot and absent from the file operators copy. Whoever sets up an " +
        "environment from `.env.example` gets a service that exits on start, and finds out after " +
        "the deploy rather than in review.",
    ).toEqual([]);
  });

  it("★ every documented var is either validated here or explained", () => {
    const shape = envObjectSchema.shape as Record<string, unknown>;
    const unexplained = documented.filter(
      (key) => !(key in shape) && !(key in NOT_VALIDATED_HERE),
    );
    expect(
      unexplained,
      "a var in `.env.example` that no schema validates and no note explains is one an operator " +
        "will set carefully and nothing will ever read. Add it to the schema, or list it in " +
        "NOT_VALIDATED_HERE with who does read it.",
    ).toEqual([]);
  });

  it("the explanations stay honest — a var that got a schema no longer needs one", () => {
    const shape = envObjectSchema.shape as Record<string, unknown>;
    for (const key of Object.keys(NOT_VALIDATED_HERE)) {
      expect(
        key in shape,
        `${key} is now validated by the schema — remove its NOT_VALIDATED_HERE entry`,
      ).toBe(false);
      expect(
        documented,
        `${key} is explained as documented-but-unvalidated, but it is not in .env.example`,
      ).toContain(key);
    }
  });

  it("F-002's three required vars are documented with their constraints, not just their names", () => {
    // The constraints are the part an operator cannot infer: reusing an auth
    // secret (§7.3 key separation), plain http on a URL that carries the
    // invitation token (§6.4), and a plan key that must exist in the database
    // or every `POST /organizations` answers 503 (§6.2). A file that lists the
    // names without them invites all three mistakes.
    expect(contents).toContain("INVITATION_TOKEN_SECRET");
    expect(contents, "the rotation consequence is not stated").toMatch(/ROTATION|rotat/i);
    expect(contents, "key separation is not stated").toMatch(/differ from BOTH|key separation/i);
    expect(contents, "the https rule is not stated").toMatch(/https/i);
    expect(contents, "the fail-closed 503 is not stated").toContain(
      "ORG_PROVISIONING_UNAVAILABLE",
    );
  });

  it("SELF-CHECK: the parser reads assignments, not comments or prose", () => {
    expect(parseEnvExample('FOO="bar"')).toEqual(["FOO"]);
    expect(parseEnvExample("FOO=bar")).toEqual(["FOO"]);
    expect(parseEnvExample("# FOO=bar")).toEqual([]);
    expect(parseEnvExample("#FOO=bar")).toEqual([]);
    // A commented-out OPTIONAL override must not read as documented-and-set:
    // `.env.example` uses that form on purpose for the tunables.
    expect(parseEnvExample("# MAX_ORGS_PER_USER=\"50\"")).toEqual([]);
    expect(parseEnvExample("  # spaced comment")).toEqual([]);
    expect(parseEnvExample("not a var line")).toEqual([]);
    expect(parseEnvExample('A=1\n# B=2\nC="3"')).toEqual(["A", "C"]);
  });
});
