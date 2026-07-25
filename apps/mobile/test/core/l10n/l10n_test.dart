import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/core/l10n/l10n.dart';

/// R4 (docs/architecture/refactor-plan.md §4, mobile.md §3.7) — D-014: "l10n
/// = keys resolve". Two things pinned here:
/// 1. The context-free [l10n] getter (`application/` controllers) resolves
///    every key this batch migrated, with the exact byte-for-byte Thai copy
///    `AuthTh` used to hold (spot-checked across every section of the old
///    const class, not just one).
/// 2. `AppLocalizations.delegate` + a real `Localizations` widget tree
///    resolve the SAME instance via `AppLocalizations.of(context)` (the
///    `presentation/` path) — proves the gen_l10n wiring (`l10n.yaml`,
///    `pubspec.yaml`'s `flutter: generate: true`) actually produces a
///    working delegate, not just that the Thai class compiles standalone.
void main() {
  group('l10n getter (application/ controllers) — spot-check every migrated section', () {
    test('signup', () {
      expect(l10n.authSignupTitle, 'สมัครใช้งาน OmniStock');
      expect(l10n.authSignupErrorEmailInvalid, 'รูปแบบอีเมลไม่ถูกต้อง');
    });

    test('login', () {
      expect(l10n.authLoginTitle, 'เข้าสู่ระบบ');
      expect(l10n.authLoginErrorInvalidCredentials, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    });

    test('throttle (parameterized keys)', () {
      expect(l10n.authThrottleBannerLong('02', '05'),
          'ลองเข้าสู่ระบบถี่เกินไป กรุณารอสักครู่แล้วลองใหม่ · เหลือ 02:05 นาที');
      expect(l10n.authThrottleBannerShort(15), 'รอสักครู่แล้วลองใหม่ · เหลือ 15 วินาที');
    });

    test('sessions', () {
      expect(l10n.authSessionsTitle, 'อุปกรณ์ที่เข้าสู่ระบบ');
      expect(l10n.authSessionsLastActive('5 นาทีที่แล้ว'), 'ใช้งานล่าสุด: 5 นาทีที่แล้ว');
    });

    test('change password', () {
      expect(l10n.authChangePasswordSectionTitle, 'เปลี่ยนรหัสผ่าน');
      expect(l10n.authChangePasswordSuccessToast, 'เปลี่ยนรหัสผ่านแล้ว · อุปกรณ์อื่นถูกออกจากระบบเพื่อความปลอดภัย');
    });

    test('common (shared beyond auth)', () {
      expect(l10n.commonPasswordShow, 'แสดงรหัสผ่าน');
      expect(l10n.commonRetry, 'ลองใหม่');
    });

    test('bootstrap', () {
      expect(l10n.authBootstrapLoading, 'กำลังตรวจสอบสถานะการเข้าสู่ระบบ...');
    });

    test('central ApiFailure fallback keys (R3) resolve too', () {
      expect(l10n.errorNetwork, isNotEmpty);
      expect(l10n.errorServer, isNotEmpty);
    });
  });

  group('AppLocalizations.of(context) — presentation/ path, real delegate wiring', () {
    testWidgets('resolves the SAME Thai copy through a real Localizations widget tree', (tester) async {
      late AppLocalizations captured;
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Builder(
            builder: (context) {
              captured = AppLocalizations.of(context);
              return const SizedBox.shrink();
            },
          ),
        ),
      );

      expect(captured.authLoginTitle, 'เข้าสู่ระบบ');
      expect(captured.localeName, 'th');
    });
  });
}
