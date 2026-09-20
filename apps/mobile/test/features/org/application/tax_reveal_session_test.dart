// ★ M-07 — the reveal session's rules, owned by the screen.
//
// Web's E-14 proves the number is dropped on ซ่อนเลข and cannot survive a
// reload. A phone adds cases a browser does not have, and the security review
// found every one of them by probing rather than reading:
//
//   - a reveal that LANDS while the app is backgrounded was painted anyway;
//   - a non-`ApiFailure` left the screen stuck in `loading` for the rest of
//     the app session, button dead and screenshot guard held;
//   - and the number outlived the screen, the shop, and the session — because
//     it lived in a global provider.
//
// The last one is why this is a plain object owned by the `State` instead of a
// Riverpod controller: leaving the screen drops the value because the value is
// IN the screen, not because somebody remembered to clear it. Riverpod refused
// to be cleared at `dispose` (defunct element) and at `initState` (modifying a
// provider during build), which was the framework making the same point.
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/error/api_failure.dart';
import 'package:mobile/features/org/application/tax_reveal_session.dart';
import 'package:mobile/features/org/domain/entities/org_entities.dart';
import 'package:mobile/features/org/domain/tax_reveal.dart';

void main() {
  late int calls;
  late int notifications;

  TaxRevealSession sessionOver(
    Future<RevealedTaxId> Function() reveal,
  ) {
    calls = 0;
    notifications = 0;
    return TaxRevealSession(
      reveal: () {
        calls++;
        return reveal();
      },
      onChanged: () => notifications++,
    );
  }

  Future<RevealedTaxId> ok({Duration delay = Duration.zero}) async {
    if (delay != Duration.zero) await Future<void>.delayed(delay);
    return RevealedTaxId(taxId: '0105560123454', revealedAt: DateTime(2026, 8, 19));
  }

  test('press → the number arrives, and it took exactly one request', () async {
    final session = sessionOver(ok);

    await session.press();

    expect(session.state, isA<RevealShown>());
    expect(visibleTaxId(session.state), '0105560123454');
    expect(calls, 1);
    expect(notifications, greaterThan(0), reason: 'the screen has to be told to repaint');
  });

  test('★ press again HIDES, and does not spend a second reveal', () async {
    final session = sessionOver(ok);

    await session.press();
    await session.press();

    expect(session.state, isA<RevealHidden>());
    // Each REVEAL is rate-limited (20/hour) and writes an audit event, so a
    // hide that re-asked would spend somebody's budget to put a number away.
    expect(calls, 1);
  });

  test('★ seeing it again costs another request — nothing is cached', () async {
    final session = sessionOver(ok);

    await session.press(); // show
    await session.press(); // hide
    await session.press(); // show again

    expect(calls, 2, reason: 'a cached number would have answered the third press');
  });

  test('★★ backgrounding drops the number', () async {
    final session = sessionOver(ok);
    await session.press();
    expect(session.state, isA<RevealShown>());

    // `inactive` is the earliest signal — on iOS it precedes the app-switcher
    // snapshot, so reacting to `paused` alone would be reacting after the
    // picture was taken.
    session.onLifecycle(AppLifecycleState.inactive);

    expect(session.state, isA<RevealHidden>());
  });

  test('★★ …and on paused/hidden/detached too', () async {
    for (final lifecycle in [
      AppLifecycleState.paused,
      AppLifecycleState.hidden,
      AppLifecycleState.detached,
    ]) {
      final session = sessionOver(ok);
      await session.press();

      session.onLifecycle(lifecycle);

      expect(session.state, isA<RevealHidden>(), reason: '$lifecycle');
    }
  });

  test('coming back to the foreground does NOT re-reveal', () async {
    final session = sessionOver(ok);
    await session.press();

    session.onLifecycle(AppLifecycleState.paused);
    session.onLifecycle(AppLifecycleState.resumed);

    expect(session.state, isA<RevealHidden>());
    expect(calls, 1, reason: 'resuming must not silently ask again');
  });

  test('★★ a reveal that LANDS while backgrounded is discarded, not painted', () async {
    // The review pressed the button, backgrounded the app, let the response
    // arrive, and found the number waiting on return — which also made the
    // on-screen promise about auto-hiding false in exactly that case.
    final session = sessionOver(() => ok(delay: const Duration(milliseconds: 30)));

    final pending = session.press();
    session.onLifecycle(AppLifecycleState.inactive);
    await pending;

    expect(session.state, isA<RevealHidden>());
    expect(visibleTaxId(session.state), isNull);
  });

  test('★ backgrounding also clears a stuck loading state', () async {
    final session = sessionOver(() => ok(delay: const Duration(milliseconds: 30)));

    final pending = session.press();
    expect(session.state, isA<RevealLoading>());

    session.onLifecycle(AppLifecycleState.paused);

    // Not left disabled on a screen that is no longer waiting for anything.
    expect(session.state, isA<RevealHidden>());
    await pending;
  });

  test('★ a NON-ApiFailure does not strand the screen in loading forever', () async {
    // Found by the review by throwing what the `on ApiFailure` clause did not
    // catch: the state stayed `RevealLoading` for the rest of the app session.
    final session = sessionOver(() async => throw StateError('deserialise'));

    await session.press();

    expect(session.state, isA<RevealError>());
  });

  test('the error carries the FAILURE, so the screen can tell 429 from 404', () async {
    final session = sessionOver(() async => throw const ThrottledFailure());

    await session.press();

    expect((session.state as RevealError).failure, isA<ThrottledFailure>());
  });

  test('a failure clears any previous number with the state that held it', () async {
    final session = sessionOver(() async => throw const ThrottledFailure());

    await session.press();

    expect(visibleTaxId(session.state), isNull);
  });

  test('★★ a response arriving after dispose does not call back into the screen', () async {
    // The screen is gone; `onChanged` would be `setState` on a dead widget.
    final session = sessionOver(() => ok(delay: const Duration(milliseconds: 30)));

    final pending = session.press();
    final before = notifications;
    session.dispose();
    await pending;

    expect(notifications, before, reason: 'the dead screen was told to repaint');
    expect(visibleTaxId(session.state), isNull);
  });
}
