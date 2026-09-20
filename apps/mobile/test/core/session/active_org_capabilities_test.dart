import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/session/session_state.dart';

/// ★ T-002-Q5 — `full_access` is a WILDCARD, and `can` has to say so.
///
/// The bug this pins shipped on web first and cost the Owner their own members
/// menu, the tax declaration, the reveal button and the rename affordance. The
/// Dart version was the same single line: `capabilities.contains(capability)`.
///
/// It survived every existing test because each one supplies its own
/// capability list — `{'manage_members'}`, `{'manage_org_settings'}` — and so
/// describes a user no shop contains. A real Owner's role carries `full_access`
/// and nothing else (`SYSTEM_ROLE_BLUEPRINT`), which is the case nobody wrote.
void main() {
  ActiveOrg org(Set<String> capabilities) =>
      ActiveOrg(orgId: 'org_1', name: 'ร้านทดสอบ', capabilities: capabilities);

  group('ActiveOrg.can', () {
    test('★ an Owner holds only full_access, and may still do everything', () {
      final owner = org({fullAccessCapability});

      expect(owner.isOwner, isTrue);
      expect(owner.can('manage_members'), isTrue);
      expect(owner.can('manage_org_settings'), isTrue);
      // Including capabilities that do not exist yet: F-003 lets people create
      // roles, and the wildcard has to keep meaning "everything" afterwards.
      expect(owner.can('whatever_f003_adds'), isTrue);
    });

    test('a Staff member gets exactly what their role lists, and no more', () {
      final staff = org({'view_products'});

      expect(staff.isOwner, isFalse);
      expect(staff.can('view_products'), isTrue);
      expect(staff.can('manage_members'), isFalse);
    });

    test('an Admin with a specific grant is not thereby an Owner', () {
      // The other direction of the same rule: holding `manage_members` must
      // not imply the wildcard, or C-1 (only an Owner may grant ownership)
      // would quietly stop holding.
      final admin = org({'manage_members', 'manage_org_settings'});

      expect(admin.can('manage_members'), isTrue);
      expect(admin.isOwner, isFalse);
      expect(admin.can('some_other_capability'), isFalse);
    });

    test('a member with no capabilities can do nothing', () {
      expect(org(const <String>{}).can('manage_members'), isFalse);
      expect(org(const <String>{}).isOwner, isFalse);
    });
  });
}
