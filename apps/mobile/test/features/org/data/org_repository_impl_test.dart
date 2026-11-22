// T-002-M3 — the data layer against a fake adapter (D-014: data = FakeHttpClientAdapter).
//
// The point of these is the MAPPING, not the plumbing: `data/` is the only
// place wire DTOs exist, so what it chooses to carry across the boundary — and
// what it drops — is the contract every layer above depends on.
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/error/api_failure.dart';
import 'package:mobile/features/org/data/org_repository_impl.dart';
import 'package:mobile/features/org/domain/entities/role_entities.dart' show RoleUpdate;
import 'package:omnistock_api_client/omnistock_api_client.dart';

/// Answers one canned body, and records what was asked.
class _FakeAdapter implements HttpClientAdapter {
  _FakeAdapter(this.status, this.body);

  final int status;
  final Object body;
  final List<RequestOptions> seen = <RequestOptions>[];

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<List<int>>? s, Future<void>? c) async {
    seen.add(options);
    return ResponseBody.fromString(
      jsonEncode(body),
      status,
      headers: {Headers.contentTypeHeader: [Headers.jsonContentType]},
    );
  }

  @override
  void close({bool force = false}) {}
}

Dio _dio(_FakeAdapter adapter) =>
    Dio(BaseOptions(baseUrl: 'https://api.test'))..httpClientAdapter = adapter;

void main() {
  group('OrgDirectoryImpl.listMyOrganizations', () {
    test('★ drops rows whose membership is not active (the short M-10 shape)', () async {
      // A revoked row carries `status` + `revokedAt` and NOTHING else — no
      // role at all. Filtering here is what lets every screen above assume the
      // full shape instead of each remembering that `roleName` is sometimes
      // absent.
      final adapter = _FakeAdapter(200, {
        'items': [
          {
            'organization': {'id': 'org_1', 'name': 'ร้านหนึ่ง', 'logo': null},
            'membership': {'status': 'active', 'roleName': 'Owner', 'roleKey': 'owner'},
          },
          {
            'organization': {'id': 'org_2', 'name': 'ร้านเก่า', 'logo': null},
            'membership': {'status': 'revoked', 'revokedAt': '2026-08-01T00:00:00.000Z'},
          },
        ],
        'nextCursor': null,
      });
      final repo = OrgDirectoryImpl(OrganizationsApi(_dio(adapter), standardSerializers));

      final orgs = await repo.listMyOrganizations();

      expect(orgs, hasLength(1));
      expect(orgs.single.id, 'org_1');
      expect(orgs.single.roleName, 'Owner');
    });

    test('surfaces the mapped ApiFailure, not a DioException', () async {
      // `ErrorMappingInterceptor` is absent from this bare Dio, so the
      // fallback path is what runs — and it must still be an ApiFailure, or
      // every caller above would have to know about Dio.
      final adapter = _FakeAdapter(500, {'error': {'code': 'INTERNAL', 'message': 'x'}});
      final repo = OrgDirectoryImpl(OrganizationsApi(_dio(adapter), standardSerializers));

      expect(repo.listMyOrganizations(), throwsA(isA<ApiFailure>()));
    });
  });

  group('OrgScopedImpl', () {
    _FakeAdapter membersAdapter() => _FakeAdapter(200, {
          'items': [
            {
              'userId': 'usr_1',
              'email': 'somchai@shop.com',
              'roleId': 'rol_1',
              'roleName': 'Owner',
              'roleKey': 'owner',
              'status': 'active',
              'activatedAt': null,
              'revokedAt': null,
              'createdAt': '2026-08-01T00:00:00.000Z',
              'isMe': true,
              'isOwner': true,
            },
          ],
          'nextCursor': null,
        });

    test('★ carries the SERVER-decided isMe/isOwner across the boundary', () async {
      // Both are computed server-side from capabilities (api-spec §3.7). The
      // entity has no `capabilities` field at all, so no screen can recompute
      // ownership from data the list deliberately does not publish.
      final adapter = membersAdapter();
      final repo = OrgScopedImpl(
        members: MembersApi(_dio(adapter), standardSerializers),
        organizations: OrganizationsApi(_dio(adapter), standardSerializers),
        invitations: InvitationsApi(_dio(adapter), standardSerializers),
        roles: RolesApi(_dio(adapter), standardSerializers),
        orgId: 'org_1',
      );

      final members = await repo.listMembers();

      expect(members.items.single.isMe, isTrue);
      expect(members.items.single.isOwner, isTrue);
      expect(members.items.single.isActive, isTrue);
      // `nextCursor: null` in the body means "that is everybody" — the fact
      // the backup-owner nudge is gated on (ux-wireframe §7).
      expect(members.isComplete, isTrue);
    });

    test('★ puts the orgId in the PATH as well as the header', () async {
      // api-spec §1 accepts either and refuses a mismatch with
      // `422 ORG_MISMATCH`. Both come from the same session value, so they
      // cannot disagree.
      final adapter = membersAdapter();
      final repo = OrgScopedImpl(
        members: MembersApi(_dio(adapter), standardSerializers),
        organizations: OrganizationsApi(_dio(adapter), standardSerializers),
        invitations: InvitationsApi(_dio(adapter), standardSerializers),
        roles: RolesApi(_dio(adapter), standardSerializers),
        orgId: 'org_2n4xk9',
      );

      await repo.listMembers();

      expect(adapter.seen.single.path, contains('org_2n4xk9'));
    });

    test('★ an issued invite carries expiresAt from the RESPONSE', () async {
      // D-027/I-7: the TTL depends on the invited role and is recomputed on
      // every reissue, so a client that derived it from a constant would show
      // a dead link as live.
      final adapter = _FakeAdapter(201, {
        'invitation': {
          'id': 'inv_1',
          'email': 'malee@shop.com',
          'roleId': 'rol_2',
          'roleName': 'Admin',
          'roleKey': 'admin',
          'status': 'pending',
          'expiresAt': '2026-08-12T07:30:00.000Z',
          'tokenIssuedAt': '2026-08-11T07:30:00.000Z',
          'invitedByUserId': 'usr_1',
          'createdAt': '2026-08-11T07:30:00.000Z',
          'acceptedAt': null,
          'acceptedByUserId': null,
          'acceptedUserCreatedAfterInvite': null,
        },
        'token': '9f2b7c',
        'inviteUrl': 'https://app.omnistock.co/invite?token=9f2b7c',
      });
      final repo = OrgScopedImpl(
        members: MembersApi(_dio(adapter), standardSerializers),
        organizations: OrganizationsApi(_dio(adapter), standardSerializers),
        invitations: InvitationsApi(_dio(adapter), standardSerializers),
        roles: RolesApi(_dio(adapter), standardSerializers),
        orgId: 'org_1',
      );

      final issued = await repo.createInvitation(email: 'malee@shop.com', roleId: 'rol_2');

      expect(issued.expiresAt, DateTime.parse('2026-08-12T07:30:00.000Z'));
      expect(issued.inviteUrl, contains('token=9f2b7c'));
      expect(issued.email, 'malee@shop.com');
    });

    test('★ an invitation\'s status is the SERVER\'s word, never recomputed here', () async {
      // `expired` is resolved at read time against the server's clock and has
      // no write path. A client that derived it from `expiresAt` would give a
      // different answer during the seconds that matter most — and would offer
      // to reissue a link the server still considers live, or the reverse.
      final adapter = _FakeAdapter(200, {
        'items': [
          {
            'id': 'inv_1',
            'email': 'new@example.com',
            'roleId': 'rol_2',
            'roleName': 'Admin',
            'roleKey': 'admin',
            // Past `expiresAt`, and STILL pending as far as this response is
            // concerned. The entity must say `pending`.
            'status': 'pending',
            'expiresAt': '2020-01-01T00:00:00.000Z',
            'tokenIssuedAt': '2019-12-31T00:00:00.000Z',
            'invitedByUserId': 'usr_1',
            'createdAt': '2019-12-31T00:00:00.000Z',
            'acceptedAt': null,
            'acceptedByUserId': null,
            'acceptedUserCreatedAfterInvite': null,
          },
        ],
        'nextCursor': 'cur_2',
      });
      final repo = OrgScopedImpl(
        members: MembersApi(_dio(adapter), standardSerializers),
        organizations: OrganizationsApi(_dio(adapter), standardSerializers),
        invitations: InvitationsApi(_dio(adapter), standardSerializers),
        roles: RolesApi(_dio(adapter), standardSerializers),
        orgId: 'org_1',
      );

      final page = await repo.listInvitations();

      expect(page.items.single.status, 'pending');
      expect(page.items.single.isPending, isTrue);
      expect(page.items.single.expiresAt, DateTime.parse('2020-01-01T00:00:00.000Z'));
      // ★ `null` SURVIVES the mapping. This asserted `isFalse`, defended by a
      // comment saying the note "is either shown or it is not" — true of the
      // rendering, and the rendering is the screen's job (`== true`). The
      // contract calls this exact conversion out in words: `null` is "nobody
      // has accepted yet", and *"we do not know yet is not no"*. An entity
      // that answers `false` to "was the account created after the link?"
      // when nobody has accepted is answering a question the server declined
      // to answer.
      expect(page.items.single.acceptedUserCreatedAfterInvite, isNull);
      // More pages exist, and the caller is told so.
      expect(page.isComplete, isFalse);
      expect(page.nextCursor, 'cur_2');
    });

    test('the invitations list defaults to pending, and passes a cursor when asked', () async {
      final adapter = _FakeAdapter(200, {'items': <Object>[], 'nextCursor': null});
      final repo = OrgScopedImpl(
        members: MembersApi(_dio(adapter), standardSerializers),
        organizations: OrganizationsApi(_dio(adapter), standardSerializers),
        invitations: InvitationsApi(_dio(adapter), standardSerializers),
        roles: RolesApi(_dio(adapter), standardSerializers),
        orgId: 'org_1',
      );

      await repo.listInvitations();
      await repo.listInvitations(status: 'all', cursor: 'cur_2');

      expect(adapter.seen.first.queryParameters['status'], 'pending');
      expect(adapter.seen.last.queryParameters['status'], 'all');
      expect(adapter.seen.last.queryParameters['cursor'], 'cur_2');
    });

    OrgScopedImpl repoOn(_FakeAdapter adapter) => OrgScopedImpl(
          members: MembersApi(_dio(adapter), standardSerializers),
          organizations: OrganizationsApi(_dio(adapter), standardSerializers),
          invitations: InvitationsApi(_dio(adapter), standardSerializers),
          roles: RolesApi(_dio(adapter), standardSerializers),
          orgId: 'org_1',
        );

    test('★ T-003-M10: roleId reaches BOTH lists as a query param, and only when asked', () async {
      final adapter = _FakeAdapter(200, {'items': <Object>[], 'nextCursor': null});
      final repo = repoOn(adapter);

      await repo.listMembers();
      await repo.listMembers(status: 'active', roleId: 'rol_staff');
      await repo.listInvitations(roleId: 'rol_staff');

      expect(adapter.seen[0].queryParameters.containsKey('roleId'), isFalse);
      expect(adapter.seen[1].queryParameters['roleId'], 'rol_staff');
      expect(adapter.seen[1].queryParameters['status'], 'active');
      expect(adapter.seen[2].queryParameters['roleId'], 'rol_staff');
      expect(adapter.seen[2].queryParameters['status'], 'pending');
    });

    Map<String, Object?> memberJson(String id, Map<String, Object?> extra) => {
          'userId': id,
          'email': '$id@shop.com',
          'roleId': 'rol_1',
          'roleName': 'Staff',
          'roleKey': 'staff',
          'status': 'active',
          'activatedAt': null,
          'revokedAt': null,
          'createdAt': '2026-08-01T00:00:00.000Z',
          'isMe': false,
          'isOwner': false,
          ...extra,
        };

    test('★ T-003-M10: the server\'s row verdict crosses the boundary as-is — including absent',
        () async {
      final adapter = _FakeAdapter(200, {
        'items': [
          memberJson('usr_a', {'viewerCanManage': true, 'manageBlockedReason': null}),
          memberJson('usr_b', {'viewerCanManage': false, 'manageBlockedReason': 'equal_permissions'}),
          memberJson('usr_c', {'viewerCanManage': false, 'manageBlockedReason': 'brand_new'}),
          memberJson('usr_d', {}),
        ],
        'nextCursor': null,
      });

      final rows = (await repoOn(adapter).listMembers()).items;

      expect(rows[0].viewerCanManage, isTrue);
      expect(rows[0].manageBlockedReason, isNull);
      expect(rows[1].viewerCanManage, isFalse);
      expect(rows[1].manageBlockedReason, 'equal_permissions');
      // OPEN set: an unknown reason is carried, not dropped or rejected.
      expect(rows[2].manageBlockedReason, 'brand_new');
      // Absent stays absent — never defaulted to true or false.
      expect(rows[3].viewerCanManage, isNull);
      expect(rows[3].manageBlockedReason, isNull);
    });
    test('★ T-003-M09 (D-039): GET /roles carries inviteTtlHours verbatim — absent stays null',
        () async {
      final adapter = _FakeAdapter(200, {
        'items': [
          {'id': 'rol_a', 'name': 'A', 'key': null, 'isSystem': false, 'viewerCanAssign': true, 'inviteTtlHours': 24},
          {'id': 'rol_b', 'name': 'B', 'key': 'staff', 'isSystem': true, 'viewerCanAssign': true, 'inviteTtlHours': 168},
          {'id': 'rol_c', 'name': 'C', 'key': 'owner', 'isSystem': true, 'viewerCanAssign': false},
        ],
        'nextCursor': null,
      });

      final roles = await repoOn(adapter).listRoles();

      expect(roles.map((r) => r.inviteTtlHours), [24, 168, null]);
    });

    test('★ T-003-M11: member rows carry roleId (R10 marks the current role by id, never by name)',
        () async {
      final adapter = _FakeAdapter(200, {
        'items': [memberJson('usr_a', {'roleId': 'rol_pack_9'})],
        'nextCursor': null,
      });

      final row = (await repoOn(adapter).listMembers()).items.single;

      expect(row.roleId, 'rol_pack_9');
    });

    test('★ T-003-M11: PATCH /members/{userId} sends ONLY {roleId} and maps the 200 row', () async {
      final adapter = _FakeAdapter(200, {
        ...memberJson('usr_a', {'viewerCanManage': true}),
        'roleId': 'rol_new',
        'roleName': 'แพ็คของ',
        'roleKey': null,
      });

      final row = await repoOn(adapter).updateMemberRole(userId: 'usr_a', roleId: 'rol_new');

      expect(adapter.seen.single.method, 'PATCH');
      expect(adapter.seen.single.path, '/orgs/org_1/members/usr_a');
      expect(adapter.seen.single.data, {'roleId': 'rol_new'});
      expect(row.roleId, 'rol_new');
      expect(row.roleName, 'แพ็คของ');
      expect(row.roleKey, isNull);
      expect(row.viewerCanManage, isTrue);
    });

    test('★ T-003-M11: a refused PATCH member surfaces as an ApiFailure, not a DioException',
        () async {
      final adapter = _FakeAdapter(403, {
        'error': {'code': 'TARGET_NOT_BELOW_ACTOR', 'message': 'no'},
      });

      await expectLater(
        repoOn(adapter).updateMemberRole(userId: 'usr_a', roleId: 'rol_x'),
        throwsA(isA<ApiFailure>()),
      );
    });

    test('★ T-003-M05: role-details carries every server verdict verbatim, open-set reasons included',
        () async {
      Map<String, Object?> role(String id, Map<String, Object?> viewer, {Object? lastEdited}) => {
            'id': id,
            'name': 'Name $id',
            'key': id == 'rol_c' ? null : 'staff',
            'nameCustomized': false,
            'isSystem': id == 'rol_a',
            'grantsOwnership': false,
            'capabilities': ['manage_products', 'manage_stock'],
            'version': 1,
            'usage': {'activeMembers': 2, 'pendingInvitations': 1},
            'lastEdited': lastEdited,
            'viewer': viewer,
            'createdAt': '2026-08-01T00:00:00.000Z',
          };
      Map<String, Object?> v(bool allowed, [String? reason]) => {'allowed': allowed, 'reason': reason};
      final adapter = _FakeAdapter(200, {
        'items': [
          role('rol_a', {'canEdit': v(false, 'role_locked'), 'canDelete': v(false, 'role_locked'), 'canClone': v(false, 'owner_role')}),
          role('rol_b', {'canEdit': v(true), 'canDelete': v(false, 'in_use'), 'canClone': v(true)},
              lastEdited: {
                'at': '2026-09-02T09:10:00.000Z',
                'by': {'kind': 'brand_new_kind', 'roleName': 'Admin', 'roleKey': 'admin'},
              }),
          role('rol_c', {'canEdit': v(false, 'brand_new'), 'canDelete': v(false, 'brand_new'), 'canClone': v(false, 'brand_new')}),
        ],
        'nextCursor': null,
        'viewer': {'canCreate': v(false, 'role_limit_reached'), 'limit': 30},
      });

      final page = await repoOn(adapter).listRoleDetails();

      expect(adapter.seen.single.path, '/orgs/org_1/role-details');
      expect(page.limit, 30);
      expect(page.canCreate.allowed, isFalse);
      expect(page.canCreate.reason, 'role_limit_reached');
      expect(page.items.map((r) => r.id), ['rol_a', 'rol_b', 'rol_c']);
      expect(page.items[0].canClone.reason, 'owner_role');
      expect(page.items[0].isSystem, isTrue);
      expect(page.items[1].canEdit.allowed, isTrue);
      expect(page.items[1].canEdit.reason, isNull);
      expect(page.items[1].canDelete.reason, 'in_use');
      expect(page.items[1].usage.activeMembers, 2);
      expect(page.items[1].usage.pendingInvitations, 1);
      expect(page.items[1].lastEdited!.kind, 'brand_new_kind');
      expect(page.items[1].lastEdited!.byRoleName, 'Admin');
      expect(page.items[0].lastEdited, isNull);
      expect(page.items[2].roleKey, isNull);
      expect(page.items[2].canEdit.reason, 'brand_new');
    });

    test('★ T-003-M05: capability catalog keeps order, labels and selectable', () async {
      final adapter = _FakeAdapter(200, {
        'groups': [
          {'key': 'g', 'labelTh': 'กลุ่ม'},
        ],
        'items': [
          {
            'key': 'manage_products',
            'labelTh': 'จัดการสินค้า',
            'descriptionTh': 'd',
            'group': 'g',
            'status': 'active',
            'implies': <String>[],
            'selectable': true,
          },
          {
            'key': 'full_access',
            'labelTh': 'ทำได้ทุกอย่าง',
            'descriptionTh': 'd',
            'group': null,
            'status': 'active',
            'implies': <String>[],
            'selectable': false,
          },
        ],
      });

      final catalog = await repoOn(adapter).getCapabilityCatalog();

      expect(adapter.seen.single.path, '/orgs/org_1/capabilities');
      expect(catalog.items.map((e) => e.key), ['manage_products', 'full_access']);
      expect(catalog.items.first.labelTh, 'จัดการสินค้า');
      expect(catalog.items.last.selectable, isFalse);
    });

    test('★ T-003-M05: a refusal on role-details surfaces as an ApiFailure (never an empty page)',
        () async {
      final adapter = _FakeAdapter(500, {'error': {'code': 'INTERNAL', 'message': 'x'}});
      expect(repoOn(adapter).listRoleDetails(), throwsA(isA<ApiFailure>()));
      expect(repoOn(adapter).getCapabilityCatalog(), throwsA(isA<ApiFailure>()));
    });

    Map<String, Object?> roleDetailJson({int version = 4}) => {
          'id': 'rol_1',
          'name': 'Admin',
          'key': 'admin',
          'nameCustomized': false,
          'isSystem': false,
          'grantsOwnership': false,
          'capabilities': ['manage_members', 'manage_roles'],
          'version': version,
          'usage': {'activeMembers': 2, 'pendingInvitations': 0},
          'lastEdited': null,
          'viewer': {
            'canEdit': {'allowed': true, 'reason': null},
            'canDelete': {'allowed': false, 'reason': 'in_use'},
            'canClone': {'allowed': true, 'reason': null},
          },
          'createdAt': '2026-08-01T00:00:00.000Z',
        };

    test('★ T-003-M06: GET /roles/{id} carries version + verdicts verbatim', () async {
      final adapter = _FakeAdapter(200, roleDetailJson(version: 7));

      final role = await repoOn(adapter).getRoleDetail('rol_1');

      expect(adapter.seen.single.method, 'GET');
      expect(adapter.seen.single.path, '/orgs/org_1/roles/rol_1');
      expect(role.version, 7);
      expect(role.canDelete.reason, 'in_use');
      expect(role.capabilities, ['manage_members', 'manage_roles']);
    });

    test('★ T-003-M06: POST /roles sends name + capabilities, returns the created role', () async {
      final adapter = _FakeAdapter(201, roleDetailJson(version: 1));

      final role = await repoOn(adapter).createRole(name: 'แพ็คของ', capabilities: const ['manage_orders']);

      expect(adapter.seen.single.method, 'POST');
      expect(adapter.seen.single.path, '/orgs/org_1/roles');
      expect(adapter.seen.single.data, {'name': 'แพ็คของ', 'capabilities': ['manage_orders']});
      expect(role.version, 1);
    });

    test('★ T-003-M06: PATCH sends version ALWAYS and name/capabilities ONLY when given', () async {
      final adapter = _FakeAdapter(200, roleDetailJson(version: 5));
      final repo = repoOn(adapter);

      await repo.updateRole('rol_1', const RoleUpdate(version: 4, capabilities: ['manage_members']));
      await repo.updateRole('rol_1', const RoleUpdate(version: 4, name: 'แอดมิน'));

      expect(adapter.seen[0].method, 'PATCH');
      expect(adapter.seen[0].path, '/orgs/org_1/roles/rol_1');
      expect(adapter.seen[0].data, {'version': 4, 'capabilities': ['manage_members']});
      expect(adapter.seen[1].data, {'version': 4, 'name': 'แอดมิน'});
    });

    test('★ T-003-M08: grantsOwnership is carried from the wire (the R4 Owner card reads it, never `key`)',
        () async {
      final owner = {...roleDetailJson(), 'key': 'staff', 'grantsOwnership': true, 'isSystem': true};
      final notOwner = {...roleDetailJson(), 'key': 'owner', 'grantsOwnership': false};

      expect((await repoOn(_FakeAdapter(200, owner)).getRoleDetail('rol_1')).grantsOwnership, isTrue);
      expect((await repoOn(_FakeAdapter(200, notOwner)).getRoleDetail('rol_1')).grantsOwnership, isFalse);
    });

    test('★ T-003-M08: DELETE /roles/{id} — no body, one request', () async {
      final adapter = _FakeAdapter(200, {'id': 'rol_1', 'deletedAt': '2026-11-22T00:00:00.000Z'});

      await repoOn(adapter).deleteRole('rol_1');

      expect(adapter.seen.single.method, 'DELETE');
      expect(adapter.seen.single.path, '/orgs/org_1/roles/rol_1');
      expect(adapter.seen.single.data, isNull);
    });

    // The code → ConflictFailure(details) mapping is the interceptor's (tested
    // in core/api); this Dio has none, so all that is claimed here is "an
    // ApiFailure, never a raw DioException".
    test('★ T-003-M08: a refused DELETE surfaces as an ApiFailure, not a DioException', () async {
      final adapter = _FakeAdapter(409, {
        'error': {'code': 'ROLE_IN_USE', 'message': 'in use'},
      });

      await expectLater(repoOn(adapter).deleteRole('rol_1'), throwsA(isA<ApiFailure>()));
    });

    test('★ T-003-M06: catalog carries groups, description, status and implies for R3', () async {
      final adapter = _FakeAdapter(200, {
        'groups': [
          {'key': 'catalog_stock', 'labelTh': 'สินค้าและสต๊อก'},
        ],
        'items': [
          {
            'key': 'manage_products',
            'labelTh': 'จัดการสินค้า',
            'descriptionTh': 'เพิ่ม แก้ และลบสินค้า',
            'group': 'catalog_stock',
            'status': 'upcoming',
            'implies': ['view_products'],
            'selectable': true,
          },
        ],
      });

      final catalog = await repoOn(adapter).getCapabilityCatalog();

      expect(catalog.groups.single.key, 'catalog_stock');
      expect(catalog.groups.single.labelTh, 'สินค้าและสต๊อก');
      final item = catalog.items.single;
      expect(item.descriptionTh, 'เพิ่ม แก้ และลบสินค้า');
      expect(item.group, 'catalog_stock');
      expect(item.status, 'upcoming');
      expect(item.implies, ['view_products']);
    });
  });
}
