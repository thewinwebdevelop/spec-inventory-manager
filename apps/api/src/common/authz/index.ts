// F-002 · T-002-05 ★ — public surface of the authorization layer.
//
// Controllers import the two decorators from here; @qa imports the two tables +
// `enumerateRoutes` (architecture §12.2 item 4/7). The guard itself is wired
// once, globally, in `TenancyModule` — a feature module must never re-register
// it (`@UseGuards(CapabilityGuard)` on a controller would run it a second time
// and, worse, suggests it is opt-in when the whole point is that it is not).
export {
  RequireCapability,
  AnyActiveMember,
  CAPABILITY_KEY,
  ANY_ACTIVE_MEMBER_KEY,
} from "./capability.decorator";
export { CapabilityGuard } from "./capability.guard";
export {
  CAPABILITY_EVENT_SINK,
  CAPABILITY_DENIED_EVENT,
  LoggingCapabilityEventSink,
  type CapabilityEventSink,
} from "./capability-events";
export {
  ROUTE_CAPABILITIES,
  ANY_ACTIVE_MEMBER_ROUTES,
  CAPABILITY_MANAGE_ORG_SETTINGS,
  MUTATING_HTTP_METHODS,
  READ_HTTP_METHODS,
  isMutatingMethod,
  routeKey,
  toTemplatePath,
  type RouteCapability,
  type AnyActiveMemberRoute,
} from "./route-capabilities";
export {
  enumerateRoutes,
  type RouteDeclaration,
  type RouteDeclarationKind,
} from "./route-declarations";
