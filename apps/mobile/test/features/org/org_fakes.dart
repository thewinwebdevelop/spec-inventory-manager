// Shared fakes for the org feature's controller and widget tests.
//
// Both implement the ABSTRACT ports, never the impls — which is the point of
// there being two ports: a test wires a repository without ever touching Dio,
// and cannot accidentally hand an org-scoped fake to the user-scoped provider.
import 'package:mobile/core/error/api_failure.dart';
import 'package:mobile/features/org/domain/entities/org_entities.dart';
import 'package:mobile/features/org/domain/repositories/org_repository.dart';

class FakeOrgDirectory implements OrgDirectory {
  FakeOrgDirectory({
    this.orgs = const [],
    this.listFailure,
    this.createFailure,
    this.created,
    this.delay = Duration.zero,
  });

  final List<MyOrganization> orgs;
  final ApiFailure? listFailure;
  final ApiFailure? createFailure;
  final CreatedOrganization? created;
  final Duration delay;

  int createCalls = 0;
  final List<String> namesSeen = <String>[];

  @override
  Future<List<MyOrganization>> listMyOrganizations() async {
    await Future<void>.delayed(delay);
    if (listFailure != null) throw listFailure!;
    return orgs;
  }

  @override
  Future<CreatedOrganization> createOrganization({required String name}) async {
    createCalls++;
    namesSeen.add(name);
    await Future<void>.delayed(delay);
    if (createFailure != null) throw createFailure!;
    return created ??
        CreatedOrganization(id: 'org_new', name: name, capabilities: const {'full_access'});
  }
}

class FakeOrgScoped implements OrgScoped {
  FakeOrgScoped({
    this.memberPages = const [],
    this.invitationPages = const [],
    this.roles = const [],
    this.membersFailure,
    this.invitationsFailure,
    this.rolesFailure,
    this.createInvitationFailure,
    this.issued,
    this.delay = Duration.zero,
    this.profile,
    this.revealed,
    this.profileFailure,
    this.revealFailure,
    this.revealThrows,
  });

  /// One entry per call — so a test can make page 2 fail after page 1 worked.
  final List<PagedResult<MemberRow>> memberPages;
  final List<PagedResult<InvitationRow>> invitationPages;
  final List<RoleRow> roles;

  final ApiFailure? membersFailure;
  final ApiFailure? invitationsFailure;
  final ApiFailure? rolesFailure;
  final ApiFailure? createInvitationFailure;
  final IssuedInvite? issued;
  final Duration delay;

  // ★ M-07 — the tax card's two calls. `revealCalls` is counted because the
  // rule under test is "every look is a fresh, audited request": a screen that
  // cached the number would show it twice for one call here.
  final OrgProfileView? profile;
  final RevealedTaxId? revealed;
  final ApiFailure? profileFailure;
  final ApiFailure? revealFailure;

  /// Anything that is NOT an `ApiFailure` — a deserialisation error, say. The
  /// review used exactly this to find a `press()` that caught only the typed
  /// family and left the screen stuck in `loading` forever.
  final Object? revealThrows;
  int revealCalls = 0;
  int profileCalls = 0;

  int memberCalls = 0;
  int invitationCalls = 0;
  final List<String?> cursorsSeen = <String?>[];
  final List<String> statusesSeen = <String>[];

  @override
  Future<PagedResult<MemberRow>> listMembers({String status = 'active', String? cursor}) async {
    final index = memberCalls++;
    cursorsSeen.add(cursor);
    statusesSeen.add(status);
    await Future<void>.delayed(delay);
    if (membersFailure != null) throw membersFailure!;
    if (index >= memberPages.length) return const PagedResult(items: []);
    return memberPages[index];
  }

  @override
  Future<PagedResult<InvitationRow>> listInvitations({
    String status = 'pending',
    String? cursor,
  }) async {
    final index = invitationCalls++;
    await Future<void>.delayed(delay);
    if (invitationsFailure != null) throw invitationsFailure!;
    if (index >= invitationPages.length) return const PagedResult(items: []);
    return invitationPages[index];
  }

  @override
  Future<List<RoleRow>> listRoles() async {
    await Future<void>.delayed(delay);
    if (rolesFailure != null) throw rolesFailure!;
    return roles;
  }

  @override
  Future<IssuedInvite> createInvitation({required String email, required String roleId}) async {
    await Future<void>.delayed(delay);
    if (createInvitationFailure != null) throw createInvitationFailure!;
    return issued ??
        IssuedInvite(
          inviteUrl: 'https://app.omnistock.test/invite?token=raw-token',
          email: email,
          expiresAt: DateTime.utc(2026, 8, 9, 7, 30),
        );
  }
  @override
  Future<OrgProfileView> getOrganization() async {
    profileCalls++;
    if (delay != Duration.zero) await Future<void>.delayed(delay);
    if (profileFailure != null) throw profileFailure!;
    return profile ??
        const OrgProfileView(
          id: 'org_1',
          name: 'ร้านหอมกรุ่นเบเกอรี่',
          taxProfileComplete: true,
          entityType: 'personal',
          taxIdMasked: '•••••••••3454',
          vatRegistered: false,
          branchCode: '00000',
        );
  }

  @override
  Future<RevealedTaxId> revealTaxId() async {
    revealCalls++;
    if (delay != Duration.zero) await Future<void>.delayed(delay);
    if (revealThrows != null) throw revealThrows!;
    if (revealFailure != null) throw revealFailure!;
    return revealed ??
        RevealedTaxId(taxId: '0105560123454', revealedAt: DateTime(2026, 8, 19));
  }

}

const threeRoles = [
  // ★ B-9 — `grantsOwnership` is what the screens read; `key` is translation
  // only. Set from the server's derivation, which for the system roles means
  // the Owner row and nothing else.
  RoleRow(id: 'rol_owner', name: 'Owner', key: 'owner', grantsOwnership: true),
  RoleRow(id: 'rol_admin', name: 'Admin', key: 'admin'),
  RoleRow(id: 'rol_staff', name: 'Staff', key: 'staff'),
];

MemberRow member({
  String id = 'usr_1',
  String? email,
  bool isMe = false,
  bool isOwner = false,
  String status = 'active',
  String? roleKey = 'staff',
  String roleName = 'Staff',
}) {
  return MemberRow(
    userId: id,
    email: email ?? '$id@shop.com',
    roleName: roleName,
    roleKey: roleKey,
    status: status,
    isMe: isMe,
    isOwner: isOwner,
  );
}

InvitationRow invitation({
  String id = 'inv_1',
  String email = 'new@example.com',
  String status = 'pending',
  String? roleKey = 'admin',
  String roleName = 'Admin',
  DateTime? expiresAt,
  DateTime? acceptedAt,
  bool acceptedUserCreatedAfterInvite = false,
}) {
  return InvitationRow(
    id: id,
    email: email,
    roleName: roleName,
    roleKey: roleKey,
    status: status,
    expiresAt: expiresAt ?? DateTime.utc(2026, 8, 9, 7, 30),
    acceptedAt: acceptedAt,
    acceptedUserCreatedAfterInvite: acceptedUserCreatedAfterInvite,
  );
}
