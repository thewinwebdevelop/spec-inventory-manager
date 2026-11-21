// F-003 · T-003-B23 (from review DV01 — Medium) — the env SNAPSHOT `main.ts`
// validated at boot, handed to the DI graph once.
//
// Before this, providers called `loadEnv(process.env)` inside their own
// `useFactory`. That reads whatever `process.env` holds when Nest gets round to
// the factory — not the env `main.ts` validated and logged. For most values the
// two never differ; for `ROLE_WRITES_ENABLED` (the rollout switch of
// architecture §12) "the value we booted with" is the whole point, so every
// org-config consumer now reads THIS object.
//
// ⚠️ Not every reader: auth, the JWT verifier (`tenancy.module.ts`), health and
// the org rate-limit numbers still read `process.env` (security review B23
// L-3). Those values cannot change the role-write rollout switch, so they were
// left alone — do not read this file as "nothing reads process.env after boot".
//
// Lives in `common/` (leaf layer) because the consumer that matters most —
// `RoleWritesEnabledGuard`, a global guard registered in `tenancy/` — may not
// import a feature module (depcruise `api-leafward-only`).
import { Global, Module, type DynamicModule } from "@nestjs/common";
import type { Env } from "@omnistock/config";

/** The validated, frozen `Env` from `loadEnv()` at boot (main.ts). */
export const BOOT_ENV = Symbol("BOOT_ENV");

/**
 * F-003 §12 — `ROLE_WRITES_ENABLED` as a boolean, from {@link BOOT_ENV}. The read
 * routes report `writes_disabled` from it (api-spec §3) and
 * `RoleWritesEnabledGuard` answers `503` from it — ONE token, so a verdict and
 * a 503 cannot disagree.
 */
export const ROLE_WRITES_ENABLED = Symbol("ROLE_WRITES_ENABLED");

@Global()
@Module({})
export class BootEnvModule {
  /** `env` MUST be the object `loadEnv()` returned at boot — never re-parsed here. */
  static forRoot(env: Env): DynamicModule {
    return {
      module: BootEnvModule,
      global: true,
      providers: [
        // Frozen in place: same object main.ts holds, but nobody downstream can edit it.
        { provide: BOOT_ENV, useValue: Object.isFrozen(env) ? env : Object.freeze(env) },
        {
          provide: ROLE_WRITES_ENABLED,
          // Already a boolean (exact "true" only — `parseRoleWritesEnabled`).
          useFactory: (boot: Env): boolean => boot.ROLE_WRITES_ENABLED === true,
          inject: [BOOT_ENV],
        },
      ],
      exports: [BOOT_ENV, ROLE_WRITES_ENABLED],
    };
  }
}
