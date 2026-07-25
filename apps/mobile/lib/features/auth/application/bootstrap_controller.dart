import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/entities/auth_bootstrap_status.dart';
import '../domain/usecases/run_auth_bootstrap.dart';
import 'auth_providers.dart';

/// D-023 — Riverpod `AsyncNotifier` wrapping the pure [runAuthBootstrap]
/// usecase (docs/mobile-architecture.md §5 migration map: "auth_bootstrap.dart
/// -> usecase + controller"). `AsyncValue` models the design-system's
/// loading/error/data states directly (design-system.md §2): `.loading` is
/// the initial/retry-in-flight state, `.data` carries the terminal
/// [AuthBootstrapStatus], and `.error` is reserved for a genuinely unexpected
/// throw (the usecase itself never throws — every real-world failure mode
/// is modeled as a terminal [AuthBootstrapStatus] value instead, e.g.
/// [AuthBootstrapStatus.transientFailure]).
///
/// `BootstrapScreen` (presentation) watches this via
/// `bootstrapControllerProvider` and reacts to the terminal status exactly
/// once per attempt (mirrors the previous `BootstrapScreenState._run`'s
/// "never fire onRestored/onNeedsLogin twice" guard, now expressed as
/// "read the resolved AsyncValue once, on the widget side, and gate the
/// callback there").
class BootstrapController extends AsyncNotifier<AuthBootstrapStatus> {
  @override
  Future<AuthBootstrapStatus> build() {
    return runAuthBootstrap(ref.read(authRepositoryProvider));
  }

  /// Re-runs the one-shot bootstrap (never loops automatically; only on
  /// explicit user action — e.g. the offline/retry button, L-3).
  Future<void> retry() async {
    state = const AsyncValue<AuthBootstrapStatus>.loading();
    state = await AsyncValue.guard(
      () => runAuthBootstrap(ref.read(authRepositoryProvider)),
    );
  }
}

final bootstrapControllerProvider =
    AsyncNotifierProvider<BootstrapController, AuthBootstrapStatus>(BootstrapController.new);
