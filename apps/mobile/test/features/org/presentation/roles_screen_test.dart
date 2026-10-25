// T-003-M05 (EM3) — R1 รายการบทบาท + R2 เลือกต้นแบบ, and the two entry points.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/error/api_failure.dart';
import 'package:mobile/core/session/session_controller.dart';
import 'package:mobile/core/session/session_state.dart';
import 'package:mobile/core/ui/skeleton.dart';
import 'package:mobile/features/org/application/org_providers.dart';
import 'package:mobile/features/org/domain/entities/org_entities.dart';
import 'package:mobile/features/org/domain/entities/role_entities.dart';
import 'package:mobile/features/org/presentation/screens/members_screen.dart';
import 'package:mobile/features/org/presentation/screens/org_profile_screen.dart';
import 'package:mobile/features/org/presentation/screens/role_template_screen.dart';
import 'package:mobile/features/org/presentation/screens/roles_screen.dart';

import '../harness.dart';
import '../org_fakes.dart';

const rolesOrg = ActiveOrg(
  orgId: 'org_1',
  name: 'ร้านหอมกรุ่นเบเกอรี่',
  capabilities: {'manage_roles'},
);

const _catalog = CapabilityCatalogView(items: [
  CapabilityCatalogEntry(key: 'manage_products', labelTh: 'จัดการสินค้า', selectable: true),
  CapabilityCatalogEntry(key: 'manage_stock', labelTh: 'จัดการสต๊อก', selectable: true),
  CapabilityCatalogEntry(key: 'manage_orders', labelTh: 'จัดการออเดอร์', selectable: true),
  CapabilityCatalogEntry(key: 'manage_members', labelTh: 'จัดการสมาชิกและคำเชิญ', selectable: true),
]);

const _ok = RoleVerdict(allowed: true);

RoleDetailView _role(
  String id,
  String name, {
  String? key,
  bool customized = true,
  bool isSystem = false,
  List<String> caps = const ['manage_products'],
  int members = 0,
  int pending = 0,
  RoleLastEditedInfo? lastEdited,
  RoleVerdict canEdit = _ok,
  RoleVerdict canClone = _ok,
}) =>
    RoleDetailView(
      id: id,
      name: name,
      roleKey: key,
      nameCustomized: customized,
      isSystem: isSystem,
      capabilities: caps,
      usage: RoleUsage(activeMembers: members, pendingInvitations: pending),
      lastEdited: lastEdited,
      canEdit: canEdit,
      canDelete: _ok,
      canClone: canClone,
    );

final _owner = _role(
  'rol_owner', 'Owner',
  key: 'owner', customized: false, isSystem: true, caps: const ['full_access'], members: 1,
  canEdit: const RoleVerdict(allowed: false, reason: 'role_locked'),
  canClone: const RoleVerdict(allowed: false, reason: 'owner_role'),
);
final _admin = _role(
  'rol_admin', 'Admin',
  key: 'admin', customized: false, caps: const ['manage_products', 'manage_stock', 'manage_orders', 'manage_members'],
  members: 2,
  lastEdited: RoleLastEditedInfo(at: DateTime.utc(2026, 6, 23, 7, 30), kind: 'me'),
);
final _staff = _role('rol_staff', 'Staff', key: 'staff', customized: false, members: 3, pending: 1);
final _external = _role(
  'rol_ext', 'บัญชีภายนอก',
  caps: const ['manage_products', 'manage_stock', 'manage_orders', 'manage_members'],
  canEdit: const RoleVerdict(allowed: false, reason: 'exceeds_your_permissions'),
  canClone: const RoleVerdict(allowed: false, reason: 'exceeds_your_permissions'),
  lastEdited: RoleLastEditedInfo(at: DateTime.utc(2026, 9, 2, 2, 10), kind: 'former_member'),
);

RoleDetailsPage _page(List<RoleDetailView> items, {RoleVerdict canCreate = _ok, int limit = 30}) =>
    RoleDetailsPage(items: items, canCreate: canCreate, limit: limit);

Future<FakeOrgScoped> _pump(
  WidgetTester tester, {
  RoleDetailsPage? page,
  ApiFailure? detailsFailure,
  ApiFailure? catalogFailure,
  OrgProfileView? profile,
  Duration delay = Duration.zero,
  ValueChanged<RoleDetailView>? onOpenRole,
  ValueChanged<String?>? onCreateNext,
  ActiveOrg org = rolesOrg,
}) async {
  final scoped = FakeOrgScoped(
    roleDetails: page ?? _page([_owner, _admin, _staff, _external]),
    roleDetailsFailure: detailsFailure,
    catalog: _catalog,
    catalogFailure: catalogFailure,
    profile: profile ??
        const OrgProfileView(
          id: 'org_1', name: 'ร้านหอมกรุ่นเบเกอรี่', taxProfileComplete: true,
          myRoleId: 'rol_owner',
        ),
    delay: delay,
  );
  await pumpScreen(
    tester,
    RolesScreen(onOpenRole: onOpenRole, onCreateNext: onCreateNext),
    overrides: [orgScopedRepositoryProvider.overrideWithValue(scoped)],
    activeOrg: org,
  );
  return scoped;
}

Finder _createButton() => find.widgetWithText(ElevatedButton, 'สร้างบทบาท');

void main() {
  group('R1 states', () {
    testWidgets('loading — skeleton, and "สร้างบทบาท" is disabled until both reads are in', (tester) async {
      await _pump(tester, delay: const Duration(milliseconds: 50));
      await tester.pump();

      expect(find.byType(SessionListSkeleton), findsOneWidget);
      expect(tester.widget<ElevatedButton>(_createButton()).onPressed, isNull);
      await tester.pumpAndSettle();
    });

    testWidgets('data — title, intro, counter, rows with the §0.2 lines and badges', (tester) async {
      await _pump(tester);
      await tester.pumpAndSettle();

      expect(find.text('บทบาทและสิทธิ์'), findsOneWidget); // AppBar
      expect(find.text('บทบาทคือชุดสิทธิ์ที่มอบให้สมาชิก เช่น พนักงานแพ็คของทำอะไรได้บ้าง'), findsOneWidget);
      expect(find.text('มอบบทบาทให้แต่ละคนได้ที่หน้าสมาชิก'), findsOneWidget);
      expect(find.text('ใช้ไป 4 จาก 30 บทบาท'), findsOneWidget);

      // System names translate by key; "(รวมคุณ)" only on the viewer's own role.
      expect(find.text('เจ้าของร้าน'), findsOneWidget);
      expect(find.text('สมาชิก 1 คน (รวมคุณ)'), findsOneWidget);
      expect(find.text('สมาชิก 2 คน'), findsOneWidget);
      expect(find.text('สมาชิก 3 คน · คำเชิญที่ยังไม่ปิด 1 ใบ'), findsOneWidget);
      expect(find.text('ยังไม่มีสมาชิกใช้'), findsOneWidget);
      // Last edited — its own line.
      expect(find.text('ค่าเริ่มต้นของระบบ'), findsNWidgets(2));
      expect(find.text('แก้ไขล่าสุดโดยคุณ · 23 มิ.ย. 2026, 14:30'), findsOneWidget);
      expect(find.text('แก้ไขล่าสุดโดยอดีตสมาชิก · 2 ก.ย. 2026, 09:10'), findsOneWidget);
      // Customized name is shown verbatim.
      expect(find.text('บัญชีภายนอก'), findsOneWidget);

      // Badges: lock for the system role, read-only for the exceeds verdict.
      expect(find.text('ล็อก'), findsOneWidget);
      expect(find.text('ดูได้อย่างเดียว'), findsOneWidget);
    });

    testWidgets('rows are in SERVER order', (tester) async {
      await _pump(tester, page: _page([_staff, _owner, _admin]));
      await tester.pumpAndSettle();

      double y(String id) => tester.getTopLeft(find.byKey(ValueKey('role-row-$id'))).dy;
      expect(y('rol_staff') < y('rol_owner'), isTrue);
      expect(y('rol_owner') < y('rol_admin'), isTrue);
    });

    testWidgets('error — details fetch failed: panel + retry that refetches', (tester) async {
      final scoped = await _pump(tester, detailsFailure: const ServerFailure());
      await tester.pumpAndSettle();

      expect(find.text('โหลดรายการบทบาทไม่สำเร็จ'), findsOneWidget);
      expect(find.text('ตรวจการเชื่อมต่อแล้วลองใหม่'), findsOneWidget);
      expect(find.text('ใช้ไป', skipOffstage: false), findsNothing);
      expect(tester.widget<ElevatedButton>(_createButton()).onPressed, isNull);

      final before = scoped.roleDetailsCalls;
      await tester.tap(find.text('ลองใหม่'));
      await tester.pumpAndSettle();
      expect(scoped.roleDetailsCalls, before + 1);
      expect(scoped.catalogCalls, greaterThan(1));
    });

    testWidgets('error — catalog fetch failed (details fine) is ALSO the error state', (tester) async {
      await _pump(tester, catalogFailure: const ServerFailure());
      await tester.pumpAndSettle();

      expect(find.text('โหลดรายการบทบาทไม่สำเร็จ'), findsOneWidget);
      expect(find.byKey(const ValueKey('role-row-rol_owner')), findsNothing);
      expect(tester.widget<ElevatedButton>(_createButton()).onPressed, isNull);
    });

    testWidgets('empty list is the error state, not an empty state (a shop always has an Owner)',
        (tester) async {
      await _pump(tester, page: _page(const []));
      await tester.pumpAndSettle();

      expect(find.text('โหลดรายการบทบาทไม่สำเร็จ'), findsOneWidget);
    });

    testWidgets('writes_disabled — info banner on top, list still readable, create disabled with NO limit copy',
        (tester) async {
      await _pump(tester, page: _page([_owner, _admin], canCreate: const RoleVerdict(allowed: false, reason: 'writes_disabled')));
      await tester.pumpAndSettle();

      expect(find.text('ยังสร้างหรือแก้บทบาทไม่ได้ในตอนนี้'), findsOneWidget);
      expect(find.byKey(const ValueKey('role-row-rol_admin')), findsOneWidget);
      expect(tester.widget<ElevatedButton>(_createButton()).onPressed, isNull);
      expect(find.textContaining('ครบ'), findsNothing);
    });

    testWidgets('role_limit_reached — disabled + the limit sentence under it; no banner', (tester) async {
      await _pump(tester, page: _page([_owner], canCreate: const RoleVerdict(allowed: false, reason: 'role_limit_reached'), limit: 30));
      await tester.pumpAndSettle();

      expect(find.text('ร้านนี้มีบทบาทครบ 30 บทบาทแล้ว ลบบทบาทที่ไม่ใช้ก่อน จึงจะสร้างใหม่ได้'), findsOneWidget);
      expect(find.text('ยังสร้างหรือแก้บทบาทไม่ได้ในตอนนี้'), findsNothing);
      expect(tester.widget<ElevatedButton>(_createButton()).onPressed, isNull);
    });

    testWidgets('an unknown canCreate reason still disables, with the generic sentence (no raw key)',
        (tester) async {
      await _pump(tester, page: _page([_owner], canCreate: const RoleVerdict(allowed: false, reason: 'brand_new')));
      await tester.pumpAndSettle();

      expect(tester.widget<ElevatedButton>(_createButton()).onPressed, isNull);
      expect(find.textContaining('brand_new'), findsNothing);
    });

    testWidgets('★ the create button follows ONLY the server verdict — not the viewer capabilities',
        (tester) async {
      // Viewer holds full_access + manage_roles; the server says no.
      await _pump(
        tester,
        page: _page([_owner], canCreate: const RoleVerdict(allowed: false, reason: 'role_limit_reached')),
        org: const ActiveOrg(orgId: 'org_1', name: 'x', capabilities: {'full_access', 'manage_roles'}),
      );
      await tester.pumpAndSettle();
      expect(tester.widget<ElevatedButton>(_createButton()).onPressed, isNull);
    });

    testWidgets('rows are not tappable (no ›) while R3/R4 are not wired', (tester) async {
      await _pump(tester);
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.chevron_right), findsNothing);
    });

    testWidgets('rows open R3/R4 through the seam once it is wired', (tester) async {
      RoleDetailView? opened;
      await _pump(tester, onOpenRole: (r) => opened = r);
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.chevron_right), findsNWidgets(4));
      await tester.tap(find.byKey(const ValueKey('role-row-rol_admin')));
      expect(opened?.id, 'rol_admin');
    });

    testWidgets('the screen leaves when manage_roles is taken away (ไม่ค้างบนจอที่เข้าไม่ได้)',
        (tester) async {
      final scoped = FakeOrgScoped(roleDetails: _page([_owner]), catalog: _catalog);
      final container = await pumpScreen(
        tester,
        Builder(
          builder: (context) => ElevatedButton(
            onPressed: () => openRolesScreen(context),
            child: const Text('open'),
          ),
        ),
        overrides: [orgScopedRepositoryProvider.overrideWithValue(scoped)],
        activeOrg: rolesOrg,
      );
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      expect(find.text('ใช้ไป 1 จาก 30 บทบาท'), findsOneWidget);

      container.read(sessionControllerProvider.notifier).capabilitiesLearned(
        orgId: 'org_1',
        capabilities: const {'manage_members'},
      );
      await tester.pumpAndSettle();

      expect(find.text('ใช้ไป 1 จาก 30 บทบาท'), findsNothing);
      expect(find.text('open'), findsOneWidget);
    });
  });

  group('R2 flow', () {
    testWidgets('สร้างบทบาท → R2 full-screen with the lead, options and the owner note', (tester) async {
      await _pump(tester);
      await tester.pumpAndSettle();

      await tester.tap(_createButton());
      await tester.pumpAndSettle();

      expect(find.text('สร้างบทบาทใหม่'), findsOneWidget); // AppBar
      expect(find.text('เริ่มจากบทบาทที่ใกล้เคียงที่สุด แล้วค่อยปรับสิทธิ์'), findsOneWidget);
      // Owner is not offered at all; the others are, and blank is last.
      expect(find.byKey(const ValueKey('template-rol_owner')), findsNothing);
      expect(find.byKey(const ValueKey('template-rol_admin')), findsOneWidget);
      expect(find.byKey(const ValueKey('template-rol_staff')), findsOneWidget);
      expect(find.byKey(const ValueKey('template-blank')), findsOneWidget);
      final note = find.text('บทบาทเจ้าของร้านใช้เป็นต้นแบบไม่ได้ เพราะสิทธิ์ทำได้ทุกอย่างมีได้เฉพาะเจ้าของร้าน');
      await tester.scrollUntilVisible(note, 100);
      expect(note, findsOneWidget);
    });

    testWidgets('R2 reuses R1\'s data — no second fetch', (tester) async {
      final scoped = await _pump(tester);
      await tester.pumpAndSettle();
      final details = scoped.roleDetailsCalls;
      final catalog = scoped.catalogCalls;

      await tester.tap(_createButton());
      await tester.pumpAndSettle();

      expect(scoped.roleDetailsCalls, details);
      expect(scoped.catalogCalls, catalog);
    });
  });

  group('R2 screen', () {
    Future<List<String?>> pumpR2(
      WidgetTester tester,
      List<RoleDetailView> roles, {
      bool wired = true,
    }) async {
      final nexts = <String?>[];
      await pumpScreen(
        tester,
        RoleTemplateScreen(
          roles: roles,
          catalog: _catalog,
          onNext: wired ? nexts.add : null,
        ),
        activeOrg: rolesOrg,
      );
      return nexts;
    }

    testWidgets('description = "{n} สิทธิ์: first 3 catalog labels…" in catalog order', (tester) async {
      await pumpR2(tester, [_owner, _admin, _staff]);

      expect(find.text('4 สิทธิ์: จัดการสินค้า, จัดการสต๊อก, จัดการออเดอร์…'), findsOneWidget);
      expect(find.text('1 สิทธิ์: จัดการสินค้า'), findsOneWidget);
      expect(find.text('ไม่ติ๊กสิทธิ์ใดไว้ก่อน เลือกเองทีละข้อ'), findsOneWidget);
    });

    testWidgets('default = cloneable role with the fewest capabilities; "ถัดไป" passes its id',
        (tester) async {
      final nexts = await pumpR2(tester, [_owner, _admin, _staff]);

      await tester.tap(find.text('ถัดไป'));
      expect(nexts, ['rol_staff']);
    });

    testWidgets('choosing "เริ่มจากว่าง" → next gets null (R3 without ?from=)', (tester) async {
      final nexts = await pumpR2(tester, [_owner, _admin, _staff]);

      await tester.tap(find.byKey(const ValueKey('template-blank')));
      await tester.pump();
      await tester.tap(find.text('ถัดไป'));
      expect(nexts, [null]);
    });

    testWidgets('no cloneable role → blank is preselected', (tester) async {
      final nexts = await pumpR2(tester, [_owner, _external]);

      await tester.tap(find.text('ถัดไป'));
      expect(nexts, [null]);
    });

    testWidgets('a role the server refuses to clone is shown disabled with its reason and cannot be picked',
        (tester) async {
      final nexts = await pumpR2(tester, [_owner, _admin, _external]);

      expect(find.text('บทบาทนี้มีสิทธิ์ที่คุณไม่มี จึงใช้เป็นต้นแบบไม่ได้'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('template-rol_ext')));
      await tester.pump();
      await tester.tap(find.text('ถัดไป'));
      expect(nexts, ['rol_admin']);
    });

    testWidgets('an unknown clone refusal gets the generic sentence, never the raw reason', (tester) async {
      await pumpR2(tester, [
        _role('rol_x', 'X', canClone: const RoleVerdict(allowed: false, reason: 'brand_new')),
      ]);

      expect(find.text('ใช้บทบาทนี้เป็นต้นแบบไม่ได้'), findsOneWidget);
      expect(find.textContaining('brand_new'), findsNothing);
    });

    testWidgets('"ถัดไป" is disabled while R3 is not wired (no button onto nothing)', (tester) async {
      await pumpR2(tester, [_staff], wired: false);

      expect(tester.widget<ElevatedButton>(find.widgetWithText(ElevatedButton, 'ถัดไป')).onPressed, isNull);
    });
  });

  group('entry points (reachability)', () {
    testWidgets('ข้อมูลร้าน: row appears for manage_roles with its sub, and opens R1', (tester) async {
      final scoped = FakeOrgScoped(roleDetails: _page([_owner]), catalog: _catalog);
      await pumpScreen(
        tester,
        const OrgProfileScreen(),
        overrides: [orgScopedRepositoryProvider.overrideWithValue(scoped)],
        activeOrg: rolesOrg,
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const ValueKey('roles-entry-row')), findsOneWidget);
      expect(find.text('กำหนดว่าแต่ละบทบาททำอะไรได้'), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey('roles-entry-row')));
      await tester.pumpAndSettle();
      expect(find.text('ใช้ไป 1 จาก 30 บทบาท'), findsOneWidget);
    });

    testWidgets('ข้อมูลร้าน: no row without manage_roles', (tester) async {
      await pumpScreen(
        tester,
        const OrgProfileScreen(),
        overrides: [orgScopedRepositoryProvider.overrideWithValue(FakeOrgScoped())],
        activeOrg: adminOrg, // manage_members only
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const ValueKey('roles-entry-row')), findsNothing);
      expect(find.text('กำหนดว่าแต่ละบทบาททำอะไรได้'), findsNothing);
    });

    testWidgets('ข้อมูลร้าน: an Owner (full_access wildcard) gets the row', (tester) async {
      await pumpScreen(
        tester,
        const OrgProfileScreen(),
        overrides: [orgScopedRepositoryProvider.overrideWithValue(FakeOrgScoped())],
        activeOrg: const ActiveOrg(orgId: 'org_1', name: 'x', capabilities: {'full_access'}),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const ValueKey('roles-entry-row')), findsOneWidget);
    });

    testWidgets('สมาชิก: "จัดการบทบาท" tertiary button appears for manage_roles and opens R1', (tester) async {
      final scoped = FakeOrgScoped(roleDetails: _page([_owner]), catalog: _catalog);
      await pumpScreen(
        tester,
        const MembersScreen(),
        overrides: [orgScopedRepositoryProvider.overrideWithValue(scoped)],
        activeOrg: const ActiveOrg(
          orgId: 'org_1', name: 'x', capabilities: {'manage_members', 'manage_roles'},
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('จัดการบทบาท'), findsOneWidget);
      await tester.tap(find.text('จัดการบทบาท'));
      await tester.pumpAndSettle();
      expect(find.text('ใช้ไป 1 จาก 30 บทบาท'), findsOneWidget);
    });

    testWidgets('สมาชิก: no button without manage_roles', (tester) async {
      await pumpScreen(
        tester,
        const MembersScreen(),
        overrides: [orgScopedRepositoryProvider.overrideWithValue(FakeOrgScoped())],
        activeOrg: adminOrg,
      );
      await tester.pumpAndSettle();

      expect(find.text('จัดการบทบาท'), findsNothing);
    });
  });
}
