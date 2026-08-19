/// T-002-M1 ★ — the one piece of state the router guard and every feature read
/// (mobile.md §3.2).
///
/// A sealed class, so `switch` over it is exhaustive: a fifth state cannot be
/// added without every reader being asked what to do about it. That matters
/// because two of these are easy to conflate and the conflation is dangerous
/// in opposite directions:
///
///   - [SessionUnknown] is NOT [SessionNone]. Bootstrap has not answered yet.
///     Treating it as "logged out" bounces a live session to login on every
///     cold start; treating it as "logged in" flashes shop data at somebody
///     who may not be.
///   - [SessionAuthed] with `active == null` is NOT "no session". The person
///     is signed in and simply has not picked a shop — the org picker, not the
///     login screen.
library;

import 'package:flutter/foundation.dart' show immutable;

/// The capability that IS ownership (D-028/C-1), and a WILDCARD for every
/// other capability. It lives here, in core, because both meanings are read
/// outside the invite screen that first needed it.
const String fullAccessCapability = 'full_access';

/// ★ The rule, in one place: `full_access` answers every question.
///
/// A free function as well as [ActiveOrg.can] because not every caller holds
/// an `ActiveOrg` — `features/org/domain/tax_reveal.dart` is pure and takes a
/// plain `Set<String>`. When it was written it re-implemented this line, and
/// the capability tripwire in the web lane (which scans BOTH trees) failed the
/// build over it. That is the guard doing precisely its job: a second copy of
/// an authorization rule is how two answers to one question start.
bool hasCapability(Set<String> capabilities, String required) =>
    capabilities.contains(fullAccessCapability) || capabilities.contains(required);

/// What the caller may DO in a shop, cached after login/switch.
///
/// `capabilities` is RBAC (F-003) and `entitlements` is the plan tier (F-007).
/// They are separate fields on purpose: "may this person?" and "does this shop
/// pay for it?" are different questions, and collapsing them shows an upgrade
/// prompt to a Staff member whose shop already has the feature.
@immutable
class ActiveOrg {
  const ActiveOrg({
    required this.orgId,
    required this.name,
    required this.capabilities,
    this.entitlements = const <String>{},
  });

  final String orgId;
  final String name;

  /// ⛔ For deciding what to OFFER. The server enforces regardless
  /// (architecture §3.1), and every hidden control still needs its error path.
  final Set<String> capabilities;
  final Set<String> entitlements;

  /// Ownership is a CAPABILITY, never a role name or key — `roleKey` is an
  /// open set that F-003 lets people create.
  bool get isOwner => capabilities.contains(fullAccessCapability);

  /// ★ `full_access` is a WILDCARD, so this is not set membership.
  ///
  /// A system Owner's role carries `full_access` and nothing else — no
  /// `manage_members`, no `manage_org_settings` — and the server's
  /// `CapabilityGuard` reads it as "everything". A plain `contains` therefore
  /// answers "no" for the one person who may do anything, and every gate built
  /// on it hides the app from its owner. That is not hypothetical: the web app
  /// had the same line, and it cost the Owner their own members menu, the tax
  /// declaration, the reveal button and the rename affordance (tasks.md,
  /// 2026-08-16). Same rule as core-domain's `hasCapability`.
  bool can(String capability) => hasCapability(capabilities, capability);
}

@immutable
class OrgSummary {
  const OrgSummary({required this.id, required this.name, required this.roleName});

  final String id;
  final String name;
  final String roleName;
}

@immutable
sealed class SessionState {
  const SessionState();
}

/// Cold-start restore has not finished. Render a splash; decide nothing.
final class SessionUnknown extends SessionState {
  const SessionUnknown();
}

/// Confirmed signed out.
final class SessionNone extends SessionState {
  const SessionNone();
}

/// Signed in. `active == null` means "has not picked a shop yet".
final class SessionAuthed extends SessionState {
  const SessionAuthed({required this.orgs, this.active});

  final List<OrgSummary> orgs;
  final ActiveOrg? active;

  SessionAuthed copyWith({List<OrgSummary>? orgs, ActiveOrg? active}) =>
      SessionAuthed(orgs: orgs ?? this.orgs, active: active ?? this.active);

  /// Dropping the active org WITHOUT dropping the session — what a
  /// `403 ORG_ACCESS_DENIED` means (D-027: a session is not tied to a shop).
  SessionAuthed withoutActiveOrg() => SessionAuthed(orgs: orgs);
}

/// `426` — the client is too old to talk to this API. A terminal screen.
final class SessionForceUpdate extends SessionState {
  const SessionForceUpdate();
}
