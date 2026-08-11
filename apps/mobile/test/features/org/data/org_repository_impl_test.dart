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
        orgId: 'org_1',
      );

      final members = await repo.listMembers();

      expect(members.single.isMe, isTrue);
      expect(members.single.isOwner, isTrue);
      expect(members.single.isActive, isTrue);
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
        orgId: 'org_1',
      );

      final issued = await repo.createInvitation(email: 'malee@shop.com', roleId: 'rol_2');

      expect(issued.expiresAt, DateTime.parse('2026-08-12T07:30:00.000Z'));
      expect(issued.inviteUrl, contains('token=9f2b7c'));
      expect(issued.email, 'malee@shop.com');
    });
  });
}
