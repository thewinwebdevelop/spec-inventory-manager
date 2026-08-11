import '../error/api_failure.dart';
import 'session_controller.dart';

/// T-002-M2 ★ — the bridge from a failure to the session (mobile.md §3.2:
/// "interceptor 401-terminal / 403-revoked / 426 ยิงเข้า `SessionController`").
///
/// Without this, `OrgAccessDeniedFailure` would be a type nothing reacts to —
/// a taxonomy entry that reads like enforcement and changes nothing. Three
/// failures move the session, and each moves it a DIFFERENT distance:
///
///   - [OrgAccessDeniedFailure] → drop the SHOP, keep the session (D-027);
///   - [AuthExpiredFailure] → end the session (refresh already failed);
///   - [ForceUpdateFailure] → terminal screen, nothing else works.
///
/// Everything else is a screen's problem, not the session's. Widening this
/// list is how "the app logged me out for no reason" happens: a
/// [ForbiddenFailure] here would sign somebody out for opening a page they
/// lack one capability for.
///
/// Pure and synchronous, so the rule is testable without Dio, a widget tree
/// or a running app.
class SessionFailureListener {
  const SessionFailureListener(this._session);

  final SessionController _session;

  /// Returns true when the failure moved the session — the caller can then
  /// skip its own error UI, because the router is about to take over.
  bool handle(ApiFailure failure) {
    switch (failure) {
      case OrgAccessDeniedFailure():
        // The shop, not the account. Signing out here would be the
        // destructive reading of a status that says nothing about their
        // account — and the person is very likely still in other shops.
        _session.orgAccessDenied();
        return true;
      case AuthExpiredFailure():
        _session.sessionExpired();
        return true;
      case ForceUpdateFailure():
        _session.forceUpdate();
        return true;
      // Everything below stays with the screen that made the call. Listed
      // explicitly rather than caught by a default, so a new failure case
      // has to be given an answer here too.
      case NetworkFailure():
      case ThrottledFailure():
      case ForbiddenFailure():
      case EntitlementFailure():
      case ValidationFailure():
      case BusyFailure():
      case ConflictFailure():
      case NotFoundFailure():
      case ServerFailure():
        return false;
    }
  }
}
