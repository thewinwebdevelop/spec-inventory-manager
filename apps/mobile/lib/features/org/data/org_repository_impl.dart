import 'package:dio/dio.dart';
// Prefixed on purpose. Several wire DTOs share a NAME with the domain entity
// they map onto (`CreatedOrganization`, `MemberRow`), and an unprefixed import
// makes the two look interchangeable at a glance — which is the moment a DTO
// starts travelling past this file. `wire.` at every use site says which side
// of the boundary a type is on.
import 'package:omnistock_api_client/omnistock_api_client.dart' as wire;

import '../../../core/error/api_failure.dart';
import '../domain/entities/org_entities.dart';
import '../domain/repositories/org_repository.dart';

/// T-002-M3 — the only place the generated client is touched for F-002
/// (gate rule 3), and the only place wire DTOs exist.
///
/// Every method funnels `DioException` through the same two lines:
///
/// ```dart
/// on DioException catch (e) {
///   throw e.error is ApiFailure ? e.error as ApiFailure : const ServerFailure();
/// }
/// ```
///
/// `ErrorMappingInterceptor` has already turned the response into an
/// [ApiFailure] by the time it gets here, so a repository that wrote its own
/// status switch would be a second, drifting copy of the taxonomy — which is
/// exactly what `core/error` exists to prevent.
ApiFailure _asFailure(DioException e) =>
    e.error is ApiFailure ? e.error! as ApiFailure : const ServerFailure();

/// USER-scoped: built on `baseDioProvider`, which sends NO org header.
///
/// Both of these endpoints exist because the caller is not inside a shop —
/// one of them is how they get into their first. Sending
/// `X-Organization-Id` here would hand the server an input those routes
/// should never receive (security review I-3).
class OrgDirectoryImpl implements OrgDirectory {
  OrgDirectoryImpl(this._api);

  final wire.OrganizationsApi _api;

  @override
  Future<List<MyOrganization>> listMyOrganizations() async {
    try {
      final page = await _api.listMyOrganizations();
      final items = page.data?.items.toList() ?? const <wire.MyOrganizationItem>[];
      return items
          // `status` decides the SHAPE of the row (M-10): a revoked row
          // carries no role at all. Filtering here means every screen below
          // can assume the full shape instead of each remembering that
          // `roleName` is sometimes absent.
          .where((item) => item.membership.status == wire.MyOrganizationMembershipStatusEnum.active)
          .map(
            (item) => MyOrganization(
              id: item.organization.id,
              name: item.organization.name,
              roleName: item.membership.roleName ?? '',
              roleKey: item.membership.roleKey,
            ),
          )
          .toList(growable: false);
    } on DioException catch (e) {
      throw _asFailure(e);
    }
  }

  @override
  Future<CreatedOrganization> createOrganization({required String name}) async {
    try {
      final res = await _api.createOrganization(
        createOrganizationRequest: wire.CreateOrganizationRequest(
          (b) => b
            ..name = name
            // The API defaults this, and S2 deliberately does not ask
            // (ux-wireframe §3: no timezone/currency/plan questions). Sending
            // the documented default keeps the request explicit without
            // adding a field the screen is told not to show.
            ..timezone = 'Asia/Bangkok',
        ),
      );
      final body = res.data!;
      return CreatedOrganization(
        id: body.organization.id,
        name: body.organization.name,
        capabilities: const {'full_access'},
      );
    } on DioException catch (e) {
      throw _asFailure(e);
    }
  }
}

/// ORG-scoped: built on `orgDioProvider`, which cannot exist without an
/// active shop.
class OrgScopedImpl implements OrgScoped {
  OrgScopedImpl({
    required wire.MembersApi members,
    required wire.OrganizationsApi organizations,
    required wire.InvitationsApi invitations,
    required String orgId,
  })  : _members = members,
        _organizations = organizations,
        _invitations = invitations,
        _orgId = orgId;

  final wire.MembersApi _members;
  final wire.OrganizationsApi _organizations;
  final wire.InvitationsApi _invitations;

  /// Still required in the PATH by the contract, even though the header
  /// carries it too — api-spec §1 accepts either and refuses a mismatch with
  /// `422 ORG_MISMATCH`. Taken from the same session value the interceptor
  /// uses, so the two cannot disagree.
  final String _orgId;

  @override
  Future<PagedResult<MemberRow>> listMembers({String status = 'active', String? cursor}) async {
    try {
      final page = await _members.listMembers(orgId: _orgId, status: status, cursor: cursor);
      final body = page.data;
      final items = body?.items.toList() ?? const <wire.MemberRow>[];
      return PagedResult(
        items: items
            .map(
              (m) => MemberRow(
                userId: m.userId,
                email: m.email,
                roleName: m.roleName,
                roleKey: m.roleKey,
                status: m.status.name,
                isMe: m.isMe,
                isOwner: m.isOwner,
              ),
            )
            .toList(growable: false),
        // Carried, never dropped: an absent `nextCursor` is the only proof a
        // count taken from this list is a count of everybody (ux-wireframe §7).
        nextCursor: body?.nextCursor,
      );
    } on DioException catch (e) {
      throw _asFailure(e);
    }
  }

  @override
  Future<PagedResult<InvitationRow>> listInvitations({
    String status = 'pending',
    String? cursor,
  }) async {
    try {
      final page = await _invitations.listInvitations(
        orgId: _orgId,
        status: status,
        cursor: cursor,
      );
      final body = page.data;
      final items = body?.items.toList() ?? const <wire.Invitation>[];
      return PagedResult(
        items: items
            .map(
              (i) => InvitationRow(
                id: i.id,
                email: i.email,
                roleName: i.roleName,
                roleKey: i.roleKey,
                // `expired` is the SERVER's word, computed at read time
                // against its own clock. Recomputing it here from
                // `expiresAt` would give the two sides different answers
                // during the seconds that matter most.
                status: i.status.name,
                expiresAt: i.expiresAt,
                acceptedAt: i.acceptedAt,
                acceptedUserCreatedAfterInvite: i.acceptedUserCreatedAfterInvite ?? false,
              ),
            )
            .toList(growable: false),
        nextCursor: body?.nextCursor,
      );
    } on DioException catch (e) {
      throw _asFailure(e);
    }
  }

  @override
  Future<List<RoleRow>> listRoles() async {
    try {
      final page = await _organizations.listOrgRoles(orgId: _orgId);
      final items = page.data?.items.toList() ?? const <wire.RoleRow>[];
      return items
          .map(
            (r) => RoleRow(
              id: r.id,
              name: r.name,
              key: r.key,
              // Optional on the wire (contract-evolution): absent means the
              // server does not publish it, which is not the same as "no".
              grantsOwnership: r.grantsOwnership ?? false,
            ),
          )
          .toList(growable: false);
    } on DioException catch (e) {
      throw _asFailure(e);
    }
  }

  @override
  Future<IssuedInvite> createInvitation({
    required String email,
    required String roleId,
  }) async {
    try {
      final res = await _invitations.createInvitation(
        orgId: _orgId,
        createInvitationRequest: wire.CreateInvitationRequest(
          (b) => b
            ..email = email
            ..roleId = roleId,
        ),
      );
      final body = res.data!;
      return IssuedInvite(
        inviteUrl: body.inviteUrl,
        email: body.invitation.email,
        // Read from the response, never computed from a constant: the TTL
        // depends on the invited ROLE (D-028/I-7) and is recomputed on every
        // reissue (D-027).
        expiresAt: body.invitation.expiresAt,
      );
    } on DioException catch (e) {
      throw _asFailure(e);
    }
  }
}
