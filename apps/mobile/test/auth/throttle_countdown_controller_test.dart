import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/auth/throttle_countdown_controller.dart';

void main() {
  group('ThrottleCountdownController', () {
    test('starts inactive', () {
      final controller = ThrottleCountdownController();
      expect(controller.isActive, isFalse);
      expect(controller.remainingSeconds, 0);
    });

    test('start() activates the countdown and ticks down every second (real-time, no jitter)', () {
      fakeAsync((async) {
        final controller = ThrottleCountdownController();
        var notifyCount = 0;
        controller.addListener(() => notifyCount++);

        controller.start(5);
        expect(controller.isActive, isTrue);
        expect(controller.remainingSeconds, 5);

        async.elapse(const Duration(seconds: 1));
        expect(controller.remainingSeconds, 4);

        async.elapse(const Duration(seconds: 3));
        expect(controller.remainingSeconds, 1);

        async.elapse(const Duration(seconds: 1));
        expect(controller.remainingSeconds, 0);
        expect(controller.isActive, isFalse);

        // 1 notify on start + 5 ticks = 6.
        expect(notifyCount, 6);

        controller.dispose();
      });
    });

    test('reaching 0 auto re-enables (banner disappears, no manual reset needed)', () {
      fakeAsync((async) {
        final controller = ThrottleCountdownController();
        controller.start(2);
        async.elapse(const Duration(seconds: 2));
        expect(controller.isActive, isFalse);
        controller.dispose();
      });
    });

    test('re-syncs (replaces) an in-flight countdown when start() is called again — clock-skew handling', () {
      fakeAsync((async) {
        final controller = ThrottleCountdownController();
        controller.start(10);
        async.elapse(const Duration(seconds: 3));
        expect(controller.remainingSeconds, 7);

        // Server responded with a fresh 429 + Retry-After during the wait —
        // re-sync should REPLACE, not stack, the countdown.
        controller.start(20);
        expect(controller.remainingSeconds, 20);

        async.elapse(const Duration(seconds: 1));
        expect(controller.remainingSeconds, 19);

        controller.dispose();
      });
    });

    test('start(0) or negative leaves the countdown inactive immediately', () {
      fakeAsync((async) {
        final controller = ThrottleCountdownController();
        controller.start(0);
        expect(controller.isActive, isFalse);
        controller.dispose();
      });
    });

    test('cancel() stops the timer and resets to inactive', () {
      fakeAsync((async) {
        final controller = ThrottleCountdownController();
        controller.start(30);
        async.elapse(const Duration(seconds: 5));
        expect(controller.remainingSeconds, 25);

        controller.cancel();
        expect(controller.isActive, isFalse);
        expect(controller.remainingSeconds, 0);

        // No further ticks after cancel.
        async.elapse(const Duration(seconds: 5));
        expect(controller.remainingSeconds, 0);

        controller.dispose();
      });
    });
  });
}
