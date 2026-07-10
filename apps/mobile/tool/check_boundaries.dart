// D-023 (mobile architecture refactor) — mobile boundary gate. Dependency-
// free (no package:analyzer, no pub packages) — just `dart:io` + regex —
// so it stays fast and has zero extra maintenance surface, mirroring the
// server-side depcruise gate's spirit for `packages/core-domain` purity.
//
// Run: `fvm dart run tool/check_boundaries.dart` (from apps/mobile/).
//
// Rules enforced (docs/mobile-architecture.md §6, D-023 item 4):
//   1. lib/features/*/domain/**  must NOT import flutter/dio/
//      omnistock_api_client/riverpod.
//   2. lib/core/**               must NOT import lib/features/**.
//   3. omnistock_api_client      may only be imported from
//      lib/features/*/data/** or lib/core/api/**.
//   4. lib/features/X/**        must NOT import lib/features/Y/** for any
//      other feature Y (no cross-feature imports).
//   5. lib/features/*/domain/** must NOT import its OWN feature's
//      data/application/presentation (the dependency rule points inward —
//      a "pure" domain file re-exporting or importing data/ would pull the
//      generated client in transitively while looking clean under rule 1).
//
// All URI-bearing directives are scanned — `import`, `export`, and
// `part`/`part of 'uri.dart'` — not just `import` (★ sanity-pass fix: an
// `export` used to bypass every rule). Whitespace between the keyword and
// the quote is optional (`import'x.dart';` is legal Dart).
//
// Exit code 0 = clean, 1 = violations found (prints every violation, not
// just the first, so a single run surfaces the whole list).
import 'dart:io';

final _directiveRe = RegExp(r'''^\s*(?:import|export|part\s+of|part)\s*['"]([^'"]+)['"]''');

class Violation {
  Violation(this.file, this.rule, this.message);
  final String file;
  final int rule;
  final String message;

  @override
  String toString() => '  [rule $rule] $file: $message';
}

/// One parsed URI-bearing directive (`import`/`export`/`part`): the raw URI
/// text as written in the file.
class Import {
  Import(this.uri, this.lineNumber);
  final String uri;
  final int lineNumber;
}

List<Import> _parseImports(File file) {
  final imports = <Import>[];
  final lines = file.readAsLinesSync();
  for (var i = 0; i < lines.length; i++) {
    final match = _directiveRe.firstMatch(lines[i]);
    if (match != null) {
      imports.add(Import(match.group(1)!, i + 1));
    }
  }
  return imports;
}

/// Collapses `.`/`..` segments in a POSIX-style path (`File.absolute` does
/// NOT do this on its own — it only makes the path absolute, leaving any
/// `..`/`.` segments in place, which would silently defeat every path-based
/// rule below for relative imports that climb directories).
String _collapseDotSegments(String posixPath) {
  final isAbsolute = posixPath.startsWith('/');
  final out = <String>[];
  for (final segment in posixPath.split('/')) {
    if (segment.isEmpty || segment == '.') continue;
    if (segment == '..') {
      if (out.isNotEmpty) out.removeLast();
      continue;
    }
    out.add(segment);
  }
  return (isAbsolute ? '/' : '') + out.join('/');
}

/// Resolves a relative import (`'../../foo.dart'`) against the importing
/// file's directory into a POSIX-style path relative to `lib/`, e.g.
/// `lib/features/auth/data/foo.dart` -> `features/auth/data/foo.dart`. Returns
/// null for package:/dart: imports (handled separately by the caller).
String? _resolveRelative(String libRoot, String importingFilePath, String importUri) {
  if (importUri.startsWith('package:') || importUri.startsWith('dart:')) return null;
  final importingDir = Directory(importingFilePath).parent.path;
  final resolved = File('$importingDir/$importUri').absolute;
  final normalized = _collapseDotSegments(resolved.path.replaceAll(r'\', '/'));
  final libPrefix = '${_collapseDotSegments(Directory(libRoot).absolute.path.replaceAll(r'\', '/'))}/';
  if (!normalized.startsWith(libPrefix)) {
    // Import escapes lib/ entirely (shouldn't happen for app code) — treat
    // the full normalized path as-is; none of the rules below will match it.
    return normalized;
  }
  return normalized.substring(libPrefix.length);
}

/// Feature name from a `features/<name>/...` relative-to-lib path, or null
/// if the path isn't under `features/`.
String? _featureOf(String libRelativePath) {
  final m = RegExp(r'^features/([^/]+)/').firstMatch(libRelativePath);
  return m?.group(1);
}

bool _isDomainPath(String libRelativePath) => RegExp(r'^features/[^/]+/domain/').hasMatch(libRelativePath);

bool _isFeatureDataPath(String libRelativePath) =>
    RegExp(r'^features/[^/]+/data/').hasMatch(libRelativePath);

bool _isCoreApiPath(String libRelativePath) => libRelativePath.startsWith('core/api/');

bool _isCorePath(String libRelativePath) => libRelativePath.startsWith('core/');

void main(List<String> args) {
  final libDir = Directory('lib');
  if (!libDir.existsSync()) {
    stderr.writeln('check_boundaries: no lib/ directory found — run this from apps/mobile/.');
    exit(2);
  }

  final violations = <Violation>[];

  final dartFiles = libDir
      .listSync(recursive: true)
      .whereType<File>()
      .where((f) => f.path.endsWith('.dart'))
      .toList()
    ..sort((a, b) => a.path.compareTo(b.path));

  for (final file in dartFiles) {
    final rawPath = file.path.replaceAll(r'\', '/');
    // Path relative to lib/, e.g. "features/auth/domain/validation.dart".
    final libRelative = rawPath.substring(rawPath.indexOf('lib/') + 'lib/'.length);
    final imports = _parseImports(file);
    final selfFeature = _featureOf(libRelative);

    for (final imp in imports) {
      final uri = imp.uri;
      final isPackageImport = uri.startsWith('package:');
      final packageName = isPackageImport ? uri.substring('package:'.length).split('/').first : null;

      // ---- Rule 1: domain/ forbids flutter/dio/omnistock_api_client/riverpod ----
      if (_isDomainPath(libRelative)) {
        final forbidden = <String>[];
        if (uri.startsWith('dart:ui') || packageName == 'flutter') forbidden.add('flutter');
        if (packageName == 'dio') forbidden.add('dio');
        if (packageName == 'omnistock_api_client') forbidden.add('omnistock_api_client');
        if (packageName == 'flutter_riverpod' || packageName == 'riverpod') forbidden.add('riverpod');
        for (final f in forbidden) {
          violations.add(Violation(
            rawPath,
            1,
            'line ${imp.lineNumber}: domain/ imports "$uri" ($f is forbidden in domain — pure Dart only)',
          ));
        }
      }

      // Resolve relative imports for the path-based rules (2/3/4) — a
      // package: import of our OWN package (package:mobile/...) is
      // equivalent to a relative import for these purposes.
      String? targetLibRelative;
      if (packageName == 'mobile') {
        targetLibRelative = uri.substring('package:mobile/'.length);
      } else if (!isPackageImport && !uri.startsWith('dart:')) {
        targetLibRelative = _resolveRelative('lib', rawPath, uri);
      }

      // ---- Rule 2: core/ forbids importing features/ ----
      if (_isCorePath(libRelative) && targetLibRelative != null && targetLibRelative.startsWith('features/')) {
        violations.add(Violation(
          rawPath,
          2,
          'line ${imp.lineNumber}: core/ imports "$uri" (core/ must not depend on features/)',
        ));
      }

      // ---- Rule 3: omnistock_api_client only in features/*/data/** or core/api/** ----
      if (packageName == 'omnistock_api_client' &&
          !_isFeatureDataPath(libRelative) &&
          !_isCoreApiPath(libRelative)) {
        violations.add(Violation(
          rawPath,
          3,
          'line ${imp.lineNumber}: imports "$uri" (omnistock_api_client is only allowed in '
          'features/*/data/** and core/api/**)',
        ));
      }

      // ---- Rule 4: no cross-feature imports ----
      if (selfFeature != null && targetLibRelative != null) {
        final targetFeature = _featureOf(targetLibRelative);
        if (targetFeature != null && targetFeature != selfFeature) {
          violations.add(Violation(
            rawPath,
            4,
            'line ${imp.lineNumber}: imports "$uri" (feature "$selfFeature" must not import '
            'feature "$targetFeature" directly)',
          ));
        }
      }

      // ---- Rule 5: domain/ must not depend on its own feature's other layers ----
      if (_isDomainPath(libRelative) && selfFeature != null && targetLibRelative != null) {
        final ownLayer = RegExp('^features/${RegExp.escape(selfFeature)}/(data|application|presentation)/')
            .firstMatch(targetLibRelative);
        if (ownLayer != null) {
          violations.add(Violation(
            rawPath,
            5,
            'line ${imp.lineNumber}: domain/ references "$uri" (domain must not depend on '
            '${ownLayer.group(1)}/ — the dependency rule points inward)',
          ));
        }
      }
    }
  }

  if (violations.isEmpty) {
    stdout.writeln('check_boundaries: OK — ${dartFiles.length} files scanned, no violations.');
    exit(0);
  }

  stderr.writeln('check_boundaries: ${violations.length} violation(s) found:');
  for (final v in violations) {
    stderr.writeln(v);
  }
  exit(1);
}
