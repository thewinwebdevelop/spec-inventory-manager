// T-003-M11 ★ — ux R10 / R10a on mobile: tap a member row → bottom sheet →
// change that member's role (test-plan CM3-08 + the error table R10 (ค)).
//
// Every test drives the REAL members screen with no seam override: the row
// tap must open the sheet the app ships, not a test double of it.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/error/api_failure.dart';
import 'package:mobile/core/session/session_state.dart';
import 'package:mobile/features/org/application/org_providers.dart';
import 'package:mobile/features/org/domain/entities/org_entities.dart';
import 'package:mobile/features/org/presentation/screens/invite_member_screen.dart';
import 'package:mobile/features/org/presentation/screens/members_screen.dart';
import 'package:mobile/features/org/presentation/widgets/role_radio_option.dart';

import '../harness.dart';
import '../org_fakes.dart';

/// G3-14-shaped: system roles + a custom ⊆ role + a custom role the viewer
/// cannot hand out, with the server's per-role verdicts.
const _roles = [
  RoleRow(
    id: 'rol_owner',
    name: 'Owner',
    key: 'owner',
    grantsOwnership: true,
    viewerCanAssign: false,
    assignBlockedReason: 'owner_only',
  ),
  RoleRow(id: 'rol_admin', name: 'Admin', key: 'admin', viewerCanAssign: true),
  RoleRow(id: 'rol_staff', name: 'Staff', key: 'staff', viewerCanAssign: true),
  RoleRow(id: 'rol_pack', name: 'พนักงานแพ็คของ', key: null, nameCustomized: true, viewerCanAssign: true),
  RoleRow(
    id: 'rol_bill',
    name: 'บัญชีภายนอก',
    key: null,
    nameCustomized: true,
    viewerCanAssign: false,
    assignBlockedReason: 'exceeds_your_permissions',
  ),
];

/// An Admin who holds manage_members + manage_roles (verdicts present).
const _adminWithRoles = ActiveOrg(
  orgId: 'org_1',
  name: 'ร้านหอมกรุ่นเบเกอรี่',
  capabilities: {'manage_members', 'manage_roles'},
);

/// An Admin who holds manage_members ONLY — the server sends no verdict.
const _adminMembersOnly = ActiveOrg(
  orgId: 'org_1',
  name: 'ร้านหอมกรุ่นเบเกอรี่',
  capabilities: {'manage_members'},
);

const _saving = 'กำลังบันทึก...';

OrgProfileView _profile(Set<String> caps) => OrgProfileView(
      id: 'org_1',
      name: 'ร้านหอมกรุ่นเบเกอรี่',
      taxProfileComplete: true,
      capabilities: caps,
    );

MemberRow _mai({bool? verdict = true, String roleId = 'rol_staff'}) => member(
      id: 'usr_mai',
      email: 'mai@shop.com',
      roleId: roleId,
      viewerCanManage: verdict,
    );

MemberRow _me({bool isOwner = false, String roleId = 'rol_admin', bool? verdict}) => member(
      id: 'usr_me',
      email: 'somchai@shop.com',
      isMe: true,
      isOwner: isOwner,
      roleId: roleId,
      roleKey: isOwner ? 'owner' : 'admin',
      roleName: isOwner ? 'Owner' : 'Admin',
      viewerCanManage: verdict,
    );

Future<FakeOrgScoped> _pump(
  WidgetTester tester, {
  required List<MemberRow> rows,
  List<Object> answers = const [],
  List<List<RoleRow>>? roleAnswers,
  ActiveOrg org = _adminWithRoles,
  OrgProfileView? profile,
  List<PagedResult<MemberRow>>? pages,
}) async {
  final scoped = FakeOrgScoped(
    memberPages: pages ?? [PagedResult(items: rows), PagedResult(items: rows), PagedResult(items: rows)],
    roles: _roles,
    roleAnswers: roleAnswers,
    updateMemberAnswers: [...answers],
    profile: profile,
  );
  await pumpScreen(
    tester,
    const MembersScreen(),
    overrides: [orgScopedRepositoryProvider.overrideWithValue(scoped)],
    activeOrg: org,
  );
  await tester.pumpAndSettle();
  return scoped;
}

Future<void> _open(WidgetTester tester, String email) async {
  await tester.tap(find.text(email));
  await tester.pumpAndSettle();
}

Finder _option(String label) => find.ancestor(
      of: find.textContaining(label),
      matching: find.byType(RadioListTile<String>),
    );

RadioListTile<String> _tile(WidgetTester tester, String label) =>
    tester.widget<RadioListTile<String>>(_option(label).first);

ButtonStyleButton _saveButton(WidgetTester tester) =>
    tester.widget<ButtonStyleButton>(find.byKey(const ValueKey('member-role-save')));

Future<void> _pick(WidgetTester tester, String label) async {
  await tester.tap(_option(label).first);
  await tester.pumpAndSettle();
}

Future<void> _submit(WidgetTester tester) async {
  await tester.tap(find.byKey(const ValueKey('member-role-save')));
  await tester.pumpAndSettle();
}

/// (label, enabled) for every option a screen offers, in order.
List<(String, bool)> _offered(WidgetTester tester) => [
      for (final w in tester.widgetList<RoleRadioOption>(find.byType(RoleRadioOption)))
        (w.label, !w.disabled),
    ];

const _footer = 'ถอดสมาชิกออกจากร้าน หรือยกเลิกคำเชิญ ทำได้ที่เว็บ';

void main() {
  group('CM3-08 — the sheet', () {
    testWidgets('★ options = the invite screen\'s, from the same widget + source; current role selected',
        (tester) async {
      await _pump(tester, rows: [_mai()]);
      await _open(tester, 'mai@shop.com');

      expect(find.text('เปลี่ยนบทบาทของ'), findsOneWidget);
      expect(find.descendant(of: find.byType(BottomSheet), matching: find.text('mai@shop.com')),
          findsOneWidget);
      final inSheet = _offered(tester);
      expect(inSheet, [
        ('เจ้าของร้าน', false),
        ('ผู้ดูแล', true),
        ('พนักงาน', true),
        ('พนักงานแพ็คของ', true),
        ('บัญชีภายนอก', false),
      ]);
      // disabled + reason, never hidden (R8 rule)
      expect(find.text('เฉพาะเจ้าของร้านเท่านั้นที่ตั้งเจ้าของร้านคนใหม่ได้'), findsOneWidget);
      expect(find.text('บทบาทนี้มีสิทธิ์ที่คุณไม่มี จึงมอบให้คนอื่นไม่ได้'), findsOneWidget);
      // the current role is marked and pre-selected
      expect(find.text('พนักงาน (บทบาทปัจจุบัน)'), findsOneWidget);
      expect(tester.widget<RadioGroup<String>>(find.byType(RadioGroup<String>)).groupValue, 'rol_staff');
      // no owner description in the sheet (ux R8 mobile note)
      expect(find.text('ทำได้ทุกอย่าง รวมถึงตั้ง/ถอดเจ้าของร้านคนอื่น'), findsNothing);

      // Same list, same states on the invite screen (one source, one widget).
      await tester.pumpWidget(const SizedBox()); // drop the open sheet's route
      final scoped = FakeOrgScoped(roles: _roles);
      await pumpScreen(
        tester,
        const InviteMemberScreen(),
        overrides: [orgScopedRepositoryProvider.overrideWithValue(scoped)],
        activeOrg: _adminWithRoles,
      );
      await tester.pumpAndSettle();
      expect(_offered(tester), inSheet);
    });

    testWidgets('★ no-op guard: save is disabled until a DIFFERENT role is picked', (tester) async {
      final scoped = await _pump(tester, rows: [_mai()]);
      await _open(tester, 'mai@shop.com');

      expect(_saveButton(tester).onPressed, isNull);
      await _pick(tester, 'พนักงานแพ็คของ');
      expect(_saveButton(tester).onPressed, isNotNull);
      await _pick(tester, 'พนักงาน (บทบาทปัจจุบัน)');
      expect(_saveButton(tester).onPressed, isNull);
      expect(scoped.memberRoleUpdates, isEmpty);
    });

    testWidgets('★ success: ONE PATCH with {roleId}, sheet closes, toast, row updated + list re-read',
        (tester) async {
      final updated = member(
        id: 'usr_mai',
        email: 'mai@shop.com',
        roleId: 'rol_pack',
        roleKey: null,
        roleName: 'พนักงานแพ็คของ',
        roleNameCustomized: true,
        viewerCanManage: true,
      );
      final scoped = await _pump(
        tester,
        rows: [_mai()],
        answers: [updated],
        pages: [
          PagedResult(items: [_mai()]),
          PagedResult(items: [updated]),
        ],
      );
      final listCallsBefore = scoped.memberCalls;
      await _open(tester, 'mai@shop.com');
      await _pick(tester, 'พนักงานแพ็คของ');
      await _submit(tester);

      expect(scoped.memberRoleUpdates, [(userId: 'usr_mai', roleId: 'rol_pack')]);
      expect(find.byType(BottomSheet), findsNothing);
      expect(find.text('เปลี่ยนบทบาทของ mai@shop.com เป็น พนักงานแพ็คของ แล้ว'), findsOneWidget);
      expect(scoped.memberCalls, greaterThan(listCallsBefore), reason: 'L-4: the list is re-read');
      expect(
        find.descendant(
          of: find.ancestor(of: find.text('mai@shop.com'), matching: find.byType(ListTile)),
          matching: find.textContaining('พนักงานแพ็คของ'),
        ),
        findsOneWidget,
      );
    });

    testWidgets('★ locked while sending: options, ✕, back and the barrier all hold until the answer',
        (tester) async {
      final updated = _mai(roleId: 'rol_pack');
      final scoped = await _pump(tester, rows: [_mai()], answers: [updated]);
      scoped.writeGate = Completer<void>();
      await _open(tester, 'mai@shop.com');
      await _pick(tester, 'พนักงานแพ็คของ');
      await tester.tap(find.byKey(const ValueKey('member-role-save')));
      await tester.pump();

      expect(find.text(_saving), findsOneWidget);
      expect(_saveButton(tester).onPressed, isNull);
      for (final label in ['ผู้ดูแล', 'พนักงานแพ็คของ']) {
        expect(_tile(tester, label).enabled, isFalse, reason: label);
      }
      final close = tester.widget<IconButton>(find.byKey(const ValueKey('member-role-dismiss')));
      expect(close.onPressed, isNull);

      // Back, a tap on the barrier, and a drag down: none closes it. Settled
      // after EACH attempt — a single pump() leaves a closing sheet in the
      // tree mid-animation, and the first version of this test passed with
      // every guard removed (mutation-checked).
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.byType(BottomSheet), findsOneWidget, reason: 'back');
      final top = tester.getTopLeft(find.byType(BottomSheet));
      expect(top.dy, greaterThan(20), reason: 'there is barrier above the sheet to tap');
      await tester.tapAt(const Offset(10, 10));
      await tester.pumpAndSettle();
      expect(find.byType(BottomSheet), findsOneWidget, reason: 'barrier');
      await tester.drag(find.text(_saving), const Offset(0, 500));
      await tester.pumpAndSettle();
      expect(find.byType(BottomSheet), findsOneWidget, reason: 'drag');
      expect(tester.getTopLeft(find.byType(BottomSheet)).dy, top.dy, reason: 'not dragged away');

      scoped.writeGate!.complete();
      await tester.pumpAndSettle();
      expect(find.byType(BottomSheet), findsNothing);
      expect(scoped.memberRoleUpdates, hasLength(1));
    });

    testWidgets('closing with ✕ before saving sends nothing', (tester) async {
      final scoped = await _pump(tester, rows: [_mai()]);
      await _open(tester, 'mai@shop.com');
      await _pick(tester, 'พนักงานแพ็คของ');
      await tester.tap(find.byKey(const ValueKey('member-role-dismiss')));
      await tester.pumpAndSettle();
      expect(find.byType(BottomSheet), findsNothing);
      expect(scoped.memberRoleUpdates, isEmpty);
    });

    testWidgets('roles failing to load (or an empty list) → error + retry, save disabled',
        (tester) async {
      await _pump(tester, rows: [_mai()], roleAnswers: [const [], _roles]);
      await _open(tester, 'mai@shop.com');
      expect(find.text('โหลดรายการบทบาทไม่สำเร็จ'), findsOneWidget);
      expect(_saveButton(tester).onPressed, isNull);
      await tester.tap(find.text('ลองใหม่'));
      await tester.pumpAndSettle();
      expect(find.byType(RoleRadioOption), findsNWidgets(_roles.length));
    });

    testWidgets('no remove / reset-password / cancel-invitation action in the sheet (F-002b)',
        (tester) async {
      await _pump(tester, rows: [_mai()]);
      await _open(tester, 'mai@shop.com');
      for (final word in ['ถอดออกจากร้าน', 'ตั้งรหัสผ่านใหม่', 'ยกเลิกคำเชิญ', 'รีเซ็ต']) {
        // The footer (ux R10 (ก)) NAMES these to say they live on the web —
      // that sentence is the only place the words may appear.
      expect(
        find.byWidgetPredicate(
          (w) => w is Text && (w.data ?? '').contains(word) && w.data != _footer,
        ),
        findsNothing,
        reason: word,
      );
      }
    });

    testWidgets('"ดูว่าแต่ละบทบาททำอะไรได้บ้าง" only for a manage_roles holder', (tester) async {
      await _pump(tester, rows: [_mai()]);
      await _open(tester, 'mai@shop.com');
      expect(find.text('ดูว่าแต่ละบทบาททำอะไรได้บ้าง'), findsOneWidget);
    });

    testWidgets('… and absent without manage_roles', (tester) async {
      await _pump(tester, rows: [_mai(verdict: null)], org: _adminMembersOnly);
      await _open(tester, 'mai@shop.com');
      expect(find.text('ดูว่าแต่ละบทบาททำอะไรได้บ้าง'), findsNothing);
    });
  });

  group('★ M11 — no verdict (manage_members without manage_roles) is NOT fail-closed', () {
    testWidgets('an ordinary row opens the sheet; the server decides', (tester) async {
      final scoped = await _pump(
        tester,
        rows: [_mai(verdict: null)],
        org: _adminMembersOnly,
        answers: [const ForbiddenFailure(code: 'TARGET_NOT_BELOW_ACTOR')],
      );
      await _open(tester, 'mai@shop.com');
      expect(find.byType(BottomSheet), findsOneWidget);
      await _pick(tester, 'ผู้ดูแล');
      await _submit(tester);
      expect(scoped.memberRoleUpdates, hasLength(1));
      expect(find.text('คุณจัดการสมาชิกคนนี้ไม่ได้ — ให้เจ้าของร้านช่วย'), findsWidgets);
    });

    testWidgets('★ an Owner row is locked owner_only and has NO way to open the sheet',
        (tester) async {
      await _pump(
        tester,
        rows: [member(id: 'usr_own', email: 'owner@shop.com', isOwner: true, roleKey: 'owner', roleId: 'rol_owner')],
        org: _adminMembersOnly,
      );
      final tile = tester.widget<ListTile>(
        find.ancestor(of: find.text('owner@shop.com'), matching: find.byType(ListTile)),
      );
      expect(tile.onTap, isNull);
      expect(find.text('เฉพาะเจ้าของร้านเท่านั้นที่เปลี่ยนบทบาทหรือถอดเจ้าของร้านคนอื่นได้'),
          findsOneWidget);
      await tester.tap(find.text('owner@shop.com'));
      await tester.pumpAndSettle();
      expect(find.byType(BottomSheet), findsNothing);
    });

    testWidgets('★ D-040 — your own row opens the sheet (title "เปลี่ยนบทบาทของคุณ")', (tester) async {
      await _pump(tester, rows: [_me()], org: _adminMembersOnly);
      await _open(tester, 'somchai@shop.com');
      expect(find.text('เปลี่ยนบทบาทของคุณ'), findsOneWidget);
      expect(find.descendant(of: find.byType(BottomSheet), matching: find.text('somchai@shop.com')),
          findsNothing);
    });
  });

  group('R10a — changing your own role', () {
    const confirmTitle = 'เปลี่ยนบทบาทของตัวเอง?';
    const body = 'จาก "ผู้ดูแล" เป็น "พนักงาน" มีผลทันที หลังเปลี่ยน คุณอาจทำบางอย่างไม่ได้อีก '
        'และถ้าบทบาทใหม่จัดการสมาชิกไม่ได้ คุณจะเปลี่ยนกลับเองไม่ได้ ต้องให้เจ้าของร้านเปลี่ยนให้';

    testWidgets('★ asks first; "ไม่เปลี่ยน" sends nothing and keeps the choice', (tester) async {
      final scoped = await _pump(tester, rows: [_me(verdict: true)]);
      await _open(tester, 'somchai@shop.com');
      await _pick(tester, 'พนักงาน');
      await _submit(tester);

      expect(find.text(confirmTitle), findsOneWidget);
      expect(find.text(body), findsOneWidget);
      expect(find.text('คุณจะไม่ได้เป็นเจ้าของร้านแล้ว'), findsNothing);
      await tester.tap(find.text('ไม่เปลี่ยน'));
      await tester.pumpAndSettle();

      expect(scoped.memberRoleUpdates, isEmpty);
      expect(find.byType(RoleRadioOption), findsWidgets);
      expect(tester.widget<RadioGroup<String>>(find.byType(RadioGroup<String>)).groupValue, 'rol_staff');
    });

    testWidgets('★ confirmed → ONE PATCH; still manages members → stays, self toast', (tester) async {
      final after = _me(roleId: 'rol_staff', verdict: true);
      final scoped = await _pump(
        tester,
        rows: [_me(verdict: true)],
        answers: [
          member(
            id: 'usr_me',
            email: 'somchai@shop.com',
            isMe: true,
            roleId: 'rol_staff',
            roleKey: 'staff',
            roleName: 'Staff',
          ),
        ],
        pages: [PagedResult(items: [_me(verdict: true)]), PagedResult(items: [after])],
        profile: _profile({'manage_members'}),
      );
      await _open(tester, 'somchai@shop.com');
      await _pick(tester, 'พนักงาน');
      await _submit(tester);
      await tester.tap(find.text('เปลี่ยนบทบาทของฉัน'));
      await tester.pumpAndSettle();

      expect(scoped.memberRoleUpdates, [(userId: 'usr_me', roleId: 'rol_staff')]);
      expect(scoped.profileCalls, greaterThan(0), reason: 'myMembership is re-learned');
      expect(find.text('เปลี่ยนบทบาทของคุณเป็น "พนักงาน" แล้ว'), findsOneWidget);
      expect(find.byType(MembersScreen), findsOneWidget);
    });

    testWidgets('★ confirmed and manage_members is gone → leaves the members screen + says so',
        (tester) async {
      await _pump(
        tester,
        rows: [_me(verdict: true)],
        answers: [
          member(id: 'usr_me', email: 'somchai@shop.com', isMe: true, roleId: 'rol_staff', roleName: 'Staff'),
        ],
        profile: _profile(const {}),
      );
      await _open(tester, 'somchai@shop.com');
      await _pick(tester, 'พนักงาน');
      await _submit(tester);
      await tester.tap(find.text('เปลี่ยนบทบาทของฉัน'));
      await tester.pumpAndSettle();

      expect(find.byType(BottomSheet), findsNothing);
      expect(
        find.text('เปลี่ยนบทบาทของคุณเป็น "พนักงาน" แล้ว — ตอนนี้คุณจัดการสมาชิกไม่ได้แล้ว'),
        findsOneWidget,
      );
    });

    testWidgets('an Owner changing their own role reads "คุณจะไม่ได้เป็นเจ้าของร้านแล้ว" first',
        (tester) async {
      const ownerOrgWithRoles = ActiveOrg(
        orgId: 'org_1',
        name: 'ร้านหอมกรุ่นเบเกอรี่',
        capabilities: {'full_access'},
      );
      await _pump(
        tester,
        rows: [_me(isOwner: true, roleId: 'rol_owner', verdict: true)],
        org: ownerOrgWithRoles,
      );
      await _open(tester, 'somchai@shop.com');
      await _pick(tester, 'ผู้ดูแล');
      await _submit(tester);
      expect(find.textContaining('คุณจะไม่ได้เป็นเจ้าของร้านแล้ว'), findsOneWidget);
    });

    testWidgets('another member\'s row never asks', (tester) async {
      final scoped = await _pump(tester, rows: [_mai()], answers: [_mai(roleId: 'rol_admin')]);
      await _open(tester, 'mai@shop.com');
      await _pick(tester, 'ผู้ดูแล');
      await _submit(tester);
      expect(find.text(confirmTitle), findsNothing);
      expect(scoped.memberRoleUpdates, hasLength(1));
    });
  });

  group('R10 (ค) — every refusal, its sentence, and what happens', () {
    Future<FakeOrgScoped> refuse(
      WidgetTester tester,
      ApiFailure failure, {
      OrgProfileView? profile,
      List<List<RoleRow>>? roleAnswers,
    }) async {
      final scoped = await _pump(
        tester,
        rows: [_mai()],
        answers: [failure],
        profile: profile,
        roleAnswers: roleAnswers,
      );
      await _open(tester, 'mai@shop.com');
      await _pick(tester, 'พนักงานแพ็คของ');
      await _submit(tester);
      expect(scoped.memberRoleUpdates, hasLength(1), reason: 'never retried');
      return scoped;
    }

    String? groupValue(WidgetTester tester) =>
        tester.widget<RadioGroup<String>>(find.byType(RadioGroup<String>)).groupValue;

    testWidgets('403 TARGET_NOT_BELOW_ACTOR → copy, everything disabled, button becomes "ปิด", members re-read',
        (tester) async {
      final scoped = await refuse(tester, const ForbiddenFailure(code: 'TARGET_NOT_BELOW_ACTOR'));
      final before = scoped.memberCalls;
      expect(find.text('คุณจัดการสมาชิกคนนี้ไม่ได้ — ให้เจ้าของร้านช่วย'), findsOneWidget);
      for (final label in ['ผู้ดูแล', 'พนักงานแพ็คของ']) {
        expect(_tile(tester, label).enabled, isFalse);
      }
      expect(find.descendant(of: find.byKey(const ValueKey('member-role-save')), matching: find.text('ปิด')),
          findsOneWidget);
      expect(before, greaterThan(1), reason: 'refetched members');
      await _submit(tester);
      expect(find.byType(BottomSheet), findsNothing);
      expect(scoped.memberRoleUpdates, hasLength(1));
    });

    testWidgets('403 ROLE_EXCEEDS_ACTOR → copy, roles re-read, back to the current role, stays',
        (tester) async {
      final scoped = await refuse(tester, const ForbiddenFailure(code: 'ROLE_EXCEEDS_ACTOR'));
      expect(
        find.text('บทบาทนี้มีสิทธิ์ที่คุณไม่มี จึงมอบให้คนอื่นไม่ได้ เลือกบทบาทอื่น หรือให้เจ้าของร้านทำ'),
        findsOneWidget,
      );
      expect(scoped.rolesCalls, greaterThan(1));
      expect(groupValue(tester), 'rol_staff');
      expect(find.byType(BottomSheet), findsOneWidget);
    });

    testWidgets('403 FORBIDDEN, still a manage_members holder → Owner-only copy, re-reads, stays',
        (tester) async {
      final scoped = await refuse(
        tester,
        const ForbiddenFailure(code: 'FORBIDDEN'),
        profile: _profile({'manage_members'}),
      );
      expect(scoped.profileCalls, greaterThan(0));
      expect(
        find.text('คุณไม่มีสิทธิ์เปลี่ยนบทบาทนี้ — เฉพาะเจ้าของร้านเท่านั้นที่ตั้งหรือเปลี่ยนบทบาทของเจ้าของร้าน'),
        findsOneWidget,
      );
      expect(scoped.rolesCalls, greaterThan(1));
      expect(find.byType(BottomSheet), findsOneWidget);
    });

    testWidgets('403 FORBIDDEN and manage_members is gone → sheet closes + "คุณไม่มีสิทธิ์จัดการสมาชิกแล้ว"',
        (tester) async {
      await refuse(tester, const ForbiddenFailure(code: 'FORBIDDEN'), profile: _profile(const {}));
      expect(find.byType(BottomSheet), findsNothing);
      expect(find.text('คุณไม่มีสิทธิ์จัดการสมาชิกแล้ว'), findsOneWidget);
    });

    testWidgets('404 → sheet closes, toast, members re-read', (tester) async {
      final scoped = await refuse(tester, const NotFoundFailure());
      expect(find.byType(BottomSheet), findsNothing);
      expect(find.text('สมาชิกคนนี้ไม่ได้อยู่ในร้านแล้ว'), findsOneWidget);
      expect(scoped.memberCalls, greaterThan(1));
    });

    testWidgets('409 LAST_OWNER → copy, back to the current role', (tester) async {
      await refuse(tester, const ConflictFailure(code: 'LAST_OWNER'));
      expect(
        find.text('เปลี่ยนไม่ได้ เพราะร้านต้องมีเจ้าของร้านอย่างน้อย 1 คน — ตั้งคนอื่นเป็นเจ้าของร้านก่อน แล้วค่อยเปลี่ยน'),
        findsOneWidget,
      );
      expect(groupValue(tester), 'rol_staff');
    });

    testWidgets('409 busy → copy, the choice is kept and the button works again', (tester) async {
      await refuse(tester, const BusyFailure());
      expect(find.text('ร้านนี้กำลังมีการแก้ไขอื่นอยู่ ลองใหม่อีกครั้งในไม่กี่วินาที'), findsOneWidget);
      expect(groupValue(tester), 'rol_pack');
      expect(_saveButton(tester).onPressed, isNotNull);
    });

    testWidgets('422 ROLE_INVALID → copy, roles re-read, back to the current role', (tester) async {
      final scoped = await refuse(tester, const ValidationFailure(code: 'ROLE_INVALID'));
      expect(find.text('บทบาทที่เลือกใช้ไม่ได้แล้ว กรุณาเลือกใหม่อีกครั้ง'), findsOneWidget);
      expect(scoped.rolesCalls, greaterThan(1));
      expect(groupValue(tester), 'rol_staff');
    });

    testWidgets('★ UX01 · 429 → "ทำรายการกับสมาชิกถี่เกินไป กรุณารอ {mm:ss} …", counts down, button held',
        (tester) async {
      await refuse(tester, const ThrottledFailure(retryAfterSeconds: 90));
      expect(find.text('ทำรายการกับสมาชิกถี่เกินไป กรุณารอ 01:30 แล้วลองใหม่'), findsOneWidget);
      expect(_saveButton(tester).onPressed, isNull);
      expect(groupValue(tester), 'rol_pack');
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('ทำรายการกับสมาชิกถี่เกินไป กรุณารอ 01:29 แล้วลองใหม่'), findsOneWidget);
      await tester.pump(const Duration(seconds: 90));
      expect(find.textContaining('ทำรายการกับสมาชิกถี่เกินไป'), findsNothing);
      expect(_saveButton(tester).onPressed, isNotNull);
    });

    testWidgets('network / 5xx → generic copy, the choice is kept', (tester) async {
      await refuse(tester, const ServerFailure());
      expect(find.text('เปลี่ยนบทบาทไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'), findsOneWidget);
      expect(groupValue(tester), 'rol_pack');
      expect(_saveButton(tester).onPressed, isNotNull);
    });
  });
}
