import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

import 'package:mobile/features/auth/application/auth_providers.dart';
import 'package:mobile/features/auth/data/auth_repository_impl.dart';
import 'package:mobile/features/auth/data/token_store.dart';
import 'package:mobile/features/auth/presentation/screens/bootstrap_screen.dart';

import '../../data/fake_dio_adapter.dart';
import '../../data/fakes.dart';

AuthRepositoryImpl buildClient(FakeHttpClientAdapter adapter, {TokenStore? tokenStore}) {
  final dio = buildFakeDio(adapter);
  final authApi = AuthApi(dio, standardSerializers);
  return AuthRepositoryImpl(
    authApi: authApi,
    tokenStore: tokenStore ?? TokenStore(secureStorage: FakeSecureStorage()),
  );
}

/// D-023 — every test provides its fake-wired [AuthRepositoryImpl] via a
/// `ProviderScope` override of [authRepositoryProvider] instead of a
/// constructor argument on [BootstrapScreen] (which no longer takes one —
/// the screen now reads the repository through
/// `application/bootstrap_controller.dart`'s Riverpod provider graph).
Widget wrap(AuthRepositoryImpl client, Widget child) {
  return ProviderScope(
    overrides: [authRepositoryProvider.overrideWithValue(client)],
    child: MaterialApp(home: child),
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

    await tester.pumpWidget(wrap(
      client,
      BootstrapScreen(
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

    await tester.pumpWidget(wrap(
      client,
      BootstrapScreen(
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

    await tester.pumpWidget(wrap(
      client,
      BootstrapScreen(
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

    await tester.pumpWidget(wrap(
      client,
      BootstrapScreen(
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
    // wipes storage (mirrors the run_auth_bootstrap_test.dart assertion at
    // the AuthRepositoryImpl/TokenStore level).
    expect(await tokenStore.getRefreshToken(), 'old-refresh');
  });

  testWidgets('retry button re-runs the bootstrap and can succeed on the second attempt', (tester) async {
    final adapter = FakeHttpClientAdapter();
    adapter.enqueue(FakeResponse(statusCode: 503, jsonBody: null));
    final tokenStore = TokenStore(secureStorage: FakeSecureStorage());
    await tokenStore.setRefreshToken('old-refresh');
    final client = buildClient(adapter, tokenStore: tokenStore);
    var restored = false;

    await tester.pumpWidget(wrap(
      client,
      BootstrapScreen(
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

  testWidgets(
      'D-022 ★ re-review Important #2: offline/retry state offers an escape hatch to '
      'login WITHOUT wiping the keychain', (tester) async {
    final adapter = FakeHttpClientAdapter();
    // A persistent transient failure (e.g. a proxy 403 that never recovers)
    // — the point of the escape hatch is the user is never stuck here.
    adapter.enqueue(FakeResponse(statusCode: 403, jsonBody: null));
    final tokenStore = TokenStore(secureStorage: FakeSecureStorage());
    await tokenStore.setRefreshToken('old-refresh');
    final client = buildClient(adapter, tokenStore: tokenStore);
    var neededLogin = false;
    var restored = false;

    await tester.pumpWidget(wrap(
      client,
      BootstrapScreen(
        onRestored: () => restored = true,
        onNeedsLogin: () => neededLogin = true,
      ),
    ));
    await tester.pump(const Duration(milliseconds: 10));
    await tester.pump(const Duration(milliseconds: 10));

    expect(find.text('เชื่อมต่อไม่สำเร็จ'), findsOneWidget);
    expect(find.text('เข้าสู่ระบบด้วยรหัสผ่าน'), findsOneWidget);

    await tester.tap(find.text('เข้าสู่ระบบด้วยรหัสผ่าน'));
    await tester.pump();

    expect(neededLogin, isTrue);
    expect(restored, isFalse);
    // Critically: the keychain refresh token must NOT be wiped by taking the
    // escape hatch — a successful password login overwrites it with a fresh
    // pair anyway, and the old family is server-side GC'able.
    expect(await tokenStore.getRefreshToken(), 'old-refresh');
  });

  testWidgets(
      'D-022 ★ re-review Minor #4: _decided guard — two rapid retry taps that both '
      'resolve to a terminal outcome fire onRestored exactly once', (tester) async {
    final adapter = FakeHttpClientAdapter();
    adapter.enqueue(FakeResponse(statusCode: 503, jsonBody: null));
    final tokenStore = TokenStore(secureStorage: FakeSecureStorage());
    await tokenStore.setRefreshToken('old-refresh');
    final client = buildClient(adapter, tokenStore: tokenStore);
    var restoredCount = 0;

    await tester.pumpWidget(wrap(
      client,
      BootstrapScreen(
        onRestored: () => restoredCount++,
        onNeedsLogin: () {},
      ),
    ));
    await tester.pump(const Duration(milliseconds: 10));
    await tester.pump(const Duration(milliseconds: 10));
    expect(find.text('เชื่อมต่อไม่สำเร็จ'), findsOneWidget);

    // Queue two successful responses — one for each rapid retry tap.
    adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {
      'accessToken': 'access-a',
      'refreshToken': 'refresh-a',
      'expiresIn': 900,
      'tokenType': 'Bearer',
    }));
    adapter.enqueue(FakeResponse(statusCode: 200, jsonBody: {
      'accessToken': 'access-b',
      'refreshToken': 'refresh-b',
      'expiresIn': 900,
      'tokenType': 'Bearer',
    }));

    final state = tester.state<BootstrapScreenState>(find.byType(BootstrapScreen));
    // Fire two retries back-to-back before either settles (simulates two
    // rapid taps) — only the FIRST terminal resolution should ever reach
    // onRestored.
    final retry1 = state.retry();
    final retry2 = state.retry();
    await tester.pump(const Duration(milliseconds: 10));
    await tester.pump(const Duration(milliseconds: 10));
    await Future.wait([retry1, retry2]);
    await tester.pump(const Duration(milliseconds: 10));

    expect(restoredCount, 1);
  });
}
