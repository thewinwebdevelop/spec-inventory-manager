// F-001 · T-001-03 — password hashing (argon2id). arch §5.1/§9.
// - OWASP params (auth.constants ARGON2_OPTIONS), PHC-encoded (salt embedded).
// - verify is constant-time by construction (argon2.verify).
// - rehash-on-login: if a stored hash's params are below current, re-hash the
//   just-verified plaintext transparently (§5.1).
// - dummy-verify: on unknown email the login path verifies against a DUMMY hash
//   so timing is identical whether or not the account exists (§9). (M-10) the
//   dummy hash is generated from the CURRENT params at construction, so bumping
//   params regenerates it atomically — never a stale low-param dummy.
import { Injectable, OnModuleInit } from "@nestjs/common";
import * as argon2 from "argon2";
import { ARGON2_OPTIONS } from "./auth.constants";

@Injectable()
export class HashingService implements OnModuleInit {
  /**
   * A fixed dummy hash generated from the CURRENT argon2 params (M-10). Used by
   * the login path's dummy-verify on unknown email so the not-found branch does
   * the same argon2 work as a real verify. Regenerated at boot from
   * ARGON2_OPTIONS, so if params are bumped the dummy is bumped with them.
   */
  private dummyHash!: string;

  async onModuleInit(): Promise<void> {
    // Derive the dummy hash from the current params at boot (M-10): a random,
    // never-matching plaintext hashed with ARGON2_OPTIONS. Never persisted; its
    // only purpose is to make the unknown-email path cost the same as a real
    // verify under the SAME params in force right now.
    this.dummyHash = await argon2.hash("dummy-verify-placeholder-not-a-real-password", ARGON2_OPTIONS);
  }

  /** Hash a plaintext password → PHC-encoded argon2id string (salt embedded). */
  async hash(plaintext: string): Promise<string> {
    return argon2.hash(plaintext, ARGON2_OPTIONS);
  }

  /**
   * Constant-time verify. Returns false (never throws) on a malformed/verify
   * failure so a corrupt stored hash can't be distinguished by an exception.
   */
  async verify(hash: string, plaintext: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plaintext);
    } catch {
      return false;
    }
  }

  /**
   * Dummy-verify against the fixed dummy hash — always returns false, but does
   * the SAME argon2 work as a real verify so the unknown-email login path is
   * timing-indistinguishable from a real (wrong-password) verify (§9). The
   * login service calls this on the not-found branch.
   */
  async dummyVerify(plaintext: string): Promise<boolean> {
    return this.verify(this.dummyHash, plaintext);
  }

  /**
   * True if a stored hash was produced with params below current config →
   * caller should transparently re-hash the just-verified plaintext (§5.1).
   * argon2.needsRehash compares the encoded params against ARGON2_OPTIONS.
   */
  needsRehash(hash: string): boolean {
    try {
      return argon2.needsRehash(hash, ARGON2_OPTIONS);
    } catch {
      // A hash we can't parse is safest treated as needing a rehash (it will be
      // replaced on the next successful login).
      return true;
    }
  }
}
