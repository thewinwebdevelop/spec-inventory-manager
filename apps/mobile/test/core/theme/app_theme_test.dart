import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/theme/app_theme.dart';

void main() {
  group('buildAppTheme', () {
    test('light registers AppColorsX.light + light scaffold', () {
      final t = buildAppTheme();
      expect(t.brightness, Brightness.light);
      expect(t.extension<AppColorsX>(), same(AppColorsX.light));
      expect(t.scaffoldBackgroundColor, AppColors.bg);
      // primary button (light) uses the brand primary as its fill
      expect(AppColorsX.light.btnBg, AppColors.primary);
    });

    test('dark registers AppColorsX.dark + neutral-charcoal scaffold', () {
      final t = buildAppDarkTheme();
      expect(t.brightness, Brightness.dark);
      expect(t.extension<AppColorsX>(), same(AppColorsX.dark));
      expect(t.scaffoldBackgroundColor, AppColorsDark.bg);
      // dark primary button is the solid deep-green fill (NOT color.primary,
      // which is the light teal used for text/icons on dark) — §1.1c.
      expect(AppColorsX.dark.btnBg, AppColorsDark.btnBg);
      expect(AppColorsX.dark.btnBg, isNot(AppColorsX.dark.primary));
    });

    test('destructive button is a distinct token, deeper in dark than light', () {
      // §1.1c — dark destructive is a deep solid red, not the washed `danger`.
      expect(AppColorsX.light.btnDangerBg, AppColors.btnDangerBg);
      expect(AppColorsX.dark.btnDangerBg, AppColorsDark.btnDangerBg);
      expect(AppColorsX.dark.btnDangerBg, isNot(AppColorsX.dark.danger));
      expect(AppColorsX.dark.btnDangerBg, isNot(AppColorsX.light.btnDangerBg));
    });

    test('shimmer highlight differs from the skeleton base', () {
      // §2 — the sweeping band must contrast with surfaceMuted to be visible.
      expect(AppColorsX.light.shimmerHi, isNot(AppColorsX.light.surfaceMuted));
      expect(AppColorsX.dark.shimmerHi, isNot(AppColorsX.dark.surfaceMuted));
    });
  });

  testWidgets('context.appColors resolves per active theme', (tester) async {
    late AppColorsX seen;
    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(),
        darkTheme: buildAppDarkTheme(),
        themeMode: ThemeMode.dark,
        home: Builder(
          builder: (context) {
            seen = context.appColors;
            return const SizedBox.shrink();
          },
        ),
      ),
    );

    // Under the dark theme, a widget reading context.appColors gets the dark
    // token set — the seam that makes every migrated widget adapt.
    expect(seen.dangerBg, AppColorsDark.dangerBg);
    expect(seen.text, AppColorsDark.text);
    expect(seen.bg, AppColorsDark.bg);
  });
}
