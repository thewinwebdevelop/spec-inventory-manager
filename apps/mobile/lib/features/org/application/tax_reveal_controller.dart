import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/error/api_failure.dart';
import '../domain/tax_reveal.dart';
import 'org_providers.dart';

/// ★ M-07 — the reveal button, and the two things that must drop the number.
///
/// The state machine itself is pure (`domain/tax_reveal.dart`); this adds the
/// request and the lifecycle. Two rules beyond "press to show, press to hide":
///
///  1. **Backgrounding drops it.** A phone in a shop gets put on the counter
///     and picked up by whoever is standing there. Coming back to a screen
///     still displaying somebody's national ID — because that is what these
///     thirteen digits are for a บุคคลธรรมดา taxpayer — is not something the
///     person asked for. They ask again, which costs one more audited reveal.
///  2. **Every press is a fresh request.** Nothing is cached, so there is
///     nothing to serve a second look from. That is §3.16's design, not an
///     oversight: each look is rate-limited and recorded.
///
/// [FLAG_SECURE] is the other half and lives in the screen: it blanks the
/// app-switcher thumbnail, which this controller cannot do because the OS
/// takes that snapshot without asking Dart first. Belt (the flag) and braces
/// (dropping the value) — the race between "app is backgrounding" and "frame
/// is captured" is exactly why one of them is not enough.
class TaxRevealController extends Notifier<RevealState> with WidgetsBindingObserver {
  @override
  RevealState build() {
    final binding = WidgetsBinding.instance;
    binding.addObserver(this);
    ref.onDispose(() => binding.removeObserver(this));
    return const RevealHidden();
  }

  // `lifecycle`, not the override's `state`: `state` is the Notifier's own
  // property, and shadowing it inside the one method that WRITES it would be
  // a trap for the next reader.
  @override
  // ignore: avoid_renaming_method_parameters
  void didChangeAppLifecycleState(AppLifecycleState lifecycle) {
    // `inactive` fires BEFORE `paused` on both platforms and is the earliest
    // signal available — on iOS it is what precedes the app-switcher snapshot.
    // Reacting to `paused` alone would be reacting after the picture.
    if (lifecycle == AppLifecycleState.resumed) return;
    if (state is RevealShown) state = const RevealHidden();
  }

  /// The button. Hides when shown, asks when not.
  Future<void> press() async {
    if (!pressRequestsReveal(state)) {
      // Hiding: replace the state with one that has no field for the number.
      state = const RevealHidden();
      return;
    }

    state = const RevealLoading();
    try {
      final revealed = await ref.read(orgScopedRepositoryProvider).revealTaxId();
      state = RevealShown(taxId: revealed.taxId, revealedAt: revealed.revealedAt);
    } on ApiFailure catch (failure) {
      // The message is chosen by the screen (it owns copy); the controller
      // reports WHICH failure so a throttle can be told apart from a 404 on a
      // shop whose declaration was removed while this screen was open.
      state = RevealError(failure.runtimeType.toString());
    }
  }

  /// Leaving the screen. Called from `dispose` so the value does not outlive
  /// the widget that asked for it — `autoDispose` would do it too, but only
  /// once nothing else is listening, and this must not depend on that.
  void forget() => state = const RevealHidden();
}

final taxRevealControllerProvider =
    NotifierProvider<TaxRevealController, RevealState>(TaxRevealController.new);
