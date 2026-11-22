// T-003-M08 (EM3-05 · AC-3.8/3.9b · ux R5 + §E) — R5 ลบบทบาท on mobile: the
// "ลบบทบาทนี้" button in "การจัดการอื่น" (R3 and R4), its confirm dialog, and
// the "ยังมีคนใช้" variants. Behaviour reference = web W09
// (`RoleDeleteAction.tsx`, `role-delete-failure.ts`).
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/error/api_failure.dart';
import 'package:mobile/core/session/session_state.dart';
import 'package:mobile/features/org/application/org_providers.dart';
import 'package:mobile/features/org/domain/entities/org_entities.dart';
import 'package:mobile/features/org/domain/entities/role_entities.dart';
import 'package:mobile/features/org/presentation/screens/members_screen.dart';
import 'package:mobile/features/org/presentation/screens/role_form_screen.dart';
import 'package:mobile/features/org/presentation/screens/roles_screen.dart';

import '../harness.dart';
import '../org_fakes.dart';

const _viewer = ActiveOrg(
  orgId: 'org_1',
  name: 'ร้านหอมกรุ่นเบเกอรี่',
  capabilities: {'manage_roles', 'manage_members', 'manage_products'},
);

/// Designs roles, but cannot open R6 (no `manage_members`).
const _rolesOnly = ActiveOrg(
  orgId: 'org_1',
  name: 'ร้านหอมกรุ่นเบเกอรี่',
  capabilities: {'manage_roles', 'manage_products'},
);

const _catalog = CapabilityCatalogView(
  groups: [CapabilityGroupEntry(key: 'catalog_stock', labelTh: 'สินค้าและสต๊อก')],
  items: [
    CapabilityCatalogEntry(key: 'manage_products', labelTh: 'จัดการสินค้า', selectable: true, group: 'catalog_stock'),
  ],
);

const _ok = RoleVerdict(allowed: true);
RoleVerdict _no(String reason) => RoleVerdict(allowed: false, reason: reason);

RoleDetailView _role({
  String id = 'rol_pack',
  int members = 0,
  int invites = 0,
  RoleVerdict canEdit = _ok,
  RoleVerdict canDelete = _ok,
  int version = 1,
}) =>
    RoleDetailView(
      id: id,
      name: 'แพ็คของ',
      roleKey: null,
      nameCustomized: true,
      isSystem: false,
      grantsOwnership: false,
      capabilities: const ['manage_products'],
      usage: RoleUsage(activeMembers: members, pendingInvitations: invites),
      lastEdited: null,
      canEdit: canEdit,
      canDelete: canDelete,
      canClone: _ok,
      version: version,
    );

/// R1's list follows the deletes this fake has accepted — so "back to R1
/// with the row gone" is a fact about the screen, not about the fixture.
class _LiveRoles extends FakeOrgScoped {
  _LiveRoles({required this.all, super.roleDetailAnswers, super.deleteRoleAnswers, super.profile})
      : super(catalog: _catalog);

  final List<RoleDetailView> all;

  @override
  Future<RoleDetailsPage> listRoleDetails() async {
    roleDetailsCalls++;
    final gone = {
      for (var i = 0; i < deletedRoleIds.length; i++)
        if (deleteRoleAnswers.isNotEmpty &&
            deleteRoleAnswers[i < deleteRoleAnswers.length ? i : deleteRoleAnswers.length - 1] == roleDeleted)
          deletedRoleIds[i],
    };
    return RoleDetailsPage(
      items: all.where((r) => !gone.contains(r.id)).toList(),
      canCreate: _ok,
      limit: 30,
    );
  }
}

OrgProfileView _profile(ActiveOrg org, {String myRoleId = 'rol_owner'}) => OrgProfileView(
      id: 'org_1',
      name: 'ร้าน',
      taxProfileComplete: true,
      myRoleId: myRoleId,
      capabilities: org.capabilities,
    );

FakeOrgScoped _repo(
  List<Object> detail, {
  List<Object> delete = const [roleDeleted],
  ActiveOrg org = _viewer,
  String myRoleId = 'rol_owner',
}) =>
    _LiveRoles(
      all: [for (final d in detail) if (d is RoleDetailView) d].take(1).toList(),
      roleDetailAnswers: detail,
      deleteRoleAnswers: [...delete],
      profile: _profile(org, myRoleId: myRoleId),
    );

/// Host → R3/R4 of [roleId].
Future<FakeOrgScoped> _open(
  WidgetTester tester,
  FakeOrgScoped repo, {
  String roleId = 'rol_pack',
  ActiveOrg org = _viewer,
}) async {
  await pumpScreen(
    tester,
    Builder(
      builder: (context) => Scaffold(
        body: Center(
          child: ElevatedButton(onPressed: () => openRoleEditScreen(context, roleId), child: const Text('host')),
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

final _deleteButton = find.byKey(const ValueKey('role-delete-button'));
final _dialog = find.byKey(const ValueKey('role-delete-dialog'));
final _confirm = find.byKey(const ValueKey('role-delete-confirm'));
final _cancel = find.byKey(const ValueKey('role-delete-cancel'));
final _panel = find.byKey(const ValueKey('role-in-use-panel'));
final _inUseDialog = find.byKey(const ValueKey('role-delete-in-use-dialog'));
Finder _inDialog(String text) => find.descendant(of: _dialog, matching: find.text(text));
Finder _inPanel(Finder panel, String text) => find.descendant(of: panel, matching: find.text(text));

bool _enabled(WidgetTester tester, Finder f) => tester.widget<ButtonStyleButton>(f).onPressed != null;

Future<void> _showDelete(WidgetTester tester) async {
  await tester.scrollUntilVisible(_deleteButton, 200, scrollable: find.byType(Scrollable).first);
  await tester.pumpAndSettle();
}

Future<void> _openDialog(WidgetTester tester) async {
  await _showDelete(tester);
  await tester.tap(_deleteButton);
  await tester.pumpAndSettle();
  expect(_dialog, findsOneWidget);
}

Future<void> _drainToast(WidgetTester tester) async {
  await tester.pump(const Duration(seconds: 5));
  await tester.pumpAndSettle();
}

void main() {
  group('R5 (ก) · confirm', () {
    testWidgets('R3: "ลบบทบาทนี้" sits under การจัดการอื่น; the dialog says what deleting means; '
        'focus starts on "ไม่ลบ"', (tester) async {
      await _open(tester, _repo([_role()]));
      await _showDelete(tester);
      expect(find.text('การจัดการอื่น'), findsOneWidget);
      expect(_enabled(tester, _deleteButton), isTrue);

      await tester.tap(_deleteButton);
      await tester.pumpAndSettle();

      expect(_inDialog('ลบบทบาท "แพ็คของ"?'), findsOneWidget);
      expect(
        _inDialog('ลบแล้วเอาคืนไม่ได้ ถ้าต้องใช้อีกต้องสร้างใหม่ ประวัติเดิม (สมาชิกที่ถูกถอด คำเชิญเก่า) '
            'ยังแสดงชื่อบทบาทนี้ได้ตามเดิม'),
        findsOneWidget,
      );
      expect(find.descendant(of: _confirm, matching: find.text('ลบบทบาท')), findsOneWidget);
      expect(find.descendant(of: _cancel, matching: find.text('ไม่ลบ')), findsOneWidget);
      expect(FocusManager.instance.primaryFocus?.debugLabel, 'role-delete-cancel',
          reason: 'destructive → focusCancel (ui.md §1)');
    });

    testWidgets('"ไม่ลบ" closes and sends nothing', (tester) async {
      final repo = await _open(tester, _repo([_role()]));
      await _openDialog(tester);
      await tester.tap(_cancel);
      await tester.pumpAndSettle();
      expect(_dialog, findsNothing);
      expect(repo.deletedRoleIds, isEmpty);
    });

    testWidgets('★ confirm → EXACTLY ONE DELETE, even pressed twice; in flight "กำลังลบ..." and no dismiss',
        (tester) async {
      final gate = Completer<void>();
      final repo = (await _open(tester, _repo([_role()])))..writeGate = gate;
      await _openDialog(tester);

      await tester.tap(_confirm);
      await tester.pump();
      expect(find.descendant(of: _confirm, matching: find.text('กำลังลบ...')), findsOneWidget);
      await tester.tap(_confirm, warnIfMissed: false);
      await tester.pump();
      // The barrier and back must not close a dialog whose DELETE is in flight.
      await tester.tapAt(const Offset(5, 5));
      await tester.pump();
      expect(_dialog, findsOneWidget);
      expect(_enabled(tester, _cancel), isFalse);

      gate.complete();
      await tester.pumpAndSettle();
      expect(repo.deletedRoleIds, ['rol_pack']);
      await _drainToast(tester);
    });

    testWidgets('★ success → toast + back to R1, and the row is GONE there', (tester) async {
      final other = _role(id: 'rol_other');
      final repo = _LiveRoles(
        all: [_role(), other],
        roleDetailAnswers: [_role()],
        deleteRoleAnswers: [roleDeleted],
        profile: _profile(_viewer),
      );
      await pumpScreen(
        tester,
        Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: ElevatedButton(onPressed: () => openRolesScreen(context), child: const Text('host')),
            ),
          ),
        ),
        overrides: [orgScopedRepositoryProvider.overrideWithValue(repo)],
        activeOrg: _viewer,
      );
      await tester.tap(find.text('host'));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('role-row-rol_pack')), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey('role-row-rol_pack')));
      await tester.pumpAndSettle();
      await _openDialog(tester);
      await tester.tap(_confirm);
      await tester.pumpAndSettle();

      expect(find.text('ลบบทบาท "แพ็คของ" แล้ว'), findsOneWidget);
      expect(find.byType(RolesScreen), findsOneWidget);
      expect(find.byKey(const ValueKey('role-form-name')), findsNothing);
      expect(find.byKey(const ValueKey('role-row-rol_pack')), findsNothing);
      expect(find.byKey(const ValueKey('role-row-rol_other')), findsOneWidget, reason: 'control');
      expect(repo.deletedRoleIds, hasLength(1));
      await _drainToast(tester);
    });

    testWidgets('success from a DIRTY R3 → leaves without asking "ทิ้งการแก้ไข?"', (tester) async {
      await _open(tester, _repo([_role()]));
      await tester.tap(find.byKey(const ValueKey('cap-row-manage_products')));
      await tester.pumpAndSettle();
      await _openDialog(tester);
      await tester.tap(_confirm);
      await tester.pumpAndSettle();
      expect(find.text('ทิ้งการแก้ไขนี้?'), findsNothing);
      expect(find.text('host'), findsOneWidget);
      await _drainToast(tester);
    });

    testWidgets('R4 (edit refused for another reason, delete allowed) offers the same delete', (tester) async {
      final repo = await _open(tester,
          _repo([_role(canEdit: _no('equal_permissions_in_use'), canDelete: _ok)]));
      expect(find.byKey(const ValueKey('role-form-name')), findsNothing, reason: 'R4');
      await _openDialog(tester);
      await tester.tap(_confirm);
      await tester.pumpAndSettle();
      expect(repo.deletedRoleIds, hasLength(1));
      expect(find.text('host'), findsOneWidget);
      await _drainToast(tester);
    });
  });

  group('R5 (ข) · still in use — known from the verdict', () {
    testWidgets('disabled button + the panel UNDER it, numbers from usage, links to R6', (tester) async {
      await _open(tester, _repo([_role(members: 2, invites: 1, canDelete: _no('in_use'))]));
      await _showDelete(tester);

      expect(_enabled(tester, _deleteButton), isFalse);
      expect(_inPanel(_panel, 'ลบไม่ได้ตอนนี้ — ยังมีคนใช้บทบาทนี้อยู่'), findsOneWidget);
      expect(_inPanel(_panel, 'สมาชิก 2 คน · คำเชิญที่ยังไม่ปิด 1 ใบ'), findsOneWidget);
      expect(_inPanel(_panel, 'ย้ายสมาชิกไปบทบาทอื่นและยกเลิกคำเชิญเหล่านี้ก่อน แล้วค่อยลบ'), findsOneWidget);
      expect(_inPanel(_panel, 'ดูสมาชิกที่ใช้บทบาทนี้ (2)'), findsOneWidget);
      expect(_inPanel(_panel, 'ดูคำเชิญที่ใช้บทบาทนี้ (1)'), findsOneWidget);
      expect(_inPanel(_panel, 'คนที่จัดการสมาชิกได้ (เช่น เจ้าของร้าน) ต้องเป็นคนย้ายสมาชิกหรือยกเลิกคำเชิญ'),
          findsNothing);
    });

    testWidgets('a link opens R6 for THIS role; coming back re-reads the role', (tester) async {
      final repo = await _open(tester, _repo([_role(members: 2, invites: 1, canDelete: _no('in_use'))]));
      await _showDelete(tester);
      final seenBefore = repo.roleDetailIdsSeen.length;

      await tester.tap(find.byKey(const ValueKey('role-in-use-members')));
      await tester.pumpAndSettle();
      expect(find.byType(RoleMembersScreen), findsOneWidget);
      expect(find.text('คนที่ใช้บทบาท "แพ็คของ"'), findsOneWidget);
      expect(repo.memberRoleIdsSeen, contains('rol_pack'));
      expect(repo.invitationRoleIdsSeen, contains('rol_pack'));

      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      expect(repo.roleDetailIdsSeen.length, greaterThan(seenBefore), reason: 'counts may have changed in R6');
    });

    testWidgets('zero parts are dropped: only invitations → no members link', (tester) async {
      await _open(tester, _repo([_role(members: 0, invites: 3, canDelete: _no('in_use'))]));
      await _showDelete(tester);
      expect(_inPanel(_panel, 'คำเชิญที่ยังไม่ปิด 3 ใบ'), findsOneWidget);
      expect(find.byKey(const ValueKey('role-in-use-members')), findsNothing);
      expect(find.byKey(const ValueKey('role-in-use-invitations')), findsOneWidget);
    });

    testWidgets('the only holder is ME → "(รวมคุณ)" and the "ให้เจ้าของร้านย้ายคุณ" line', (tester) async {
      await _open(tester,
          _repo([_role(members: 1, canDelete: _no('in_use'))], myRoleId: 'rol_pack'));
      await _showDelete(tester);
      expect(_inPanel(_panel, 'สมาชิก 1 คน (รวมคุณ)'), findsOneWidget);
      expect(_inPanel(_panel, 'คนที่ใช้บทบาทนี้คือคุณเอง — ให้เจ้าของร้านย้ายคุณไปบทบาทอื่นก่อน'), findsOneWidget);
      expect(_inPanel(_panel, 'ย้ายสมาชิกไปบทบาทอื่นและยกเลิกคำเชิญเหล่านี้ก่อน แล้วค่อยลบ'), findsNothing);
    });

    testWidgets('a viewer WITHOUT manage_members → no links, the "คนที่จัดการสมาชิกได้…" line instead',
        (tester) async {
      await _open(tester, _repo([_role(members: 2, invites: 1, canDelete: _no('in_use'))], org: _rolesOnly),
          org: _rolesOnly);
      await _showDelete(tester);
      expect(find.byKey(const ValueKey('role-in-use-members')), findsNothing);
      expect(find.byKey(const ValueKey('role-in-use-invitations')), findsNothing);
      expect(_inPanel(_panel, 'คนที่จัดการสมาชิกได้ (เช่น เจ้าของร้าน) ต้องเป็นคนย้ายสมาชิกหรือยกเลิกคำเชิญ'),
          findsOneWidget);
    });

    testWidgets('another delete-only reason (history_limit_reached) → disabled + its title/body', (tester) async {
      await _open(tester, _repo([_role(canDelete: _no('history_limit_reached'))]));
      await _showDelete(tester);
      expect(_enabled(tester, _deleteButton), isFalse);
      expect(find.text('ลบเพิ่มไม่ได้'), findsOneWidget);
      expect(find.text('ร้านนี้ลบบทบาทไปครบจำนวนที่ระบบเก็บประวัติได้แล้ว กรุณาติดต่อทีมงาน OmniStock'),
          findsOneWidget);
      expect(_panel, findsNothing);
    });
  });

  group('R5 · refusals at confirm (§E)', () {
    testWidgets('★ 409 ROLE_IN_USE → the dialog turns into (ข) with the SERVER numbers; role re-read; one DELETE',
        (tester) async {
      final repo = await _open(
        tester,
        _repo(
          [_role(), _role(invites: 2, canDelete: _no('in_use'), version: 2)],
          delete: [const ConflictFailure(code: 'ROLE_IN_USE', details: {'activeMembers': 1, 'pendingInvitations': 2})],
        ),
      );
      await _openDialog(tester);
      await tester.tap(_confirm);
      await tester.pumpAndSettle();

      expect(_inUseDialog, findsOneWidget);
      expect(_inPanel(_inUseDialog, 'ลบไม่ได้ตอนนี้ — ยังมีคนใช้บทบาทนี้อยู่'), findsOneWidget);
      expect(_inPanel(_inUseDialog, 'สมาชิก 1 คน · คำเชิญที่ยังไม่ปิด 2 ใบ'), findsOneWidget,
          reason: 'details, not the stale usage (0/0)');
      expect(_inPanel(_inUseDialog, 'ดูสมาชิกที่ใช้บทบาทนี้ (1)'), findsOneWidget);
      expect(repo.deletedRoleIds, hasLength(1));
      expect(repo.roleDetailIdsSeen, hasLength(2), reason: 'the role is read again');

      await tester.tap(find.byKey(const ValueKey('role-delete-close')));
      await tester.pumpAndSettle();
      expect(_inUseDialog, findsNothing);
      // The page now shows the re-read verdict: in use, under the button.
      await _showDelete(tester);
      expect(_enabled(tester, _deleteButton), isFalse);
      expect(_inPanel(_panel, 'คำเชิญที่ยังไม่ปิด 2 ใบ'), findsOneWidget);
      expect(repo.deletedRoleIds, hasLength(1), reason: 'never retried');
    });

    testWidgets('409 ROLE_IN_USE → the dialog\'s R6 link closes it and opens R6', (tester) async {
      await _open(
        tester,
        _repo([_role()],
            delete: [const ConflictFailure(code: 'ROLE_IN_USE', details: {'activeMembers': 0, 'pendingInvitations': 1})]),
      );
      await _openDialog(tester);
      await tester.tap(_confirm);
      await tester.pumpAndSettle();
      await tester.tap(find.descendant(of: _inUseDialog, matching: find.byKey(const ValueKey('role-in-use-invitations'))));
      await tester.pumpAndSettle();
      expect(_inUseDialog, findsNothing);
      expect(find.byType(RoleMembersScreen), findsOneWidget);
    });

    testWidgets('409 ROLE_IN_USE without usable details → (ข) without invented numbers', (tester) async {
      await _open(tester, _repo([_role()], delete: [const ConflictFailure(code: 'ROLE_IN_USE')]));
      await _openDialog(tester);
      await tester.tap(_confirm);
      await tester.pumpAndSettle();
      expect(_inUseDialog, findsOneWidget);
      expect(find.descendant(of: _inUseDialog, matching: find.textContaining('สมาชิก ')), findsNothing);
      expect(find.descendant(of: _inUseDialog, matching: find.textContaining('ใบ')), findsNothing);
    });

    testWidgets('409 ROLE_HISTORY_LIMIT_REACHED → shown IN the dialog, confirm disabled, one DELETE',
        (tester) async {
      final repo = await _open(tester,
          _repo([_role()], delete: [const ConflictFailure(code: 'ROLE_HISTORY_LIMIT_REACHED', details: {'limit': 500})]));
      await _openDialog(tester);
      await tester.tap(_confirm);
      await tester.pumpAndSettle();

      expect(_dialog, findsOneWidget);
      expect(_inDialog('ลบเพิ่มไม่ได้ — ร้านนี้ลบบทบาทไปครบ 500 ครั้งที่ระบบเก็บประวัติได้แล้ว กรุณาติดต่อทีมงาน OmniStock'),
          findsOneWidget);
      expect(_enabled(tester, _confirm), isFalse);
      expect(repo.deletedRoleIds, hasLength(1));
    });

    testWidgets('404 → "บทบาทนี้ถูกลบไปแล้ว" + back to R1', (tester) async {
      await _open(tester, _repo([_role()], delete: [const NotFoundFailure()]));
      await _openDialog(tester);
      await tester.tap(_confirm);
      await tester.pumpAndSettle();
      expect(find.text('บทบาทนี้ถูกลบไปแล้ว'), findsOneWidget);
      expect(find.text('host'), findsOneWidget);
      await _drainToast(tester);
    });

    testWidgets('TARGET_NOT_BELOW_ACTOR → dialog closes, its sentence stays on the screen, role re-read',
        (tester) async {
      final repo = await _open(tester, _repo(
        [_role(), _role(canEdit: _no('equal_permissions_in_use'), canDelete: _no('equal_permissions_in_use'))],
        delete: [const ForbiddenFailure(code: 'TARGET_NOT_BELOW_ACTOR')],
      ));
      await _openDialog(tester);
      await tester.tap(_confirm);
      await tester.pumpAndSettle();

      expect(_dialog, findsNothing);
      expect(repo.roleDetailIdsSeen, hasLength(2));
      // Re-read: the role is now R4 with the matching reason banner.
      expect(find.text('ดูได้อย่างเดียว — มีคนที่สิทธิ์เท่าคุณใช้บทบาทนี้อยู่'), findsOneWidget);
      expect(find.text('หน้านี้สำหรับคนที่จัดการบทบาทได้'), findsNothing, reason: 'stays — not FORBIDDEN');
    });

    testWidgets('an unmapped failure → the DELETE generic sentence under the button', (tester) async {
      await _open(tester, _repo([_role()], delete: [const ServerFailure()]));
      await _openDialog(tester);
      await tester.tap(_confirm);
      await tester.pumpAndSettle();
      expect(_dialog, findsNothing);
      await _showDelete(tester);
      expect(find.text('ลบบทบาทไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'), findsOneWidget);
      expect(find.text('บันทึกบทบาทไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'), findsNothing);
    });

    testWidgets('429 → countdown under the button, which stays disabled until it runs out', (tester) async {
      await _open(tester, _repo([_role()], delete: [const ThrottledFailure(retryAfterSeconds: 2)]));
      await _openDialog(tester);
      await tester.tap(_confirm);
      await tester.pumpAndSettle();
      await _showDelete(tester);
      expect(find.text('แก้บทบาทถี่เกินไป กรุณารอ 00:02 แล้วลองใหม่'), findsOneWidget);
      expect(_enabled(tester, _deleteButton), isFalse);
      await tester.pump(const Duration(seconds: 3));
      await tester.pumpAndSettle();
      expect(_enabled(tester, _deleteButton), isTrue);
    });

    testWidgets('★ 403 FORBIDDEN → leaves for the ForbiddenPanel', (tester) async {
      await _open(tester, _repo([_role()], delete: [const ForbiddenFailure()]));
      await _openDialog(tester);
      await tester.tap(_confirm);
      await tester.pumpAndSettle();
      expect(find.text('หน้านี้สำหรับคนที่จัดการบทบาทได้'), findsOneWidget);
    });
  });

  group('responsive (D-038)', () {
    for (final size in const [Size(360, 740), Size(800, 1280)]) {
      testWidgets('the dialog fits at ${size.width.toInt()}×${size.height.toInt()}; buttons ≥ 44 tall',
          (tester) async {
        tester.view.physicalSize = size * 3;
        tester.view.devicePixelRatio = 3.0;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);

        await _open(tester, _repo([_role()]));
        await _openDialog(tester);
        expect(tester.takeException(), isNull);
        expect(tester.getSize(_confirm).height, greaterThanOrEqualTo(44));
        expect(tester.getSize(_cancel).height, greaterThanOrEqualTo(44));
        expect(tester.getSize(_deleteButton).height, greaterThanOrEqualTo(44));
      });
    }
  });
}
