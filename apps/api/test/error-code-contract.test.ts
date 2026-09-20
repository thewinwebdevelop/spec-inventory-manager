// ★ THE SERVER↔CONTRACT ERROR-CODE AUDIT (2026-09-05, release-gate-f §5 item 1).
//
// ── THE HOLE THIS CLOSES ───────────────────────────────────────────────────
// An error code IS contract: both clients `switch` on it to choose which Thai
// sentence a person reads. Until today five of them (`EMAIL_TAKEN`,
// `EMAIL_INVALID`, `PASSWORD_TOO_SHORT|LONG|BREACHED`) existed in exactly two
// places — `src/common/error-codes.ts` and two client switch statements — and in
// no agreement between them. Rename one server-side and:
//
//   `oasdiff`                   spec ↔ spec        — nothing changed in the spec
//   `contracts-drift`           generated ↔ spec   — the generated client is
//                                                    built FROM the spec
//   `error-codes.test.ts`       registry ↔ itself  — pins the ones it lists
//   `error-code-coverage.test`  client ↔ spec      — green while BOTH are stale
//
// …and every gate stays green while both apps quietly fall back to a generic
// message for a case they have specific copy for.
//
// ── WHY IT LIVES HERE AND NOT IN packages/contracts ────────────────────────
// This is the direction `packages/contracts/src/error-code-coverage.test.ts`
// cannot check: it needs the PRODUCTION registry, and `@omnistock/contracts` is
// a leaf package that must never import `apps/api`. So the two guards sit on
// opposite sides of the seam and answer opposite questions:
//
//   contracts side   every code a CLIENT branches on is in the contract
//   here             every code the SERVER can answer is in the contract
//
// Neither implies the other, and only both together mean "the three layers say
// the same thing".
//
// ── IT READS THE BUNDLE, AND ONLY RESPONSE DESCRIPTIONS ────────────────────
// `openapi/openapi.yaml` is the artifact every consumer reads (same reasoning as
// `openapi-parity.kit.ts`). Codes are matched inside `` `BACKTICKS` `` in a
// RESPONSE description — not anywhere in the file — because that is the only
// placement that ties a code to the status it comes back with. A code named in
// an operation-level description ("a client that receives `403 ORG_ACCESS_DENIED`
// refetches this endpoint") is prose about somebody else's response and proves
// nothing about this one.
import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { describe, it, expect } from "vitest";
import { ERROR_CODES } from "../src/common/error-codes";
import { resolveBundledSpecPath } from "./openapi-parity.kit";

/** The OpenAPI verbs a Path Item Object may carry (siblings like `parameters` are not operations). */
const OPENAPI_METHODS: readonly string[] = Object.freeze([
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
]);

/** An UPPER_SNAKE token written as code in a description: `` `EMAIL_TAKEN` ``. */
const CODE_IN_DESCRIPTION = /`([A-Z][A-Z0-9_]{3,})`/g;

/**
 * Codes that belong to NO single endpoint, so demanding a response description
 * for them would be demanding a lie.
 *
 * `INTERNAL` is the filter's fallback for any unrecognised error — it can come
 * back from every route and is documented once, on `ErrorResponse.code` in
 * `components/common.yaml`. It is still required to appear SOMEWHERE in the
 * bundle (see the second test), so a rename of it is still caught.
 *
 * ⚠️ One member, and adding a second needs an argument: the value of this file
 * is that "the contract does not mention this code" is a build failure.
 */
export const NOT_ENDPOINT_SPECIFIC: readonly string[] = Object.freeze(["INTERNAL"]);

/**
 * Wire codes that are NOT registry entries, and why.
 *
 * The global `ValidationPipe` turns the first failing constraint's MESSAGE into
 * the wire `error.code` (`main.ts`), and F-001's auth DTOs exploit that by
 * writing codes as messages (`@Matches(..., { message: "DEVICE_ID_INVALID" })`).
 * Those two values really are answered by `POST /auth/login`, so documenting
 * them is honest — but they live in `auth/dto.ts`, not in `ERROR_CODES`.
 *
 * ⛔ Do not treat this list as a pattern to copy. `apps/api/CLAUDE.md` §5 is
 * explicit that a new feature throws a typed registry error; this exists so the
 * audit can tell "documented, from a known non-registry source" apart from
 * "documented, from nowhere at all" — which is what a typo in the spec looks
 * like, and which the second test below turns red.
 */
export const NON_REGISTRY_WIRE_CODES: readonly string[] = Object.freeze([
  "DEVICE_ID_INVALID",
  "TOKEN_TRANSPORT_INVALID",
]);

/** Where a code is documented: the set of HTTP statuses it is named under. */
export type CodePlacement = ReadonlyMap<string, ReadonlySet<string>>;

/**
 * Every code named in a RESPONSE description of the bundled contract, mapped to
 * the status codes it is named under.
 *
 * Pure over a parsed document so the self-check can feed it a hostile one.
 */
export function readDocumentedCodes(doc: unknown): CodePlacement {
  const paths = (doc as { paths?: Record<string, Record<string, unknown>> } | null)?.paths;
  const found = new Map<string, Set<string>>();
  if (!paths || typeof paths !== "object") return found;

  for (const item of Object.values(paths)) {
    if (!item || typeof item !== "object") continue;
    for (const [verb, operation] of Object.entries(item)) {
      if (!OPENAPI_METHODS.includes(verb.toLowerCase())) continue;
      const responses = (operation as { responses?: Record<string, unknown> } | null)?.responses;
      if (!responses || typeof responses !== "object") continue;
      for (const [status, response] of Object.entries(responses)) {
        const description = (response as { description?: unknown } | null)?.description;
        if (typeof description !== "string") continue;
        for (const match of description.matchAll(CODE_IN_DESCRIPTION)) {
          const set = found.get(match[1]) ?? new Set<string>();
          set.add(status);
          found.set(match[1], set);
        }
      }
    }
  }
  return found;
}

export interface CodeDrift {
  readonly code: string;
  readonly registryStatus: number;
  /** Statuses the contract names it under (empty ⇒ undocumented). */
  readonly documentedUnder: readonly string[];
}

/** Registry codes the contract never names under any response. */
export function undocumentedCodes(
  registry: Readonly<Record<string, { code: string; status: number }>>,
  documented: CodePlacement,
): CodeDrift[] {
  return Object.values(registry)
    .filter((def) => !NOT_ENDPOINT_SPECIFIC.includes(def.code))
    .filter((def) => !documented.has(def.code))
    .map((def) => ({ code: def.code, registryStatus: def.status, documentedUnder: [] }));
}

/** Registry codes documented under a status the server would never answer with. */
export function statusDrift(
  registry: Readonly<Record<string, { code: string; status: number }>>,
  documented: CodePlacement,
): CodeDrift[] {
  const drifted: CodeDrift[] = [];
  for (const def of Object.values(registry)) {
    const under = documented.get(def.code);
    if (!under) continue;
    const wrong = [...under].filter((status) => status !== String(def.status));
    if (wrong.length > 0) {
      drifted.push({ code: def.code, registryStatus: def.status, documentedUnder: wrong });
    }
  }
  return drifted;
}

describe("★ every error code the server can answer is published by the contract", () => {
  const specPath = resolveBundledSpecPath();
  const raw = readFileSync(specPath, "utf8");
  const doc = parseYaml(raw) as unknown;
  const documented = readDocumentedCodes(doc);
  const registry = ERROR_CODES as unknown as Record<string, { code: string; status: number }>;

  it("the audit actually read a contract and a registry", () => {
    // An empty read agrees with every server in existence. Same floor as the
    // parity kit's `minRoutes`: a decorative gate is worse than none, because
    // its name says the question has been answered.
    expect(raw.length).toBeGreaterThan(10_000);
    expect(Object.keys(registry).length).toBeGreaterThanOrEqual(30);
    expect(documented.size).toBeGreaterThanOrEqual(20);
  });

  it("SELF-CHECK: it catches an undocumented code, a wrong status, and spares a correct one", () => {
    const fakeDoc = {
      paths: {
        "/x": {
          post: {
            // Correct: 409 in the registry, named under 409 here.
            responses: {
              "409": { description: "`EMAIL_TAKEN` — taken" },
              // Wrong: `RATE_LIMITED` is 429 in the registry.
              "418": { description: "`RATE_LIMITED` — nope" },
            },
          },
          // Prose at OPERATION level must NOT count as documentation.
          description: "`LAST_OWNER` is mentioned here and nowhere useful",
        },
      },
    };
    const placement = readDocumentedCodes(fakeDoc);
    expect([...placement.keys()].sort()).toEqual(["EMAIL_TAKEN", "RATE_LIMITED"]);

    const tiny = {
      EMAIL_TAKEN: { code: "EMAIL_TAKEN", status: 409 },
      RATE_LIMITED: { code: "RATE_LIMITED", status: 429 },
      LAST_OWNER: { code: "LAST_OWNER", status: 409 },
    };
    expect(undocumentedCodes(tiny, placement).map((d) => d.code)).toEqual(["LAST_OWNER"]);
    expect(statusDrift(tiny, placement).map((d) => d.code)).toEqual(["RATE_LIMITED"]);

    // And a code the registry exempts is never reported as undocumented.
    expect(
      undocumentedCodes({ INTERNAL: { code: "INTERNAL", status: 500 } }, placement),
    ).toEqual([]);
  });

  it("★ no registry code is missing from the contract", () => {
    const missing = undocumentedCodes(registry, documented).map((d) => d.code);
    expect(
      missing,
      "the server can answer with these codes and packages/contracts/openapi never names them. " +
        "Rename one and oasdiff, contracts-drift and every unit suite stay green while both " +
        "apps lose their specific message. Name the code in the `description` of the response " +
        "that answers it, then re-bundle.",
    ).toEqual([]);
  });

  it("★ no code is documented under a status the server would not answer with", () => {
    const drift = statusDrift(registry, documented).map(
      (d) => `${d.code}: registry says ${d.registryStatus}, contract says ${d.documentedUnder.join("/")}`,
    );
    expect(
      drift,
      "a client reading the contract would handle these on the wrong status — which is the " +
        "same failure as an undocumented code, arriving one layer later.",
    ).toEqual([]);
  });

  it("the exemptions are honest — `INTERNAL` is still in the document somewhere", () => {
    // It has no endpoint of its own, but it must not vanish silently either:
    // it is documented on `ErrorResponse.code` in components/common.yaml.
    for (const code of NOT_ENDPOINT_SPECIFIC) {
      expect(raw, `${code} is exempt from the per-response rule but absent entirely`).toContain(
        code,
      );
    }
  });

  it("★ every code the contract names is one the server actually has", () => {
    // The opposite drift, and the one a reviewer cannot see: a spec that
    // promises `PASSWORD_TO_SHORT` (typo) documents a code no server will ever
    // send, so the client branch written for it is dead on arrival.
    const known = new Set([...Object.keys(registry), ...NON_REGISTRY_WIRE_CODES]);
    const invented = [...documented.keys()].filter((code) => !known.has(code)).sort();
    expect(
      invented,
      "the contract names these codes but neither ERROR_CODES nor the documented " +
        "validation-pipe messages produce them. Either the spec has a typo or the code was " +
        "renamed server-side without updating the contract.",
    ).toEqual([]);
  });
});
