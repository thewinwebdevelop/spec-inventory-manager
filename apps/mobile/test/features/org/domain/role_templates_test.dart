// T-003-M05 (CM3) — R2's pure decisions and R1's badge rule.
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/org/domain/entities/role_entities.dart';
import 'package:mobile/features/org/domain/role_list_row.dart';
import 'package:mobile/features/org/domain/role_templates.dart';

RoleDetailView role(
  String id, {
  List<String> caps = const [],
  RoleVerdict canClone = const RoleVerdict(allowed: true),
  RoleVerdict canEdit = const RoleVerdict(allowed: true),
  bool isSystem = false,
}) =>
    RoleDetailView(
      id: id,
      name: id,
      roleKey: null,
      nameCustomized: true,
      isSystem: isSystem,
      capabilities: caps,
      usage: const RoleUsage(activeMembers: 0, pendingInvitations: 0),
      lastEdited: null,
      canEdit: canEdit,
      canDelete: const RoleVerdict(allowed: true),
      canClone: canClone,
    );

const catalog = CapabilityCatalogView(items: [
  CapabilityCatalogEntry(key: 'manage_products', labelTh: 'จัดการสินค้า', selectable: true),
  CapabilityCatalogEntry(key: 'full_access', labelTh: 'ทำได้ทุกอย่าง', selectable: false),
  CapabilityCatalogEntry(key: 'manage_stock', labelTh: 'จัดการสต๊อก', selectable: true),
  CapabilityCatalogEntry(key: 'manage_orders', labelTh: 'จัดการออเดอร์', selectable: true),
  CapabilityCatalogEntry(key: 'view_reports', labelTh: 'ดูรายงาน', selectable: true),
]);

void main() {
  group('offeredTemplates', () {
    test('drops owner_role (AC-3.2) and keeps disabled-but-offered roles', () {
      final roles = [
        role('owner', canClone: const RoleVerdict(allowed: false, reason: 'owner_role')),
        role('big', canClone: const RoleVerdict(allowed: false, reason: 'exceeds_your_permissions')),
        role('ok'),
      ];
      expect(offeredTemplates(roles).map((r) => r.id), ['big', 'ok']);
    });
  });

  group('defaultTemplateId', () {
    test('fewest capabilities among CLONEABLE roles; ties keep server order', () {
      final roles = [
        role('a', caps: ['x', 'y', 'z']),
        role('b', caps: ['x']),
        role('c', caps: ['x']),
        // fewer, but the server said no — must not win.
        role('d', canClone: const RoleVerdict(allowed: false, reason: 'exceeds_your_permissions')),
      ];
      expect(defaultTemplateId(roles), 'b');
    });

    test('never the owner_role row, even if it somehow says allowed', () {
      final roles = [
        role('owner', canClone: const RoleVerdict(allowed: true, reason: 'owner_role')),
        role('x', caps: ['a', 'b']),
      ];
      expect(defaultTemplateId(roles), 'x');
    });

    test('no cloneable role → blank', () {
      final roles = [
        role('d', canClone: const RoleVerdict(allowed: false, reason: 'exceeds_your_permissions')),
      ];
      expect(defaultTemplateId(roles), blankTemplateId);
      expect(defaultTemplateId(const []), blankTemplateId);
    });
  });

  group('summarizeCapabilities', () {
    test('catalog order, selectable only, first 3, truncated flag from the count', () {
      final s = summarizeCapabilities(
        role('r', caps: ['view_reports', 'full_access', 'manage_orders', 'manage_products', 'manage_stock']),
        catalog,
      );
      expect(s.count, 5);
      expect(s.labels, ['จัดการสินค้า', 'จัดการสต๊อก', 'จัดการออเดอร์']);
      expect(s.truncated, isTrue);
    });

    test('a key the catalog does not know is counted but never printed', () {
      final s = summarizeCapabilities(role('r', caps: ['manage_products', 'future_cap']), catalog);
      expect(s.count, 2);
      expect(s.labels, ['จัดการสินค้า']);
      expect(s.truncated, isFalse);
    });
  });

  group('roleBadgeFor', () {
    test('isSystem wins', () {
      expect(
        roleBadgeFor(role('o', isSystem: true, canEdit: const RoleVerdict(allowed: false, reason: 'exceeds_your_permissions'))),
        RoleBadge.locked,
      );
    });
    test('read-only for a refusal that is neither role_locked nor writes_disabled (incl. unknown)', () {
      for (final reason in ['exceeds_your_permissions', 'in_use_requires_manage_members', 'brand_new', null]) {
        expect(
          roleBadgeFor(role('r', canEdit: RoleVerdict(allowed: false, reason: reason))),
          RoleBadge.readOnly,
          reason: '$reason',
        );
      }
    });
    test('no badge when editable, role_locked, or writes_disabled', () {
      expect(roleBadgeFor(role('r')), isNull);
      expect(roleBadgeFor(role('r', canEdit: const RoleVerdict(allowed: false, reason: 'role_locked'))), isNull);
      expect(roleBadgeFor(role('r', canEdit: const RoleVerdict(allowed: false, reason: 'writes_disabled'))), isNull);
    });
  });

  test('writesDisabledBanner reads only the create verdict reason', () {
    expect(writesDisabledBanner(const RoleVerdict(allowed: false, reason: 'writes_disabled')), isTrue);
    expect(writesDisabledBanner(const RoleVerdict(allowed: false, reason: 'role_limit_reached')), isFalse);
    expect(writesDisabledBanner(const RoleVerdict(allowed: true)), isFalse);
  });
}
