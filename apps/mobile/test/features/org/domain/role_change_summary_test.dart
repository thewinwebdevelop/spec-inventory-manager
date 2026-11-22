// T-003-M07 — what R3a (confirm before save) and R3b (409 ROLE_CHANGED) say
// about a capability change. The Dart twin of web `role-change-summary.test.ts`.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/org/domain/entities/role_entities.dart';
import 'package:mobile/features/org/domain/role_change_summary.dart';

/// What a tier-`all` shop's catalog looks like: `access_accounting` (tier
/// `full`) is absent — the server hides it (api-spec §3 AC-7.4).
const _catalog = CapabilityCatalogView(
  groups: [
    CapabilityGroupEntry(key: 'team', labelTh: 'ทีมงาน'),
    CapabilityGroupEntry(key: 'catalog_stock', labelTh: 'สินค้าและสต๊อก'),
    CapabilityGroupEntry(key: 'finance', labelTh: 'การเงิน'),
  ],
  items: [
    CapabilityCatalogEntry(key: 'full_access', labelTh: 'ทำได้ทุกอย่าง (เฉพาะเจ้าของร้าน)', selectable: false),
    CapabilityCatalogEntry(key: 'manage_members', labelTh: 'จัดการสมาชิกและคำเชิญ', selectable: true, group: 'team'),
    CapabilityCatalogEntry(key: 'manage_roles', labelTh: 'จัดการบทบาทและสิทธิ์', selectable: true, group: 'team'),
    CapabilityCatalogEntry(
      key: 'manage_products', labelTh: 'จัดการสินค้า', selectable: true, group: 'catalog_stock',
      implies: ['view_products'],
    ),
    CapabilityCatalogEntry(key: 'view_products', labelTh: 'ดูสินค้า', selectable: true, group: 'catalog_stock'),
    CapabilityCatalogEntry(key: 'manage_stock', labelTh: 'จัดการสต๊อก', selectable: true, group: 'catalog_stock'),
    CapabilityCatalogEntry(key: 'view_financials', labelTh: 'ดูต้นทุนและกำไร', selectable: true, group: 'finance'),
  ],
);

/// The golden file (read, not copied) — used here only to pick real vectors
/// for the UX01 display rules.
final _golden = jsonDecode(File(
  '${Directory.current.path}/../../packages/core-domain/src/rbac/fixtures/lost-capabilities.vectors.json',
).readAsStringSync()) as Map<String, Object?>;

List<Map<String, Object?>> get _vectors => (_golden['vectors']! as List).cast<Map<String, Object?>>();
List<String> _s(Object? v) => (v! as List).cast<String>().toList();
Set<String> get _liveKeys => {
      for (final r in ((_golden['registries']! as Map)['live']! as List).cast<Map<String, Object?>>())
        r['key']! as String,
    };

void main() {
  group('comparisonRegistry — the catalog\'s own edges (server truth), nothing bundled', () {
    test('every catalog item, with its implies', () {
      final reg = comparisonRegistry(_catalog);
      expect(reg.map((e) => e.key), _catalog.items.map((i) => i.key));
      expect(reg.firstWhere((e) => e.key == 'manage_products').implies, ['view_products']);
    });

    test('★ UX01: full_access expands over what THIS shop can see — a hidden tier-full key never enters the list',
        () {
      final change = capabilityChange(['full_access'], ['manage_stock'], comparisonRegistry(_catalog));
      expect(change.removed, contains('full_access'));
      expect(change.removed, isNot(contains('access_accounting')));
      expect(change.removed, isNot(contains('manage_stock')));
    });
  });

  group('capabilityChange', () {
    test('added is lostCapabilities the other way round', () {
      final c = capabilityChange(['manage_members'], ['manage_roles'], comparisonRegistry(_catalog));
      expect(c.added, ['manage_roles']);
      expect(c.removed, ['manage_members']);
    });
  });

  group('capabilityLines (UX01 · ux §0.4)', () {
    test('catalog labels, in catalog order (not key order)', () {
      final l = capabilityLines(['view_financials', 'manage_members'], _catalog);
      expect(l.labels, ['จัดการสมาชิกและคำเชิญ', 'ดูต้นทุนและกำไร']);
      expect(l.otherCount, 0);
    });

    test('full_access present = ONE line, nothing else listed or counted (golden vector)', () {
      final v = _vectors.firstWhere(
        (x) => x['registry'] == 'live' && _s(x['before']).contains('full_access') && _s(x['lost']).contains('full_access'),
      );
      // The vector's `lost` holds every live key, access_accounting included.
      expect(_s(v['lost']), contains('access_accounting'));
      final l = capabilityLines(_s(v['lost']), _catalog);
      expect(l.labels, ['ทำได้ทุกอย่าง (เฉพาะเจ้าของร้าน)']);
      expect(l.otherCount, 0);
    });

    test('full_access with no catalog label → counted once, never dropped', () {
      final l = capabilityLines(['full_access', 'manage_members'], const CapabilityCatalogView(items: []));
      expect(l.labels, isEmpty);
      expect(l.otherCount, 1);
    });

    test('a really unknown key still counts as "อื่นอีก n" (golden vector: unknown key is kept and can be lost)', () {
      final v = _vectors.firstWhere(
        (x) => x['registry'] == 'live' && _s(x['lost']).any((k) => !_liveKeys.contains(k)),
      );
      final change = capabilityChange(_s(v['before']), _s(v['after']), comparisonRegistry(_catalog));
      final l = capabilityLines(change.removed, _catalog);
      expect(l.otherCount, greaterThan(0));
      expect(l.otherCount, change.removed.where((k) => !_catalog.items.any((i) => i.key == k)).length);
    });

    test('empty → nothing', () {
      final l = capabilityLines(const [], _catalog);
      expect(l.labels, isEmpty);
      expect(l.otherCount, 0);
      expect(l.isEmpty, isTrue);
    });
  });

  group('buildSaveConfirmation — R3a', () {
    const usage = RoleUsage(activeMembers: 2, pendingInvitations: 1);

    test('added / removed compare EXPANDED sets', () {
      final c = buildSaveConfirmation(
        roleName: 'ผู้ดูแล',
        before: ['manage_members', 'manage_products'],
        after: ['manage_members', 'view_products', 'view_financials'],
        catalog: _catalog,
        usage: usage,
        isMine: false,
      );
      expect(c.added.labels, ['ดูต้นทุนและกำไร']);
      expect(c.removed.labels, ['จัดการสินค้า']);
      expect(c.selfLoss, isNull);
      expect(c.usage.activeMembers, 2);
      expect(c.usage.pendingInvitations, 1);
      expect(c.roleName, 'ผู้ดูแล');
    });

    test('not my role → no self-loss even when something is lost', () {
      final c = buildSaveConfirmation(
        roleName: 'x', before: ['manage_members', 'manage_roles'], after: ['manage_members'],
        catalog: _catalog, usage: usage, isMine: false,
      );
      expect(c.removed.labels, ['จัดการบทบาทและสิทธิ์']);
      expect(c.selfLoss, isNull);
    });

    test('my role, losing manage_roles → self-loss with losesManageRoles', () {
      final c = buildSaveConfirmation(
        roleName: 'x', before: ['manage_members', 'manage_roles'], after: ['manage_members'],
        catalog: _catalog, usage: usage, isMine: true,
      );
      expect(c.selfLoss, isNotNull);
      expect(c.selfLoss!.lines.labels, ['จัดการบทบาทและสิทธิ์']);
      expect(c.selfLoss!.losesManageRoles, isTrue);
    });

    test('my role, losing something else → self-loss without losesManageRoles', () {
      final c = buildSaveConfirmation(
        roleName: 'x', before: ['manage_members', 'manage_roles'], after: ['manage_roles'],
        catalog: _catalog, usage: usage, isMine: true,
      );
      expect(c.selfLoss!.lines.labels, ['จัดการสมาชิกและคำเชิญ']);
      expect(c.selfLoss!.losesManageRoles, isFalse);
    });

    test('my role, gains only → no self-loss', () {
      final c = buildSaveConfirmation(
        roleName: 'x', before: ['manage_roles'], after: ['manage_roles', 'manage_stock'],
        catalog: _catalog, usage: usage, isMine: true,
      );
      expect(c.selfLoss, isNull);
      expect(c.added.labels, ['จัดการสต๊อก']);
      expect(c.removed.isEmpty, isTrue);
    });

    test('a stored key the catalog hides goes back in the PATCH, so it is neither added nor removed', () {
      // `access_accounting` stored on the role (shop since moved off tier full):
      // the form passes it through (ux §0.4), so it is on both sides.
      final c = buildSaveConfirmation(
        roleName: 'x',
        before: ['access_accounting', 'manage_members'],
        after: ['access_accounting', 'manage_roles'],
        catalog: _catalog, usage: usage, isMine: true,
      );
      expect(c.removed.labels, ['จัดการสมาชิกและคำเชิญ']);
      expect(c.removed.otherCount, 0);
      expect(c.added.otherCount, 0);
    });
  });

  group('draftDiff / reapplyDraft — R3b', () {
    const start = (name: 'ผู้ดูแล', capabilities: ['manage_members', 'manage_stock']);

    test('the person\'s diff against the version they STARTED from', () {
      final d = draftDiff(
        start,
        (name: ' ผู้ช่วยเจ้าของร้าน ', capabilities: ['manage_members', 'view_financials']),
        _catalog,
      );
      expect(d.name, (from: 'ผู้ดูแล', to: 'ผู้ช่วยเจ้าของร้าน'));
      expect(d.added.labels, ['ดูต้นทุนและกำไร']);
      expect(d.removed.labels, ['จัดการสต๊อก']);
      expect(d.addedKeys, ['view_financials']);
      expect(d.removedKeys, ['manage_stock']);
      expect(d.isEmpty, isFalse);
    });

    test('an only re-spaced name is not part of the diff', () {
      final d = draftDiff(start, (name: 'ผู้ดูแล  ', capabilities: ['manage_members', 'manage_stock']), _catalog);
      expect(d.name, isNull);
      expect(d.isEmpty, isTrue);
    });

    test('reapply lays the diff over the LATEST version, keeping what others changed', () {
      final d = draftDiff(start, (name: 'ผู้ช่วย', capabilities: ['manage_members', 'view_financials']), _catalog);
      final r = reapplyDraft(
        latestName: 'หัวหน้า',
        latestSelection: {'manage_members', 'manage_stock', 'manage_roles'},
        diff: d,
        catalog: _catalog,
        viewerCan: (_) => true,
      );
      expect(r.name, 'ผู้ช่วย');
      expect(r.selection, {'manage_members', 'manage_roles', 'view_financials'});
      expect(r.skipped, isFalse);
    });

    test('no name change in the draft → the latest name stays', () {
      final d = draftDiff(start, (name: 'ผู้ดูแล', capabilities: ['manage_members']), _catalog);
      final r = reapplyDraft(
        latestName: 'หัวหน้า',
        latestSelection: {'manage_members', 'manage_stock'},
        diff: d,
        catalog: _catalog,
        viewerCan: (_) => true,
      );
      expect(r.name, 'หัวหน้า');
      expect(r.selection, {'manage_members'});
    });

    test('an addition the viewer can no longer grant is skipped and reported', () {
      final d = draftDiff(
        start,
        (name: 'ผู้ดูแล', capabilities: ['manage_members', 'manage_stock', 'view_financials', 'manage_roles']),
        _catalog,
      );
      final r = reapplyDraft(
        latestName: 'ผู้ดูแล',
        latestSelection: {'manage_members', 'manage_stock'},
        diff: d,
        catalog: _catalog,
        viewerCan: (k) => k != 'view_financials',
      );
      expect(r.selection, {'manage_members', 'manage_roles', 'manage_stock'});
      expect(r.skipped, isTrue);
    });

    test('an added manage_X brings its implied view_X like a tick would', () {
      final d = draftDiff(
        start,
        (name: 'ผู้ดูแล', capabilities: ['manage_members', 'manage_stock', 'manage_products']),
        _catalog,
      );
      final r = reapplyDraft(
        latestName: 'ผู้ดูแล',
        latestSelection: {'manage_members'},
        diff: d,
        catalog: _catalog,
        viewerCan: (_) => true,
      );
      expect(r.selection, containsAll(['manage_products', 'view_products']));
    });

    test('a non-selectable / unknown added key is never ticked by reapply', () {
      final d = draftDiff(
        (name: 'a', capabilities: ['manage_members']),
        (name: 'a', capabilities: ['manage_members', 'secret_future_cap']),
        _catalog,
      );
      final r = reapplyDraft(
        latestName: 'a', latestSelection: {'manage_members'}, diff: d, catalog: _catalog, viewerCan: (_) => true,
      );
      expect(r.selection, {'manage_members'});
      expect(r.skipped, isFalse);
    });
  });

}
