import 'dart:async';

import 'package:flutter/foundation.dart';

/// Real-time ticking wrapper around [formatThrottleMessage]'s pure math
/// (ux-wireframe §3.2: "นับถอยหลังเป็น นาที:วินาที ที่ปรับ real-time ทุก
/// วินาที"). Not itself a widget so it stays unit-testable with a fake
/// [Ticker] callback (see test/auth/throttle_countdown_controller_test.dart).
///
/// Re-sync semantics (ux-wireframe §3.2 "เผื่อ clock skew ... re-sync ทุกครั้ง
/// ที่ผู้ใช้พยายาม submit ซ้ำ"): call [start] again with a fresh
/// `retryAfterSeconds` whenever the server returns a new 429 — it replaces
/// the running countdown rather than stacking timers.
class ThrottleCountdownController extends ChangeNotifier {
  ThrottleCountdownController({
    Duration tick = const Duration(seconds: 1),
    Timer Function(Duration, void Function(Timer))? timerFactory,
  })  : _tick = tick,
        _timerFactory = timerFactory ?? Timer.periodic;

  final Duration _tick;
  final Timer Function(Duration, void Function(Timer)) _timerFactory;

  Timer? _timer;
  int _remainingSeconds = 0;
  bool get isActive => _remainingSeconds > 0;
  int get remainingSeconds => _remainingSeconds;

  /// Starts (or re-syncs) the countdown from `retryAfterSeconds` (the
  /// `Retry-After` header value, api-spec §3). If a countdown is already
  /// running, this replaces it — the newest server-provided value always
  /// wins (handles clock skew across repeated 429s).
  void start(int retryAfterSeconds) {
    _timer?.cancel();
    _remainingSeconds = max0(retryAfterSeconds);
    if (_remainingSeconds <= 0) {
      notifyListeners();
      return;
    }
    _timer = _timerFactory(_tick, (timer) {
      _remainingSeconds = max0(_remainingSeconds - 1);
      notifyListeners();
      if (_remainingSeconds <= 0) {
        timer.cancel();
      }
    });
    notifyListeners();
  }

  void cancel() {
    _timer?.cancel();
    _timer = null;
    _remainingSeconds = 0;
    notifyListeners();
  }

  static int max0(int n) => n < 0 ? 0 : n;

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}
