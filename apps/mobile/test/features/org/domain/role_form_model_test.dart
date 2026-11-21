// T-003-M06 (CM3-04) — R3's form model, pure Dart. Mirrors the web
// `role-form-model.test.ts` rule for rule; the catalog fixture carries a
// `manage_X → view_X` pair (AC-7.3 has no real pair in F-003 — dm §1).
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/org/domain/entities/role_entities.dart';
import 'package:mobile/features/org/domain/role_form_model.dart';

const _catalog = CapabilityCatalogView(
  groups: [
    CapabilityGroupEntry(key: 'team', labelTh: 'ทีมงาน'),
    CapabilityGroupEntry(key: 'catalog_stock', labelTh: 'สินค้าและสต๊อก'),
  ],
  items: [
    CapabilityCatalogEntry(
      key: 'full_access', labelTh: 'ทำได้ทุกอย่าง', selectable: false, group: null,
    ),
    CapabilityCatalogEntry(
      key: 'manage_members', labelTh: 'จัดการสมาชิกและคำเชิญ', selectable: true, group: 'team',
      descriptionTh: 'เชิญคนเข้าร้าน',
    ),
    CapabilityCatalogEntry(
      key: 'manage_roles', labelTh: 'จัดการบทบาทและสิทธิ์', selectable: true, group: 'team',
    ),
    CapabilityCatalogEntry(
      key: 'manage_products', labelTh: 'จัดการสินค้า', selectable: true, group: 'catalog_stock',
      status: 'upcoming', implies: ['view_products'],
    ),
    CapabilityCatalogEntry(
      key: 'view_products', labelTh: 'ดูสินค้า', selectable: true, group: 'catalog_stock',
    ),
    CapabilityCatalogEntry(
      key: 'brand_new', labelTh: 'ของใหม่', selectable: true, group: 'not_a_group',
      status: 'brand_new_status',
    ),
  ],
);

bool _all(String _) => true;

void main() {
  group('buildChecklist', () {
    test('groups in groups[] order, rows in items[] order, unknown/null group → "other" last, non-selectable hidden',
        () {
      final view = buildChecklist(_catalog, const {}, _all);

      expect(view.groups.map((g) => g.key), ['team', 'catalog_stock', otherGroupKey]);
      expect(view.groups.first.label, 'ทีมงาน');
      expect(view.groups.last.label, isNull); // presentation prints "อื่น ๆ"
      expect(view.groups[1].rows.map((r) => r.key), ['manage_products', 'view_products']);
      expect(view.groups.expand((g) => g.rows).map((r) => r.key), isNot(contains('full_access')));
      expect(view.total, 5);
    });

    test('upcoming badge only for status=upcoming; an unknown status is "available" (no badge)', () {
      final view = buildChecklist(_catalog, const {}, _all);
      final rows = {for (final r in view.groups.expand((g) => g.rows)) r.key: r};

      expect(rows['manage_products']!.upcoming, isTrue);
      expect(rows['brand_new']!.upcoming, isFalse);
      expect(view.hasUpcoming, isTrue);
      expect(rows['manage_members']!.description, 'เชิญคนเข้าร้าน');
    });

    test('imply-lock: a row implied by a ticked key is ticked + locked, and counted', () {
      final view = buildChecklist(_catalog, {'manage_products', 'view_products'}, _all);
      final rows = {for (final r in view.groups.expand((g) => g.rows)) r.key: r};

      expect(rows['view_products']!.checked, isTrue);
      expect(rows['view_products']!.locked, isTrue);
      expect(rows['manage_products']!.locked, isFalse);
      expect(view.selectedCount, 2);
      expect(view.groups[1].selectedCount, 2);
    });

    test('"คุณไม่มีสิทธิ์นี้": disabled only while NOT ticked', () {
      final view = buildChecklist(_catalog, {'manage_roles'}, (k) => k == 'manage_members');
      final rows = {for (final r in view.groups.expand((g) => g.rows)) r.key: r};

      expect(rows['manage_members']!.disabled, isFalse);
      expect(rows['manage_roles']!.disabled, isFalse, reason: 'ticked rows stay untickable');
      expect(rows['manage_products']!.disabled, isTrue);
    });
  });

  group('selection', () {
    test('toggle on manage_X adds view_X; toggle off leaves view_X ticked-but-unlocked', () {
      var s = toggleCapability(const {}, 'manage_products', true, _catalog);
      expect(s, {'manage_products', 'view_products'});

      s = toggleCapability(s, 'manage_products', false, _catalog);
      expect(s, {'view_products'});
      final view = buildChecklist(_catalog, s, _all);
      final row = view.groups[1].rows.firstWhere((r) => r.key == 'view_products');
      expect(row.checked, isTrue);
      expect(row.locked, isFalse);
    });

    test('initialSelection expands implies and passes unknown keys through (never dropped)', () {
      final seeded = initialSelection(['manage_products', 'gone_key'], _catalog);
      expect(seeded.selection, {'manage_products', 'view_products'});
      expect(seeded.passthrough, ['gone_key']);
    });

    test('cloneSelection drops non-selectable keys (full_access) and unknown keys', () {
      expect(cloneSelection(['full_access', 'manage_roles', 'gone_key'], _catalog), {'manage_roles'});
    });

    test('payload = canonical: implied keys dropped, passthrough kept, sorted by key (code unit)', () {
      final payload = payloadCapabilities(
        {'view_products', 'manage_products', 'manage_members'},
        ['gone_key'],
        _catalog,
      );
      expect(payload, ['gone_key', 'manage_members', 'manage_products']);
    });
  });

  group('viewerCanGrant (UX guard only)', () {
    test('full_access answers every key', () {
      expect(viewerCanGrant({'full_access'}, 'manage_roles', _catalog), isTrue);
    });
    test('a held key grants what it implies', () {
      expect(viewerCanGrant({'manage_products'}, 'view_products', _catalog), isTrue);
      expect(viewerCanGrant({'manage_products'}, 'manage_roles', _catalog), isFalse);
    });
  });

  group('name', () {
    test('length counts code points after trim', () {
      expect(roleNameLength('  แพ็ค  '), 'แพ็ค'.runes.length);
      expect(roleNameLength('😀😀'), 2);
    });

    test('client checks: empty / too long; everything else is the server\'s', () {
      expect(validateRoleNameInput('   '), RoleNameProblem.empty);
      expect(validateRoleNameInput('ก' * 51), RoleNameProblem.tooLong);
      expect(validateRoleNameInput('ก' * 50), isNull);
    });

    test('cloneName: "สำเนาของ {name}", ≤ 50, and " (n)" on a case-insensitive clash', () {
      expect(cloneName('พนักงาน', const []), 'สำเนาของ พนักงาน');
      expect(cloneName('Staff', const ['สำเนาของ  staff']), 'สำเนาของ Staff (2)');
      expect(cloneName('Staff', const ['สำเนาของ Staff', 'สำเนาของ Staff (2)']), 'สำเนาของ Staff (3)');

      final long = 'ก' * 60;
      final first = cloneName(long, const []);
      expect(first.runes.length, 50);
      final clashed = cloneName(long, [first]);
      expect(clashed.runes.length, lessThanOrEqualTo(50));
      expect(clashed, endsWith(' (2)'));
    });
  });

  group('buildRoleUpdate', () {
    test('nothing changed → null (send nothing)', () {
      expect(
        buildRoleUpdate(
          version: 3, initialName: 'ผู้ดูแล', name: ' ผู้ดูแล ',
          initialCapabilities: const ['a', 'b'], capabilities: const ['b', 'a'],
        ),
        isNull,
      );
    });

    test('⚠ name only when the trimmed value differs — the shown translation is never sent back', () {
      final caps = buildRoleUpdate(
        version: 3, initialName: 'ผู้ดูแล', name: 'ผู้ดูแล',
        initialCapabilities: const ['a'], capabilities: const ['a', 'b'],
      )!;
      expect(caps.version, 3);
      expect(caps.name, isNull);
      expect(caps.capabilities, ['a', 'b']);

      final renamed = buildRoleUpdate(
        version: 3, initialName: 'ผู้ดูแล', name: '  แอดมิน ',
        initialCapabilities: const ['a'], capabilities: const ['a'],
      )!;
      expect(renamed.name, 'แอดมิน');
      expect(renamed.capabilities, isNull);
    });
  });
}
