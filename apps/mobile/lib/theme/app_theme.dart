import 'package:flutter/material.dart';

/// Design tokens ported 1:1 from docs/design-system.md §1 (owned by `ux`) —
/// values only, no off-token colors/spacing (design-system.md §6: "ห้าม
/// off-token / ห้าม hardcode สี-spacing; ห้าม web↔mobile drift"). Mirrors the
/// same token set web ported into `apps/web/src/styles/tokens.css`
/// (design-system.md §1.5) — if a token is missing/unworkable here, escalate
/// to `ux`, do not invent a value.
///
/// Naming stays close to the `namespace.role[.variant]` convention from
/// design-system.md §1 so a diff against the source table is easy.
class AppColors {
  AppColors._();

  static const primary = Color(0xFF1F6FEB);
  static const primaryFg = Color(0xFFFFFFFF);
  static const primaryHover = Color(0xFF1A5FCC);

  static const danger = Color(0xFFD92D20);
  static const dangerFg = Color(0xFFFFFFFF);
  static const dangerBg = Color(0xFFFEF3F2);
  static const dangerBorder = Color(0xFFFDA29B);
  static const dangerText = Color(0xFFB42318);

  static const warningBg = Color(0xFFFFFAEB);
  static const warningBorder = Color(0xFFFEC84B);
  static const warningText = Color(0xFFB54708);

  static const successBg = Color(0xFFECFDF3);
  static const successText = Color(0xFF067647);

  static const badgeCurrentBg = Color(0xFFECFDF3);
  static const badgeCurrentText = Color(0xFF067647);

  static const surface = Color(0xFFFFFFFF);
  static const surfaceMuted = Color(0xFFF9FAFB);
  static const bg = Color(0xFFF2F4F7);
  static const text = Color(0xFF101828);
  static const textMuted = Color(0xFF667085);
  static const borderDefault = Color(0xFFD0D5DD);
  static const overlay = Color(0x66101828); // color.overlay @ 40%
}

/// `space.*` (4-pt grid, design-system.md §1.3).
class AppSpacing {
  AppSpacing._();

  static const s1 = 4.0;
  static const s2 = 8.0;
  static const s3 = 12.0;
  static const s4 = 16.0; // space.form.gap
  static const s5 = 20.0;
  static const s6 = 24.0; // space.screen.padding (mobile full-screen)
  static const s8 = 32.0;

  static const formGap = s4;
  static const screenPadding = s6;
}

/// `radius.*` (design-system.md §1.3).
class AppRadius {
  AppRadius._();

  static const button = 8.0;
  static const card = 12.0;
  static const badge = 9999.0; // pill
}

/// `size.*` (design-system.md §1.3).
class AppSizes {
  AppSizes._();

  static const tapTargetMin = 44.0;
}

/// `type.*` (design-system.md §1.2). Font: Sarabun (Thai glyph coverage +
/// tabular-lining numerals) — falls back to the platform default if the font
/// asset isn't bundled; `FontFeature.tabularFigures()` is applied explicitly
/// wherever countdown numerals render (ThrottleBanner) regardless of font
/// availability, since that's the behavior the token exists to guarantee.
class AppTypography {
  AppTypography._();

  static const fontFamilyFallback = <String>[
    'Sarabun',
    'Noto Sans Thai',
  ];

  static const headingMd = TextStyle(
    fontSize: 24,
    height: 32 / 24,
    fontWeight: FontWeight.w600,
    color: AppColors.text,
    fontFamilyFallback: fontFamilyFallback,
  );

  static const headingSm = TextStyle(
    fontSize: 18,
    height: 28 / 18,
    fontWeight: FontWeight.w600,
    color: AppColors.text,
    fontFamilyFallback: fontFamilyFallback,
  );

  static const bodyMd = TextStyle(
    fontSize: 16,
    height: 26 / 16,
    fontWeight: FontWeight.w400,
    color: AppColors.text,
    fontFamilyFallback: fontFamilyFallback,
  );

  static const bodySm = TextStyle(
    fontSize: 14,
    height: 22 / 14,
    fontWeight: FontWeight.w400,
    color: AppColors.textMuted,
    fontFamilyFallback: fontFamilyFallback,
  );

  static const labelSm = TextStyle(
    fontSize: 14,
    height: 20 / 14,
    fontWeight: FontWeight.w500,
    color: AppColors.text,
    fontFamilyFallback: fontFamilyFallback,
  );

  static const buttonMd = TextStyle(
    fontSize: 16,
    height: 24 / 16,
    fontWeight: FontWeight.w600,
    fontFamilyFallback: fontFamilyFallback,
  );
}

/// Builds the shared Flutter `ThemeData`/`ColorScheme` from the tokens above
/// (design-system.md §1: "แปลงเป็น ... Flutter ThemeData/ColorScheme").
ThemeData buildAppTheme() {
  final colorScheme = ColorScheme.fromSeed(
    seedColor: AppColors.primary,
    primary: AppColors.primary,
    onPrimary: AppColors.primaryFg,
    error: AppColors.danger,
    onError: AppColors.dangerFg,
    surface: AppColors.surface,
    onSurface: AppColors.text,
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: colorScheme,
    scaffoldBackgroundColor: AppColors.bg,
    fontFamilyFallback: AppTypography.fontFamilyFallback,
    textTheme: const TextTheme(
      headlineSmall: AppTypography.headingMd,
      titleMedium: AppTypography.headingSm,
      bodyLarge: AppTypography.bodyMd,
      bodySmall: AppTypography.bodySm,
      labelLarge: AppTypography.buttonMd,
      labelSmall: AppTypography.labelSm,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.surface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.button),
        borderSide: const BorderSide(color: AppColors.borderDefault),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.button),
        borderSide: const BorderSide(color: AppColors.borderDefault),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.button),
        borderSide: const BorderSide(color: AppColors.primary, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.button),
        borderSide: const BorderSide(color: AppColors.dangerBorder, width: 2),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.button),
        borderSide: const BorderSide(color: AppColors.danger, width: 2),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.primaryFg,
        minimumSize: const Size.fromHeight(AppSizes.tapTargetMin),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.button),
        ),
        textStyle: AppTypography.buttonMd,
      ),
    ),
  );
}
