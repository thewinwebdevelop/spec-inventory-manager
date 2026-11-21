// F-003 · T-003-B23 ★ — the `ROLE_WRITE_DECIDER` seam (architecture §2 "พิสูจน์ว่าแดงได้จริง" ·
// §13.1 · §13.5 "DI seam").
//
// Production binds the pure `decideRoleWrite` (core-domain) and nothing else.
// The seam exists so tests can prove the layers BEHIND the decider still hold
// on their own: inject a decider that allows everything and the Owner
// invariant must still answer `409 LAST_OWNER` with zero writes (U-API3-01 ·
// MUT-07), and G3-01 can spy that every `@RoleWrite()` route really decides.
//
// ⛔ Never bind anything but `decideRoleWrite` in a production module.
import type { Provider } from "@nestjs/common";
import { decideRoleWrite, type RoleWriteDecider } from "@omnistock/core-domain";

export const ROLE_WRITE_DECIDER = Symbol("ROLE_WRITE_DECIDER");

export const roleWriteDeciderProvider: Provider = {
  provide: ROLE_WRITE_DECIDER,
  useValue: decideRoleWrite satisfies RoleWriteDecider,
};
