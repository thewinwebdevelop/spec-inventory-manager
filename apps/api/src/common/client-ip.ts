// F-002 · T-002-11 ★ (security-review N-3, architecture §8 / §15 row 3)
// The ONE place that turns a client IP into a rate-limit bucket identity.
// Used by `auth/throttle.service.ts` (F-001) and by the org rate-limit guard
// (F-002 §8). Do not re-implement this logic anywhere else.
//
// ── Why ────────────────────────────────────────────────────────────────────
// A per-IP limiter keyed on the FULL address is a no-op against IPv6: one
// subscriber is normally delegated a whole /64 (2^64 addresses), so rotating
// the interface identifier mints an unlimited number of buckets ⇒ unlimited
// attempts. Collapsing IPv6 to its /64 makes "one bucket ≈ one subscriber"
// true again. IPv4 has no such delegation (a host is one address), so IPv4
// keys are left exactly as F-001 shipped them.
//
// ── Trade-off, stated on purpose ───────────────────────────────────────────
// Clients that genuinely SHARE a /64 (same household, one small office) now
// share one quota. That is the intended cost of prefix collapsing: it is the
// only way to make the limit bind to something the attacker cannot rotate.
// Quotas are sized per §8 with that sharing in mind.
//
// ── Fail-closed on unparseable input ───────────────────────────────────────
// Anything we cannot parse maps to ONE shared `unknown` bucket instead of
// being passed through verbatim. Passing garbage through would let an
// attacker (in a mis-set TRUST_PROXY_HOPS deployment where X-Forwarded-For is
// attacker-controlled) mint a fresh bucket per request — i.e. exactly the
// bypass this task closes. The cost of the safer choice is bounded: unrelated
// unparseable-IP traffic shares one quota (a shared-fate throttle, never an
// authorization decision), and it matches what F-001 already did with its
// `req.ip ?? "unknown"` fallback.
//
// ── Not our job ────────────────────────────────────────────────────────────
// WHICH address is "the client" is decided by express `trust proxy`, driven by
// TRUST_PROXY_HOPS (main.ts). This helper never looks at headers; it only
// normalises an address that has already been resolved.

/** Single shared bucket for addresses we refuse to guess at (fail-closed). */
export const UNKNOWN_IP_BUCKET = "unknown";

/** Prefix length IPv6 clients are collapsed to before keying (N-3). */
export const IPV6_BUCKET_PREFIX_BITS = 64;

/** Minimal shape of what we read off a request: only the resolved `req.ip`. */
export interface IpBearingRequest {
  readonly ip?: string | undefined;
}

// Strict dotted-quad: 0-255 per octet, no leading zeros (an octal-looking
// "01.2.3.4" is ambiguous across parsers, so we refuse rather than guess).
const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const HEXTET_RE = /^[0-9a-f]{1,4}$/;
const BRACKETED_RE = /^\[([^\]]+)\](?::\d{1,5})?$/;
const IPV4_WITH_PORT_RE = /^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/;

/**
 * Rate-limit bucket identity for a client IP.
 *
 * - IPv4              → returned verbatim (`"1.2.3.4"`), F-001 behaviour.
 * - IPv4-mapped IPv6  → treated as its IPv4 (`"::ffff:1.2.3.4"` → `"1.2.3.4"`).
 * - IPv6              → collapsed to its /64 (`"2001:db8:a:1::9"` →
 *                       `"2001:db8:a:1::/64"`).
 * - anything else     → {@link UNKNOWN_IP_BUCKET} (fail-closed, shared).
 */
export function clientIpKey(rawIp: string | null | undefined): string {
  const trimmed = typeof rawIp === "string" ? rawIp.trim() : "";
  if (trimmed === "") return UNKNOWN_IP_BUCKET;

  const address = stripEnvelope(trimmed);
  if (IPV4_RE.test(address)) return address;

  const groups = parseIpv6(address.toLowerCase());
  if (groups === null) return UNKNOWN_IP_BUCKET;

  const mappedIpv4 = ipv4MappedDottedQuad(groups);
  if (mappedIpv4 !== null) return mappedIpv4;

  // Keep the top 64 bits, zero the interface identifier.
  const prefix = [groups[0], groups[1], groups[2], groups[3], 0, 0, 0, 0];
  return `${formatIpv6(prefix)}/${IPV6_BUCKET_PREFIX_BITS}`;
}

/**
 * Bucket identity for an express request. Reads ONLY `req.ip` — i.e. the
 * address express resolved under `trust proxy` (TRUST_PROXY_HOPS). Headers are
 * deliberately not consulted here.
 */
export function clientIpKeyFromRequest(req: IpBearingRequest): string {
  return clientIpKey(req.ip);
}

/** Drop `[...]` brackets, a trailing `:port`, and any `%zone` suffix. */
function stripEnvelope(value: string): string {
  let address = value;
  const bracketed = BRACKETED_RE.exec(address);
  if (bracketed) {
    address = bracketed[1];
  } else {
    const withPort = IPV4_WITH_PORT_RE.exec(address);
    // Only IPv4 can carry an unambiguous `:port` without brackets.
    if (withPort) address = withPort[1];
  }
  const zone = address.indexOf("%");
  return zone === -1 ? address : address.slice(0, zone);
}

/** Parse an IPv6 literal into 8 16-bit groups, or null if it is not one. */
function parseIpv6(input: string): number[] | null {
  if (!input.includes(":")) return null;

  const doubleColon = input.indexOf("::");
  if (doubleColon !== -1 && input.indexOf("::", doubleColon + 1) !== -1) return null;

  const head = doubleColon === -1 ? input : input.slice(0, doubleColon);
  const tail = doubleColon === -1 ? "" : input.slice(doubleColon + 2);

  const headParts = head === "" ? [] : head.split(":");
  const tailParts = tail === "" ? [] : tail.split(":");

  // A trailing dotted-quad (::ffff:1.2.3.4) is only legal at the very end.
  const headGroups = toGroups(headParts, doubleColon === -1);
  const tailGroups = toGroups(tailParts, true);
  if (headGroups === null || tailGroups === null) return null;

  if (doubleColon === -1) return headGroups.length === 8 ? headGroups : null;

  // "::" must stand for at least one zero group.
  const omitted = 8 - headGroups.length - tailGroups.length;
  if (omitted < 1) return null;
  return [...headGroups, ...new Array<number>(omitted).fill(0), ...tailGroups];
}

function toGroups(parts: string[], allowIpv4Tail: boolean): number[] | null {
  const groups: number[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isLast = i === parts.length - 1;
    if (part.includes(".")) {
      if (!isLast || !allowIpv4Tail || !IPV4_RE.test(part)) return null;
      const [a, b, c, d] = part.split(".").map((o) => Number(o));
      groups.push((a << 8) | b, (c << 8) | d);
      continue;
    }
    if (!HEXTET_RE.test(part)) return null;
    groups.push(Number.parseInt(part, 16));
  }
  return groups.length > 8 ? null : groups;
}

/** `::ffff:a.b.c.d` (RFC 4291 §2.5.5.2) → the dotted quad; otherwise null. */
function ipv4MappedDottedQuad(groups: number[]): string | null {
  const isMapped =
    groups[0] === 0 && groups[1] === 0 && groups[2] === 0 && groups[3] === 0 && groups[4] === 0 && groups[5] === 0xffff;
  if (!isMapped) return null;
  const high = groups[6];
  const low = groups[7];
  return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
}

/** RFC 5952 text form: lower-case, no leading zeros, longest zero run as "::". */
function formatIpv6(groups: number[]): string {
  let bestStart = -1;
  let bestLength = 0;
  let runStart = -1;
  let runLength = 0;
  for (let i = 0; i < groups.length; i++) {
    if (groups[i] !== 0) {
      runStart = -1;
      runLength = 0;
      continue;
    }
    if (runStart === -1) runStart = i;
    runLength += 1;
    if (runLength > bestLength) {
      bestStart = runStart;
      bestLength = runLength;
    }
  }
  const hextets = groups.map((g) => g.toString(16));
  // A single zero group is written as "0", not compressed (RFC 5952 §4.2.2).
  if (bestLength < 2) return hextets.join(":");
  return `${hextets.slice(0, bestStart).join(":")}::${hextets.slice(bestStart + bestLength).join(":")}`;
}
