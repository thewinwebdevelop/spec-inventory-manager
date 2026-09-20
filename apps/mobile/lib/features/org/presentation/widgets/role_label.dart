import '../../../../core/l10n/l10n.dart';

/// T-002-M3 — `roleKey` → Thai, with a fallback that matters.
///
/// `roleKey` is an OPEN set: `owner|admin|staff` for the three system roles,
/// `null` for anything F-003 lets a shop create. An unknown value MUST fall
/// back to the server's `roleName` rather than rendering the key or an empty
/// string — api-spec §3.2 says so on the field.
///
/// ⛔ Never a permission input. "Is this an Owner?" is answered by
/// capabilities (or by the server's `isOwner`), never by this string.
String roleLabel(AppLocalizations t, String? roleKey, String roleName) => switch (roleKey) {
      'owner' => t.roleOwner,
      'admin' => t.roleAdmin,
      'staff' => t.roleStaff,
      _ => roleName,
    };
