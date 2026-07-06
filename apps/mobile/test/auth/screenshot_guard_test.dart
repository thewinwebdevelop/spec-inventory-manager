import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/auth/screenshot_guard.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const channel = MethodChannel('omnistock/screenshot_guard');
  final calls = <String>[];

  setUp(() {
    calls.clear();
    ScreenshotGuardScope.resetForTest();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      channel,
      (call) async {
        calls.add(call.method);
        return null;
      },
    );
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      channel,
      null,
    );
  });

  group('ScreenshotGuard (T-001-17 L-5)', () {
    test('enable/disable invoke the native method channel', () async {
      await ScreenshotGuard.enable();
      await ScreenshotGuard.disable();

      expect(calls, ['enable', 'disable']);
    });

    test('a missing native handler is swallowed silently (no throw)', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
        channel,
        null,
      );

      // No handler registered at all -> MissingPluginException internally;
      // must not propagate.
      await expectLater(ScreenshotGuard.enable(), completes);
    });
  });

  group('ScreenshotGuardScope (reference counting)', () {
    test('first acquire enables the guard; release disables it', () async {
      final release = ScreenshotGuardScope.acquire();
      await pumpEventQueue();
      expect(calls, ['enable']);

      release();
      await pumpEventQueue();
      expect(calls, ['enable', 'disable']);
    });

    test('a second concurrent acquire does NOT re-invoke enable, and only the LAST release disables', () async {
      final releaseA = ScreenshotGuardScope.acquire();
      await pumpEventQueue();
      final releaseB = ScreenshotGuardScope.acquire();
      await pumpEventQueue();

      // Only one "enable" call for the 0->1 transition, not one per acquire.
      expect(calls, ['enable']);

      releaseA();
      await pumpEventQueue();
      // Still one interested caller (B) -> must NOT disable yet.
      expect(calls, ['enable']);

      releaseB();
      await pumpEventQueue();
      expect(calls, ['enable', 'disable']);
    });

    test('calling the same release callback twice is a no-op the second time', () async {
      final release = ScreenshotGuardScope.acquire();
      await pumpEventQueue();
      release();
      await pumpEventQueue();
      release(); // second call — must not double-decrement or re-disable
      await pumpEventQueue();

      expect(calls, ['enable', 'disable']);
    });
  });
}
