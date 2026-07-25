import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

import 'package:mobile/core/l10n/l10n.dart';
import 'package:mobile/features/auth/application/auth_providers.dart';
import 'package:mobile/features/auth/data/auth_repository_impl.dart';
import 'package:mobile/features/auth/presentation/screens/session_list.dart';
import 'package:mobile/features/auth/data/token_store.dart';
import 'package:mobile/core/ui/skeleton.dart';

import '../../data/fake_dio_adapter.dart';
import '../../data/fakes.dart';

AuthRepositoryImpl buildClient(FakeHttpClientAdapter adapter) {
  final dio = buildFakeDio(adapter);
  final authApi = AuthApi(dio, standardSerializers);
  final store = TokenStore(secureStorage: FakeSecureStorage());
  store.setAccessToken('access-1');
  return AuthRepositoryImpl(authApi: authApi, tokenStore: store);
}

/// D-023 PASS 2 — provider-override wiring (see login_screen_test.dart doc).
/// R4 — `localizationsDelegates`/`supportedLocales` added since the list now
/// reads copy via `AppLocalizations.of(context)!`.
Widget wrap(AuthRepositoryImpl client, Widget child) {
  return ProviderScope(
    overrides: [authRepositoryProvider.overrideWithValue(client)],
    child: MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(body: child),
    ),
  );
}

Map<String, Object?> sessionJson({
  required String familyId,
  String? deviceId,
  required String createdAt,
  String? lastUsedAt,
  required bool current,
}) {
  return {
    'familyId': familyId,
    'deviceId': deviceId,
    'createdAt': createdAt,
    'lastUsedAt': lastUsedAt,
    'current': current,
  };
}

void main() {
  testWidgets('shows a skeleton shimmer while loading', (tester) async {
    final adapter = FakeHttpClientAdapter();
    adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {'sessions': <Map<String, Object?>>[]}));
    final client = buildClient(adapter);

    await tester.pumpWidget(wrap(
      client,
      SessionList(onSessionExpired: () {}, onLoggedOutAll: () {}),
    ));
    // One frame after mount, before the async load() resolves — still loading.
    expect(find.byType(SessionListSkeleton), findsOneWidget);

    // Let the fake request resolve (one microtask/event-loop turn) WITHOUT
    // using pumpAndSettle — the shimmer's `repeat(reverse: true)`
    // AnimationController never naturally settles, so pumpAndSettle would
    // time out. A bounded pump lets the list move past loading instead.
    await tester.pump(const Duration(milliseconds: 50));
    await tester.pump(const Duration(milliseconds: 50));
  });

  testWidgets('shows the error state + retry button when loading fails', (tester) async {
    final adapter = FakeHttpClientAdapter();
    adapter.enqueue(FakeResponse(statusCode: 500));
    final client = buildClient(adapter);

    await tester.pumpWidget(wrap(
      client,
      SessionList(onSessionExpired: () {}, onLoggedOutAll: () {}),
    ));
    await tester.pumpAndSettle();

    expect(find.text('โหลดรายการอุปกรณ์ไม่สำเร็จ'), findsOneWidget);
    expect(find.text('ลองใหม่'), findsOneWidget);
  });

  testWidgets('retry re-issues the request and shows data on success', (tester) async {
    final adapter = FakeHttpClientAdapter();
    adapter.enqueue(FakeResponse(statusCode: 500));
    adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {
      'sessions': [
        sessionJson(
          familyId: 'f1',
          deviceId: 'device-1',
          createdAt: '2026-07-01T00:00:00.000Z',
          lastUsedAt: '2026-07-06T00:00:00.000Z',
          current: true,
        ),
      ],
    }));
    final client = buildClient(adapter);

    await tester.pumpWidget(wrap(
      client,
      SessionList(onSessionExpired: () {}, onLoggedOutAll: () {}),
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.text('ลองใหม่'));
    await tester.pumpAndSettle();

    expect(find.text('อุปกรณ์นี้'), findsOneWidget);
  });

  testWidgets('renders sessions and marks the current device with a badge + no logout button', (tester) async {
    final adapter = FakeHttpClientAdapter();
    adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {
      'sessions': [
        sessionJson(
          familyId: 'f1',
          deviceId: 'device-1',
          createdAt: '2026-07-01T00:00:00.000Z',
          lastUsedAt: '2026-07-06T00:00:00.000Z',
          current: true,
        ),
        sessionJson(
          familyId: 'f2',
          deviceId: null,
          createdAt: '2026-07-01T00:00:00.000Z',
          lastUsedAt: '2026-07-02T00:00:00.000Z',
          current: false,
        ),
      ],
    }));
    final client = buildClient(adapter);

    await tester.pumpWidget(wrap(
      client,
      SessionList(onSessionExpired: () {}, onLoggedOutAll: () {}),
    ));
    await tester.pumpAndSettle();

    expect(find.text('อุปกรณ์นี้'), findsOneWidget);
    expect(find.text('อุปกรณ์ไม่ทราบชื่อ'), findsOneWidget);
    // Only ONE logout-device button (the non-current row).
    expect(find.text('ออกจากอุปกรณ์นี้'), findsOneWidget);
  });

  testWidgets('logging out a device shows a confirm dialog, then removes the row optimistically', (tester) async {
    final adapter = FakeHttpClientAdapter();
    adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {
      'sessions': [
        sessionJson(
          familyId: 'f1',
          deviceId: 'device-1',
          createdAt: '2026-07-01T00:00:00.000Z',
          lastUsedAt: '2026-07-06T00:00:00.000Z',
          current: true,
        ),
        sessionJson(
          familyId: 'f2',
          deviceId: 'device-2',
          createdAt: '2026-07-01T00:00:00.000Z',
          lastUsedAt: '2026-07-02T00:00:00.000Z',
          current: false,
        ),
      ],
    }));
    adapter.enqueue(FakeResponse(statusCode: 204)); // logout response

    final client = buildClient(adapter);

    await tester.pumpWidget(wrap(
      client,
      SessionList(onSessionExpired: () {}, onLoggedOutAll: () {}),
    ));
    await tester.pumpAndSettle();

    expect(find.text('device-2'), findsOneWidget);

    await tester.tap(find.text('ออกจากอุปกรณ์นี้'));
    await tester.pumpAndSettle();

    expect(find.text('ออกจากอุปกรณ์นี้?'), findsOneWidget);
    await tester.tap(find.text('ออกจากอุปกรณ์นี้').last);
    await tester.pumpAndSettle();

    expect(find.text('device-2'), findsNothing);
    expect(find.text('ออกจากอุปกรณ์แล้ว'), findsOneWidget);
  });

  testWidgets(
      'T-001-17 L-4: shows the "cannot identify current device" notice when there is more than 1 session',
      (tester) async {
    final adapter = FakeHttpClientAdapter();
    adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {
      'sessions': [
        sessionJson(
          familyId: 'f1',
          deviceId: 'device-1',
          createdAt: '2026-07-01T00:00:00.000Z',
          lastUsedAt: '2026-07-06T00:00:00.000Z',
          current: false,
        ),
        sessionJson(
          familyId: 'f2',
          deviceId: 'device-2',
          createdAt: '2026-07-01T00:00:00.000Z',
          lastUsedAt: '2026-07-02T00:00:00.000Z',
          current: false,
        ),
      ],
    }));
    final client = buildClient(adapter);

    await tester.pumpWidget(wrap(
      client,
      SessionList(onSessionExpired: () {}, onLoggedOutAll: () {}),
    ));
    await tester.pumpAndSettle();

    // Both rows have a logout-device button (neither `current`, since mobile
    // never gets a true `current: true` back — api-spec §2.6) — the notice
    // is what tells the user not to trust that as "these are all other
    // devices".
    expect(find.text('ออกจากอุปกรณ์นี้'), findsNWidgets(2));
    expect(
      find.text(
        'อุปกรณ์นี้ไม่สามารถระบุตัวเองในรายการด้านล่างได้ — หากไม่แน่ใจว่าแถวไหนคืออุปกรณ์ที่ถืออยู่ กรุณาระวังก่อนกด "ออกจากอุปกรณ์นี้"',
      ),
      findsOneWidget,
    );
  });

  testWidgets('does NOT show the "cannot identify current device" notice with only 1 session', (tester) async {
    final adapter = FakeHttpClientAdapter();
    adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {
      'sessions': [
        sessionJson(
          familyId: 'f1',
          deviceId: 'device-1',
          createdAt: '2026-07-01T00:00:00.000Z',
          lastUsedAt: '2026-07-06T00:00:00.000Z',
          current: true,
        ),
      ],
    }));
    final client = buildClient(adapter);

    await tester.pumpWidget(wrap(
      client,
      SessionList(onSessionExpired: () {}, onLoggedOutAll: () {}),
    ));
    await tester.pumpAndSettle();

    expect(
      find.text(
        'อุปกรณ์นี้ไม่สามารถระบุตัวเองในรายการด้านล่างได้ — หากไม่แน่ใจว่าแถวไหนคืออุปกรณ์ที่ถืออยู่ กรุณาระวังก่อนกด "ออกจากอุปกรณ์นี้"',
      ),
      findsNothing,
    );
  });

  testWidgets('logout-all shows the confirm dialog and calls onLoggedOutAll on success', (tester) async {
    final adapter = FakeHttpClientAdapter();
    adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {
      'sessions': [
        sessionJson(
          familyId: 'f1',
          deviceId: 'device-1',
          createdAt: '2026-07-01T00:00:00.000Z',
          lastUsedAt: '2026-07-06T00:00:00.000Z',
          current: true,
        ),
      ],
    }));
    adapter.enqueue(FakeResponse(statusCode: 204)); // logout-all response
    final client = buildClient(adapter);
    var loggedOutAll = false;

    await tester.pumpWidget(wrap(
      client,
      SessionList(
        onSessionExpired: () {},
        onLoggedOutAll: () => loggedOutAll = true,
      ),
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.text('ออกจากระบบทุกอุปกรณ์'));
    await tester.pumpAndSettle();

    expect(find.text('ออกจากระบบทุกอุปกรณ์?'), findsOneWidget);
    await tester.tap(find.text('ออกจากระบบทุกอุปกรณ์').last);
    await tester.pumpAndSettle();

    expect(loggedOutAll, isTrue);
  });

  // ★ sanity-pass fix (Important #1): the INITIAL fetch runs inside the
  // controller's build() — before any imperative load() call exists — so a
  // dead session on mount must still navigate to login (the pre-D-023
  // contract), not park the user on an authenticated screen with an empty
  // list while storage is already wiped.
  testWidgets('initial load hitting a dead session fires onSessionExpired and never flashes error/empty UI', (tester) async {
    final adapter = FakeHttpClientAdapter();
    // Access token rejected (401), then the refresh itself is dead too.
    adapter.enqueue(FakeResponse(statusCode: 401));
    adapter.enqueue(FakeResponse(
      statusCode: 401,
      jsonBody: {
        'error': {'code': 'INVALID_REFRESH', 'message': 'dead'},
      },
    ));
    final client = buildClient(adapter);

    var expiredCalls = 0;
    await tester.pumpWidget(wrap(
      client,
      SessionList(onSessionExpired: () => expiredCalls++, onLoggedOutAll: () {}),
    ));
    // Bounded pumps, NOT pumpAndSettle — on the expired path the skeleton
    // (whose shimmer never settles) intentionally stays up until navigation.
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    await tester.pump(const Duration(milliseconds: 50));

    expect(expiredCalls, 1, reason: 'mount-path expiry must navigate exactly once');
    // Neither the error state (load-failed + retry) nor the data/empty
    // state's logout-all button may flash — the skeleton holds until the
    // (already-fired) navigation takes over.
    expect(find.text('โหลดรายการอุปกรณ์ไม่สำเร็จ'), findsNothing);
    expect(find.text('ออกจากระบบทุกอุปกรณ์'), findsNothing);
    expect(find.byType(SessionListSkeleton), findsOneWidget);
  });
}
