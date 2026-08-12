import '../entities/org_entities.dart';

/// T-002-M3 — the org feature's ports.
///
/// Two of them, split along the line that matters: [OrgDirectory] talks to
/// USER-scoped endpoints (the caller is not in a shop yet), [OrgScoped] talks
/// to org-scoped ones. The split exists in the type system so a repository
/// cannot be built against the wrong Dio by accident — `data/` wires
/// [OrgDirectory] to `baseDioProvider` and [OrgScoped] to `orgDioProvider`,
/// and neither can reach the other's client.
///
/// Abstract, never a concrete impl, so a provider types to this (the R5 rule
/// the auth feature already follows).
abstract interface class OrgDirectory {
  /// `GET /me/organizations` — every shop this person is an active member of.
  Future<List<MyOrganization>> listMyOrganizations();

  /// `POST /organizations`.
  Future<CreatedOrganization> createOrganization({required String name});
}

abstract interface class OrgScoped {
  /// `GET /orgs/{orgId}/members`.
  Future<PagedResult<MemberRow>> listMembers({String status = 'active', String? cursor});

  /// `GET /orgs/{orgId}/invitations`.
  ///
  /// Defaults to `pending` — the section's job is the work still outstanding
  /// (ux-wireframe §7). `all` is what the "ดูคำเชิญที่หมดอายุ/ยกเลิกแล้ว"
  /// toggle asks for.
  Future<PagedResult<InvitationRow>> listInvitations({String status = 'pending', String? cursor});

  /// `GET /orgs/{orgId}/roles`.
  Future<List<RoleRow>> listRoles();

  /// `POST /orgs/{orgId}/invitations` — returns the invite URL ONCE.
  ///
  /// The raw token is returned and never stored: the server keeps only its
  /// hash (D-018), so nothing can hand the link out a second time. The caller
  /// holds it in screen state and drops it when the sheet closes.
  Future<IssuedInvite> createInvitation({required String email, required String roleId});
}

/// The one-shot result of creating an invitation.
class IssuedInvite {
  const IssuedInvite({required this.inviteUrl, required this.email, required this.expiresAt});

  final String inviteUrl;
  final String email;
  final DateTime expiresAt;
}
