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
    required this.grantsOwnership,
    required this.capabilities,
    required this.usage,
    required this.lastEdited,
    required this.canEdit,
    required this.canDelete,
    required this.canClone,
    required this.version,
  });

  final String id;
  final String name;

  /// ⛔ Display slug ONLY. Never a permission input.
  final String? roleKey;
  final bool nameCustomized;
  final bool isSystem;

  /// T-003-M08 — derived by the SERVER from `capabilities` (`full_access`),
  /// never from [roleKey]. R4 reads it to show the single full-access card.
  final bool grantsOwnership;
  final List<String> capabilities;
  final RoleUsage usage;
  final RoleLastEditedInfo? lastEdited;
  final RoleVerdict canEdit;
  final RoleVerdict canDelete;
  final RoleVerdict canClone;

  /// `RoleDetail.version` — what a PATCH must echo (T-003-M06). Only ever the
  /// server's number; the client never bumps it (409 `ROLE_CHANGED` means
  /// re-read, never retry with `details.currentVersion` — SR-14).
  final int version;
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
    this.descriptionTh = '',
    this.group,
    this.status = 'active',
    this.implies = const [],
  });

  final String key;
  final String labelTh;
  final bool selectable;

  /// T-003-M06 (R3 checklist) — server text (D-037), never typed here.
  final String descriptionTh;

  /// A key into [CapabilityCatalogView.groups], or anything else (an OPEN
  /// value) — an unknown or `null` group lands in "อื่น ๆ" (ux §0.4).
  final String? group;

  /// OPEN set; only `upcoming` changes what the row looks like.
  final String status;

  /// `manage_X → view_X` edges (AC-7.3) — the imply-lock reads these.
  final List<String> implies;
}

class CapabilityGroupEntry {
  const CapabilityGroupEntry({required this.key, required this.labelTh});

  final String key;
  final String labelTh;
}

/// `GET /orgs/{orgId}/capabilities` — labels come from the server (D-037),
/// never typed on the client. Catalog order is preserved.
class CapabilityCatalogView {
  const CapabilityCatalogView({required this.items, this.groups = const []});

  final List<CapabilityCatalogEntry> items;

  /// Server order = display order of the R3 checklist groups.
  final List<CapabilityGroupEntry> groups;
}

/// T-003-M06 — a `PATCH /roles/{id}` body. `name` / `capabilities` are each
/// present ONLY when they changed (ux R3 ⚠️: sending the shown translation of
/// an un-renamed system role back would rename it); `version` always.
class RoleUpdate {
  const RoleUpdate({required this.version, this.name, this.capabilities});

  final int version;
  final String? name;
  final List<String>? capabilities;
}
