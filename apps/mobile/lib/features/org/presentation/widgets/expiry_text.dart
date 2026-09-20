import '../../../../core/l10n/l10n.dart';
import '../../domain/expiry.dart';

/// T-002-M3 — joins the pure expiry calculation to `ux`'s words.
///
/// The split is the point: `domain/expiry.dart` decides WHICH number, this
/// decides which sentence, and the sentence itself lives in `app_th.arb`.
/// Nothing in the chain is allowed to know that "24 ชั่วโมง" is a plausible
/// answer — the duration depends on the invited role and restarts on every
/// reissue (D-027/D-028).
String formatExpiryLine(AppLocalizations t, DateTime expiresAt, {DateTime? now}) {
  final remaining = remainingUntil(expiresAt, now: now);
  final phrase = switch (remaining.unit) {
    RemainingUnit.expired => t.remainingExpired,
    RemainingUnit.days => t.remainingDays(remaining.value),
    RemainingUnit.hours => t.remainingHours(remaining.value),
    RemainingUnit.minutes => t.remainingMinutes(remaining.value),
  };
  return t.inviteExpiresAt(formatShopDateTime(expiresAt), phrase);
}
