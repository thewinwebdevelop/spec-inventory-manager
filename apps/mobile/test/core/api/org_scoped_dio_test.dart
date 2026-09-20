// T-002-M1 ★ — the org header a repository cannot forget, and the two clients
// that must stay apart (mobile.md §3.2).
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_providers.dart';
import 'package:mobile/core/api/org_header_interceptor.dart';
import 'package:mobile/core/session/session_controller.dart';
import 'package:mobile/core/session/session_state.dart';

/// Records every request that reached the "network".
class _RecordingAdapter implements HttpClientAdapter {
  final List<RequestOptions> seen = <RequestOptions>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    seen.add(options);
    return ResponseBody.fromString('{}', 200, headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    });
  }

  @override
  void close({bool force = false}) {}
}

const _org = ActiveOrg(
  orgId: 'org_2n4xk9',
  name: 'ร้านหอมกรุ่นเบเกอรี่',
  capabilities: {'full_access', 'manage_members'},
);

ProviderContainer _container(_RecordingAdapter adapter, {ActiveOrg? active}) {
  // A base Dio shaped like the real one: HttpsGuard-equivalent at 0, auth
  // attach at 1, then error mapping — so the insert position under test is
  // the position the architecture diagram names.
  final base = Dio(BaseOptions(baseUrl: 'https://api.test'))
    ..httpClientAdapter = adapter
    ..interceptors.addAll([
      InterceptorsWrapper(onRequest: (o, h) => h.next(o)), // https guard
      InterceptorsWrapper(onRequest: (o, h) {
        o.headers['Authorization'] = 'Bearer tok';
        h.next(o);
      }),
      InterceptorsWrapper(onRequest: (o, h) => h.next(o)), // error mapping
    ]);

  final container = ProviderContainer(overrides: [baseDioProvider.overrideWithValue(base)]);
  if (active != null) {
    container
        .read(sessionControllerProvider.notifier)
        .signedIn(orgs: const [], active: active);
  }
  addTearDown(container.dispose);
  return container;
}

void main() {
  group('orgDioProvider', () {
    test('★ attaches X-Organization-Id to every request', () async {
      final adapter = _RecordingAdapter();
      final container = _container(adapter, active: _org);

      await container.read(orgDioProvider).get<dynamic>('/orgs/x/members');

      expect(adapter.seen, hasLength(1));
      expect(adapter.seen.first.headers[OrgHeaderInterceptor.headerName], _org.orgId);
    });

    test('★ the org-AGNOSTIC client sends no org header (I-3)', () async {
      // `/auth/*`, the shop list, shop creation and invitation preview/accept
      // exist because the caller is not in a shop. Sending an org id on them
      // hands the server an input those routes should never receive.
      final adapter = _RecordingAdapter();
      final container = _container(adapter, active: _org);

      await container.read(baseDioProvider).get<dynamic>('/me/organizations');

      expect(adapter.seen.first.headers.containsKey(OrgHeaderInterceptor.headerName), isFalse);
    });

    test('★ building the org client does not contaminate the base client', () async {
      // The failure this guards: mutating the shared instance's interceptors
      // would put an org header on `/auth/refresh` too.
      final adapter = _RecordingAdapter();
      final container = _container(adapter, active: _org);

      container.read(orgDioProvider); // build it
      await container.read(baseDioProvider).post<dynamic>('/auth/refresh');

      expect(adapter.seen.first.headers.containsKey(OrgHeaderInterceptor.headerName), isFalse);
    });

    test('★ a caller cannot override the header with another shop', () async {
      final adapter = _RecordingAdapter();
      final container = _container(adapter, active: _org);

      await container.read(orgDioProvider).get<dynamic>(
            '/orgs/x/members',
            options: Options(headers: {OrgHeaderInterceptor.headerName: 'org_someone_else'}),
          );

      expect(adapter.seen.first.headers[OrgHeaderInterceptor.headerName], _org.orgId);
    });

    test('★ the header goes on BEFORE refresh, so a replay still carries it', () async {
      // `RefreshInterceptor` and `RetryInterceptor` rebuild the request from
      // `RequestOptions`. Anything applied by an EARLIER interceptor is
      // already on those options and survives; anything later is not. This
      // asserts the position rather than the outcome, because the outcome
      // (a retried request in the right shop) only shows up under a 401.
      final adapter = _RecordingAdapter();
      final container = _container(adapter, active: _org);

      final dio = container.read(orgDioProvider);
      final orgHeaderIndex =
          dio.interceptors.indexWhere((i) => i is OrgHeaderInterceptor);
      expect(orgHeaderIndex, greaterThan(0), reason: 'must sit after the auth attach');
      expect(
        orgHeaderIndex,
        lessThan(dio.interceptors.length - 1),
        reason: 'must sit before the last interceptor (refresh/error mapping)',
      );
    });

    test('★ throws — never falls back — when there is no active shop', () {
      // A fallback would send org-scoped requests with no org, turning a
      // routing bug into a 422 the user cannot act on.
      final container = _container(_RecordingAdapter());
      expect(() => container.read(orgDioProvider), throwsStateError);
    });

    test('★ switching shops is ONE write, and the client follows', () async {
      final adapter = _RecordingAdapter();
      final container = _container(adapter, active: _org);

      await container.read(orgDioProvider).get<dynamic>('/orgs/a/members');
      container.read(sessionControllerProvider.notifier).switchOrg(
            const ActiveOrg(orgId: 'org_other', name: 'อีกร้าน', capabilities: {}),
          );
      await container.read(orgDioProvider).get<dynamic>('/orgs/b/members');

      expect(adapter.seen[0].headers[OrgHeaderInterceptor.headerName], 'org_2n4xk9');
      expect(adapter.seen[1].headers[OrgHeaderInterceptor.headerName], 'org_other');
    });
  });

  group('SessionController', () {
    test('starts unknown — not signed out', () {
      // Treating "not finished checking" as "logged out" bounces a live
      // session to login on every cold start.
      final container = ProviderContainer();
      addTearDown(container.dispose);
      expect(container.read(sessionControllerProvider), isA<SessionUnknown>());
      expect(container.read(activeOrgIdProvider), isNull);
    });

    test('★ ORG_ACCESS_DENIED drops the SHOP, never the session (D-027)', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final controller = container.read(sessionControllerProvider.notifier);
      controller.signedIn(orgs: const [], active: _org);

      controller.orgAccessDenied();

      final state = container.read(sessionControllerProvider);
      expect(state, isA<SessionAuthed>(), reason: 'still signed in');
      expect((state as SessionAuthed).active, isNull, reason: 'but no shop');
      expect(container.read(activeOrgIdProvider), isNull);
    });

    test('a terminal 401 does end the session', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final controller = container.read(sessionControllerProvider.notifier);
      controller.signedIn(orgs: const [], active: _org);

      controller.sessionExpired();

      expect(container.read(sessionControllerProvider), isA<SessionNone>());
    });

    test('★ ownership is a capability, never a role name', () {
      expect(_org.isOwner, isTrue);
      const staff = ActiveOrg(orgId: 'o', name: 'n', capabilities: {'view_products'});
      expect(staff.isOwner, isFalse);
    });
  });
}
