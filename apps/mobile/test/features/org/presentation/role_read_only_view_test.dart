// T-003-M08 (CM3-03 · EM3 R4) — R4 ดูบทบาทแบบอ่านอย่างเดียว on mobile: the
// full read view replaces M06's interim (header + reason only). Behaviour
// reference = web W08 (`RoleReadOnlyView.tsx`, `CapabilityReadList.tsx`).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/error/api_failure.dart';
import 'package:mobile/core/session/session_state.dart';
import 'package:mobile/core/ui/checkbox_row.dart';
import 'package:mobile/core/ui/sticky_action_bar.dart';
import 'package:mobile/features/org/application/org_providers.dart';
import 'package:mobile/features/org/domain/entities/org_entities.dart';
import 'package:mobile/features/org/domain/entities/role_entities.dart';
import 'package:mobile/features/org/presentation/screens/role_form_screen.dart';

import '../harness.dart';
import '../org_fakes.dart';

const _viewer = ActiveOrg(
  orgId: 'org_1',
  name: 'ร้านหอมกรุ่นเบเกอรี่',
  capabilities: {'manage_roles', 'manage_members', 'manage_org_settings', 'manage_products'},
);

const _catalog = CapabilityCatalogView(
  groups: [
    CapabilityGroupEntry(key: 'team', labelTh: 'ทีมงาน'),
    CapabilityGroupEntry(key: 'shop', labelTh: 'ร้าน'),
    CapabilityGroupEntry(key: 'catalog_stock', labelTh: 'สินค้าและสต๊อก'),
  ],
  items: [
    CapabilityCatalogEntry(
      key: 'full_access', labelTh: 'ทำได้ทุกอย่าง (เฉพาะเจ้าของร้าน)', selectable: false,
      descriptionTh: 'ทำได้ทุกอย่างในร้านนี้ รวมถึงสิทธิ์ที่จะเพิ่มในอนาคต และตั้งหรือถอดเจ้าของร้าน',
    ),
    CapabilityCatalogEntry(key: 'manage_members', labelTh: 'จัดการสมาชิกและคำเชิญ', selectable: true, group: 'team'),
    CapabilityCatalogEntry(key: 'manage_roles', labelTh: 'จัดการบทบาทและสิทธิ์', selectable: true, group: 'team'),
    CapabilityCatalogEntry(
      key: 'manage_billing', labelTh: 'จัดการแพ็กเกจและการชำระเงิน', selectable: true, group: 'shop',
      status: 'upcoming',
    ),
    CapabilityCatalogEntry(
      key: 'manage_products', labelTh: 'จัดการสินค้า', selectable: true, group: 'catalog_stock',
      implies: ['view_products'],
    ),
    CapabilityCatalogEntry(key: 'view_products', labelTh: 'ดูสินค้า', selectable: true, group: 'catalog_stock'),
  ],
);

const _ok = RoleVerdict(allowed: true);
RoleVerdict _no(String reason) => RoleVerdict(allowed: false, reason: reason);

RoleDetailView _role(
  String id,
  String name, {
  String? key,
  bool customized = true,
  bool isSystem = false,
  bool grantsOwnership = false,
  List<String> caps = const ['manage_members', 'manage_products'],
  int members = 2,
  int invites = 0,
  RoleVerdict canEdit = _ok,
  RoleVerdict canDelete = _ok,
  RoleVerdict canClone = _ok,
}) =>
    RoleDetailView(
      id: id,
      name: name,
      roleKey: key,
      nameCustomized: customized,
      isSystem: isSystem,
      grantsOwnership: grantsOwnership,
      capabilities: caps,
      usage: RoleUsage(activeMembers: members, pendingInvitations: invites),
      lastEdited: null,
      canEdit: canEdit,
      canDelete: canDelete,
      canClone: canClone,
      version: 1,
    );

final _ownerRole = _role('rol_owner', 'Owner',
    key: 'owner', customized: false, isSystem: true, grantsOwnership: true,
    caps: const ['full_access'], members: 1,
    canEdit: _no('role_locked'), canDelete: _no('role_locked'), canClone: _no('owner_role'));

/// Admin-like: equal to me and held by others → read-only, clone allowed.
final _equal = _role('rol_admin', 'Admin',
    key: 'admin', customized: false,
    canEdit: _no('equal_permissions_in_use'), canDelete: _no('equal_permissions_in_use'));

Future<FakeOrgScoped> _openRole(
  WidgetTester tester,
  RoleDetailView role, {
  CapabilityCatalogView? catalog = _catalog,
  bool catalogFails = false,
  String myRoleId = 'rol_staff',
}) async {
  final repo = FakeOrgScoped(
    roleDetails: RoleDetailsPage(items: [role], canCreate: _ok, limit: 30),
    catalog: catalog,
    catalogFailure: catalogFails ? const ServerFailure() : null,
    roleDetailAnswers: [role],
    profile: OrgProfileView(
      id: 'org_1',
      name: 'ร้าน',
      taxProfileComplete: true,
      myRoleId: myRoleId,
      capabilities: _viewer.capabilities,
    ),
  );
  await pumpScreen(
    tester,
    Builder(
      builder: (context) => Scaffold(
        body: Center(
          child: ElevatedButton(onPressed: () => openRoleEditScreen(context, role.id), child: const Text('host')),
        ),
      ),
    ),
    overrides: [orgScopedRepositoryProvider.overrideWithValue(repo)],
    activeOrg: _viewer,
  );
  await tester.tap(find.text('host'));
  await tester.pumpAndSettle();
  return repo;
}

Finder _banner() => find.byKey(const ValueKey('role-reason-banner'));
Finder _inBanner(String text) => find.descendant(of: _banner(), matching: find.text(text));
Finder _clone() => find.byKey(const ValueKey('role-readonly-clone'));
Finder _delete() => find.byKey(const ValueKey('role-delete-button'));
Finder _readRow(String key) => find.byKey(ValueKey('cap-read-$key'));

bool _enabled(WidgetTester tester, Finder f) {
  final w = tester.widget(f);
  return switch (w) {
    ButtonStyleButton(:final onPressed) => onPressed != null,
    _ => throw StateError('not a button: $w'),
  };
}

Future<void> _scrollTo(WidgetTester tester, Finder f) async {
  await tester.scrollUntilVisible(f, 200, scrollable: find.byType(Scrollable).first);
  await tester.pumpAndSettle();
}

void main() {
  group('R4 · the read view (any canEdit refusal)', () {
    testWidgets('no form, no sticky bar; name is TEXT; capabilities are a LIST, not disabled checkboxes',
        (tester) async {
      await _openRole(tester, _equal);

      expect(find.byKey(const ValueKey('role-form-name')), findsNothing);
      expect(find.byType(TextField), findsNothing);
      expect(find.byType(StickyActionBar), findsNothing);
      expect(find.byType(CheckboxRow), findsNothing, reason: 'ux §A: never a disabled checkbox');
      expect(find.byType(Checkbox), findsNothing);

      final nameRow = find.byKey(const ValueKey('role-readonly-name'));
      expect(find.descendant(of: nameRow, matching: find.text('ชื่อบทบาท')), findsOneWidget);
      expect(find.descendant(of: nameRow, matching: find.text('ผู้ดูแล')), findsOneWidget);
      expect(find.text('สิทธิ์ของบทบาทนี้'), findsOneWidget);
    });

    testWidgets('granted = ✓ + label; not granted = "–" + label + the TEXT "ไม่ได้ให้"; upcoming badge; implied',
        (tester) async {
      await _openRole(tester, _equal);

      Finder inRow(String key, Finder f) => find.descendant(of: _readRow(key), matching: f);
      await _scrollTo(tester, _readRow('view_products'));

      expect(inRow('manage_members', find.byIcon(Icons.check)), findsOneWidget);
      expect(inRow('manage_members', find.text('ไม่ได้ให้')), findsNothing);
      expect(inRow('manage_roles', find.text('–')), findsOneWidget);
      expect(inRow('manage_roles', find.text('ไม่ได้ให้')), findsOneWidget,
          reason: 'colour is never the only signal');
      expect(inRow('manage_billing', find.text('เร็ว ๆ นี้')), findsOneWidget);
      expect(inRow('manage_billing', find.text('ไม่ได้ให้')), findsOneWidget);
      // manage_products implies view_products → ✓ + "มาพร้อมสิทธิ์จัดการ".
      expect(inRow('view_products', find.byIcon(Icons.check)), findsOneWidget);
      expect(inRow('view_products', find.text('มาพร้อมสิทธิ์จัดการ')), findsOneWidget);
      expect(_readRow('full_access'), findsNothing, reason: 'not selectable → not a row');
    });

    testWidgets('keys the catalog does not know → one line', (tester) async {
      await _openRole(tester, _role('rol_x', 'แปลก',
          caps: const ['manage_members', 'mystery_a', 'mystery_b'],
          canEdit: _no('exceeds_your_permissions'), canDelete: _no('exceeds_your_permissions'),
          canClone: _no('exceeds_your_permissions')));
      await _scrollTo(tester, find.text('และสิทธิ์อื่นอีก 2 รายการที่แสดงในหน้านี้ไม่ได้'));
      expect(find.text('และสิทธิ์อื่นอีก 2 รายการที่แสดงในหน้านี้ไม่ได้'), findsOneWidget);
    });

    testWidgets('catalog failed → the danger banner with retry instead of the list', (tester) async {
      final repo = await _openRole(tester, _equal, catalogFails: true);
      expect(find.text('โหลดรายการสิทธิ์ไม่สำเร็จ'), findsOneWidget);
      final before = repo.catalogCalls;
      await tester.tap(find.text('ลองใหม่'));
      await tester.pumpAndSettle();
      expect(repo.catalogCalls, before + 1);
    });
  });

  group('R4 · reason banner (§0.3 (ก): ONE banner, the server\'s first reason)', () {
    testWidgets('equal_permissions_in_use → lock banner with the clone button INSIDE; delete hidden',
        (tester) async {
      await _openRole(tester, _equal);

      expect(_inBanner('ดูได้อย่างเดียว — มีคนที่สิทธิ์เท่าคุณใช้บทบาทนี้อยู่'), findsOneWidget);
      expect(find.descendant(of: _banner(), matching: find.byIcon(Icons.lock_outline)), findsOneWidget);
      expect(find.descendant(of: _banner(), matching: _clone()), findsOneWidget);
      expect(_enabled(tester, _clone()), isTrue);
      expect(_delete(), findsNothing, reason: 'same reason as the banner → not repeated');
      expect(find.text('การจัดการอื่น'), findsNothing);
    });

    testWidgets('clone in the banner opens R3 clone of this role', (tester) async {
      await _openRole(tester, _equal);
      await tester.tap(_clone());
      await tester.pumpAndSettle();
      expect(find.text('เริ่มจากสำเนาของ "ผู้ดูแล"'), findsOneWidget);
      expect(find.byKey(const ValueKey('role-form-name')), findsOneWidget);
    });

    testWidgets('in_use_requires_manage_members → its copy + clone in the banner', (tester) async {
      await _openRole(tester, _role('rol_c', 'แพ็คของ',
          canEdit: _no('in_use_requires_manage_members'), canDelete: _no('in_use_requires_manage_members')));
      expect(_inBanner('ดูได้อย่างเดียว — มีสมาชิกคนอื่นใช้บทบาทนี้อยู่'), findsOneWidget);
      expect(find.descendant(of: _banner(), matching: _clone()), findsOneWidget);
    });

    testWidgets('exceeds_your_permissions → its copy; clone and delete both hidden', (tester) async {
      await _openRole(tester, _role('rol_x', 'บัญชีภายนอก',
          canEdit: _no('exceeds_your_permissions'), canDelete: _no('exceeds_your_permissions'),
          canClone: _no('exceeds_your_permissions')));
      expect(_inBanner('ดูได้อย่างเดียว — บทบาทนี้มีสิทธิ์ที่คุณไม่มี'), findsOneWidget);
      expect(_clone(), findsNothing);
      expect(_delete(), findsNothing);
    });

    testWidgets('a reason this build has never heard of → generic copy, never the raw key', (tester) async {
      await _openRole(tester, _role('rol_x', 'อนาคต',
          canEdit: _no('brand_new_reason'), canDelete: _ok, canClone: _no('brand_new_reason')));
      expect(_inBanner('ดูได้อย่างเดียว'), findsOneWidget);
      expect(_inBanner('ตอนนี้คุณทำรายการนี้กับบทบาทนี้ไม่ได้ ถ้าคิดว่าไม่ถูกต้อง ติดต่อเจ้าของร้าน'), findsOneWidget);
      expect(find.textContaining('brand_new_reason'), findsNothing);
      // canDelete allowed (an edit-only refusal) → delete offered; canClone unknown → hidden.
      await _scrollTo(tester, _delete());
      expect(_enabled(tester, _delete()), isTrue);
      expect(_clone(), findsNothing);
    });

    testWidgets('clone role_limit_reached → disabled in the banner + the no-limit sentence', (tester) async {
      await _openRole(tester, _role('rol_c', 'แพ็คของ',
          canEdit: _no('equal_permissions_in_use'), canDelete: _no('equal_permissions_in_use'),
          canClone: _no('role_limit_reached')));
      expect(find.descendant(of: _banner(), matching: _clone()), findsOneWidget);
      expect(_enabled(tester, _clone()), isFalse);
      expect(_inBanner('ร้านนี้มีบทบาทครบจำนวนสูงสุดแล้ว ลบบทบาทที่ไม่ใช้ก่อน จึงจะสร้างใหม่ได้'), findsOneWidget);
    });

    testWidgets('★ CM3-03: the verdict wins — local caps would allow, server says read-only', (tester) async {
      // I hold everything this role grants, yet the server refuses: read-only.
      await _openRole(tester, _role('rol_c', 'แพ็คของ', caps: const ['manage_members'],
          canEdit: _no('equal_permissions_in_use'), canDelete: _no('equal_permissions_in_use')));
      expect(find.byKey(const ValueKey('role-form-name')), findsNothing);
      expect(_banner(), findsOneWidget);
    });
  });

  group('R4 · writes_disabled', () {
    testWidgets('ONE info banner at the very top (no lock banner); clone + delete DISABLED under การจัดการอื่น',
        (tester) async {
      await _openRole(tester, _role('rol_c', 'แพ็คของ', members: 0,
          canEdit: _no('writes_disabled'), canDelete: _no('writes_disabled'), canClone: _no('writes_disabled')));

      expect(find.text('ยังสร้างหรือแก้บทบาทไม่ได้ในตอนนี้'), findsOneWidget);
      expect(find.byIcon(Icons.lock_outline), findsNothing);
      // The banner is the first thing in the list, above the usage line.
      final top = tester.getTopLeft(find.text('ยังสร้างหรือแก้บทบาทไม่ได้ในตอนนี้')).dy;
      expect(top, lessThan(tester.getTopLeft(find.text('ยังไม่มีสมาชิกใช้')).dy));

      await _scrollTo(tester, _delete());
      expect(find.text('การจัดการอื่น'), findsOneWidget);
      expect(_enabled(tester, _clone()), isFalse);
      expect(_enabled(tester, _delete()), isFalse);
      expect(find.text('ลบไม่ได้ตอนนี้ — ยังมีคนใช้บทบาทนี้อยู่'), findsNothing);
    });
  });

  group('R4 · the Owner role (role_locked · grantsOwnership)', () {
    testWidgets('"ล็อก" badge, lock banner, ONE full-access card, no name row, no clone, no delete',
        (tester) async {
      await _openRole(tester, _ownerRole, myRoleId: 'rol_owner');

      expect(find.text('ล็อก'), findsOneWidget);
      expect(_inBanner('บทบาทเจ้าของร้านถูกล็อกไว้'), findsOneWidget);
      final card = find.byKey(const ValueKey('cap-read-full-access'));
      expect(card, findsOneWidget);
      expect(find.descendant(of: card, matching: find.text('ทำได้ทุกอย่าง (เฉพาะเจ้าของร้าน)')), findsOneWidget);
      expect(
        find.descendant(
            of: card,
            matching: find.text('ทำได้ทุกอย่างในร้านนี้ รวมถึงสิทธิ์ที่จะเพิ่มในอนาคต และตั้งหรือถอดเจ้าของร้าน')),
        findsOneWidget,
      );
      expect(find.byKey(const ValueKey('role-readonly-name')), findsNothing);
      expect(find.textContaining('ไม่ได้ให้'), findsNothing, reason: 'a card, not a checklist');
      expect(_clone(), findsNothing);
      expect(_delete(), findsNothing);
      expect(find.text('การจัดการอื่น'), findsNothing);
      expect(find.text('สมาชิก 1 คน (รวมคุณ)'), findsOneWidget);
    });

    testWidgets('★ isSystem hides clone/delete even if a verdict were to allow them', (tester) async {
      await _openRole(tester, _role('rol_owner', 'Owner', key: 'owner', customized: false,
          isSystem: true, grantsOwnership: true, caps: const ['full_access'],
          canEdit: _no('role_locked'), canDelete: _ok, canClone: _ok));
      expect(_clone(), findsNothing);
      expect(_delete(), findsNothing);
    });
  });

  group('responsive (D-038)', () {
    for (final size in const [Size(360, 740), Size(800, 1280)]) {
      testWidgets('R4 renders without overflow at ${size.width.toInt()}×${size.height.toInt()}', (tester) async {
        tester.view.physicalSize = size * 3;
        tester.view.devicePixelRatio = 3.0;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);

        await _openRole(tester, _role('rol_c', 'แพ็คของ', invites: 1,
            canEdit: _no('equal_permissions_in_use'), canDelete: _no('in_use'), canClone: _no('role_limit_reached')));
        expect(tester.takeException(), isNull);
        await _scrollTo(tester, find.byKey(const ValueKey('role-in-use-panel')));
        expect(tester.takeException(), isNull);
      });
    }
  });
}
