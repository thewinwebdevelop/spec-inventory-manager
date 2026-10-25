/// T-003-M05 — R1 row decisions that are not copy. Pure Dart.
///
/// ⛔ The badge is a presentation of the server's `canEdit` verdict and of
/// `isSystem`; it is never a permission decision (nothing is enabled or hidden
/// by it — the row is tappable either way, R3/R4 decide from the same verdict).
library;

import 'entities/role_entities.dart';

enum RoleBadge { locked, readOnly }

/// ux R1 · Badge (neutral, text always): `isSystem` wins; `!canEdit.allowed`
/// shows "ดูได้อย่างเดียว" unless the reason is `role_locked` /
/// `writes_disabled` (the lock badge / the banner already say it). No other
/// badge exists.
RoleBadge? roleBadgeFor(RoleDetailView role) {
  if (role.isSystem) return RoleBadge.locked;
  if (!role.canEdit.allowed &&
      role.canEdit.reason != 'role_locked' &&
      role.canEdit.reason != 'writes_disabled') {
    return RoleBadge.readOnly;
  }
  return null;
}

/// The create verdict's `writes_disabled` reason is reported on EVERY write
/// verdict while the flag is off (api-spec) — so it is the one to read for the
/// top banner.
bool writesDisabledBanner(RoleVerdict canCreate) => canCreate.reason == 'writes_disabled';
