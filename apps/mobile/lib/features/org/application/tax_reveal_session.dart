import 'package:flutter/widgets.dart' show AppLifecycleState;

import '../../../core/error/api_failure.dart';
import '../domain/entities/org_entities.dart';
import '../domain/tax_reveal.dart';

/// ★ M-07 — the reveal button's behaviour, owned by the SCREEN.
///
/// ── Why this is not a Riverpod provider, which it was twice ───────────────
/// The security review's Critical was "the revealed number outlives the screen,
/// the shop, and the session": a global `NotifierProvider` kept it after the
/// widget was gone, so re-entering the screen painted somebody's national ID
/// again with no new request — and therefore no `org.tax_profile.revealed`
/// event to show it had been seen.
///
/// Fixing that inside Riverpod meant clearing the state at a widget lifecycle
/// point, and Riverpod refuses all of them: writing from `dispose` notifies a
/// defunct element, and writing from `initState` throws "tried to modify a
/// provider while the widget tree was building". Three attempts, three
/// refusals — which is the framework saying that ephemeral, screen-scoped
/// secret state does not belong in a container that outlives screens.
///
/// So it lives in the `State` that shows it. "Leaving the screen drops the
/// number" stops being a rule somebody has to implement and becomes a fact
/// about where the value is stored. A plain class rather than the `State`
/// itself so the rules stay testable without a widget.
class TaxRevealSession {
  TaxRevealSession({required this.reveal, required this.onChanged});

  /// The one call that returns a full tax id (§3.16): rate-limited 20/hour and
  /// audited, which is why nothing here caches its result.
  final Future<RevealedTaxId> Function() reveal;
  final void Function() onChanged;

  RevealState _state = const RevealHidden();
  RevealState get state => _state;

  /// Bumped by anything that invalidates a request in flight, so a response
  /// that arrives after the app backgrounded is dropped instead of painted.
  int _epoch = 0;

  void _set(RevealState next) {
    _state = next;
    onChanged();
  }

  /// The button: hides when a number is shown, asks when it is not.
  Future<void> press() async {
    if (!pressRequestsReveal(_state)) {
      // Hiding is local — it must never spend one of the user's twenty looks.
      _epoch++;
      _set(const RevealHidden());
      return;
    }

    final mine = ++_epoch;
    _set(const RevealLoading());
    try {
      final revealed = await reveal();
      if (mine != _epoch) return; // superseded: backgrounded, hidden, or gone
      _set(RevealShown(taxId: revealed.taxId, revealedAt: revealed.revealedAt));
    } on ApiFailure catch (failure) {
      if (mine != _epoch) return;
      // The failure itself, not its type name: the screen picks copy from it,
      // so a spent quota (429) stops reading like a removed declaration (404).
      _set(RevealError(failure));
    } catch (_) {
      // ★ Anything else — a deserialisation error on the one endpoint whose
      // success path no integration test covered, for instance. Without this
      // the state stayed `RevealLoading` for the rest of the app session: the
      // button dead and the screenshot guard held. The review found it by
      // throwing a non-`ApiFailure`.
      if (mine != _epoch) return;
      _set(const RevealError(null));
    }
  }

  /// The app left the foreground.
  ///
  /// A phone in a shop gets put on the counter, and the OS photographs the
  /// screen for its app switcher on the way out. The number goes, and a
  /// request in flight is invalidated so it cannot land behind the user's
  /// back — the review pressed the button, backgrounded the app, and found the
  /// number waiting on return, which also made the on-screen promise about
  /// auto-hiding false in exactly that case.
  void onLifecycle(AppLifecycleState lifecycle) {
    if (lifecycle == AppLifecycleState.resumed) return;
    _epoch++;
    // `RevealLoading` too, or the button is left disabled on a screen that is
    // no longer waiting for anything.
    if (_state is RevealShown || _state is RevealLoading) _set(const RevealHidden());
  }

  /// The screen is going away. Nothing outside it holds a reference, so the
  /// value dies here — but the epoch still moves, so a late response cannot
  /// call back into a disposed widget.
  void dispose() => _epoch++;
}
