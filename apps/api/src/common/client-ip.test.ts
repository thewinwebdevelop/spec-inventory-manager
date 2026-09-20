// F-002 · T-002-11 ★ (N-3) — the ONE client-IP → rate-limit-bucket helper.
//
// Why this exists: a per-IP limiter keyed on the FULL address is a no-op for
// IPv6, because a single subscriber is normally handed a whole /64 (2^64
// addresses). Rotating the low 64 bits gives unlimited buckets ⇒ unlimited
// attempts. So IPv6 is collapsed to its /64 BEFORE the key is built.
//
// Non-negotiables encoded here:
//  - IPv4 behaviour is byte-identical to F-001 (no accidental regression).
//  - IPv4-mapped IPv6 (::ffff:1.2.3.4) is an IPv4 client, NOT a /64.
//  - Anything unparseable collapses into ONE shared bucket (fail-closed):
//    garbage must never mint fresh buckets, that is the bypass we are closing.
//  - The helper NEVER reads headers: which address is "the client" stays a
//    property of express `trust proxy` / TRUST_PROXY_HOPS.
import { describe, it, expect } from "vitest";
import { clientIpKey, clientIpKeyFromRequest, UNKNOWN_IP_BUCKET } from "./client-ip";

describe("clientIpKey — IPv4 (F-001 behaviour must not change)", () => {
  it("returns the IPv4 address verbatim", () => {
    for (const ip of ["1.2.3.4", "10.0.0.1", "127.0.0.1", "255.255.255.255", "0.0.0.0"]) {
      expect(clientIpKey(ip)).toBe(ip);
    }
  });

  it("keeps distinct IPv4 addresses in distinct buckets (no prefix collapsing on v4)", () => {
    expect(clientIpKey("203.0.113.1")).not.toBe(clientIpKey("203.0.113.2"));
    // …not even inside the same /24 — v4 hosts are not handed a subnet each.
    expect(clientIpKey("203.0.113.1")).toBe("203.0.113.1");
  });

  it("strips an IPv4 host:port form (some proxies append the source port)", () => {
    expect(clientIpKey("203.0.113.9:54321")).toBe("203.0.113.9");
  });
});

describe("clientIpKey — IPv6 collapses to /64 (N-3)", () => {
  it("two addresses in the SAME /64 produce the SAME key", () => {
    const a = clientIpKey("2001:db8:85a3:1::1");
    const b = clientIpKey("2001:db8:85a3:1:ffff:ffff:ffff:ffff");
    expect(a).toBe(b);
    expect(a).toBe("2001:db8:85a3:1::/64");
  });

  it("rotating the low 64 bits cannot mint new buckets", () => {
    const keys = new Set(
      ["2001:db8:85a3:1::1", "2001:db8:85a3:1::2", "2001:db8:85a3:1:0:0:1:0", "2001:db8:85a3:1:dead:beef:cafe:1"].map(
        clientIpKey,
      ),
    );
    expect(keys.size).toBe(1);
  });

  it("addresses in DIFFERENT /64s produce DIFFERENT keys", () => {
    expect(clientIpKey("2001:db8:85a3:1::1")).not.toBe(clientIpKey("2001:db8:85a3:2::1"));
    expect(clientIpKey("2001:db8:85a3:2::1")).toBe("2001:db8:85a3:2::/64");
  });

  it("canonicalises compressed / expanded / upper-case spellings to one key", () => {
    const expanded = clientIpKey("2001:0DB8:0000:0000:0000:0000:0000:0001");
    expect(clientIpKey("2001:db8::1")).toBe(expanded);
    expect(expanded).toBe("2001:db8::/64");
  });

  it("handles the loopback / all-zero prefix", () => {
    expect(clientIpKey("::1")).toBe("::/64");
    expect(clientIpKey("::")).toBe("::/64");
  });

  it("emits an RFC-5952-shaped prefix (lower-case, longest zero-run compressed)", () => {
    expect(clientIpKey("2001:db8:0:1:2:3:4:5")).toBe("2001:db8:0:1::/64");
    expect(clientIpKey("fe80::1")).toBe("fe80::/64");
  });

  it("ignores a zone id and surrounding brackets", () => {
    expect(clientIpKey("fe80::1%eth0")).toBe("fe80::/64");
    expect(clientIpKey("[2001:db8::1]")).toBe("2001:db8::/64");
    expect(clientIpKey("[2001:db8::1]:443")).toBe("2001:db8::/64");
  });
});

describe("clientIpKey — IPv4-mapped IPv6 is an IPv4 client, not a /64", () => {
  it("::ffff:1.2.3.4 keys exactly like 1.2.3.4", () => {
    expect(clientIpKey("::ffff:1.2.3.4")).toBe("1.2.3.4");
    expect(clientIpKey("::ffff:1.2.3.4")).toBe(clientIpKey("1.2.3.4"));
  });

  it("the hex spelling of the same mapped address keys identically", () => {
    // ::ffff:c0a8:1 === ::ffff:192.168.0.1
    expect(clientIpKey("::ffff:c0a8:1")).toBe("192.168.0.1");
  });

  it("two different mapped IPv4s stay in different buckets (not collapsed to ::/64)", () => {
    expect(clientIpKey("::ffff:203.0.113.1")).not.toBe(clientIpKey("::ffff:203.0.113.2"));
    expect(clientIpKey("::ffff:203.0.113.1")).not.toBe("::/64");
  });

  it("a dual-stack client seen as ::ffff:127.0.0.1 shares the 127.0.0.1 bucket", () => {
    expect(clientIpKey("::ffff:127.0.0.1")).toBe("127.0.0.1");
  });
});

describe("clientIpKey — unparseable input fails CLOSED into one shared bucket", () => {
  const garbage = [
    undefined,
    null,
    "",
    "   ",
    "unknown",
    "garbage",
    "1.2.3",
    "1.2.3.4.5",
    "999.1.1.1",
    "01.2.3.4", // leading zero → ambiguous (octal) → refuse to guess
    "2001:db8:::1",
    "2001:db8::1::2",
    "::ffff:1.2.3",
    "1.2.3.4, 5.6.7.8",
    "12345:db8::1",
    "0x7f000001",
  ];

  it("maps every unparseable value to the SAME single bucket", () => {
    const keys = new Set(garbage.map((g) => clientIpKey(g as string | null | undefined)));
    expect(keys).toEqual(new Set([UNKNOWN_IP_BUCKET]));
  });

  it("garbage can never mint a fresh bucket (that would be the bypass)", () => {
    const rotating = Array.from({ length: 50 }, (_, i) => `not-an-ip-${i}`);
    expect(new Set(rotating.map(clientIpKey)).size).toBe(1);
  });

  it("the unknown bucket cannot be confused with a real address bucket", () => {
    expect(UNKNOWN_IP_BUCKET).toBe("unknown");
    expect(clientIpKey("1.2.3.4")).not.toBe(UNKNOWN_IP_BUCKET);
    expect(clientIpKey("2001:db8::1")).not.toBe(UNKNOWN_IP_BUCKET);
  });
});

describe("clientIpKeyFromRequest — TRUST_PROXY_HOPS still decides the source IP", () => {
  it("derives the key from req.ip (what express resolved) and nothing else", () => {
    const req = {
      ip: "2001:db8:aaaa:1::9",
      headers: { "x-forwarded-for": "203.0.113.7" }, // must be ignored here
    };
    expect(clientIpKeyFromRequest(req)).toBe("2001:db8:aaaa:1::/64");
  });

  it("with trust proxy = 0 express leaves req.ip as the socket peer → the spoofed XFF has no effect", () => {
    // Simulates TRUST_PROXY_HOPS=0: express ignores X-Forwarded-For, so two
    // requests with different spoofed XFF share one socket-peer bucket.
    const reqA = { ip: "::ffff:127.0.0.1", headers: { "x-forwarded-for": "1.2.3.4" } };
    const reqB = { ip: "::ffff:127.0.0.1", headers: { "x-forwarded-for": "5.6.7.8" } };
    const a = clientIpKeyFromRequest(reqA);
    const b = clientIpKeyFromRequest(reqB);
    expect(a).toBe(b);
  });

  it("a missing req.ip falls back to the shared unknown bucket", () => {
    expect(clientIpKeyFromRequest({})).toBe(UNKNOWN_IP_BUCKET);
  });
});
