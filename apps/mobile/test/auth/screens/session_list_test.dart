import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

import 'package:mobile/auth/auth_client.dart';
import 'package:mobile/auth/screens/session_list.dart';
import 'package:mobile/auth/token_store.dart';
import 'package:mobile/auth/widgets/skeleton.dart';

import '../fake_dio_adapter.dart';
import '../fakes.dart';

AuthClient buildClient(FakeHttpClientAdapter adapter) {
  final dio = buildFakeDio(adapter);
  final authApi = AuthApi(dio, standardSerializers);
  final store = TokenStore(secureStorage: FakeSecureStorage());
  store.setAccessToken('access-1');
  return AuthClient(authApi: authApi, tokenStore: store);
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

    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: SessionList(authClient: client, onSessionExpired: () {}, onLoggedOutAll: () {}),
      ),
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

    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: SessionList(authClient: client, onSessionExpired: () {}, onLoggedOutAll: () {}),
      ),
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

    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: SessionList(authClient: client, onSessionExpired: () {}, onLoggedOutAll: () {}),
      ),
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

    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: SessionList(authClient: client, onSessionExpired: () {}, onLoggedOutAll: () {}),
      ),
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

    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: SessionList(authClient: client, onSessionExpired: () {}, onLoggedOutAll: () {}),
      ),
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

    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: SessionList(
          authClient: client,
          onSessionExpired: () {},
          onLoggedOutAll: () => loggedOutAll = true,
        ),
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
}
