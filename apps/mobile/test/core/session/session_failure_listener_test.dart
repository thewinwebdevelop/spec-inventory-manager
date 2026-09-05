// T-002-M2 ★ — which failures move the session, and how far.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/error/api_failure.dart';
import 'package:mobile/core/session/session_controller.dart';
import 'package:mobile/core/session/session_failure_listener.dart';
import 'package:mobile/core/session/session_state.dart';

const _org = ActiveOrg(orgId: 'org_1', name: 'ร้าน', capabilities: {'manage_members'});

(SessionController, SessionFailureListener) _subject() {
  final controller = SessionController()..signedIn(orgs: const [], active: _org);
  return (controller, SessionFailureListener(controller));
}

void main() {
  test('★ ORG_ACCESS_DENIED drops the SHOP and keeps the session (D-027)', () {
    final (controller, listener) = _subject();

    expect(listener.handle(const OrgAccessDeniedFailure()), isTrue);

    final state = controller.state;
    expect(state, isA<SessionAuthed>(), reason: 'still signed in');
    expect((state as SessionAuthed).active, isNull, reason: 'but no active shop');
  });

  test('★ FORBIDDEN moves nothing — one missing capability is not a logout', () {
    // The failure this guards is "the app logged me out for no reason":
    // opening a page you lack one capability for must leave you exactly where
    // you are, in the shop you are in.
    final (controller, listener) = _subject();

    expect(listener.handle(const ForbiddenFailure(code: 'FORBIDDEN')), isFalse);

    expect((controller.state as SessionAuthed).active?.orgId, 'org_1');
  });

  test('a terminal 401 does end the session', () {
    final (controller, listener) = _subject();
    expect(listener.handle(const AuthExpiredFailure()), isTrue);
    expect(controller.state, isA<SessionNone>());
  });

  test('426 goes to the force-update screen', () {
    final (controller, listener) = _subject();
    expect(listener.handle(const ForceUpdateFailure()), isTrue);
    expect(controller.state, isA<SessionForceUpdate>());
  });

  test('★ no ordinary failure touches the session', () {
    // Widening this list is how a transient network blip becomes a logout.
    const ordinary = <ApiFailure>[
      NetworkFailure(),
      ThrottledFailure(),
      EntitlementFailure(),
      ValidationFailure(),
      BusyFailure(),
      ConflictFailure(code: 'LAST_OWNER'),
      NotFoundFailure(),
      ServerFailure(),
    ];
    for (final failure in ordinary) {
      final (controller, listener) = _subject();
      expect(listener.handle(failure), isFalse, reason: '$failure');
      expect(controller.state, isA<SessionAuthed>(), reason: '$failure');
      expect((controller.state as SessionAuthed).active, isNotNull, reason: '$failure');
    }
  });

  group('the provider (★ T-002-M3 — the wiring M2 left open)', () {
    test('★ resolves to a listener bound to the app\'s real SessionController', () {
      // Until this provider existed the class had a test and no caller: a
      // rule that reads like enforcement and enforces nothing.
      final container = ProviderContainer();
      addTearDown(container.dispose);
      container.read(sessionControllerProvider.notifier).signedIn(orgs: const [], active: _org);

      final moved = container.read(sessionFailureListenerProvider)
          .handle(const OrgAccessDeniedFailure());

      expect(moved, isTrue);
      expect(container.read(activeOrgIdProvider), isNull);
      // The account survives — the shop is what was lost (D-027).
      expect(container.read(sessionControllerProvider), isA<SessionAuthed>());
    });

    test('the same instance is reused — one listener, one session', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      expect(
        identical(
          container.read(sessionFailureListenerProvider),
          container.read(sessionFailureListenerProvider),
        ),
        isTrue,
      );
    });
  });
}
