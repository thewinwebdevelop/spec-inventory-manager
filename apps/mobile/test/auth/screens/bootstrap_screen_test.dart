import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

import 'package:mobile/auth/auth_client.dart';
import 'package:mobile/auth/screens/bootstrap_screen.dart';
import 'package:mobile/auth/token_store.dart';

import '../fake_dio_adapter.dart';
import '../fakes.dart';

AuthClient buildClient(FakeHttpClientAdapter adapter, {TokenStore? tokenStore}) {
  final dio = buildFakeDio(adapter);
  final authApi = AuthApi(dio, standardSerializers);
  return AuthClient(
    authApi: authApi,
    tokenStore: tokenStore ?? TokenStore(secureStorage: FakeSecureStorage()),
  );
}

// NOTE: uses two small-duration `tester.pump(...)` calls (never
// `pumpAndSettle()`/`pumpEventQueue()`) to let the bootstrap's Future chain
// resolve. `BootstrapScreen`'s loading state renders an indeterminate
// `CircularProgressIndicator`, whose ticking `AnimationController` schedules
// a new timer every frame — `pumpAndSettle()` never sees "no more frames
// scheduled" (times out), and `pumpEventQueue()` (a REAL event-loop drain,
// unrelated to the widget-test scheduler) spins forever chasing that same
// ticker. A couple of small explicit pumps is enough to let the already-fake
// (synchronous-ish) Dio/TokenStore future chain complete and settle the
// widget tree past the loading frame.

void main() {
  testWidgets('no refresh token -> calls onNeedsLogin, never shows the offline retry state', (tester) async {
    final client = buildClient(FakeHttpClientAdapter());
    var neededLogin = false;
    var restored = false;

    await tester.pumpWidget(MaterialApp(
      home: BootstrapScreen(
        authClient: client,
        onRestored: () => restored = true,
        onNeedsLogin: () => neededLogin = true,
      ),
    ));

    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    await tester.pump(const Duration(milliseconds: 10));
    await tester.pump(const Duration(milliseconds: 10));

    expect(neededLogin, isTrue);
    expect(restored, isFalse);
  });

  testWidgets('refresh token present + refresh succeeds -> calls onRestored', (tester) async {
    final adapter = FakeHttpClientAdapter();
    adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {
      'accessToken': 'access-1',
      'refreshToken': 'refresh-1',
      'expiresIn': 900,
      'tokenType': 'Bearer',
    }));
    final tokenStore = TokenStore(secureStorage: FakeSecureStorage());
    await tokenStore.setRefreshToken('old-refresh');
    final client = buildClient(adapter, tokenStore: tokenStore);
    var restored = false;
    var neededLogin = false;

    await tester.pumpWidget(MaterialApp(
      home: BootstrapScreen(
        authClient: client,
        onRestored: () => restored = true,
        onNeedsLogin: () => neededLogin = true,
      ),
    ));
    await tester.pump(const Duration(milliseconds: 10));
    await tester.pump(const Duration(milliseconds: 10));

    expect(restored, isTrue);
    expect(neededLogin, isFalse);
  });

  testWidgets('dead refresh token (401) -> calls onNeedsLogin', (tester) async {
    final adapter = FakeHttpClientAdapter();
    adapter.enqueue(FakeResponse(
      statusCode: 401,
      jsonBody: {
        'error': {'code': 'INVALID_REFRESH', 'message': 'dead'},
      },
    ));
    final tokenStore = TokenStore(secureStorage: FakeSecureStorage());
    await tokenStore.setRefreshToken('old-refresh');
    final client = buildClient(adapter, tokenStore: tokenStore);
    var neededLogin = false;

    await tester.pumpWidget(MaterialApp(
      home: BootstrapScreen(
        authClient: client,
        onRestored: () {},
        onNeedsLogin: () => neededLogin = true,
      ),
    ));
    await tester.pump(const Duration(milliseconds: 10));
    await tester.pump(const Duration(milliseconds: 10));

    expect(neededLogin, isTrue);
  });

  testWidgets('transient failure (L-3) -> shows offline/retry state, does NOT call onNeedsLogin', (tester) async {
    final adapter = FakeHttpClientAdapter();
    adapter.enqueue(FakeResponse(statusCode: 503, jsonBody: null));
    final tokenStore = TokenStore(secureStorage: FakeSecureStorage());
    await tokenStore.setRefreshToken('old-refresh');
    final client = buildClient(adapter, tokenStore: tokenStore);
    var neededLogin = false;
    var restored = false;

    await tester.pumpWidget(MaterialApp(
      home: BootstrapScreen(
        authClient: client,
        onRestored: () => restored = true,
        onNeedsLogin: () => neededLogin = true,
      ),
    ));
    await tester.pump(const Duration(milliseconds: 10));
    await tester.pump(const Duration(milliseconds: 10));

    expect(neededLogin, isFalse);
    expect(restored, isFalse);
    expect(find.text('เชื่อมต่อไม่สำเร็จ'), findsOneWidget);
    expect(find.text('ลองใหม่'), findsOneWidget);

    // The refresh token must still be intact — a transient failure never
    // wipes storage (mirrors the auth_bootstrap_test.dart assertion at the
    // AuthClient/TokenStore level).
    expect(await tokenStore.getRefreshToken(), 'old-refresh');
  });

  testWidgets('retry button re-runs the bootstrap and can succeed on the second attempt', (tester) async {
    final adapter = FakeHttpClientAdapter();
    adapter.enqueue(FakeResponse(statusCode: 503, jsonBody: null));
    final tokenStore = TokenStore(secureStorage: FakeSecureStorage());
    await tokenStore.setRefreshToken('old-refresh');
    final client = buildClient(adapter, tokenStore: tokenStore);
    var restored = false;

    await tester.pumpWidget(MaterialApp(
      home: BootstrapScreen(
        authClient: client,
        onRestored: () => restored = true,
        onNeedsLogin: () {},
      ),
    ));
    await tester.pump(const Duration(milliseconds: 10));
    await tester.pump(const Duration(milliseconds: 10));
    expect(find.text('เชื่อมต่อไม่สำเร็จ'), findsOneWidget);

    adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {
      'accessToken': 'access-2',
      'refreshToken': 'refresh-2',
      'expiresIn': 900,
      'tokenType': 'Bearer',
    }));
    await tester.tap(find.text('ลองใหม่'));
    await tester.pump(const Duration(milliseconds: 10));
    await tester.pump(const Duration(milliseconds: 10));

    expect(restored, isTrue);
  });
}
