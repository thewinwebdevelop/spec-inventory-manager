// F-002 · T-002-16 — the cursor codec (api-spec §1 "Pagination").
import { describe, it, expect } from "vitest";
import {
  CURSOR_INVALID_MESSAGE,
  DEFAULT_PAGE_SIZE,
  LIMIT_INVALID_MESSAGE,
  MAX_PAGE_SIZE,
  decodeCursor,
  encodeCursor,
  paginate,
  requireCursor,
  resolveLimit,
} from "./cursor";
import { DomainException } from "./domain-exception";

const POSITION = { createdAt: "2026-07-28T09:00:00.000Z", id: "mem_123" };

describe("encodeCursor / decodeCursor", () => {
  it("round-trips a position", () => {
    expect(decodeCursor(encodeCursor(POSITION))).toEqual(POSITION);
  });

  it("is base64url — safe in a query string without escaping", () => {
    const encoded = encodeCursor({ createdAt: POSITION.createdAt, id: "a/b+c?d=e" });
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(encoded)?.id).toBe("a/b+c?d=e");
  });

  it("is opaque — the id is not readable at a glance", () => {
    expect(encodeCursor(POSITION)).not.toContain("mem_123");
  });

  it.each([
    ["not base64 at all", "!!!!"],
    ["base64 of not-JSON", Buffer.from("hello", "utf8").toString("base64url")],
    ["JSON that is not an object", Buffer.from("42", "utf8").toString("base64url")],
    ["JSON missing the id", Buffer.from('{"c":"2026-01-01T00:00:00Z"}', "utf8").toString("base64url")],
    ["JSON missing the timestamp", Buffer.from('{"i":"x"}', "utf8").toString("base64url")],
    ["an unparseable timestamp", Buffer.from('{"c":"soon","i":"x"}', "utf8").toString("base64url")],
    ["empty strings", Buffer.from('{"c":"","i":""}', "utf8").toString("base64url")],
    ["the empty string", ""],
    ["a number", 7],
    ["null", null],
  ])("★ returns null for %s — never a half-decoded value", (_label, raw) => {
    expect(decodeCursor(raw)).toBeNull();
  });

  it("★ does not throw on a hostile payload (a huge nested object)", () => {
    const hostile = Buffer.from(JSON.stringify({ c: { a: { b: 1 } }, i: [] }), "utf8").toString(
      "base64url",
    );
    expect(decodeCursor(hostile)).toBeNull();
  });
});

describe("requireCursor", () => {
  it("undefined for an absent cursor (first page)", () => {
    expect(requireCursor(undefined)).toBeUndefined();
    expect(requireCursor("")).toBeUndefined();
  });

  it("★ 422 VALIDATION_FAILED with a fieldError for garbage — never a silent page 1", () => {
    // Silently ignoring a bad cursor would restart the list from the top, which
    // a client experiences as an infinite loop over the first page.
    try {
      requireCursor("!!!not-a-cursor");
      throw new Error("expected a throw");
    } catch (err) {
      expect(err).toBeInstanceOf(DomainException);
      const ex = err as DomainException;
      expect(ex.getStatus()).toBe(422);
      expect(ex.code).toBe("VALIDATION_FAILED");
      expect(ex.fieldErrors).toEqual({ cursor: CURSOR_INVALID_MESSAGE });
    }
  });
});

describe("resolveLimit", () => {
  it("defaults to 25", () => {
    expect(resolveLimit(undefined)).toBe(DEFAULT_PAGE_SIZE);
    expect(resolveLimit("")).toBe(DEFAULT_PAGE_SIZE);
  });

  it("accepts a numeric string (query params are strings)", () => {
    expect(resolveLimit("10")).toBe(10);
  });

  it("★ clamps to the maximum rather than refusing (no unbounded scan)", () => {
    expect(resolveLimit("100000")).toBe(MAX_PAGE_SIZE);
    expect(resolveLimit(50, 10)).toBe(10);
  });

  it.each(["0", "-1", "abc", "2.5", Number.NaN])("422 for limit=%s", (raw) => {
    try {
      resolveLimit(raw);
      throw new Error("expected a throw");
    } catch (err) {
      expect(err).toBeInstanceOf(DomainException);
      expect((err as DomainException).fieldErrors).toEqual({ limit: LIMIT_INVALID_MESSAGE });
    }
  });
});

describe("paginate", () => {
  const row = (id: string) => ({ id, createdAt: new Date("2026-07-28T09:00:00.000Z") });
  const toCursor = (r: { id: string; createdAt: Date }) => ({
    createdAt: r.createdAt.toISOString(),
    id: r.id,
  });

  it("a short page has no next cursor", () => {
    const result = paginate([row("a"), row("b")], 5, toCursor);
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBeNull();
  });

  it("★ an EXACTLY full page still has no next cursor (over-fetch by one)", () => {
    // The failure this pins: returning a cursor because the page was full leads
    // to an empty next page — infinite scroll that never terminates.
    const result = paginate([row("a"), row("b")], 2, toCursor);
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBeNull();
  });

  it("drops the extra row and points the cursor at the LAST returned row", () => {
    const result = paginate([row("a"), row("b"), row("c")], 2, toCursor);
    expect(result.items.map((r) => r.id)).toEqual(["a", "b"]);
    expect(decodeCursor(result.nextCursor)).toEqual({
      createdAt: "2026-07-28T09:00:00.000Z",
      id: "b",
    });
  });
});
