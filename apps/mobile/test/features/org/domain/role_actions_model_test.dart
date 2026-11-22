// T-003-M08 — what R3/R4's clone and delete controls do, decided from the
// server's verdicts + `isSystem` only (ux §0.3 (ก) "ลำดับบนจอ R4" + the R4
// table). Dart twin of web `role-actions-model.ts`; same cases.
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/org/domain/entities/role_entities.dart';
import 'package:mobile/features/org/domain/role_actions_model.dart';

const _ok = RoleVerdict(allowed: true);
RoleVerdict _no(String reason) => RoleVerdict(allowed: false, reason: reason);

void main() {
  group('cloneAffordance (R4 only)', () {
    test('the Owner role never offers a clone, whatever the verdict says (AC-3.2)', () {
      expect(cloneAffordance(canClone: _ok, isSystem: true), isA<CloneHidden>());
      expect(cloneAffordance(canClone: _no('owner_role'), isSystem: true), isA<CloneHidden>());
    });

    test('allowed → an enabled button inside the reason banner', () {
      expect(cloneAffordance(canClone: _ok, isSystem: false), isA<CloneInBanner>());
    });

    test('writes_disabled → disabled in "การจัดการอื่น" (the top banner explains, no note)', () {
      final a = cloneAffordance(canClone: _no('writes_disabled'), isSystem: false);
      expect(a, isA<CloneDisabled>());
      a as CloneDisabled;
      expect(a.place, ClonePlace.section);
      expect(a.reason, isNull);
    });

    test('role_limit_reached → disabled in the banner, with its reason', () {
      final a = cloneAffordance(canClone: _no('role_limit_reached'), isSystem: false);
      a as CloneDisabled;
      expect(a.place, ClonePlace.banner);
      expect(a.reason, 'role_limit_reached');
    });

    test('any other reason, known or not → hidden (the main banner covers it)', () {
      for (final r in ['exceeds_your_permissions', 'owner_role', 'some_future_reason']) {
        expect(cloneAffordance(canClone: _no(r), isSystem: false), isA<CloneHidden>(), reason: r);
      }
    });
  });

  group('deleteAffordance (R3 and R4)', () {
    test('the Owner role never shows delete', () {
      expect(deleteAffordance(canEdit: _ok, canDelete: _ok, isSystem: true), isA<DeleteHidden>());
    });

    test('allowed → enabled (also when only EDIT is refused)', () {
      expect(deleteAffordance(canEdit: _ok, canDelete: _ok, isSystem: false), isA<DeleteEnabled>());
      expect(
        deleteAffordance(canEdit: _no('some_edit_only_reason'), canDelete: _ok, isSystem: false),
        isA<DeleteEnabled>(),
      );
    });

    test('writes_disabled → disabled with no note of its own', () {
      expect(
        deleteAffordance(canEdit: _no('writes_disabled'), canDelete: _no('writes_disabled'), isSystem: false),
        isA<DeleteDisabled>(),
      );
    });

    test('same reason as the main banner → hidden (never said twice)', () {
      for (final r in [
        'exceeds_your_permissions',
        'in_use_requires_manage_members',
        'equal_permissions_in_use',
        'some_future_reason',
      ]) {
        expect(deleteAffordance(canEdit: _no(r), canDelete: _no(r), isSystem: false), isA<DeleteHidden>(),
            reason: r);
      }
    });

    test('in_use → the R5 (ข) panel under a disabled button — on R3 (edit allowed) and R4', () {
      expect(deleteAffordance(canEdit: _ok, canDelete: _no('in_use'), isSystem: false), isA<DeleteInUse>());
      expect(
        deleteAffordance(canEdit: _no('equal_permissions_in_use'), canDelete: _no('in_use'), isSystem: false),
        isA<DeleteInUse>(),
      );
    });

    test('a different delete-only reason → blocked, carrying the RAW reason for presentation to map', () {
      final a = deleteAffordance(canEdit: _ok, canDelete: _no('history_limit_reached'), isSystem: false);
      expect((a as DeleteBlocked).reason, 'history_limit_reached');
      final u = deleteAffordance(canEdit: _ok, canDelete: _no('brand_new_reason'), isSystem: false);
      expect((u as DeleteBlocked).reason, 'brand_new_reason');
    });

    test('a refusal with no reason at all → blocked with an empty reason (generic copy), never enabled', () {
      final a = deleteAffordance(canEdit: _ok, canDelete: const RoleVerdict(allowed: false), isSystem: false);
      expect((a as DeleteBlocked).reason, '');
    });
  });

  group('inUseOnlyMe', () {
    test('only when the single active member is me and no invitation is open', () {
      const me = RoleUsage(activeMembers: 1, pendingInvitations: 0);
      expect(inUseOnlyMe(me, isMine: true), isTrue);
      expect(inUseOnlyMe(me, isMine: false), isFalse);
      expect(inUseOnlyMe(const RoleUsage(activeMembers: 2, pendingInvitations: 0), isMine: true), isFalse);
      expect(inUseOnlyMe(const RoleUsage(activeMembers: 1, pendingInvitations: 1), isMine: true), isFalse);
    });
  });
}
