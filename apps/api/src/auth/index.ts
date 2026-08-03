// F-002 · T-002-15 — the public surface of `auth/`.
//
// backend.md §2.2 rule 1: a feature module may use another feature module only
// through its exported providers, and must import them from that module's
// barrel — never by deep-importing a file inside it. `orgs/` needs exactly two
// things from here, so this file exists to make that rule literally true rather
// than aspirational:
//
//   SecurityEventsService  the ONE audit emitter (`org.created`, …). It lives in
//                          `auth/` for historical reasons (F-001 built it) and
//                          `common/`/`tenancy/` may not import a feature module,
//                          which is why the two global guards get it injected by
//                          the composition root instead. A feature module has no
//                          such restriction and injects it directly, so there is
//                          exactly one emitter and `collectSecurityEvents()`
//                          sees every event.
//   JsonOnlyGuard          the 415 transport guard api-spec §1 requires on every
//                          body-carrying route, not just `/auth/*`.
//
// ⛔ Nothing else is re-exported on purpose. `AuthService`, the throttle and the
// token services are auth's internals; a feature module that needs one of them
// is a design question, not an import.
export { AuthModule, AUTH_REDIS } from "./auth.module";
export { JsonOnlyGuard } from "./json-only.guard";
export {
  SecurityEventsService,
  collectSecurityEvents,
  SECURITY_EVENT_TYPES,
  type SecurityEvent,
  type SecurityEventType,
  type SecurityEventCollector,
} from "./security-events.service";
