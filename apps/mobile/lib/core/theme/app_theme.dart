import 'package:flutter/material.dart';

/// Boundary-gate extension (docs/architecture/refactor-plan.md §4, mobile.md
/// §5.2 new rule 6: "features/**, core/** ห้าม import app/**") — moved from
/// `lib/app/theme/app_theme.dart`. Design tokens are cross-cutting
/// infrastructure every layer (`core/ui/`, every feature's `presentation/`)
/// needs, not something the composition root (`app/`) owns exclusively —
/// `app/app.dart` still calls [buildAppTheme] to build the app-wide
/// `ThemeData`, it just does so by importing `core/theme/` like everyone
/// else now, instead of being the one file everyone imported FROM `app/`.
///
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

  // Brand "Calm Teal deep" (D-026 · design-system.md §1.1). Light values.
  static const primary = Color(0xFF0C6155);
  static const primaryFg = Color(0xFFFFFFFF);
  static const primaryHover = Color(0xFF094E45);

  static const accent = Color(0xFFF2A65A);
  static const accentSoft = Color(0xFFFBEBD6);
  static const accentText = Color(0xFF9A631A);

  static const danger = Color(0xFFC0362C);
  static const dangerFg = Color(0xFFFFFFFF);
  static const dangerBg = Color(0xFFFBEDEB);
  static const dangerBorder = Color(0xFFEAB6B0);
  static const dangerText = Color(0xFF8F291F);

  static const warning = Color(0xFFB5730E);
  static const warningBg = Color(0xFFFBF1DF);
  static const warningBorder = Color(0xFFEBCB8A);
  static const warningText = Color(0xFF7E5008);

  static const success = Color(0xFF2F7D57);
  static const successBg = Color(0xFFE7F3EC);
  static const successBorder = Color(0xFFB7DCC6);
  static const successText = Color(0xFF1F5D3D);

  static const badgeCurrentBg = Color(0xFFE7F3EC);
  static const badgeCurrentText = Color(0xFF1F5D3D);

  static const surface = Color(0xFFFFFFFF);
  static const surfaceMuted = Color(0xFFE7EFEC);
  static const bg = Color(0xFFF3F7F5);
  static const text = Color(0xFF112320);
  static const textMuted = Color(0xFF566B65);
  static const borderDefault = Color(0xFFCFDCD7);
  static const overlay = Color(0x730B1614); // color.overlay @ 45%

  // Interaction — primary button tokens (§1.1c). Light: button == primary.
  static const btnBg = primary;
  static const btnFg = primaryFg;
  static const btnHover = primaryHover;
  // Outline/secondary button border = mix(textMuted 60%, borderDefault) —
  // borderDefault alone is too faint for a button edge (§1.1c). Precomputed.
  static const btnBorder = Color(0xFF869893);
  // Destructive button fill (§1.1c) — light = danger; dark gets a deeper solid
  // red (AppColorsDark) so it doesn't look washed like the light `danger` tone.
  static const btnDangerBg = danger;
  static const btnDangerHover = Color(0xFFA52D24);
  // Skeleton shimmer highlight band (§2) — sweeps across `surfaceMuted`.
  static const shimmerHi = Color(0xFFF4F8F6);
}

/// Dark-theme palette (design-system.md §1.1b/1.1c). Ground = neutral charcoal
/// (not green-tinted) so the teal brand/button pops. Semantic roles identical
/// to [AppColors]; only values differ.
class AppColorsDark {
  AppColorsDark._();

  // `color.primary` in dark is LIGHT (for text/links/icons on dark), NOT the
  // button colour — the primary button has its own dark tokens below (§1.1c).
  static const primary = Color(0xFF2FBBA6);
  static const primaryFg = Color(0xFF052421);
  static const primaryHover = Color(0xFF45C7B3);

  static const accent = Color(0xFFEEB073);
  static const accentSoft = Color(0xFF33291B);
  static const accentText = Color(0xFFF1C48C);

  static const danger = Color(0xFFE9897F);
  static const dangerFg = Color(0xFFFFFFFF);
  static const dangerBg = Color(0xFF2C1A18);
  static const dangerBorder = Color(0xFF5A322D);
  static const dangerText = Color(0xFFF0A79E);

  static const warning = Color(0xFFE0B25A);
  static const warningBg = Color(0xFF2A2213);
  static const warningBorder = Color(0xFF544321);
  static const warningText = Color(0xFFEBC981);

  static const success = Color(0xFF6FC194);
  static const successBg = Color(0xFF16261D);
  static const successBorder = Color(0xFF2C4636);
  static const successText = Color(0xFF8FD3AD);

  static const badgeCurrentBg = Color(0xFF16261D);
  static const badgeCurrentText = Color(0xFF8FD3AD);

  static const surface = Color(0xFF212423);
  static const surfaceMuted = Color(0xFF2A2D2C);
  static const bg = Color(0xFF171918);
  static const text = Color(0xFFE9EEEB);
  static const textMuted = Color(0xFF98A29D);
  static const borderDefault = Color(0xFF363A38);
  static const overlay = Color(0x99000000);

  // Primary button (dark): solid deep forest-green + white label + elevation
  // (no bright ring — avoids the "pastel" look). §1.1c.
  static const btnBg = Color(0xFF0A5A45);
  static const btnFg = Color(0xFFFFFFFF);
  static const btnHover = Color(0xFF0C6B52);
  static const btnBorder = Color(0xFF717875);
  // Destructive button (dark) — deep solid brick red + white label (white 7.1:1);
  // NOT the light `danger` salmon, which looks washed as a button fill (§1.1c).
  static const btnDangerBg = Color(0xFFA32D22);
  static const btnDangerHover = Color(0xFFBC3A2D);
  static const shimmerHi = Color(0xFF363B39);
}

/// Semantic colour tokens exposed **theme-aware** via `ThemeExtension`, so a
/// widget reads `context.appColors.danger` and gets the light/dark value for
/// the active theme — instead of the static (light-only) [AppColors] consts.
/// This is the seam that makes dark mode work without re-architecting widgets
/// later (D-026 follow-up): flip `themeMode` and every migrated widget adapts.
@immutable
class AppColorsX extends ThemeExtension<AppColorsX> {
  const AppColorsX({
    required this.primary,
    required this.primaryFg,
    required this.primaryHover,
    required this.accent,
    required this.accentSoft,
    required this.accentText,
    required this.danger,
    required this.dangerFg,
    required this.dangerBg,
    required this.dangerBorder,
    required this.dangerText,
    required this.warning,
    required this.warningBg,
    required this.warningBorder,
    required this.warningText,
    required this.success,
    required this.successBg,
    required this.successBorder,
    required this.successText,
    required this.badgeCurrentBg,
    required this.badgeCurrentText,
    required this.surface,
    required this.surfaceMuted,
    required this.bg,
    required this.text,
    required this.textMuted,
    required this.borderDefault,
    required this.overlay,
    required this.btnBg,
    required this.btnFg,
    required this.btnHover,
    required this.btnBorder,
    required this.btnDangerBg,
    required this.btnDangerHover,
    required this.shimmerHi,
  });

  final Color primary, primaryFg, primaryHover;
  final Color accent, accentSoft, accentText;
  final Color danger, dangerFg, dangerBg, dangerBorder, dangerText;
  final Color warning, warningBg, warningBorder, warningText;
  final Color success, successBg, successBorder, successText;
  final Color badgeCurrentBg, badgeCurrentText;
  final Color surface, surfaceMuted, bg, text, textMuted, borderDefault, overlay;
  final Color btnBg, btnFg, btnHover, btnBorder;
  final Color btnDangerBg, btnDangerHover, shimmerHi;

  static const light = AppColorsX(
    primary: AppColors.primary,
    primaryFg: AppColors.primaryFg,
    primaryHover: AppColors.primaryHover,
    accent: AppColors.accent,
    accentSoft: AppColors.accentSoft,
    accentText: AppColors.accentText,
    danger: AppColors.danger,
    dangerFg: AppColors.dangerFg,
    dangerBg: AppColors.dangerBg,
    dangerBorder: AppColors.dangerBorder,
    dangerText: AppColors.dangerText,
    warning: AppColors.warning,
    warningBg: AppColors.warningBg,
    warningBorder: AppColors.warningBorder,
    warningText: AppColors.warningText,
    success: AppColors.success,
    successBg: AppColors.successBg,
    successBorder: AppColors.successBorder,
    successText: AppColors.successText,
    badgeCurrentBg: AppColors.badgeCurrentBg,
    badgeCurrentText: AppColors.badgeCurrentText,
    surface: AppColors.surface,
    surfaceMuted: AppColors.surfaceMuted,
    bg: AppColors.bg,
    text: AppColors.text,
    textMuted: AppColors.textMuted,
    borderDefault: AppColors.borderDefault,
    overlay: AppColors.overlay,
    btnBg: AppColors.btnBg,
    btnFg: AppColors.btnFg,
    btnHover: AppColors.btnHover,
    btnBorder: AppColors.btnBorder,
    btnDangerBg: AppColors.btnDangerBg,
    btnDangerHover: AppColors.btnDangerHover,
    shimmerHi: AppColors.shimmerHi,
  );

  static const dark = AppColorsX(
    primary: AppColorsDark.primary,
    primaryFg: AppColorsDark.primaryFg,
    primaryHover: AppColorsDark.primaryHover,
    accent: AppColorsDark.accent,
    accentSoft: AppColorsDark.accentSoft,
    accentText: AppColorsDark.accentText,
    danger: AppColorsDark.danger,
    dangerFg: AppColorsDark.dangerFg,
    dangerBg: AppColorsDark.dangerBg,
    dangerBorder: AppColorsDark.dangerBorder,
    dangerText: AppColorsDark.dangerText,
    warning: AppColorsDark.warning,
    warningBg: AppColorsDark.warningBg,
    warningBorder: AppColorsDark.warningBorder,
    warningText: AppColorsDark.warningText,
    success: AppColorsDark.success,
    successBg: AppColorsDark.successBg,
    successBorder: AppColorsDark.successBorder,
    successText: AppColorsDark.successText,
    badgeCurrentBg: AppColorsDark.badgeCurrentBg,
    badgeCurrentText: AppColorsDark.badgeCurrentText,
    surface: AppColorsDark.surface,
    surfaceMuted: AppColorsDark.surfaceMuted,
    bg: AppColorsDark.bg,
    text: AppColorsDark.text,
    textMuted: AppColorsDark.textMuted,
    borderDefault: AppColorsDark.borderDefault,
    overlay: AppColorsDark.overlay,
    btnBg: AppColorsDark.btnBg,
    btnFg: AppColorsDark.btnFg,
    btnHover: AppColorsDark.btnHover,
    btnBorder: AppColorsDark.btnBorder,
    btnDangerBg: AppColorsDark.btnDangerBg,
    btnDangerHover: AppColorsDark.btnDangerHover,
    shimmerHi: AppColorsDark.shimmerHi,
  );

  @override
  AppColorsX copyWith() => this; // tokens are swapped wholesale per theme

  @override
  AppColorsX lerp(ThemeExtension<AppColorsX>? other, double t) {
    // Stepwise: theme switch is a discrete swap, not an animated blend.
    if (other is! AppColorsX) return this;
    return t < 0.5 ? this : other;
  }
}

/// Ergonomic theme-aware accessor: `context.appColors.danger`.
extension AppColorsContext on BuildContext {
  AppColorsX get appColors =>
      Theme.of(this).extension<AppColorsX>() ?? AppColorsX.light;
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
ThemeData buildAppTheme({Brightness brightness = Brightness.light}) {
  final isDark = brightness == Brightness.dark;
  final c = isDark ? AppColorsX.dark : AppColorsX.light;

  final colorScheme = ColorScheme.fromSeed(
    seedColor: c.primary,
    brightness: brightness,
    primary: c.primary,
    onPrimary: c.primaryFg,
    error: c.danger,
    onError: c.dangerFg,
    surface: c.surface,
    onSurface: c.text,
  );

  // Same type scale (AppTypography), colours resolved per theme so
  // `Theme.of(context).textTheme.*` is theme-aware once widgets migrate off
  // the static `AppTypography.*` consts.
  TextStyle withColor(TextStyle s, Color color) => s.copyWith(color: color);
  final textTheme = TextTheme(
    headlineSmall: withColor(AppTypography.headingMd, c.text),
    titleMedium: withColor(AppTypography.headingSm, c.text),
    bodyLarge: withColor(AppTypography.bodyMd, c.text),
    bodySmall: withColor(AppTypography.bodySm, c.textMuted),
    labelLarge: AppTypography.buttonMd, // colour from the button theme
    labelSmall: withColor(AppTypography.labelSm, c.text),
  );

  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: colorScheme,
    scaffoldBackgroundColor: c.bg,
    fontFamilyFallback: AppTypography.fontFamilyFallback,
    extensions: [c],
    textTheme: textTheme,
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: c.surface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.button),
        borderSide: BorderSide(color: c.borderDefault),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.button),
        borderSide: BorderSide(color: c.borderDefault),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.button),
        borderSide: BorderSide(color: c.primary, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.button),
        borderSide: BorderSide(color: c.dangerBorder, width: 2),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.button),
        borderSide: BorderSide(color: c.danger, width: 2),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: c.btnBg,
        foregroundColor: c.btnFg,
        // dark: solid deep-green button lifts off the card via elevation
        // (design intent — §1.1c); light: flat.
        elevation: isDark ? 3 : 0,
        shadowColor: isDark ? Colors.black : Colors.transparent,
        minimumSize: const Size.fromHeight(AppSizes.tapTargetMin),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.button),
        ),
        textStyle: AppTypography.buttonMd,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      // Secondary/outline border = btnBorder (mix(textMuted 60%, border), §1.1c) —
      // stronger than the faint field border so an outline reads as a button.
      style: OutlinedButton.styleFrom(
        side: BorderSide(color: c.btnBorder),
        minimumSize: const Size.fromHeight(AppSizes.tapTargetMin),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.button),
        ),
      ),
    ),
  );
}

/// Dark `ThemeData` — ready to wire into `MaterialApp.darkTheme` once the
/// widget colour migration (static `AppColors.*` -> `context.appColors.*`) is
/// complete. Kept as a named builder so enabling dark is a one-line change.
ThemeData buildAppDarkTheme() => buildAppTheme(brightness: Brightness.dark);
