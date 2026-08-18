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

/// One page of a cursor-paginated list — `{items, nextCursor}` (D-025).
///
/// [nextCursor] is carried up to the screens rather than dropped at the
/// repository, because two screens need to know the difference between "that
/// is everybody" and "that is the first 25": the load-more button, and the
/// backup-owner nudge, which ux-wireframe §7 forbids showing on a partial
/// list ("นับไม่ครบ = พูดในสิ่งที่ยังไม่รู้").
///
/// A local, minimal type on purpose — `PagedListController` (mobile.md §3.3)
/// is F-013's job, and inventing half of it here would be the version F-013
/// then has to unpick.
class PagedResult<T> {
  const PagedResult({required this.items, this.nextCursor});

  final List<T> items;
  final String? nextCursor;

  bool get isComplete => nextCursor == null;
}

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

/// One row of the pending-invitations section (api-spec §3.5).
///
/// `status` is the whole shape of the row, exactly as on the web client:
/// only a `pending` invitation has actions, and `expired` is COMPUTED by the
/// server at read time — there is no write path to it, so the client never
/// derives it from [expiresAt] either. Two readers computing the same status
/// from different clocks is how one screen offers to reissue a link the other
/// already calls dead.
class InvitationRow {
  const InvitationRow({
    required this.id,
    required this.email,
    required this.roleName,
    required this.roleKey,
    required this.status,
    required this.expiresAt,
    this.acceptedAt,
    this.acceptedUserCreatedAfterInvite = false,
  });

  final String id;
  final String email;
  final String roleName;
  final String? roleKey;

  /// `pending` | `accepted` | `expired` | `cancelled`.
  final String status;

  /// The ONLY source of "how long is this link good for" (ux-wireframe §1.4,
  /// answer to Q14). The TTL depends on the invited role and is recomputed on
  /// every reissue, so a screen that prints "7 วัน" is right until the first
  /// Owner invitation and wrong in the dangerous direction after it.
  final DateTime expiresAt;

  final DateTime? acceptedAt;

  /// D-028/I-7 — the account that accepted was created after the link was
  /// issued. A quiet ⓘ note, never an accusation.
  final bool acceptedUserCreatedAfterInvite;

  bool get isPending => status == 'pending';
}

/// A shop's role, for the invite picker (api-spec §3.6).
///
/// `capabilities` is deliberately absent here too — §3.6 does not publish it.
class RoleRow {
  const RoleRow({
    required this.id,
    required this.name,
    required this.key,
    this.grantsOwnership = false,
  });

  final String id;
  final String name;

  /// ⛔ Display slug ONLY (ux Q4). Never a permission input — see
  /// [grantsOwnership].
  final String? key;

  /// ★ B-9 — does granting this role grant ownership?
  ///
  /// Comes from the server, derived there from `capabilities`. Defaults to
  /// `false` because the contract field is optional: a build newer than the
  /// server it talks to must parse the list, and "the server did not say" is
  /// not "yes".
  ///
  /// This replaced `key == 'owner'` on three screens' worth of decisions. That
  /// shortcut was right for the three system roles and wrong in principle —
  /// F-003 lets people mint roles with no key at all, and I-45 flips a Staff
  /// role's key to `owner` in the database to prove the two can disagree.
  final bool grantsOwnership;
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
