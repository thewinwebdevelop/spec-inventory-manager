// T-002-M3 — S8 on mobile (ux-wireframe §9.1).
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/org/domain/repositories/org_repository.dart';
import 'package:mobile/features/org/presentation/screens/invite_link_screen.dart';

import '../harness.dart';

final _invite = IssuedInvite(
  inviteUrl: 'https://app.omnistock.test/invite?token=raw-token-value',
  email: 'malee@shop.com',
  expiresAt: DateTime.utc(2026, 8, 9, 7, 30),
);

void main() {
  testWidgets('★ the one-time warning is on screen before anything else', (tester) async {
    await pumpScreen(tester, InviteLinkScreen(invite: _invite), activeOrg: ownerOrg);

    expect(find.textContaining('ลิงก์นี้แสดงครั้งเดียว'), findsOneWidget);
    // ux settled that the strip is the ONLY gate — no dialog blocks closing
    // (user decision 2026-07-28). A confirm here would train people to
    // dismiss it.
    expect(find.byType(Dialog), findsNothing);
  });

  testWidgets('★ nothing anywhere offers to copy the OLD link', (tester) async {
    // There is no old link to copy: the server stores only the hash (D-018)
    // and a reissue kills the previous one (D-027). ux forbids the phrase
    // outright.
    await pumpScreen(tester, InviteLinkScreen(invite: _invite), activeOrg: ownerOrg);

    expect(find.textContaining('คัดลอกลิงก์เดิม'), findsNothing);
  });

  testWidgets('the link is shown in full and is selectable by hand', (tester) async {
    await pumpScreen(tester, InviteLinkScreen(invite: _invite), activeOrg: ownerOrg);

    expect(find.text(_invite.inviteUrl), findsOneWidget);
    // §14: somebody whose clipboard permission is refused can still select it.
    expect(find.byType(SelectableText), findsOneWidget);
  });

  testWidgets('★ the deadline comes from the response, in the shop\'s timezone', (tester) async {
    await pumpScreen(tester, InviteLinkScreen(invite: _invite), activeOrg: ownerOrg);

    expect(find.textContaining('ลิงก์ใช้ได้ถึง 9 ส.ค. 2026, 14:30'), findsOneWidget);
    expect(find.textContaining('7 วัน'), findsNothing);
    expect(find.textContaining('24 ชั่วโมง'), findsNothing);
  });

  testWidgets('★ copy puts the real link on the clipboard, and says so', (tester) async {
    final copied = <String>[];
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      (call) async {
        if (call.method == 'Clipboard.setData') {
          copied.add((call.arguments as Map)['text'] as String);
        }
        return null;
      },
    );
    addTearDown(() => tester.binding.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, null));

    await pumpScreen(tester, InviteLinkScreen(invite: _invite), activeOrg: ownerOrg);
    await tester.tap(find.text('คัดลอกลิงก์'));
    await tester.pumpAndSettle();

    expect(copied.single, _invite.inviteUrl);
    expect(find.text('คัดลอกลิงก์แล้ว'), findsOneWidget);
  });

  testWidgets('the copy button carries a spoken label', (tester) async {
    // §14: icon buttons need one — "คัดลอกลิงก์คำเชิญ".
    await pumpScreen(tester, InviteLinkScreen(invite: _invite), activeOrg: ownerOrg);

    expect(
      find.bySemanticsLabel(RegExp('คัดลอกลิงก์คำเชิญ')),
      findsOneWidget,
    );
  });
}
