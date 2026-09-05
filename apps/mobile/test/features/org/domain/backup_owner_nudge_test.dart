// T-002-M3 — D-030's nudge, as a decision table (ux-wireframe §7).
//
// Every case here is a way of NOT saying something untrue. The banner claims
// "you are the only Owner", and that claim is only available when the whole
// list has been read.
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/org/domain/backup_owner_nudge.dart';
import 'package:mobile/features/org/domain/entities/org_entities.dart';

MemberRow _member({
  String id = 'usr_1',
  bool isMe = false,
  bool isOwner = false,
  String status = 'active',
  String? roleKey = 'staff',
}) {
  return MemberRow(
    userId: id,
    email: '$id@shop.com',
    roleName: 'Role',
    roleKey: roleKey,
    status: status,
    isMe: isMe,
    isOwner: isOwner,
  );
}

void main() {
  test('★ one Owner and it is me, on a complete list — show it', () {
    expect(
      shouldShowBackupOwnerNudge(
        members: [
          _member(id: 'usr_1', isMe: true, isOwner: true, roleKey: 'owner'),
          _member(id: 'usr_2'),
        ],
        complete: true,
      ),
      isTrue,
    );
  });

  test('★ an incomplete list never warns — a partial count is not a count', () {
    // The exact case ux calls out: 25 of 60 members loaded, one Owner among
    // them. There may be three more on page two.
    expect(
      shouldShowBackupOwnerNudge(
        members: [_member(id: 'usr_1', isMe: true, isOwner: true, roleKey: 'owner')],
        complete: false,
      ),
      isFalse,
    );
  });

  test('two Owners — nothing to warn about', () {
    expect(
      shouldShowBackupOwnerNudge(
        members: [
          _member(id: 'usr_1', isMe: true, isOwner: true, roleKey: 'owner'),
          _member(id: 'usr_2', isOwner: true, roleKey: 'owner'),
        ],
        complete: true,
      ),
      isFalse,
    );
  });

  test('★ the sole Owner is somebody else — not my banner', () {
    // The copy says "คุณ" and offers to invite a second Owner. Shown to a
    // Staff member it would be both false and unactionable.
    expect(
      shouldShowBackupOwnerNudge(
        members: [
          _member(id: 'usr_1', isOwner: true, roleKey: 'owner'),
          _member(id: 'usr_2', isMe: true),
        ],
        complete: true,
      ),
      isFalse,
    );
  });

  test('★ a revoked Owner is not an Owner', () {
    // Otherwise a shop whose second Owner was removed keeps counting them,
    // and the one person who can act never hears about it.
    expect(
      shouldShowBackupOwnerNudge(
        members: [
          _member(id: 'usr_1', isMe: true, isOwner: true, roleKey: 'owner'),
          _member(id: 'usr_2', isOwner: true, roleKey: 'owner', status: 'revoked'),
        ],
        complete: true,
      ),
      isTrue,
    );
  });

  test('★ ownership is read from isOwner, never from roleKey', () {
    // The deviation from ux's literal rule, pinned: a custom F-003 role that
    // carries `full_access` makes somebody an Owner, and the server says so
    // through `isOwner`. Counting `roleKey == "owner"` would miss this second
    // Owner and warn a shop that has two.
    expect(
      shouldShowBackupOwnerNudge(
        members: [
          _member(id: 'usr_1', isMe: true, isOwner: true, roleKey: 'owner'),
          _member(id: 'usr_2', isOwner: true, roleKey: null),
        ],
        complete: true,
      ),
      isFalse,
    );
  });

  test('an empty or Owner-less list says nothing', () {
    expect(shouldShowBackupOwnerNudge(members: const [], complete: true), isFalse);
    expect(
      shouldShowBackupOwnerNudge(members: [_member(isMe: true)], complete: true),
      isFalse,
    );
  });
}
