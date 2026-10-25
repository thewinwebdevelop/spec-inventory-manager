/// T-003-M05 — the role entities R1/R2 work in (api-spec §3: `/role-details`,
/// `/capabilities`). Pure Dart (gate rule 1); `data/` maps the wire DTOs onto
/// these.
///
/// ⛔ Every `allowed`/`reason` here is the SERVER's verdict, carried verbatim.
/// Nothing in the client recomputes "may this person edit/clone/create" from
/// capability sets — that is the client-invented-server-fact failure mode.
library;

/// One `viewer.*` verdict (`RoleWriteVerdict`). [reason] is an OPEN set —
/// mapped to copy (unknown → generic) only in presentation.
class RoleVerdict {
  const RoleVerdict({required this.allowed, this.reason});

  final bool allowed;
  final String? reason;
}

class RoleUsage {
  const RoleUsage({required this.activeMembers, required this.pendingInvitations});

  final int activeMembers;
  final int pendingInvitations;
}

/// `RoleDetail.lastEdited` — `kind` is an OPEN set, kept as the raw string.
class RoleLastEditedInfo {
  const RoleLastEditedInfo({
    required this.at,
    required this.kind,
    this.byRoleName,
    this.byRoleKey,
    this.byRoleNameCustomized,
  });

  final DateTime at;
  final String kind;
  final String? byRoleName;

  /// ⛔ Display slug only (see `roleDisplayName`).
  final String? byRoleKey;
  final bool? byRoleNameCustomized;
}

class RoleDetailView {
  const RoleDetailView({
    required this.id,
    required this.name,
    required this.roleKey,
    required this.nameCustomized,
    required this.isSystem,
    required this.capabilities,
    required this.usage,
    required this.lastEdited,
    required this.canEdit,
    required this.canDelete,
    required this.canClone,
  });

  final String id;
  final String name;

  /// ⛔ Display slug ONLY. Never a permission input.
  final String? roleKey;
  final bool nameCustomized;
  final bool isSystem;
  final List<String> capabilities;
  final RoleUsage usage;
  final RoleLastEditedInfo? lastEdited;
  final RoleVerdict canEdit;
  final RoleVerdict canDelete;
  final RoleVerdict canClone;
}

class RoleDetailsPage {
  const RoleDetailsPage({required this.items, required this.canCreate, required this.limit});

  /// Server order.
  final List<RoleDetailView> items;
  final RoleVerdict canCreate;
  final int limit;
}

class CapabilityCatalogEntry {
  const CapabilityCatalogEntry({
    required this.key,
    required this.labelTh,
    required this.selectable,
  });

  final String key;
  final String labelTh;
  final bool selectable;
}

/// `GET /orgs/{orgId}/capabilities` — labels come from the server (D-037),
/// never typed on the client. Catalog order is preserved.
class CapabilityCatalogView {
  const CapabilityCatalogView({required this.items});

  final List<CapabilityCatalogEntry> items;
}
