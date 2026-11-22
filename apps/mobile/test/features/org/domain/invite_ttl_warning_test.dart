// T-003-M09 (D-039) — the short-link warning decides ONLY from the server's
// `RoleRow.inviteTtlHours`. Never `key`, never `grantsOwnership`, never a
// hard-coded 24/168.
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/org/domain/entities/org_entities.dart';
import 'package:mobile/features/org/domain/invite_ttl_warning.dart';

RoleRow _r(String id, {int? ttl, String? key, bool owner = false}) =>
    RoleRow(id: id, name: id, key: key, grantsOwnership: owner, inviteTtlHours: ttl);

void main() {
  test('★ a custom role the server gives a shorter TTL warns — no key involved', () {
    final roles = [_r('custom_elevated', ttl: 24), _r('staff', ttl: 168, key: 'staff')];
    expect(showsShortLinkWarning(roles.first, roles), isTrue);
  });

  test('the role with the longest published TTL does not warn', () {
    final roles = [_r('a', ttl: 24), _r('b', ttl: 168)];
    expect(showsShortLinkWarning(roles.last, roles), isFalse);
  });

  test('★ key == admin with NO inviteTtlHours does not warn (the slug is not a fact)', () {
    final roles = [_r('admin', key: 'admin'), _r('staff', ttl: 168, key: 'staff')];
    expect(showsShortLinkWarning(roles.first, roles), isFalse);
  });

  test('★ grantsOwnership without inviteTtlHours does not warn either', () {
    final roles = [_r('owner', key: 'owner', owner: true), _r('staff', ttl: 168)];
    expect(showsShortLinkWarning(roles.first, roles), isFalse);
  });

  test('every published TTL equal → nothing is "shorter than usual"', () {
    final roles = [_r('a', ttl: 24), _r('b', ttl: 24)];
    expect(showsShortLinkWarning(roles.first, roles), isFalse);
  });

  test('not a fixed threshold: 100h among 200h warns, 24h alone does not', () {
    final roles = [_r('a', ttl: 100), _r('b', ttl: 200)];
    expect(showsShortLinkWarning(roles.first, roles), isTrue);
    final solo = [_r('a', ttl: 24)];
    expect(showsShortLinkWarning(solo.first, solo), isFalse);
  });

  test('nothing selected → no warning', () {
    expect(showsShortLinkWarning(null, [_r('a', ttl: 24), _r('b', ttl: 168)]), isFalse);
  });
}
