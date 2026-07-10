import { describe, it, expect } from "vitest";
import { HttpException, type ExecutionContext } from "@nestjs/common";
import { JsonOnlyGuard } from "./json-only.guard";

// I5c.1 (L-2) unit-level — 415 unless application/json.

function ctxWithContentType(contentType?: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers: contentType ? { "content-type": contentType } : {} }) }),
  } as unknown as ExecutionContext;
}

describe("JsonOnlyGuard (L-2)", () => {
  const guard = new JsonOnlyGuard();

  it("allows application/json", () => {
    expect(guard.canActivate(ctxWithContentType("application/json"))).toBe(true);
  });

  it("allows application/json with charset param", () => {
    expect(guard.canActivate(ctxWithContentType("application/json; charset=utf-8"))).toBe(true);
  });

  it.each([
    "application/x-www-form-urlencoded",
    "multipart/form-data; boundary=x",
    "text/plain",
    undefined,
  ])("rejects %s with 415", (ct) => {
    try {
      guard.canActivate(ctxWithContentType(ct));
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(415);
      expect((err as HttpException).getResponse()).toMatchObject({
        error: { code: "UNSUPPORTED_MEDIA_TYPE" },
      });
    }
  });
});
