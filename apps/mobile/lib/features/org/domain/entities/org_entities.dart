/// T-002-M3 — the entities the org screens work in. Pure Dart (gate rule 1):
/// no dio, no generated client, no riverpod.
///
/// No `@immutable` annotation: it lives in `package:meta`, re-exported by
/// `flutter/foundation`, and `domain/` may import neither (gate rule 1 —
/// caught by the boundary gate, not by review). The classes are immutable by
/// construction anyway: every field is `final` and every constructor `const`.
///
/// These are NOT the wire DTOs. `data/` maps the generated models onto these,
/// which is what keeps a contract change from reaching `presentation/` — and
/// what let this layer drop fields the screens must not have (see
/// [MemberRow.isOwner]).
library;

/// One row of the shop picker and the switcher (api-spec §3.2).
class MyOrganization {
  const MyOrganization({
    required this.id,
    required this.name,
    required this.roleName,
    required this.roleKey,
  });

  final String id;
  final String name;

  /// Display only. `roleKey` is an OPEN set — `null` for an F-003 custom role
  /// — so a screen falls back to [roleName] rather than rendering a key.
  final String roleName;
  final String? roleKey;
}

/// One row of the members list (api-spec §3.7).
class MemberRow {
  const MemberRow({
    required this.userId,
    required this.email,
    required this.roleName,
    required this.roleKey,
    required this.status,
    required this.isMe,
    required this.isOwner,
  });

  final String userId;
  final String email;
  final String roleName;
  final String? roleKey;

  /// `active` | `invited` | `revoked`.
  final String status;

  /// Decided SERVER-side, so no screen compares ids.
  final bool isMe;

  /// ⛔ Decided SERVER-side from CAPABILITIES (api-spec §3.7 says so on the
  /// field), never from a role name or key.
  ///
  /// Note what is absent: colleagues' `capabilities`. The list does not
  /// publish them — the same choice `GET /orgs/{orgId}/roles` makes — because
  /// handing every reader everybody else's capability set so each can
  /// recompute "is this an Owner" is the client-side authorization the server
  /// avoids by answering the question itself.
  final bool isOwner;

  bool get isActive => status == 'active';
}

/// A shop's role, for the invite picker (api-spec §3.6).
///
/// `capabilities` is deliberately absent here too — §3.6 does not publish it.
class RoleRow {
  const RoleRow({required this.id, required this.name, required this.key});

  final String id;
  final String name;
  final String? key;
}

/// What `POST /organizations` hands back — complete enough to enter the new
/// shop without a second round trip (ux Q5).
class CreatedOrganization {
  const CreatedOrganization({
    required this.id,
    required this.name,
    required this.capabilities,
  });

  final String id;
  final String name;

  /// The CREATOR's capabilities in the new shop — they are its Owner.
  final Set<String> capabilities;
}
