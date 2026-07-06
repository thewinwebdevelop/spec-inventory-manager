import { describe, it, expect, beforeAll } from "vitest";
import * as argon2 from "argon2";
import { HashingService } from "./hashing.service";

// ★ U1.4 (hashing) + U2.2 (rehash) + U2.1 (dummy-verify branch). Real argon2.

let svc: HashingService;

beforeAll(async () => {
  svc = new HashingService();
  await svc.onModuleInit(); // generates the dummy hash from current params (M-10)
});

describe("HashingService.hash / verify (U1.4)", () => {
  it("returns a PHC-format argon2id string with salt embedded; plaintext appears nowhere", async () => {
    const hash = await svc.hash("correct horse battery staple");
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=\d+,t=\d+,p=\d+\$/);
    expect(hash).not.toContain("correct horse battery staple");
  });

  it("verify true for correct, false for wrong", async () => {
    const hash = await svc.hash("s3cret-passphrase-value");
    expect(await svc.verify(hash, "s3cret-passphrase-value")).toBe(true);
    expect(await svc.verify(hash, "wrong")).toBe(false);
  });

  it("two hashes of the same password differ (unique salt)", async () => {
    const a = await svc.hash("same-password-value");
    const b = await svc.hash("same-password-value");
    expect(a).not.toBe(b);
  });

  it("verify returns false (never throws) on a malformed stored hash", async () => {
    expect(await svc.verify("not-a-valid-hash", "x")).toBe(false);
  });
});

describe("HashingService.needsRehash (U2.2)", () => {
  it("true for a hash produced with below-current params", async () => {
    // Seed a deliberately weak hash (lower memoryCost than the 19456 config;
    // timeCost min is 2 per argon2, so we drop memoryCost to make it below-current).
    const weak = await argon2.hash("p", { type: argon2.argon2id, memoryCost: 8192, timeCost: 2, parallelism: 1 });
    expect(svc.needsRehash(weak)).toBe(true);
  });

  it("false for a hash at current params", async () => {
    const current = await svc.hash("p");
    expect(svc.needsRehash(current)).toBe(false);
  });
});

describe("HashingService.dummyVerify (U2.1)", () => {
  it("always returns false but performs a real argon2 verify (timing parity)", async () => {
    // Returns false for any input (the dummy hash never matches a real pw).
    expect(await svc.dummyVerify("anything")).toBe(false);
    expect(await svc.dummyVerify("another")).toBe(false);
  });
});
