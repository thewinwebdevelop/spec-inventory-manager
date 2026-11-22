// T-003-M06 (CM3-03/04/05/06/07 · EM3 R3) — R3 ฟอร์มบทบาท: create / clone /
// edit, the Disclosure checklist, the leave guard, and every write refusal.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/error/api_failure.dart';
import 'package:mobile/core/session/session_controller.dart';
import 'package:mobile/core/session/session_state.dart';
import 'package:mobile/core/ui/disclosure.dart';
import 'package:mobile/features/org/application/org_providers.dart';
import 'package:mobile/features/org/domain/entities/org_entities.dart';
import 'package:mobile/features/org/domain/entities/role_entities.dart';
import 'package:mobile/features/org/presentation/screens/role_form_screen.dart';

import '../harness.dart';
import '../org_fakes.dart';

/// The viewer: no `manage_billing` (→ that row is "คุณไม่มีสิทธิ์นี้"), and
/// `manage_products`, which implies `view_products`.
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
    CapabilityCatalogEntry(key: 'full_access', labelTh: 'ทำได้ทุกอย่าง (เฉพาะเจ้าของร้าน)', selectable: false),
    CapabilityCatalogEntry(
      key: 'manage_members', labelTh: 'จัดการสมาชิกและคำเชิญ', selectable: true, group: 'team',
      descriptionTh: 'เชิญคนเข้าร้าน เปลี่ยนบทบาท และถอดสมาชิกออก',
    ),
    CapabilityCatalogEntry(key: 'manage_roles', labelTh: 'จัดการบทบาทและสิทธิ์', selectable: true, group: 'team'),
    CapabilityCatalogEntry(
      key: 'manage_org_settings', labelTh: 'ตั้งค่าร้านและข้อมูลภาษี', selectable: true, group: 'shop',
    ),
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

RoleDetailView _role(
  String id,
  String name, {
  String? key,
  bool customized = true,
  List<String> caps = const ['manage_products'],
  int members = 0,
  int invites = 0,
  int version = 1,
  RoleVerdict canEdit = _ok,
  RoleVerdict canClone = _ok,
  RoleLastEditedInfo? lastEdited,
}) =>
    RoleDetailView(
      id: id,
      name: name,
      roleKey: key,
      nameCustomized: customized,
      isSystem: key == 'owner',
      grantsOwnership: caps.contains('full_access'),
      capabilities: caps,
      usage: RoleUsage(activeMembers: members, pendingInvitations: invites),
      lastEdited: lastEdited,
      canEdit: canEdit,
      canDelete: _ok,
      canClone: canClone,
      version: version,
    );

final _owner = _role('rol_owner', 'Owner',
    key: 'owner', customized: false, caps: const ['full_access'], members: 1,
    canEdit: const RoleVerdict(allowed: false, reason: 'role_locked'),
    canClone: const RoleVerdict(allowed: false, reason: 'owner_role'));
final _admin = _role('rol_admin', 'Admin',
    key: 'admin', customized: false,
    caps: const ['manage_members', 'manage_org_settings', 'manage_roles'], members: 2, version: 3);
final _staff = _role('rol_staff', 'Staff', key: 'staff', customized: false, caps: const ['manage_products']);
final _external = _role('rol_ext', 'บัญชีภายนอก',
    caps: const ['manage_billing'],
    canEdit: const RoleVerdict(allowed: false, reason: 'exceeds_your_permissions'),
    canClone: const RoleVerdict(allowed: false, reason: 'exceeds_your_permissions'));

RoleDetailsPage _page({RoleVerdict canCreate = _ok, int limit = 30}) =>
    RoleDetailsPage(items: [_owner, _admin, _staff, _external], canCreate: canCreate, limit: limit);

/// Every repo answers the capability re-read (after a save / a 403) with the
/// viewer's own set — otherwise the screen guard would rightly leave.
FakeOrgScoped _repo({
  RoleDetailsPage? roleDetails,
  CapabilityCatalogView? catalog,
  ApiFailure? catalogFailure,
  List<Object>? roleDetailAnswers,
  List<Object>? createRoleAnswers,
  List<Object>? updateRoleAnswers,
  Duration delay = Duration.zero,
  String myRoleId = 'rol_staff',
}) =>
    FakeOrgScoped(
      roleDetails: roleDetails,
      catalog: catalog,
      catalogFailure: catalogFailure,
      roleDetailAnswers: roleDetailAnswers,
      createRoleAnswers: createRoleAnswers,
      updateRoleAnswers: updateRoleAnswers,
      delay: delay,
      profile: OrgProfileView(
        id: 'org_1',
        name: 'ร้านหอมกรุ่นเบเกอรี่',
        taxProfileComplete: true,
        myRoleId: myRoleId,
        capabilities: _viewer.capabilities,
      ),
    );

/// The container of the last [_open] — for a test that changes the session.
late ProviderContainer _container;

/// A host screen with one button that opens R3 — so a pop, a guarded back
/// and "back to R1" all have somewhere real to go.
Future<FakeOrgScoped> _open(
  WidgetTester tester,
  void Function(BuildContext) opener, {
  FakeOrgScoped? scoped,
  ActiveOrg org = _viewer,
}) async {
  final repo = scoped ?? _repo(roleDetails: _page(), catalog: _catalog);
  _container = await pumpScreen(
    tester,
    Builder(
      builder: (context) => Scaffold(
        body: Center(
          child: ElevatedButton(onPressed: () => opener(context), child: const Text('host')),
        ),
      ),
    ),
    overrides: [orgScopedRepositoryProvider.overrideWithValue(repo)],
    activeOrg: org,
  );
  await tester.tap(find.text('host'));
  await tester.pumpAndSettle();
  return repo;
}

Finder _submit(String label) => find.widgetWithText(ElevatedButton, label);
Finder _row(String key) => find.byKey(ValueKey('cap-row-$key'));
Finder _nameField() => find.byKey(const ValueKey('role-form-name'));

bool _enabled(WidgetTester tester, String label) =>
    tester.widget<ElevatedButton>(_submit(label)).onPressed != null;

Future<void> _tapRow(WidgetTester tester, String key) async {
  await tester.ensureVisible(_row(key));
  await tester.pumpAndSettle(); // lay out the scroll before hit-testing
  await tester.tap(_row(key));
  await tester.pump();
}

/// The field may be scrolled away (a checklist error scrolls to the
/// checklist) — bring it back, type, and let the caret settle before the
/// next gesture (a pending "show caret" would otherwise scroll back mid-test).
Future<void> _typeName(WidgetTester tester, String text) async {
  await tester.dragUntilVisible(_nameField(), find.byType(ListView).last, const Offset(0, 300));
  await tester.pumpAndSettle();
  await tester.enterText(_nameField(), text);
  await tester.pumpAndSettle();
}

/// The AppBar ← (Material `BackButton`). `tester.pageBack()` looks the button
/// up by its ENGLISH tooltip, which a Thai-only app never shows.
Future<void> _back(WidgetTester tester) async {
  await tester.tap(find.byType(BackButton));
  await tester.pumpAndSettle();
}

Future<void> _press(WidgetTester tester, String label) async {
  await tester.tap(_submit(label));
  await tester.pumpAndSettle();
}

/// R3a — the confirm sheet and its two buttons.
Finder _sheet() => find.byKey(const ValueKey('role-confirm-sheet'));
Finder _sheetSubmit() => find.byKey(const ValueKey('role-confirm-submit'));
Finder _sheetCancel() => find.byKey(const ValueKey('role-confirm-cancel'));

/// Presses "บันทึก" inside the R3a sheet.
Future<void> _confirm(WidgetTester tester) async {
  expect(_sheet(), findsOneWidget, reason: 'a capability change asks first (R3a)');
  await tester.tap(_sheetSubmit());
  await tester.pumpAndSettle();
}

/// Lets the SnackBar's timer run out so no timer outlives the test.
Future<void> _drainToast(WidgetTester tester) async {
  await tester.pump(const Duration(seconds: 5));
  await tester.pumpAndSettle();
}

void main() {

  group('create from blank', () {
    testWidgets('title, empty name with placeholder, nothing ticked, every group open', (tester) async {
      await _open(tester, (c) => openRoleCreateScreen(c));

      expect(find.text('สร้างบทบาทใหม่'), findsOneWidget);
      expect(find.text('เช่น พนักงานแพ็คของ'), findsOneWidget);
      expect(find.text('ตั้งตามหน้าที่ในร้าน เช่น พนักงานแพ็คของ แอดมินตอบแชท'), findsOneWidget);
      expect(find.text('0/50'), findsOneWidget);
      expect(find.text('สิทธิ์ของบทบาทนี้'), findsOneWidget);
      expect(find.text('เลือกแล้ว 0 จาก 6'), findsOneWidget);
      expect(find.textContaining('สิทธิ์ที่มีป้าย "เร็ว ๆ นี้"'), findsOneWidget);
      // Disclosure groups, all open initially (ux R3 mobile · ui §5).
      expect(find.byType(Disclosure), findsNWidgets(3));
      expect(find.text('ทีมงาน'), findsOneWidget);
      expect(find.text('เลือก 0 จาก 2'), findsNWidgets(3));
      for (final k in ['manage_members', 'manage_roles', 'manage_org_settings', 'manage_billing']) {
        expect(_row(k), findsOneWidget, reason: k);
      }
      // full_access is not selectable → never a row.
      expect(find.text('ทำได้ทุกอย่าง (เฉพาะเจ้าของร้าน)'), findsNothing);
      expect(_submit('สร้างบทบาท'), findsOneWidget);
    });

    testWidgets('client checks: empty name, then no capability — nothing is POSTed', (tester) async {
      final repo = await _open(tester, (c) => openRoleCreateScreen(c));

      await _press(tester, 'สร้างบทบาท');
      expect(find.text('กรอกชื่อบทบาท'), findsOneWidget);

      await _typeName(tester, 'แพ็คของ');
      expect(find.text('7/50'), findsOneWidget);
      await _press(tester, 'สร้างบทบาท');
      expect(find.text('กรอกชื่อบทบาท'), findsNothing);
      expect(find.text('เลือกสิทธิ์อย่างน้อย 1 อย่าง'), findsOneWidget);

      await _typeName(tester, 'ก' * 51);
      await _press(tester, 'สร้างบทบาท');
      expect(find.text('ชื่อบทบาทยาวได้ไม่เกิน 50 ตัวอักษร'), findsOneWidget);
      expect(repo.createdBodies, isEmpty);
    });

    testWidgets('success: POST {trimmed name, canonical caps} → back to the opener + toast', (tester) async {
      final created = _role('rol_new', 'แพ็คของ', caps: const ['manage_products']);
      final repo = await _open(
        tester,
        (c) => openRoleCreateScreen(c),
        scoped: _repo(roleDetails: _page(), catalog: _catalog, createRoleAnswers: [created]),
      );

      await _typeName(tester, '  แพ็คของ  ');
      await _tapRow(tester, 'manage_products'); // ticks view_products too (locked)
      await _tapRow(tester, 'manage_members');
      await _press(tester, 'สร้างบทบาท');

      expect(repo.createdBodies.single.name, 'แพ็คของ');
      expect(repo.createdBodies.single.capabilities, ['manage_members', 'manage_products']);
      expect(find.text('host'), findsOneWidget);
      expect(find.text('สร้างบทบาท "แพ็คของ" แล้ว'), findsOneWidget);
      await _drainToast(tester);
    });
  });

  group('clone', () {
    testWidgets('pre-filled: intro, "สำเนาของ {ชื่อ}", the source capabilities ticked', (tester) async {
      await _open(tester, (c) => openRoleCreateScreen(c, fromRoleId: 'rol_staff'));

      expect(find.text('สร้างบทบาทใหม่'), findsOneWidget);
      expect(find.text('เริ่มจากสำเนาของ "พนักงาน"'), findsOneWidget);
      expect(tester.widget<TextField>(_nameField()).controller!.text, 'สำเนาของ พนักงาน');
      expect(find.text('เลือกแล้ว 2 จาก 6'), findsOneWidget); // manage_products + implied view_products
      expect(find.text('มาพร้อมสิทธิ์จัดการ'), findsOneWidget);
    });

    testWidgets('a source the server will not let me clone → blank + notice', (tester) async {
      await _open(tester, (c) => openRoleCreateScreen(c, fromRoleId: 'rol_ext'));

      expect(find.text('ใช้บทบาทนี้เป็นต้นแบบไม่ได้แล้ว เริ่มจากว่างแทน'), findsOneWidget);
      expect(find.textContaining('เริ่มจากสำเนาของ'), findsNothing);
      expect(tester.widget<TextField>(_nameField()).controller!.text, '');
    });

    testWidgets('a source that is gone → blank + notice', (tester) async {
      await _open(tester, (c) => openRoleCreateScreen(c, fromRoleId: 'rol_deleted'));
      expect(find.text('ใช้บทบาทนี้เป็นต้นแบบไม่ได้แล้ว เริ่มจากว่างแทน'), findsOneWidget);
    });
  });

  group('create verdicts (server decides)', () {
    testWidgets('writes_disabled → one banner at the top, submit disabled', (tester) async {
      await _open(
        tester,
        (c) => openRoleCreateScreen(c),
        scoped: _repo(
          roleDetails: _page(canCreate: const RoleVerdict(allowed: false, reason: 'writes_disabled')),
          catalog: _catalog,
        ),
      );

      expect(find.text('ยังสร้างหรือแก้บทบาทไม่ได้ในตอนนี้'), findsOneWidget);
      expect(_enabled(tester, 'สร้างบทบาท'), isFalse);
    });

    testWidgets('role_limit_reached → the limit sentence, submit disabled', (tester) async {
      await _open(
        tester,
        (c) => openRoleCreateScreen(c),
        scoped: _repo(
          roleDetails: _page(canCreate: const RoleVerdict(allowed: false, reason: 'role_limit_reached')),
          catalog: _catalog,
        ),
      );

      expect(find.text('ร้านนี้มีบทบาทครบ 30 บทบาทแล้ว ลบบทบาทที่ไม่ใช้ก่อน จึงจะสร้างใหม่ได้'), findsOneWidget);
      expect(_enabled(tester, 'สร้างบทบาท'), isFalse);
    });
  });

  group('checklist (CM3-04)', () {
    testWidgets('imply-lock: ticking manage_X locks view_X; unticking manage_X leaves it ticked + unlocked',
        (tester) async {
      await _open(tester, (c) => openRoleCreateScreen(c));

      await _tapRow(tester, 'manage_products');
      expect(find.text('มาพร้อมสิทธิ์จัดการ'), findsOneWidget);
      expect(find.text('เลือกแล้ว 2 จาก 6'), findsOneWidget);

      await _tapRow(tester, 'view_products'); // locked → no change
      expect(find.text('เลือกแล้ว 2 จาก 6'), findsOneWidget);

      await _tapRow(tester, 'manage_products');
      expect(find.text('มาพร้อมสิทธิ์จัดการ'), findsNothing);
      expect(find.text('เลือกแล้ว 1 จาก 6'), findsOneWidget);
    });

    testWidgets('a capability I do not hold: disabled + reason, a tap does nothing; upcoming badge',
        (tester) async {
      await _open(tester, (c) => openRoleCreateScreen(c));

      expect(
        find.descendant(of: _row('manage_billing'), matching: find.text('คุณไม่มีสิทธิ์นี้ จึงให้บทบาทอื่นไม่ได้')),
        findsOneWidget,
      );
      expect(find.descendant(of: _row('manage_billing'), matching: find.text('เร็ว ๆ นี้')), findsOneWidget);
      await _tapRow(tester, 'manage_billing');
      expect(find.text('เลือกแล้ว 0 จาก 6'), findsOneWidget);
    });

    testWidgets('a group folds and its header still says how many are ticked', (tester) async {
      await _open(tester, (c) => openRoleCreateScreen(c));
      await _tapRow(tester, 'manage_members');

      final header = find.byKey(const ValueKey('cap-group-team'));
      expect(find.descendant(of: header, matching: find.text('เลือก 1 จาก 2')), findsOneWidget);
      await tester.ensureVisible(header);
      await tester.pumpAndSettle();
      await tester.tap(find.descendant(of: header, matching: find.text('ทีมงาน')));
      await tester.pumpAndSettle();

      expect(_row('manage_members'), findsNothing);
      expect(find.descendant(of: header, matching: find.text('เลือก 1 จาก 2')), findsOneWidget);
      expect(_row('manage_org_settings'), findsOneWidget, reason: 'other groups stay open');
    });

    testWidgets('a row\'s box lines up with its group\'s chevron (no double indent)', (tester) async {
      await _open(tester, (c) => openRoleCreateScreen(c));

      final chevron = tester.getTopLeft(find.descendant(
        of: find.byKey(const ValueKey('cap-group-team')),
        matching: find.byIcon(Icons.expand_more),
      ));
      final box = tester.getTopLeft(find.descendant(
        of: _row('manage_members'),
        matching: find.byKey(const Key('checkbox_row.box')),
      ));
      // CheckboxRow's 2.5px focus-ring border is the only difference.
      expect((box.dx - chevron.dx).abs(), lessThanOrEqualTo(3));
    });

    testWidgets('CM3-07: checklist rows, group headers and the submit bar are ≥ 44 tall', (tester) async {
      await _open(tester, (c) => openRoleCreateScreen(c));

      expect(tester.getSize(_row('manage_members')).height, greaterThanOrEqualTo(44));
      expect(tester.getSize(find.byKey(const ValueKey('cap-group-team'))).height, greaterThanOrEqualTo(44));
      expect(tester.getSize(_submit('สร้างบทบาท')).height, greaterThanOrEqualTo(44));
    });
  });

  group('edit', () {
    FakeOrgScoped editRepo({List<Object>? detail, List<Object>? update, CapabilityCatalogView? catalog, ApiFailure? catalogFailure}) =>
        _repo(
          roleDetails: _page(),
          catalog: catalog ?? _catalog,
          catalogFailure: catalogFailure,
          roleDetailAnswers: detail ?? [_admin],
          updateRoleAnswers: update,
        );

    testWidgets('loading → skeleton; then heading, usage, last edited, the translated name', (tester) async {
      final repo = _repo(
        roleDetails: _page(),
        catalog: _catalog,
        roleDetailAnswers: [_admin],
        delay: const Duration(milliseconds: 50),
      );
      await pumpScreen(
        tester,
        Builder(builder: (c) => ElevatedButton(onPressed: () => openRoleEditScreen(c, 'rol_admin'), child: const Text('host'))),
        overrides: [orgScopedRepositoryProvider.overrideWithValue(repo)],
        activeOrg: _viewer,
      );
      await tester.tap(find.text('host'));
      await tester.pump();
      await tester.pump();
      expect(find.byKey(const ValueKey('role-form-skeleton')), findsOneWidget);

      await tester.pump(const Duration(milliseconds: 100));
      await tester.pumpAndSettle();
      expect(repo.roleDetailIdsSeen, ['rol_admin']);
      expect(find.text('ผู้ดูแล'), findsWidgets); // heading + the field
      expect(find.text('สมาชิก 2 คน'), findsOneWidget);
      expect(find.text('ค่าเริ่มต้นของระบบ'), findsOneWidget);
      expect(find.text('เปลี่ยนชื่อได้ ชื่อใหม่จะแสดงแทนชื่อเดิมทุกหน้าจอ'), findsOneWidget);
      expect(_enabled(tester, 'บันทึก'), isFalse, reason: 'nothing changed yet');
    });

    testWidgets('★ capabilities only → PATCH {version, capabilities} WITHOUT name; stays + toast + clean again',
        (tester) async {
      final saved = _role('rol_admin', 'Admin',
          key: 'admin', customized: false, members: 2, version: 4,
          caps: const ['manage_members', 'manage_org_settings', 'manage_products', 'manage_roles']);
      final repo = await _open(tester, (c) => openRoleEditScreen(c, 'rol_admin'),
          scoped: editRepo(update: [saved]));

      await _tapRow(tester, 'manage_products');
      expect(_enabled(tester, 'บันทึก'), isTrue);
      await _press(tester, 'บันทึก');
      await _confirm(tester);

      final body = repo.updates.single.body;
      expect(repo.updates.single.roleId, 'rol_admin');
      expect(body.version, 3);
      expect(body.name, isNull, reason: 'the shown translation must never be sent back');
      expect(body.capabilities, ['manage_members', 'manage_org_settings', 'manage_products', 'manage_roles']);
      expect(find.text('บันทึกบทบาท "ผู้ดูแล" แล้ว'), findsOneWidget);
      expect(find.text('host'), findsNothing, reason: 'edit stays on the form');
      expect(_enabled(tester, 'บันทึก'), isFalse, reason: 'the saved version is the new baseline');
      await _drainToast(tester);
    });

    testWidgets('rename only → PATCH {version, name}', (tester) async {
      final saved = _role('rol_admin', 'แอดมินร้าน', members: 2, version: 4,
          caps: const ['manage_members', 'manage_org_settings', 'manage_roles']);
      final repo = await _open(tester, (c) => openRoleEditScreen(c, 'rol_admin'),
          scoped: editRepo(update: [saved]));

      await _typeName(tester, 'แอดมินร้าน ');
      await _press(tester, 'บันทึก');

      expect(_sheet(), findsNothing, reason: 'a rename alone is sent straight away (R3a)');
      expect(repo.updates.single.body.name, 'แอดมินร้าน');
      expect(repo.updates.single.body.capabilities, isNull);
      await _drainToast(tester);
    });

    testWidgets('★ CM3-05: 409 ROLE_CHANGED → re-read, banner, form = latest; PATCH sent ONCE', (tester) async {
      final v4 = _role('rol_admin', 'ผู้ช่วยเจ้าของร้าน', members: 2, version: 4,
          caps: const ['manage_members', 'manage_roles']);
      final repo = await _open(tester, (c) => openRoleEditScreen(c, 'rol_admin'),
          scoped: editRepo(
            detail: [_admin, v4],
            update: [const ConflictFailure(code: 'ROLE_CHANGED', details: {'currentVersion': 4})],
          ));

      await _tapRow(tester, 'manage_products');
      await _press(tester, 'บันทึก');
      await _confirm(tester);

      expect(repo.updates, hasLength(1));
      expect(repo.roleDetailIdsSeen, ['rol_admin', 'rol_admin']);
      expect(find.text('มีคนแก้บทบาทนี้ไปก่อนคุณ'), findsOneWidget);
      expect(find.text('หน้านี้แสดงฉบับล่าสุดแล้ว สิ่งที่คุณแก้ไว้ยังไม่ถูกบันทึก:'), findsOneWidget);
      expect(tester.widget<TextField>(_nameField()).controller!.text, 'ผู้ช่วยเจ้าของร้าน');
      expect(find.text('เลือกแล้ว 2 จาก 6'), findsOneWidget);

      // Saving again is a NEW press, built on the version just read.
      await tester.pump(const Duration(seconds: 1));
      expect(repo.updates, hasLength(1), reason: 'never resubmitted on its own');
      await _tapRow(tester, 'manage_org_settings');
      await _press(tester, 'บันทึก');
      await _confirm(tester);
      expect(repo.updates, hasLength(2));
      expect(repo.updates.last.body.version, 4);
    });

    testWidgets('a role the server says I cannot edit → read-only reason, no form', (tester) async {
      await _open(tester, (c) => openRoleEditScreen(c, 'rol_ext'),
          scoped: editRepo(detail: [_external]));

      expect(find.text('ดูได้อย่างเดียว — บทบาทนี้มีสิทธิ์ที่คุณไม่มี'), findsOneWidget);
      expect(_nameField(), findsNothing);
      expect(_submit('บันทึก'), findsNothing);
    });

    testWidgets('★ CM3-03: verdict wins over local caps — canEdit=true even though I lack its capability',
        (tester) async {
      final odd = _role('rol_odd', 'แปลก', caps: const ['manage_billing']);
      await _open(tester, (c) => openRoleEditScreen(c, 'rol_odd'), scoped: editRepo(detail: [odd]));

      expect(_nameField(), findsOneWidget);
      // Ticked rows stay untickable, and the row is NOT marked "no permission".
      expect(
        find.descendant(of: _row('manage_billing'), matching: find.text('คุณไม่มีสิทธิ์นี้ จึงให้บทบาทอื่นไม่ได้')),
        findsNothing,
      );
    });

    testWidgets('writes_disabled on the role → the top banner, no form', (tester) async {
      final off = _role('rol_admin', 'Admin', key: 'admin', customized: false,
          canEdit: const RoleVerdict(allowed: false, reason: 'writes_disabled'));
      await _open(tester, (c) => openRoleEditScreen(c, 'rol_admin'), scoped: editRepo(detail: [off]));

      expect(find.text('ยังสร้างหรือแก้บทบาทไม่ได้ในตอนนี้'), findsOneWidget);
      expect(_submit('บันทึก'), findsNothing);
    });

    testWidgets('404 → "ไม่พบบทบาทนี้" + back to the list', (tester) async {
      await _open(tester, (c) => openRoleEditScreen(c, 'rol_gone'),
          scoped: editRepo(detail: [const NotFoundFailure()]));

      expect(find.text('ไม่พบบทบาทนี้'), findsOneWidget);
      expect(find.text('บทบาทนี้อาจถูกลบไปแล้ว'), findsOneWidget);
      await tester.tap(find.text('กลับไปหน้ารายการบทบาท'));
      await tester.pumpAndSettle();
      expect(find.text('host'), findsOneWidget);
    });

    testWidgets('load error → message + retry, which reads again', (tester) async {
      final repo = await _open(tester, (c) => openRoleEditScreen(c, 'rol_admin'),
          scoped: editRepo(detail: [const ServerFailure(), _admin]));

      expect(find.text('เปิดบทบาทนี้ไม่สำเร็จ'), findsOneWidget);
      await tester.tap(find.text('ลองใหม่'));
      await tester.pumpAndSettle();
      expect(repo.roleDetailIdsSeen, hasLength(2));
      expect(_nameField(), findsOneWidget);
    });

    testWidgets('catalog failed alone → danger banner in place of the checklist, submit disabled', (tester) async {
      await _open(tester, (c) => openRoleEditScreen(c, 'rol_admin'),
          scoped: editRepo(catalogFailure: const ServerFailure()));

      expect(find.text('โหลดรายการสิทธิ์ไม่สำเร็จ'), findsOneWidget);
      expect(_nameField(), findsOneWidget);
      await _typeName(tester, 'ชื่อใหม่');
      expect(_enabled(tester, 'บันทึก'), isFalse);
    });

    testWidgets('keys the catalog does not know: one line, and they go back in the PATCH', (tester) async {
      final withUnknown = _role('rol_admin', 'Admin', key: 'admin', customized: false, version: 3,
          caps: const ['manage_members', 'secret_future_cap']);
      final repo = await _open(tester, (c) => openRoleEditScreen(c, 'rol_admin'),
          scoped: editRepo(detail: [withUnknown], update: [withUnknown]));

      expect(find.text('และสิทธิ์อื่นอีก 1 รายการที่แสดงในหน้านี้ไม่ได้'), findsOneWidget);
      await _tapRow(tester, 'manage_roles');
      await _press(tester, 'บันทึก');
      await _confirm(tester);
      expect(repo.updates.single.body.capabilities, ['manage_members', 'manage_roles', 'secret_future_cap']);
      await _drainToast(tester);
    });
  });

  group('write refusals (CM3-06)', () {
    Future<FakeOrgScoped> createAndFail(WidgetTester tester, ApiFailure failure,
        {List<Object> detail = const []}) async {
      final repo = await _open(
        tester,
        (c) => openRoleCreateScreen(c),
        scoped: _repo(roleDetails: _page(), catalog: _catalog, createRoleAnswers: [failure]),
      );
      await _typeName(tester, 'แพ็คของ');
      await _tapRow(tester, 'manage_members');
      await _press(tester, 'สร้างบทบาท');
      return repo;
    }

    testWidgets('ROLE_NAME_TAKEN → under the name field', (tester) async {
      await createAndFail(tester, const ConflictFailure(code: 'ROLE_NAME_TAKEN'));
      expect(
        find.text('ชื่อนี้ใช้ไม่ได้ เพราะซ้ำกับบทบาทที่มีอยู่แล้ว (รวมชื่อ เจ้าของร้าน ผู้ดูแล พนักงาน) ลองตั้งชื่ออื่น'),
        findsOneWidget,
      );
    });

    testWidgets('VALIDATION_FAILED fieldErrors.name → the invisible-characters sentence', (tester) async {
      await createAndFail(tester, const ValidationFailure(code: 'VALIDATION_FAILED', fieldErrors: {'name': 'x'}));
      expect(find.textContaining('ชื่อนี้มีอักขระที่ใช้ไม่ได้'), findsOneWidget);
    });

    testWidgets('UNKNOWN_CAPABILITY → banner, catalog re-read, the named keys unticked', (tester) async {
      final repo = await createAndFail(
        tester,
        const ValidationFailure(code: 'UNKNOWN_CAPABILITY', details: {'capabilities': ['manage_members']}),
      );
      expect(find.text('สิทธิ์บางรายการใช้ไม่ได้แล้ว ระบบโหลดรายการสิทธิ์ล่าสุดให้แล้ว ตรวจดูแล้วบันทึกอีกครั้ง'),
          findsOneWidget);
      expect(repo.catalogCalls, 2);
      expect(find.text('เลือกแล้ว 0 จาก 6'), findsOneWidget);
    });

    testWidgets('a banner error scrolls the form back to the top so the banner is ON SCREEN', (tester) async {
      await _open(
        tester,
        (c) => openRoleCreateScreen(c),
        scoped: _repo(roleDetails: _page(), catalog: _catalog, createRoleAnswers: [const BusyFailure()]),
      );
      await _typeName(tester, 'แพ็คของ');
      await _tapRow(tester, 'view_products'); // the last row → scrolled down
      final scrollable = tester.state<ScrollableState>(find.byType(Scrollable).last);
      expect(scrollable.position.pixels, greaterThan(0), reason: 'control: we did scroll down');

      await _press(tester, 'สร้างบทบาท');

      expect(scrollable.position.pixels, 0);
      final banner = tester.getRect(find.text('ร้านนี้กำลังมีการแก้ไขอื่นอยู่ ลองใหม่อีกครั้งในไม่กี่วินาที'));
      expect(banner.top, greaterThanOrEqualTo(0));
      expect(banner.bottom, lessThan(tester.view.physicalSize.height / tester.view.devicePixelRatio));
    });

    testWidgets('RATE_LIMITED → countdown copy, submit disabled until it runs out', (tester) async {
      await createAndFail(tester, const ThrottledFailure(retryAfterSeconds: 125));
      expect(find.text('แก้บทบาทถี่เกินไป กรุณารอ 02:05 แล้วลองใหม่'), findsOneWidget);
      expect(_enabled(tester, 'สร้างบทบาท'), isFalse);

      await tester.pump(const Duration(seconds: 1));
      expect(find.text('แก้บทบาทถี่เกินไป กรุณารอ 02:04 แล้วลองใหม่'), findsOneWidget);
      await tester.pump(const Duration(seconds: 125));
      expect(find.textContaining('แก้บทบาทถี่เกินไป'), findsNothing);
      expect(_enabled(tester, 'สร้างบทบาท'), isTrue);
    });

    testWidgets('busy / unknown → their banners', (tester) async {
      await createAndFail(tester, const BusyFailure());
      expect(find.text('ร้านนี้กำลังมีการแก้ไขอื่นอยู่ ลองใหม่อีกครั้งในไม่กี่วินาที'), findsOneWidget);
    });

    testWidgets('generic failure copy for an unmapped code', (tester) async {
      await createAndFail(tester, const ConflictFailure(code: 'SOMETHING_NEW'));
      expect(find.text('บันทึกบทบาทไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'), findsOneWidget);
    });

    testWidgets('★ 403 FORBIDDEN → leaves the form for the ForbiddenPanel', (tester) async {
      await createAndFail(tester, const ForbiddenFailure(code: 'FORBIDDEN'));
      expect(find.text('หน้านี้สำหรับคนที่จัดการบทบาทได้'), findsOneWidget);
      expect(_nameField(), findsNothing);
    });

    testWidgets('★ TARGET_NOT_BELOW_ACTOR on edit → STAYS, re-reads, and shows the read-only reason',
        (tester) async {
      final nowReadOnly = _role('rol_admin', 'Admin', key: 'admin', customized: false, version: 3,
          canEdit: const RoleVerdict(allowed: false, reason: 'equal_permissions_in_use'));
      final repo = await _open(
        tester,
        (c) => openRoleEditScreen(c, 'rol_admin'),
        scoped: _repo(
          roleDetails: _page(),
          catalog: _catalog,
          roleDetailAnswers: [_admin, nowReadOnly],
          updateRoleAnswers: [const ForbiddenFailure(code: 'TARGET_NOT_BELOW_ACTOR')],
        ),
      );
      await _tapRow(tester, 'manage_products');
      await _press(tester, 'บันทึก');
      await _confirm(tester);

      expect(repo.roleDetailIdsSeen, hasLength(2));
      expect(find.text('ดูได้อย่างเดียว — มีคนที่สิทธิ์เท่าคุณใช้บทบาทนี้อยู่'), findsOneWidget);
      expect(find.text('หน้านี้สำหรับคนที่จัดการบทบาทได้'), findsNothing);
      expect(repo.updates, hasLength(1));
    });
  });

  group('R3a confirm before saving (M07 · AC-3.10/3.11)', () {
    FakeOrgScoped editRepo({
      List<Object>? detail,
      List<Object>? update,
      String myRoleId = 'rol_staff',
    }) =>
        _repo(
          roleDetails: _page(),
          catalog: _catalog,
          roleDetailAnswers: detail ?? [_admin],
          updateRoleAnswers: update ?? [_admin],
          myRoleId: myRoleId,
        );

    Finder inSheet(String text) => find.descendant(of: _sheet(), matching: find.text(text));

    testWidgets('a capability change asks first: title, added (expanded), impact from usage — nothing sent yet',
        (tester) async {
      final repo = await _open(tester, (c) => openRoleEditScreen(c, 'rol_admin'), scoped: editRepo());

      await _tapRow(tester, 'manage_products'); // brings view_products with it
      await _press(tester, 'บันทึก');

      expect(_sheet(), findsOneWidget);
      expect(inSheet('บันทึกการเปลี่ยนสิทธิ์ของ "ผู้ดูแล"?'), findsOneWidget);
      expect(inSheet('เพิ่ม'), findsOneWidget);
      expect(inSheet('จัดการสินค้า'), findsOneWidget);
      expect(inSheet('ดูสินค้า'), findsOneWidget);
      expect(inSheet('เอาออก'), findsNothing, reason: 'an empty section is not shown');
      expect(inSheet('มีผลกับสมาชิก 2 คนทันที ไม่ต้องออกจากระบบ'), findsOneWidget);
      expect(inSheet('คุณจะเสียสิทธิ์เหล่านี้ทันที'), findsNothing, reason: 'not my role');
      expect(find.descendant(of: _sheetSubmit(), matching: find.text('บันทึก')), findsOneWidget);
      expect(repo.updates, isEmpty, reason: 'nothing is sent before "บันทึก" in the sheet');
    });

    testWidgets('"แก้ต่อ" sends nothing and keeps the edits', (tester) async {
      final repo = await _open(tester, (c) => openRoleEditScreen(c, 'rol_admin'), scoped: editRepo());
      await _tapRow(tester, 'manage_products');
      await _press(tester, 'บันทึก');

      await tester.tap(_sheetCancel());
      await tester.pumpAndSettle();

      expect(_sheet(), findsNothing);
      expect(repo.updates, isEmpty);
      expect(find.text('เลือกแล้ว 5 จาก 6'), findsOneWidget);
      expect(_enabled(tester, 'บันทึก'), isTrue);
    });

    testWidgets('confirm → exactly ONE PATCH, even pressed twice; in flight the sheet cannot be dismissed',
        (tester) async {
      final repo = await _open(tester, (c) => openRoleEditScreen(c, 'rol_admin'), scoped: editRepo());
      repo.writeGate = Completer<void>();
      await _tapRow(tester, 'manage_products');
      await _press(tester, 'บันทึก');

      await tester.tap(_sheetSubmit());
      await tester.pump();
      expect(inSheet('กำลังบันทึก...'), findsOneWidget);
      await tester.tap(_sheetSubmit(), warnIfMissed: false);
      await tester.tapAt(const Offset(10, 10)); // the barrier
      await tester.pump();
      expect(_sheet(), findsOneWidget, reason: 'not dismissible while the PATCH is in flight');
      expect(tester.widget<OutlinedButton>(_sheetCancel()).onPressed, isNull);

      repo.writeGate!.complete();
      await tester.pumpAndSettle();
      expect(_sheet(), findsNothing);
      expect(repo.updates, hasLength(1));
      expect(find.text('บันทึกบทบาท "ผู้ดูแล" แล้ว'), findsOneWidget);
      await _drainToast(tester);
    });

    testWidgets('no members yet + open invitations → the two other impact lines; a removal is listed',
        (tester) async {
      final quiet = _role('rol_q', 'แพ็คของ', members: 0, invites: 1, caps: const ['manage_members', 'manage_roles']);
      await _open(tester, (c) => openRoleEditScreen(c, 'rol_q'), scoped: editRepo(detail: [quiet]));
      await _tapRow(tester, 'manage_members');
      await _press(tester, 'บันทึก');

      expect(inSheet('ยังไม่มีสมาชิกใช้บทบาทนี้'), findsOneWidget);
      expect(inSheet('คำเชิญที่ยังไม่ปิด 1 ใบ จะได้สิทธิ์ชุดใหม่เมื่อกดรับ'), findsOneWidget);
      expect(inSheet('เอาออก'), findsOneWidget);
      expect(inSheet('จัดการสมาชิกและคำเชิญ'), findsOneWidget);
      expect(inSheet('เพิ่ม'), findsNothing);
    });

    testWidgets('★ MY role, losing manage_roles → destructive confirm, focus on "แก้ต่อ"; then ข้อมูลร้าน + toast',
        (tester) async {
      final saved = _role('rol_admin', 'Admin', key: 'admin', customized: false, members: 2, version: 4,
          caps: const ['manage_members', 'manage_org_settings']);
      final repo = await _open(tester, (c) => openRoleEditScreen(c, 'rol_admin'),
          scoped: editRepo(update: [saved], myRoleId: 'rol_admin'));

      await _tapRow(tester, 'manage_roles');
      await _press(tester, 'บันทึก');

      expect(inSheet('คุณจะเสียสิทธิ์เหล่านี้ทันที'), findsOneWidget);
      expect(inSheet('บันทึกแล้วคุณจะกลับมาแก้เองไม่ได้ ต้องให้เจ้าของร้านแก้คืน'), findsOneWidget);
      expect(inSheet('ถ้าต้องการคืน ให้เจ้าของร้านแก้ให้'), findsNothing);
      // Listed twice: under "เอาออก" and in the warning.
      expect(inSheet('จัดการบทบาทและสิทธิ์'), findsNWidgets(2));
      expect(find.descendant(of: _sheetSubmit(), matching: find.text('บันทึก และยอมเสียสิทธิ์')), findsOneWidget);
      expect(FocusManager.instance.primaryFocus?.debugLabel, 'role-confirm-cancel',
          reason: 'ux R3a focusCancel with the self-loss warning');
      expect(repo.updates, isEmpty);

      await _confirm(tester);
      expect(repo.updates, hasLength(1));
      expect(find.text('บันทึกแล้ว — ตอนนี้คุณไม่มีสิทธิ์จัดการบทบาทแล้ว'), findsOneWidget);
      expect(find.text('host'), findsOneWidget, reason: 'back to the shop root (ข้อมูลร้าน)');
      expect(_nameField(), findsNothing);
      await _drainToast(tester);
    });

    testWidgets('MY role, losing something else → the other note; stays, toast, and the role is read again',
        (tester) async {
      final saved = _role('rol_admin', 'Admin', key: 'admin', customized: false, members: 2, version: 4,
          caps: const ['manage_org_settings', 'manage_roles']);
      final repo = await _open(tester, (c) => openRoleEditScreen(c, 'rol_admin'),
          scoped: editRepo(detail: [_admin, saved], update: [saved], myRoleId: 'rol_admin'));

      await _tapRow(tester, 'manage_members');
      await _press(tester, 'บันทึก');
      expect(inSheet('ถ้าต้องการคืน ให้เจ้าของร้านแก้ให้'), findsOneWidget);
      expect(find.descendant(of: _sheetSubmit(), matching: find.text('บันทึก และยอมเสียสิทธิ์')), findsOneWidget);

      await _confirm(tester);
      expect(repo.updates, hasLength(1));
      expect(find.text('บันทึกบทบาท "ผู้ดูแล" แล้ว'), findsOneWidget);
      expect(_nameField(), findsOneWidget, reason: 'stays on the form');
      expect(repo.roleDetailIdsSeen, hasLength(2),
          reason: 'my own role: the PATCH answer carries PRE-edit verdicts — read it again');
      await _drainToast(tester);
    });

    testWidgets('MY role, gains only → the plain confirm (no warning, primary button)', (tester) async {
      await _open(tester, (c) => openRoleEditScreen(c, 'rol_admin'), scoped: editRepo(myRoleId: 'rol_admin'));
      await _tapRow(tester, 'manage_products');
      await _press(tester, 'บันทึก');
      expect(inSheet('คุณจะเสียสิทธิ์เหล่านี้ทันที'), findsNothing);
      expect(find.descendant(of: _sheetSubmit(), matching: find.text('บันทึก')), findsOneWidget);
    });

    testWidgets('an error closes the sheet and shows on the form (§E)', (tester) async {
      final repo = await _open(tester, (c) => openRoleEditScreen(c, 'rol_admin'),
          scoped: editRepo(update: [const ServerFailure()]));
      await _tapRow(tester, 'manage_products');
      await _press(tester, 'บันทึก');
      await _confirm(tester);

      expect(_sheet(), findsNothing);
      expect(find.text('บันทึกบทบาทไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'), findsOneWidget);
      expect(repo.updates, hasLength(1));
    });
  });

  group('R3b 409 ROLE_CHANGED — my edits, re-apply never sends (M07 · AC-3.12 · SR-14)', () {
    final v4 = _role('rol_admin', 'ผู้ช่วยเจ้าของร้าน', members: 2, version: 4,
        caps: const ['manage_members', 'manage_roles']);
    const conflict = ConflictFailure(code: 'ROLE_CHANGED', details: {'currentVersion': 4});

    Future<FakeOrgScoped> conflictOnce(WidgetTester tester, {List<Object>? detail}) async {
      final repo = await _open(
        tester,
        (c) => openRoleEditScreen(c, 'rol_admin'),
        scoped: _repo(
          roleDetails: _page(),
          catalog: _catalog,
          roleDetailAnswers: detail ?? [_admin, v4],
          updateRoleAnswers: [conflict, v4],
        ),
      );
      await _typeName(tester, 'ผู้จัดการ');
      await _tapRow(tester, 'manage_products');
      await _press(tester, 'บันทึก');
      await _confirm(tester);
      return repo;
    }

    Finder banner() => find.byKey(const ValueKey('role-conflict-banner'));
    Finder inBanner(String text) => find.descendant(of: banner(), matching: find.text(text));

    testWidgets('the banner lists MY edits against the version I started from; form = latest', (tester) async {
      final repo = await conflictOnce(tester);

      expect(repo.updates, hasLength(1));
      expect(inBanner('มีคนแก้บทบาทนี้ไปก่อนคุณ'), findsOneWidget);
      expect(inBanner('ชื่อ: "ผู้ดูแล" → "ผู้จัดการ"'), findsOneWidget);
      expect(inBanner('เพิ่ม: จัดการสินค้า, ดูสินค้า'), findsOneWidget);
      expect(inBanner('ใส่การแก้ของฉันกลับเข้าไป'), findsOneWidget);
      expect(inBanner('ปิด'), findsOneWidget);
      expect(tester.widget<TextField>(_nameField()).controller!.text, 'ผู้ช่วยเจ้าของร้าน');
      expect(find.text('เลือกแล้ว 2 จาก 6'), findsOneWidget);
    });

    testWidgets('★ re-apply fills the LATEST version and sends nothing; saving again goes through R3a on v4',
        (tester) async {
      final repo = await conflictOnce(tester);

      await tester.tap(inBanner('ใส่การแก้ของฉันกลับเข้าไป'));
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 1));

      expect(repo.updates, hasLength(1), reason: 'SR-14: re-apply never sends');
      expect(tester.widget<TextField>(_nameField()).controller!.text, 'ผู้จัดการ');
      expect(find.text('เลือกแล้ว 4 จาก 6'), findsOneWidget);
      expect(inBanner('ใส่การแก้ของฉันกลับเข้าไป'), findsNothing, reason: 'once only');
      expect(inBanner('มีคนแก้บทบาทนี้ไปก่อนคุณ'), findsOneWidget, reason: 'the banner still explains');

      await _press(tester, 'บันทึก');
      await _confirm(tester);
      expect(repo.updates, hasLength(2));
      final body = repo.updates.last.body;
      expect(body.version, 4);
      expect(body.name, 'ผู้จัดการ');
      expect(body.capabilities, ['manage_members', 'manage_products', 'manage_roles']);
      await _drainToast(tester);
    });

    testWidgets('re-apply skips what I can no longer grant, and says so', (tester) async {
      final repo = await conflictOnce(tester);
      _container.read(sessionControllerProvider.notifier).capabilitiesLearned(
        orgId: 'org_1',
        capabilities: {'manage_roles', 'manage_members', 'manage_org_settings'},
      );
      await tester.pumpAndSettle();

      await tester.tap(inBanner('ใส่การแก้ของฉันกลับเข้าไป'));
      await tester.pumpAndSettle();

      expect(inBanner('บางรายการใส่กลับไม่ได้ เพราะตอนนี้คุณไม่มีสิทธิ์นั้น'), findsOneWidget);
      expect(tester.widget<TextField>(_nameField()).controller!.text, 'ผู้จัดการ');
      // The longer banner pushes the checklist below the lazily-built fold.
      await tester.dragUntilVisible(
          find.text('เลือกแล้ว 2 จาก 6'), find.byType(ListView).last, const Offset(0, -200));
      expect(find.text('เลือกแล้ว 2 จาก 6'), findsOneWidget, reason: 'manage_products was skipped');
      expect(repo.updates, hasLength(1));
    });

    testWidgets('"ปิด" keeps the latest version as it is', (tester) async {
      final repo = await conflictOnce(tester);
      await tester.tap(inBanner('ปิด'));
      await tester.pumpAndSettle();

      expect(banner(), findsNothing);
      expect(tester.widget<TextField>(_nameField()).controller!.text, 'ผู้ช่วยเจ้าของร้าน');
      expect(repo.updates, hasLength(1));
    });

    testWidgets('latest version is read-only → R4 keeps the banner, without re-apply', (tester) async {
      final locked = _role('rol_admin', 'ผู้ช่วยเจ้าของร้าน', version: 4,
          canEdit: const RoleVerdict(allowed: false, reason: 'equal_permissions_in_use'));
      final repo = await conflictOnce(tester, detail: [_admin, locked]);

      expect(inBanner('มีคนแก้บทบาทนี้ไปก่อนคุณ'), findsOneWidget);
      expect(inBanner('เพิ่ม: จัดการสินค้า, ดูสินค้า'), findsOneWidget);
      expect(inBanner('ใส่การแก้ของฉันกลับเข้าไป'), findsNothing);
      expect(_nameField(), findsNothing);
      expect(repo.updates, hasLength(1));
    });
  });

  group('leave guard', () {
    testWidgets('clean form → back leaves at once', (tester) async {
      await _open(tester, (c) => openRoleCreateScreen(c));
      await _back(tester);
      expect(find.text('host'), findsOneWidget);
    });

    testWidgets('unsaved changes → "ทิ้งการแก้ไขนี้?"; แก้ต่อ stays, ทิ้งการแก้ไข leaves', (tester) async {
      await _open(tester, (c) => openRoleCreateScreen(c));
      await _tapRow(tester, 'manage_members');

      await _back(tester);
      expect(find.text('ทิ้งการแก้ไขนี้?'), findsOneWidget);
      expect(find.text('สิ่งที่แก้ไว้ยังไม่ได้บันทึก ออกจากหน้านี้แล้วจะหายไป'), findsOneWidget);

      await tester.tap(find.text('แก้ต่อ'));
      await tester.pumpAndSettle();
      expect(find.text('host'), findsNothing);
      expect(find.text('เลือกแล้ว 1 จาก 6'), findsOneWidget);

      await _back(tester);
      await tester.tap(find.text('ทิ้งการแก้ไข'));
      await tester.pumpAndSettle();
      expect(find.text('host'), findsOneWidget);
    });
  });

  group('responsive (D-038)', () {
    for (final size in const [Size(360, 740), Size(800, 1280)]) {
      testWidgets('renders without overflow at ${size.width.toInt()}×${size.height.toInt()}', (tester) async {
        tester.view.physicalSize = size * 3;
        tester.view.devicePixelRatio = 3.0;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);

        await _open(tester, (c) => openRoleCreateScreen(c, fromRoleId: 'rol_admin'));
        expect(tester.takeException(), isNull);
        expect(_submit('สร้างบทบาท'), findsOneWidget);
        // The bar sits at the bottom of the screen, full width less padding.
        final bar = tester.getRect(_submit('สร้างบทบาท'));
        expect(bar.bottom, greaterThan(size.height - 100));
        expect(bar.width, greaterThan(size.width - 64));
      });
    }
  });
}
