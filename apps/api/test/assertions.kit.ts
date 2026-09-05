// F-002 · T-002-22 — the shared response assertions every F-002 int/E2E case
// reuses (test-plan §19.1 / Q10 items (ค)–(จ) · architecture §12.2 item 4).
//
// WHY THESE LIVE IN ONE FILE
// "the response must not contain a password hash" written inline in 45 cases is
// 45 chances to write it slightly wrong, and zero chances to notice that case 31
// forgot it. Written once, it is one thing to review — and one thing that can be
// PROVEN to fail (assertions.kit.test.ts feeds every function a body that must
// be rejected).
//
// DESIGN RULES THIS FILE OBEYS
//  1. Every function is PURE over a structural `HttpResponseLike`. Nothing
//     imports supertest, so the meta-tests can fabricate the exact hostile
//     response a real endpoint might one day return.
//  2. The `traceId` normalizer has a CLOSED allowlist (test-plan §20 item on
//     I-08): exactly one key may be dropped before two error bodies are
//     compared, and both bodies must still HAVE that key with DIFFERENT values.
//     A normalizer that can drop "whatever differs" proves nothing.
//  3. Nothing here re-declares a production table. `assertResponseHeaders` takes
//     the policy as an argument precisely so that the call sites pass
//     `RESPONSE_HEADER_POLICY` (architecture §12.2 item 4) in, and no copy of it
//     ever lives in the suite.
//  4. Every function here is ROUTE-BLIND — it sees a body, never a URL. The two
//     rules that depend on WHICH endpoint answered (`TOKEN_RESPONSE_ALLOWLIST`,
//     `TAX_ID_RESPONSE_ALLOWLIST`) are therefore enforced in `org-leak.kit.ts`,
//     which has the route in hand and imports both lists from production.

/** The parts of a supertest/undici response these assertions read. */
export interface HttpResponseLike {
  readonly status: number;
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string | string[] | undefined>>;
}

/**
 * Field names that must never appear ANYWHERE in a response body, at any depth,
 * under any endpoint.
 *
 * `token` is deliberately NOT in this list, because "may this body carry a
 * token?" is a question about the ROUTE and these functions never see one: two
 * endpoints legitimately return one (the invitation link, D-012). That rule now
 * has a production home — `TOKEN_RESPONSE_ALLOWLIST` in
 * `src/common/authz/route-capabilities.ts`, exactly two literal rows, never a
 * regex (@qa's condition) — and it is applied in `org-leak.kit.ts`, where a
 * route is in hand. A caller holding a body and no route still opts in per
 * assertion with `allowFields`.
 */
export const FORBIDDEN_RESPONSE_FIELDS: readonly string[] = Object.freeze([
  "passwordHash",
  "password",
  "newPassword",
  "currentPassword",
  "tokenHash",
  "rawToken",
  "refreshToken",
  "secret",
]);

/** Keys the error-body normalizer may drop — CLOSED, one member (test-plan §20). */
export const ERROR_BODY_VOLATILE_KEYS: readonly string[] = Object.freeze(["traceId"]);

/** Keys the error envelope is allowed to carry (backend.md §3.5). */
export const ERROR_ENVELOPE_KEYS: readonly string[] = Object.freeze([
  "code",
  "message",
  "details",
  "fieldErrors",
  "traceId",
]);

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ── deep walk ───────────────────────────────────────────────────────────────

interface Visited {
  /** JSON-ish path, e.g. `items[2].user.email`. */
  readonly path: string;
  /** Object key this value was reached through (`undefined` for array items). */
  readonly key?: string;
  readonly value: unknown;
}

function walk(value: unknown, path: string, out: Visited[], key?: string): void {
  out.push({ path, key, value });
  if (Array.isArray(value)) {
    value.forEach((item, i) => walk(item, `${path}[${i}]`, out));
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      walk(v, path === "" ? k : `${path}.${k}`, out, k);
    }
  }
}

function nodes(body: unknown): Visited[] {
  const out: Visited[] = [];
  walk(body, "", out);
  return out;
}

// ── (1) secrets ─────────────────────────────────────────────────────────────

/**
 * Paths at which a forbidden field name appears. Matching is on the exact key
 * name (case-insensitive), never a substring: `tokenIssuedAt` and
 * `acceptedUserCreatedAfterInvite` are legitimate fields and a substring match
 * would make this assertion useless the first time someone hit a false positive.
 */
export function findSecretFields(
  body: unknown,
  options: { readonly allowFields?: readonly string[] } = {},
): string[] {
  const allowed = new Set((options.allowFields ?? []).map((f) => f.toLowerCase()));
  const forbidden = FORBIDDEN_RESPONSE_FIELDS.map((f) => f.toLowerCase()).filter(
    (f) => !allowed.has(f),
  );
  return findFieldPaths(body, ...forbidden);
}

/**
 * Paths at which any of `fieldNames` appears as an object KEY, at any depth,
 * including inside arrays.
 *
 * Same exact-key, case-insensitive rule as {@link findSecretFields} — and the
 * same code underneath, so a route-aware caller (`org-leak.kit.ts` asking "is
 * there a `token` in this body?") and the blanket secret scan can never
 * disagree about what "the body contains X" means.
 */
export function findFieldPaths(body: unknown, ...fieldNames: readonly string[]): string[] {
  const wanted = new Set(fieldNames.map((f) => f.toLowerCase()));
  if (wanted.size === 0) return [];
  return nodes(body)
    .filter((n) => n.key !== undefined && wanted.has(n.key.toLowerCase()))
    .map((n) => n.path);
}

/** Throws when the body carries any {@link FORBIDDEN_RESPONSE_FIELDS} key. */
export function assertNoSecretFields(
  body: unknown,
  options: { readonly allowFields?: readonly string[] } = {},
): void {
  const hits = findSecretFields(body, options);
  if (hits.length > 0) {
    throw new Error(
      `response leaks secret field(s) at: ${hits.join(", ")}\n` +
        `body: ${safeJson(body)}`,
    );
  }
}

/**
 * Paths where a string value contains one of `foreignValues` — how "another
 * person's email" is caught. Substring (not equality) on purpose: a mapper that
 * emits `"invited u***@x.co (real: bob@x.co)"` leaks just as hard as one that
 * emits the bare address.
 */
export function findForeignValues(body: unknown, foreignValues: readonly string[]): string[] {
  const needles = foreignValues.map((v) => v.toLowerCase()).filter((v) => v.length > 0);
  if (needles.length === 0) return [];
  const hits: string[] = [];
  for (const n of nodes(body)) {
    if (typeof n.value !== "string") continue;
    const haystack = n.value.toLowerCase();
    for (const needle of needles) {
      if (haystack.includes(needle)) hits.push(`${n.path || "<root>"} ⊃ ${needle}`);
    }
  }
  return hits;
}

/** Throws when the body contains any of `foreignValues` (e.g. other people's emails). */
export function assertNoForeignValues(body: unknown, foreignValues: readonly string[]): void {
  const hits = findForeignValues(body, foreignValues);
  if (hits.length > 0) {
    throw new Error(
      `response exposes value(s) belonging to somebody else: ${hits.join(", ")}\n` +
        `body: ${safeJson(body)}`,
    );
  }
}

// ── (2) error envelope + traceId ────────────────────────────────────────────

/** The server-issued trace id of an error body, if present. */
export function traceIdOf(body: unknown): string | undefined {
  const err = (body as { error?: { traceId?: unknown } } | null | undefined)?.error;
  const traceId = err?.traceId;
  return typeof traceId === "string" ? traceId : undefined;
}

/**
 * Assert the wire error envelope: `{ error: { code, message, traceId, … } }`,
 * nothing else at the top level, no key outside {@link ERROR_ENVELOPE_KEYS},
 * and a `traceId` that is a real random UUID v4 (I-06 / NEW-7 — a counter or a
 * hash of the request would be an oracle, so the SHAPE is asserted, not merely
 * the presence).
 */
export function assertErrorEnvelope(
  res: HttpResponseLike,
  expected: { readonly code?: string; readonly status?: number } = {},
): void {
  const fail = (why: string): never => {
    throw new Error(`error envelope: ${why}\nstatus=${res.status} body=${safeJson(res.body)}`);
  };
  if (expected.status !== undefined && res.status !== expected.status) {
    fail(`expected status ${expected.status}, got ${res.status}`);
  }
  if (res.status < 400) fail(`expected a 4xx/5xx status, got ${res.status}`);

  const body = res.body;
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    fail("body is not an object");
  }
  const top = Object.keys(body as Record<string, unknown>);
  if (top.length !== 1 || top[0] !== "error") {
    fail(`top level must be exactly { error }, got { ${top.join(", ")} }`);
  }
  const err = (body as { error: unknown }).error;
  if (typeof err !== "object" || err === null || Array.isArray(err)) fail("`error` is not an object");
  const e = err as Record<string, unknown>;

  const stray = Object.keys(e).filter((k) => !ERROR_ENVELOPE_KEYS.includes(k));
  if (stray.length > 0) fail(`unknown key(s) in the envelope: ${stray.join(", ")}`);
  if (typeof e.code !== "string" || e.code.trim() === "") fail("`error.code` must be a non-empty string");
  if (typeof e.message !== "string" || e.message.trim() === "") {
    fail("`error.message` must be a non-empty string");
  }
  if (typeof e.traceId !== "string" || !UUID_V4.test(e.traceId)) {
    fail(`\`error.traceId\` must be a random UUID v4, got ${safeJson(e.traceId)}`);
  }
  if (expected.code !== undefined && e.code !== expected.code) {
    fail(`expected code ${expected.code}, got ${String(e.code)}`);
  }
  assertNoSecretFields(body);
}

/**
 * Drop ONLY {@link ERROR_BODY_VOLATILE_KEYS} so two error bodies can be
 * compared for "does this tell the caller anything different?".
 *
 * Refuses a body that has no `traceId`: the whole point of the closed allowlist
 * is that the normalizer can never quietly hide a difference. If the field is
 * missing, that IS the difference, and the comparison must not proceed.
 */
export function normalizeErrorBody(body: unknown): unknown {
  if (traceIdOf(body) === undefined) {
    throw new Error(
      `cannot normalize an error body with no \`error.traceId\` — every error ` +
        `response must carry one (I-06). body: ${safeJson(body)}`,
    );
  }
  const clone = JSON.parse(JSON.stringify(body)) as { error: Record<string, unknown> };
  for (const key of ERROR_BODY_VOLATILE_KEYS) delete clone.error[key];
  return clone;
}

/**
 * Two error responses must be indistinguishable to the caller (I-08 ฉ: "org
 * does not exist" vs "not your org"), while the one volatile field must
 * actually differ — a shared trace id would mean it is derived from the request
 * and becomes an oracle of its own.
 */
export function assertIdenticalErrorBodies(a: HttpResponseLike, b: HttpResponseLike): void {
  if (a.status !== b.status) {
    throw new Error(`error responses differ in status: ${a.status} vs ${b.status}`);
  }
  const na = JSON.stringify(normalizeErrorBody(a.body));
  const nb = JSON.stringify(normalizeErrorBody(b.body));
  if (na !== nb) {
    throw new Error(`error responses are distinguishable:\n  A: ${na}\n  B: ${nb}`);
  }
  const ta = traceIdOf(a.body);
  const tb = traceIdOf(b.body);
  if (ta === tb) {
    throw new Error(
      `both responses carry the SAME traceId (${String(ta)}) — it is derived from the ` +
        `request, which makes it an oracle. It must be random per response.`,
    );
  }
}

// ── (3) headers ─────────────────────────────────────────────────────────────

/** What a header must be: an exact value, or a shape. */
export type HeaderExpectation = string | RegExp;

/**
 * Assert a response's headers against a policy the CALLER supplies.
 *
 * Deliberately no default table here: the policy belongs to production
 * (`RESPONSE_HEADER_POLICY`, architecture §12.2 item 4). A copy living in the
 * suite would drift silently, and the test would keep passing against its own
 * copy while the API stopped setting the header.
 */
export function assertResponseHeaders(
  res: HttpResponseLike,
  policy: Readonly<Record<string, HeaderExpectation>>,
): void {
  const headers = res.headers ?? {};
  const problems: string[] = [];
  for (const [name, expectation] of Object.entries(policy)) {
    const raw = headers[name.toLowerCase()] ?? headers[name];
    const actual = Array.isArray(raw) ? raw.join(", ") : raw;
    if (actual === undefined) {
      problems.push(`${name}: missing`);
      continue;
    }
    const ok = typeof expectation === "string" ? actual === expectation : expectation.test(actual);
    if (!ok) problems.push(`${name}: expected ${String(expectation)}, got ${JSON.stringify(actual)}`);
  }
  if (problems.length > 0) {
    throw new Error(`response header policy violated:\n  ${problems.join("\n  ")}`);
  }
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}
