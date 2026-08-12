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
        orgId: 'org_1',
      );

      final page = await repo.listInvitations();

      expect(page.items.single.status, 'pending');
      expect(page.items.single.isPending, isTrue);
      expect(page.items.single.expiresAt, DateTime.parse('2020-01-01T00:00:00.000Z'));
      // A missing flag is false, not null — D-028/I-7's note is either shown
      // or it is not.
      expect(page.items.single.acceptedUserCreatedAfterInvite, isFalse);
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
        orgId: 'org_1',
      );

      await repo.listInvitations();
      await repo.listInvitations(status: 'all', cursor: 'cur_2');

      expect(adapter.seen.first.queryParameters['status'], 'pending');
      expect(adapter.seen.last.queryParameters['status'], 'all');
      expect(adapter.seen.last.queryParameters['cursor'], 'cur_2');
    });
  });
}
