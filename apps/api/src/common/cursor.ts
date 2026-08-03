// F-002 · T-002-16 — opaque keyset cursors (api-spec §1 "Pagination",
// backend.md §2.2 "pagination helper (cursor encode/decode)").
//
// EVERY list in this API is `?cursor&limit` → `{ items, nextCursor }` with a
// FIXED sort of `createdAt desc, id desc`. Offset pagination is not an option:
// with rows arriving while a user pages, `OFFSET` silently skips and repeats
// rows, and the bug only shows up in production data.
//
// THE CURSOR IS OPAQUE ON PURPOSE (api-spec §1: "ห้าม client แกะ"). It is
// base64url of a tiny JSON object — deliberately NOT signed:
//   * it carries no authorization. The org filter and the `userId` filter are
//     re-applied server-side on every page, so a caller who tampers with a
//     cursor can only move their own window inside their own result set;
//   * a signature would need a key, key rotation, and would still not stop that.
// What it MUST do is fail SAFELY on garbage: `decodeCursor` returns `null` for
// anything it cannot read, and the caller then answers 422 rather than crashing
// or — much worse — silently serving page 1 as if the cursor had been honoured.
import { domainError } from "./domain-exception";

/** The position of the last row of the previous page (the fixed sort key). */
export interface KeysetCursor {
  /** ISO-8601 UTC timestamp of the row's `createdAt`. */
  readonly createdAt: string;
  /** The row id — the tiebreaker that makes the sort total. */
  readonly id: string;
}

/** api-spec §1 — the default page size when the caller does not say. */
export const DEFAULT_PAGE_SIZE = 25;
/** Upper bound. A caller asking for more gets this, never an unbounded scan. */
export const MAX_PAGE_SIZE = 100;

/** Thai copy for a cursor the server cannot read (422). */
export const CURSOR_INVALID_MESSAGE = "ตัวชี้หน้าถัดไปไม่ถูกต้อง";
/** Thai copy for a `limit` that is not a positive integer (422). */
export const LIMIT_INVALID_MESSAGE = "จำนวนรายการต่อหน้าไม่ถูกต้อง";

/** Encode a keyset position. Returns a base64url string with no padding. */
export function encodeCursor(cursor: KeysetCursor): string {
  return Buffer.from(JSON.stringify({ c: cursor.createdAt, i: cursor.id }), "utf8").toString(
    "base64url",
  );
}

/**
 * Decode a cursor, or `null` when it is not one we produced.
 *
 * Structurally validated (both fields present, both non-empty strings, the
 * timestamp parseable) so a malformed value can never reach a Prisma `where`
 * as `undefined` — which would quietly widen the query to "no cursor" and
 * repeat page 1 forever.
 */
export function decodeCursor(raw: unknown): KeysetCursor | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const { c, i } = parsed as { c?: unknown; i?: unknown };
  if (typeof c !== "string" || typeof i !== "string" || c === "" || i === "") return null;
  if (Number.isNaN(Date.parse(c))) return null;
  return { createdAt: c, id: i };
}

/** Decoded cursor, or a `422 VALIDATION_FAILED` naming the field. */
export function requireCursor(raw: unknown): KeysetCursor | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const cursor = decodeCursor(raw);
  if (!cursor) {
    throw domainError("VALIDATION_FAILED", { fieldErrors: { cursor: CURSOR_INVALID_MESSAGE } });
  }
  return cursor;
}

/**
 * Resolve `?limit`. Absent → {@link DEFAULT_PAGE_SIZE}; above the maximum →
 * clamped (never an error: a client asking for 1000 wants "as many as you will
 * give me"). Non-numeric / zero / negative → 422, because those are bugs whose
 * silent correction would hide the bug.
 */
export function resolveLimit(raw: unknown, max: number = MAX_PAGE_SIZE): number {
  if (raw === undefined || raw === null || raw === "") return Math.min(DEFAULT_PAGE_SIZE, max);
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw domainError("VALIDATION_FAILED", { fieldErrors: { limit: LIMIT_INVALID_MESSAGE } });
  }
  return Math.min(value, max);
}

/**
 * Split an over-fetched result (`limit + 1` rows) into the page and the cursor
 * for the next one.
 *
 * Over-fetching by exactly one is what makes `nextCursor: null` HONEST: a page
 * that happens to be full is not evidence that more rows exist, and returning a
 * cursor for an empty next page is how "infinite scroll that never ends" is
 * written.
 */
export function paginate<T>(
  rows: readonly T[],
  limit: number,
  toCursor: (row: T) => KeysetCursor,
): { items: T[]; nextCursor: string | null } {
  if (rows.length <= limit) return { items: [...rows], nextCursor: null };
  const items = rows.slice(0, limit);
  return { items, nextCursor: encodeCursor(toCursor(items[items.length - 1])) };
}
