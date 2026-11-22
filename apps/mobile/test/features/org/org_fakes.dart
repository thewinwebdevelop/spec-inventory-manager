// Shared fakes for the org feature's controller and widget tests.
//
// Both implement the ABSTRACT ports, never the impls — which is the point of
// there being two ports: a test wires a repository without ever touching Dio,
// and cannot accidentally hand an org-scoped fake to the user-scoped provider.
import 'dart:async';

import 'package:mobile/core/error/api_failure.dart';
import 'package:mobile/features/org/domain/entities/org_entities.dart';
import 'package:mobile/features/org/domain/entities/role_entities.dart';
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
        CreatedOrganization(id: 'org_new', name: name);
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
    this.roleDetails,
    this.roleDetailsFailure,
    this.catalog,
    this.catalogFailure,
    List<Object>? roleDetailAnswers,
    List<Object>? createRoleAnswers,
    List<Object>? updateRoleAnswers,
    List<Object>? deleteRoleAnswers,
    List<Object>? updateMemberAnswers,
    List<List<RoleRow>>? roleAnswers,
  })  : updateMemberAnswers = updateMemberAnswers ?? <Object>[],
        roleAnswers = roleAnswers ?? <List<RoleRow>>[],
        roleDetailAnswers = roleDetailAnswers ?? <Object>[],
        createRoleAnswers = createRoleAnswers ?? <Object>[],
        updateRoleAnswers = updateRoleAnswers ?? <Object>[],
        deleteRoleAnswers = deleteRoleAnswers ?? <Object>[];

  /// One entry per call — so a test can make page 2 fail after page 1 worked.
  final List<PagedResult<MemberRow>> memberPages;
  final List<PagedResult<InvitationRow>> invitationPages;
  final List<RoleRow> roles;

  /// T-003-M11 — successive `GET /roles` answers (the LAST repeats); empty =
  /// always [roles]. Lets a test say "after ROLE_EXCEEDS_ACTOR the re-read
  /// shows the role disabled".
  final List<List<RoleRow>> roleAnswers;
  int rolesCalls = 0;

  /// T-003-M11 R10 — one answer per `PATCH /members/{userId}`: a [MemberRow]
  /// or the `ApiFailure` to throw (the LAST one repeats). Every call is
  /// recorded, so a test can say "PATCH was sent exactly once".
  final List<Object> updateMemberAnswers;
  final List<({String userId, String roleId})> memberRoleUpdates = [];

  final ApiFailure? membersFailure;
  final ApiFailure? invitationsFailure;
  final ApiFailure? rolesFailure;
  final ApiFailure? createInvitationFailure;
  final List<String> invitedRoleIds = [];
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

  // F-003 R1/R2 — `null` page/catalog = an empty-but-valid answer.
  final RoleDetailsPage? roleDetails;
  final ApiFailure? roleDetailsFailure;
  final CapabilityCatalogView? catalog;
  final ApiFailure? catalogFailure;
  int roleDetailsCalls = 0;
  int catalogCalls = 0;

  // T-003-M06 R3 — each list is consumed one answer per call (the LAST one
  // repeats), and an answer is either the role or the `ApiFailure` to throw.
  // That is what lets a test say "v1, then after the 409 the re-read sees v2".
  final List<Object> roleDetailAnswers;
  final List<Object> createRoleAnswers;
  final List<Object> updateRoleAnswers;
  final List<String> roleDetailIdsSeen = <String>[];
  final List<({String name, List<String> capabilities})> createdBodies = [];
  final List<({String roleId, RoleUpdate body})> updates = [];

  /// T-003-M08 R5 — one answer per DELETE: [roleDeleted] or the `ApiFailure`
  /// to throw (the LAST one repeats). Every DELETE is recorded.
  final List<Object> deleteRoleAnswers;
  final List<String> deletedRoleIds = <String>[];

  /// Held open until the test completes it — for the "submitting" state.
  Completer<void>? writeGate;
  int profileCalls = 0;

  int memberCalls = 0;
  int invitationCalls = 0;
  final List<String?> cursorsSeen = <String?>[];
  final List<String> statusesSeen = <String>[];
  final List<String?> memberRoleIdsSeen = <String?>[];
  final List<String> invitationStatusesSeen = <String>[];
  final List<String?> invitationRoleIdsSeen = <String?>[];

  @override
  Future<PagedResult<MemberRow>> listMembers({
    String status = 'active',
    String? roleId,
    String? cursor,
  }) async {
    final index = memberCalls++;
    cursorsSeen.add(cursor);
    statusesSeen.add(status);
    memberRoleIdsSeen.add(roleId);
    await Future<void>.delayed(delay);
    if (membersFailure != null) throw membersFailure!;
    if (index >= memberPages.length) return const PagedResult(items: []);
    return memberPages[index];
  }

  @override
  Future<PagedResult<InvitationRow>> listInvitations({
    String status = 'pending',
    String? roleId,
    String? cursor,
  }) async {
    final index = invitationCalls++;
    invitationStatusesSeen.add(status);
    invitationRoleIdsSeen.add(roleId);
    await Future<void>.delayed(delay);
    if (invitationsFailure != null) throw invitationsFailure!;
    if (index >= invitationPages.length) return const PagedResult(items: []);
    return invitationPages[index];
  }

  @override
  Future<List<RoleRow>> listRoles() async {
    final call = rolesCalls++;
    await Future<void>.delayed(delay);
    if (rolesFailure != null) throw rolesFailure!;
    if (roleAnswers.isEmpty) return roles;
    return roleAnswers[call < roleAnswers.length ? call : roleAnswers.length - 1];
  }

  @override
  Future<MemberRow> updateMemberRole({required String userId, required String roleId}) async {
    final call = memberRoleUpdates.length;
    memberRoleUpdates.add((userId: userId, roleId: roleId));
    if (writeGate != null) await writeGate!.future;
    await Future<void>.delayed(delay);
    final answer = _answer(updateMemberAnswers, call);
    if (answer is ApiFailure) throw answer;
    return answer as MemberRow;
  }

  @override
  Future<RoleDetailsPage> listRoleDetails() async {
    roleDetailsCalls++;
    await Future<void>.delayed(delay);
    if (roleDetailsFailure != null) throw roleDetailsFailure!;
    return roleDetails ??
        const RoleDetailsPage(items: [], canCreate: RoleVerdict(allowed: true), limit: 30);
  }

  @override
  Future<CapabilityCatalogView> getCapabilityCatalog() async {
    catalogCalls++;
    await Future<void>.delayed(delay);
    if (catalogFailure != null) throw catalogFailure!;
    return catalog ?? const CapabilityCatalogView(items: []);
  }

  Object _answer(List<Object> answers, int call) {
    if (answers.isEmpty) throw StateError('FakeOrgScoped: no scripted answer');
    return answers[call < answers.length ? call : answers.length - 1];
  }

  Future<RoleDetailView> _resolve(Object answer) async {
    if (answer is ApiFailure) throw answer;
    return answer as RoleDetailView;
  }

  @override
  Future<RoleDetailView> getRoleDetail(String roleId) async {
    final call = roleDetailIdsSeen.length;
    roleDetailIdsSeen.add(roleId);
    await Future<void>.delayed(delay);
    return _resolve(_answer(roleDetailAnswers, call));
  }

  @override
  Future<RoleDetailView> createRole({required String name, required List<String> capabilities}) async {
    final call = createdBodies.length;
    createdBodies.add((name: name, capabilities: capabilities));
    if (writeGate != null) await writeGate!.future;
    await Future<void>.delayed(delay);
    return _resolve(_answer(createRoleAnswers, call));
  }

  @override
  Future<RoleDetailView> updateRole(String roleId, RoleUpdate body) async {
    final call = updates.length;
    updates.add((roleId: roleId, body: body));
    if (writeGate != null) await writeGate!.future;
    await Future<void>.delayed(delay);
    return _resolve(_answer(updateRoleAnswers, call));
  }

  @override
  Future<void> deleteRole(String roleId) async {
    final call = deletedRoleIds.length;
    deletedRoleIds.add(roleId);
    if (writeGate != null) await writeGate!.future;
    await Future<void>.delayed(delay);
    final answer = _answer(deleteRoleAnswers, call);
    if (answer is ApiFailure) throw answer;
  }

  @override
  Future<IssuedInvite> createInvitation({required String email, required String roleId}) async {
    invitedRoleIds.add(roleId);
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

/// A scripted successful DELETE (see [FakeOrgScoped.deleteRoleAnswers]).
const Object roleDeleted = 'deleted';

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
  String roleId = 'rol_staff',
  bool? roleNameCustomized,
  bool? viewerCanManage,
  String? manageBlockedReason,
}) {
  return MemberRow(
    userId: id,
    email: email ?? '$id@shop.com',
    roleId: roleId,
    roleNameCustomized: roleNameCustomized,
    roleName: roleName,
    roleKey: roleKey,
    status: status,
    isMe: isMe,
    isOwner: isOwner,
    viewerCanManage: viewerCanManage,
    manageBlockedReason: manageBlockedReason,
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
  bool? acceptedUserCreatedAfterInvite,
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
