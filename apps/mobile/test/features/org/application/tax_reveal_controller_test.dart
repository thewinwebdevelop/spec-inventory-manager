// ★ M-07 — the reveal controller, and the rule that only exists on a phone.
//
// Web's E-14 proves the number is dropped when the user presses ซ่อนเลข and
// that a reload cannot bring it back. A phone adds a case a browser does not
// have: the app goes to the background — a call arrives, the owner switches to
// LINE, the screen is handed across a counter — and the OS photographs the
// screen for its app switcher while doing it.
//
// So the controller drops the number on ANY non-resumed lifecycle state, and
// these cases pin that. `FLAG_SECURE` is the other half and lives in the
// screen; neither is sufficient alone, because the OS snapshot races the
// frame.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/error/api_failure.dart';
import 'package:mobile/features/org/application/org_providers.dart';
import 'package:mobile/features/org/application/tax_reveal_controller.dart';
import 'package:mobile/features/org/domain/tax_reveal.dart';

import '../org_fakes.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  ProviderContainer containerWith(FakeOrgScoped scoped) {
    final container = ProviderContainer(
      overrides: [orgScopedRepositoryProvider.overrideWithValue(scoped)],
    );
    addTearDown(container.dispose);
    // The controller registers its lifecycle observer in `build`.
    container.read(taxRevealControllerProvider);
    return container;
  }

  test('press → the number arrives, and it took exactly one request', () async {
    final scoped = FakeOrgScoped();
    final container = containerWith(scoped);

    await container.read(taxRevealControllerProvider.notifier).press();

    final state = container.read(taxRevealControllerProvider);
    expect(state, isA<RevealShown>());
    expect((state as RevealShown).taxId, '0105560123454');
    expect(scoped.revealCalls, 1);
  });

  test('★ press again HIDES, and does not spend a second reveal', () async {
    final scoped = FakeOrgScoped();
    final container = containerWith(scoped);
    final notifier = container.read(taxRevealControllerProvider.notifier);

    await notifier.press();
    await notifier.press();

    expect(container.read(taxRevealControllerProvider), isA<RevealHidden>());
    // Hiding is local. Each REVEAL is rate-limited (20/hour) and writes an
    // audit event, so a hide that re-asked would spend somebody's budget to
    // put a number away.
    expect(scoped.revealCalls, 1);
  });

  test('★ seeing it again costs another request — nothing is cached', () async {
    final scoped = FakeOrgScoped();
    final container = containerWith(scoped);
    final notifier = container.read(taxRevealControllerProvider.notifier);

    await notifier.press(); // show
    await notifier.press(); // hide
    await notifier.press(); // show again

    expect(scoped.revealCalls, 2, reason: 'a cached number would have answered the third press');
  });

  test('★★ backgrounding the app drops the number', () async {
    // The case that does not exist on web. `inactive` is the earliest signal —
    // on iOS it precedes the app-switcher snapshot — so reacting to `paused`
    // alone would be reacting after the picture was taken.
    final container = containerWith(FakeOrgScoped());
    final notifier = container.read(taxRevealControllerProvider.notifier);

    await notifier.press();
    expect(container.read(taxRevealControllerProvider), isA<RevealShown>());

    notifier.didChangeAppLifecycleState(AppLifecycleState.inactive);

    expect(
      container.read(taxRevealControllerProvider),
      isA<RevealHidden>(),
      reason: 'a national ID must not still be on screen when the phone comes back',
    );
  });

  test('★★ …and on paused/hidden/detached too, not just inactive', () async {
    for (final lifecycle in [
      AppLifecycleState.paused,
      AppLifecycleState.hidden,
      AppLifecycleState.detached,
    ]) {
      final container = containerWith(FakeOrgScoped());
      final notifier = container.read(taxRevealControllerProvider.notifier);
      await notifier.press();

      notifier.didChangeAppLifecycleState(lifecycle);

      expect(container.read(taxRevealControllerProvider), isA<RevealHidden>(), reason: '$lifecycle');
    }
  });

  test('coming back to the foreground does NOT re-reveal', () async {
    // The counterpart: `resumed` must not undo the drop, or the whole rule
    // would be a flicker rather than a control.
    final scoped = FakeOrgScoped();
    final container = containerWith(scoped);
    final notifier = container.read(taxRevealControllerProvider.notifier);

    await notifier.press();
    notifier.didChangeAppLifecycleState(AppLifecycleState.paused);
    notifier.didChangeAppLifecycleState(AppLifecycleState.resumed);

    expect(container.read(taxRevealControllerProvider), isA<RevealHidden>());
    expect(scoped.revealCalls, 1, reason: 'resuming must not silently ask again');
  });

  test('a failure clears any previous number with the state that held it', () async {
    final container = containerWith(FakeOrgScoped(revealFailure: const ThrottledFailure()));
    final notifier = container.read(taxRevealControllerProvider.notifier);

    await notifier.press();

    final state = container.read(taxRevealControllerProvider);
    expect(state, isA<RevealError>());
    expect(visibleTaxId(state), isNull);
  });

  test('leaving the screen forgets it', () async {
    final container = containerWith(FakeOrgScoped());
    final notifier = container.read(taxRevealControllerProvider.notifier);

    await notifier.press();
    notifier.forget();

    expect(container.read(taxRevealControllerProvider), isA<RevealHidden>());
  });
}
