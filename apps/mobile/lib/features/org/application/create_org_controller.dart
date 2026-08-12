import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/error/api_failure.dart';
import '../../../core/session/session_controller.dart';
import '../../../core/session/session_state.dart';
import '../domain/entities/org_entities.dart';
import 'create_org_error.dart';
import 'org_providers.dart';

/// Longest shop name the contract accepts (api-spec §3.1, `name` 1–120).
const int orgNameMaxLength = 120;

class CreateOrgState {
  const CreateOrgState({this.submitting = false, this.error});

  final bool submitting;
  final CreateOrgError? error;
}

/// T-002-M3 — S2's one write, and what has to be true the moment it returns.
///
/// `AutoDispose`: a `409 ORG_LIMIT_REACHED` banner from a previous visit must
/// not be on screen when the form is opened again (the same reason
/// `LoginController` is autoDispose).
class CreateOrgController extends AutoDisposeNotifier<CreateOrgState> {
  bool _disposed = false;

  @override
  CreateOrgState build() {
    ref.onDispose(() => _disposed = true);
    return const CreateOrgState();
  }

  /// Returns the new shop on success, null on failure (the error is in
  /// [state]). The screen navigates; this layer does not know about routes.
  ///
  /// The shop is made ACTIVE here, before returning — ux-wireframe §3 says
  /// success goes straight into the new shop, and `POST /organizations`
  /// answers with everything needed to do that without a second round trip
  /// (ux Q5). Setting the session after navigating would build the first
  /// org-scoped screen with no active shop, and `orgDioProvider` throws on
  /// exactly that.
  Future<CreatedOrganization?> submit(String rawName) async {
    if (state.submitting) return null;

    final name = rawName.trim();
    if (name.isEmpty || name.length > orgNameMaxLength) {
      // Checked here as well as by the server: a round trip to be told the
      // field is empty is a round trip the person waits through. The server
      // remains the authority — this only short-circuits the obvious case.
      state = const CreateOrgState(error: CreateOrgFieldError());
      return null;
    }

    state = const CreateOrgState(submitting: true);
    try {
      final created = await ref.read(orgDirectoryProvider).createOrganization(name: name);
      if (_disposed) return created;

      ref.read(sessionControllerProvider.notifier).switchOrg(
            ActiveOrg(
              orgId: created.id,
              name: created.name,
              // The creator is the new shop's Owner — the response says so,
              // and this is the one moment the client learns capabilities
              // without a `GET /orgs/{orgId}` (M-3's gap everywhere else).
              capabilities: created.capabilities,
            ),
          );
      // The switcher must not be able to show a stale list that lacks the
      // shop the person is now standing in.
      ref.invalidate(myOrganizationsProvider);

      state = const CreateOrgState();
      return created;
    } on ApiFailure catch (failure) {
      if (_disposed) return null;
      state = CreateOrgState(error: toCreateOrgError(failure));
      return null;
    }
  }

  /// Dismissing the banner without retrying — the form stays as typed.
  void clearError() {
    if (!_disposed) state = CreateOrgState(submitting: state.submitting);
  }
}

final createOrgControllerProvider =
    NotifierProvider.autoDispose<CreateOrgController, CreateOrgState>(CreateOrgController.new);
