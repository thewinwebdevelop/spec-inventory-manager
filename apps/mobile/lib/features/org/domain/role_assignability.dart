/// T-003-M11 — the R8 rule, shared by the invite screen and the R10 sheet
/// (test-plan CM3-08: "ตัวเลือก role = ชุดเดียวกับจอเชิญ — widget/แหล่งข้อมูล
/// เดียวกัน"). One function, so the two lists cannot drift.
///
/// `viewerCanAssign` from the server wins when present. Only when it is
/// absent does the F-002 rule apply: the ownership-granting role is closed to
/// a non-Owner (`grantsOwnership` is the server's derivation, never `key`).
///
/// Pure Dart (gate rule 1).
library;

import 'entities/org_entities.dart';

bool roleOptionDisabled(RoleRow role, {required bool viewerIsOwner}) =>
    switch (role.viewerCanAssign) {
      final bool can => !can,
      null => role.grantsOwnership && !viewerIsOwner,
    };

/// The raw reason to explain a disabled option with — the server's
/// `assignBlockedReason`, or F-002's `owner_only` when the server sent no
/// verdict at all. `''` (→ generic copy) when the server said "no" without
/// a reason.
String roleOptionBlockedReason(RoleRow role) =>
    role.assignBlockedReason ?? (role.viewerCanAssign == null ? 'owner_only' : '');
