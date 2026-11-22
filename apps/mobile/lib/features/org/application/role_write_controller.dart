import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/error/api_failure.dart';
import '../domain/entities/role_entities.dart';
import 'org_providers.dart';
import 'role_delete_error.dart';
import 'role_write_error.dart';

/// The outcome of one press of R3's submit button.
sealed class RoleWriteResult {
  const RoleWriteResult();
}

class RoleWriteSaved extends RoleWriteResult {
  const RoleWriteSaved(this.role);

  final RoleDetailView role;
}

class RoleWriteFailed extends RoleWriteResult {
  const RoleWriteFailed(this.error);

  final RoleWriteError error;
}

/// The outcome of one confirmed R5 delete (T-003-M08).
sealed class RoleDeleteResult {
  const RoleDeleteResult();
}

class RoleDeleteDone extends RoleDeleteResult {
  const RoleDeleteDone();
}

class RoleDeleteFailed extends RoleDeleteResult {
  const RoleDeleteFailed(this.error);

  final RoleDeleteError error;
}

/// T-003-M06 — R3's submit (`POST` / `PATCH /roles`). State = "a write is in
/// flight" (the form locks while it is).
///
/// Pessimistic, one request per press: nothing is retried here, least of all
/// a `409 ROLE_CHANGED` (SR-14 — the screen re-reads and the person decides).
///
/// After every SUCCESSFUL write it re-learns the caller's capabilities: a PATCH
/// answers with `viewer.*` as it was BEFORE the edit, and editing your own role
/// can take `manage_roles` away (AC-3.10) — the screen guards then leave on
/// their own. Re-reading after a create too is the web client's behaviour.
///
/// The re-reads a REFUSAL asks for (`RoleBannerError.refetch`) are performed
/// here for the shop-level reads (list, catalog, profile); `role` is the
/// form's to do, because the form owns the version it is built on.
class RoleWriteController extends AutoDisposeNotifier<bool> {
  bool _disposed = false;

  @override
  bool build() {
    ref.onDispose(() => _disposed = true);
    return false;
  }

  /// `null` = ignored (a write is already in flight).
  Future<RoleWriteResult?> create({required String name, required List<String> capabilities}) =>
      _run(() => ref.read(orgScopedRepositoryProvider).createRole(name: name, capabilities: capabilities));

  /// `null` = ignored (a write is already in flight).
  Future<RoleWriteResult?> update(String roleId, RoleUpdate body) =>
      _run(() => ref.read(orgScopedRepositoryProvider).updateRole(roleId, body));

  /// T-003-M08 R5 — ONE `DELETE` per confirmation; `null` = ignored (a write
  /// is already in flight). Pessimistic: R1 is re-read after the answer, it
  /// never drops the row on its own. Nothing is retried — least of all a
  /// `409 ROLE_IN_USE` (the screen shows the server's numbers instead).
  Future<RoleDeleteResult?> delete(String roleId) async {
    if (state) return null;
    state = true;
    try {
      await ref.read(orgScopedRepositoryProvider).deleteRole(roleId);
      if (_disposed) return const RoleDeleteDone();
      state = false;
      ref.invalidate(roleDetailsProvider);
      return const RoleDeleteDone();
    } on ApiFailure catch (failure) {
      final error = toRoleDeleteError(failure);
      if (_disposed) return RoleDeleteFailed(error);
      state = false;
      switch (error) {
        case RoleDeleteInUse() || RoleDeleteGone() || RoleDeleteHistoryLimit():
          // The list's counts / the row itself are stale; `role` is the
          // screen's to re-read (it owns the version it shows).
          ref.invalidate(roleDetailsProvider);
        case RoleDeleteRefused(:final refetch):
          _refetch(refetch);
        case RoleDeleteForbidden():
          _relearnMe();
        case RoleDeleteThrottled():
          break;
      }
      return RoleDeleteFailed(error);
    }
  }

  Future<RoleWriteResult?> _run(Future<RoleDetailView> Function() write) async {
    if (state) return null;
    state = true;
    try {
      final saved = await write();
      if (_disposed) return RoleWriteSaved(saved);
      state = false;
      ref.invalidate(roleDetailsProvider);
      _relearnMe();
      return RoleWriteSaved(saved);
    } on ApiFailure catch (failure) {
      final error = toRoleWriteError(failure);
      if (_disposed) return RoleWriteFailed(error);
      state = false;
      if (error is RoleBannerError) _refetch(error.refetch);
      if (error is RoleForbiddenError) _relearnMe();
      return RoleWriteFailed(error);
    }
  }

  void _refetch(Set<RoleRefetch> targets) {
    if (targets.contains(RoleRefetch.list)) ref.invalidate(roleDetailsProvider);
    if (targets.contains(RoleRefetch.catalog)) ref.invalidate(capabilityCatalogProvider);
    if (targets.contains(RoleRefetch.profile)) _relearnMe();
  }

  void _relearnMe() {
    ref.invalidate(orgProfileProvider);
    unawaited(learnCapabilitiesFromRef(ref));
  }
}

final roleWriteControllerProvider =
    AutoDisposeNotifierProvider<RoleWriteController, bool>(RoleWriteController.new);
