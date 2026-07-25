import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// D-014 / mobile.md §5.2 — behavioral tests for `tool/check_boundaries.dart`
/// itself (previously untested — rules 1-5 had no dedicated test file; this
/// batch adds rules 6-7 + the test-presence check, so it's the right time to
/// close that gap for the whole script, not just the new rules).
///
/// Runs the REAL script as a subprocess against small, disposable fixture
/// trees (`Directory.systemTemp`, not `apps/mobile/lib`) — `main()` reads
/// `Directory('lib')`/`Directory('test/features/...')` relative to the
/// process's CWD, so pointing `Process.run`'s `workingDirectory` at a fixture
/// root exercises the exact same code path a real `apps/mobile` run does,
/// without touching any real source file.
void main() {
  // `flutter test` always runs with the package root (apps/mobile/) as the
  // process CWD — same assumption `tool/check_boundaries.dart`'s own doc
  // comment makes ("Run: ... from apps/mobile/"). Resolving the script path
  // from `Directory.current` (rather than `Platform.script`, which points at
  // the test RUNNER's bootstrap under `flutter test`, not this file) is what
  // makes this reliable across `dart test`/`flutter test`/CI.
  final scriptPath = '${Directory.current.path}/tool/check_boundaries.dart';
  // The fixture roots below deliberately have NO pubspec.yaml/package_config
  // of their own (they're disposable, dependency-free trees) — `dart run`
  // still needs SOME package config to resolve a language version, so this
  // test points it at apps/mobile's own real one explicitly.
  final packageConfigPath = '${Directory.current.path}/.dart_tool/package_config.json';
  // `Platform.resolvedExecutable` under `flutter test` is `flutter_tester`
  // (the Flutter engine embedder), NOT a `dart` CLI — passing `run` to it
  // doesn't work (confirmed empirically: it launches an unrelated engine
  // process and hangs). The real `dart` CLI that ships with THIS exact
  // (FVM-pinned) Flutter SDK lives at `<flutterRoot>/bin/cache/dart-sdk/bin/
  // dart` — `<flutterRoot>/bin/cache/` is also `flutter_tester`'s own
  // ancestor (`<flutterRoot>/bin/cache/artifacts/engine/<platform>/
  // flutter_tester`), so walking up to the `cache` segment and back down
  // into `dart-sdk/bin/dart` finds the SAME SDK this test process itself is
  // running under — no reliance on `$PATH` (which resolved to a different,
  // too-old `dart` when tried).
  String resolveDartExecutable() {
    final segments = Platform.resolvedExecutable.split(Platform.pathSeparator);
    final cacheIndex = segments.lastIndexOf('cache');
    if (cacheIndex == -1) return 'dart'; // fallback — shouldn't happen under flutter test
    final cacheDir = segments.sublist(0, cacheIndex + 1).join(Platform.pathSeparator);
    return [cacheDir, 'dart-sdk', 'bin', 'dart'].join(Platform.pathSeparator);
  }

  final dartExecutable = resolveDartExecutable();

  Directory makeFixture(Map<String, String> filesByRelativePath) {
    final dir = Directory.systemTemp.createTempSync('check_boundaries_fixture_');
    for (final entry in filesByRelativePath.entries) {
      final file = File('${dir.path}/${entry.key}');
      file.parent.createSync(recursive: true);
      file.writeAsStringSync(entry.value);
    }
    return dir;
  }

  Future<ProcessResult> run(Directory fixtureDir) {
    return Process.run(
      dartExecutable,
      ['run', '--packages=$packageConfigPath', scriptPath],
      workingDirectory: fixtureDir.path,
    );
  }

  test('a clean fixture (no violations, every feature has a test) exits 0', () async {
    final dir = makeFixture({
      'lib/main.dart': "import 'app/app.dart';\nvoid main() {}\n",
      'lib/app/app.dart': 'class App {}\n',
      'lib/core/ui/widget.dart': 'class Widget {}\n',
      'lib/features/stock/domain/entities/item.dart': 'class Item {}\n',
      'lib/features/stock/presentation/screens/list.dart': 'class ListScreen {}\n',
      'test/features/stock/domain/item_test.dart': 'void main() {}\n',
    });
    addTearDown(() => dir.deleteSync(recursive: true));

    final result = await run(dir);
    expect(result.exitCode, 0, reason: result.stderr.toString());
  });

  group('rule 6 — no file imports app/ except main.dart', () {
    test('features/ importing app/ is a violation', () async {
      final dir = makeFixture({
        'lib/main.dart': 'void main() {}\n',
        'lib/app/theme.dart': 'class Theme {}\n',
        'lib/features/stock/presentation/screens/list.dart': "import '../../../../app/theme.dart';\n",
        'test/features/stock/presentation/list_test.dart': 'void main() {}\n',
      });
      addTearDown(() => dir.deleteSync(recursive: true));

      final result = await run(dir);
      expect(result.exitCode, 1);
      expect(result.stderr.toString(), contains('[rule 6]'));
    });

    test('core/ importing app/ is a violation', () async {
      final dir = makeFixture({
        'lib/main.dart': 'void main() {}\n',
        'lib/app/theme.dart': 'class Theme {}\n',
        'lib/core/ui/widget.dart': "import '../../app/theme.dart';\n",
      });
      addTearDown(() => dir.deleteSync(recursive: true));

      final result = await run(dir);
      expect(result.exitCode, 1);
      expect(result.stderr.toString(), contains('[rule 6]'));
    });

    test('main.dart importing app/ is explicitly allowed', () async {
      final dir = makeFixture({
        'lib/main.dart': "import 'app/app.dart';\nvoid main() {}\n",
        'lib/app/app.dart': 'class App {}\n',
      });
      addTearDown(() => dir.deleteSync(recursive: true));

      final result = await run(dir);
      expect(result.exitCode, 0, reason: result.stderr.toString());
    });

    test('app/ importing another app/ file (composing itself) is allowed', () async {
      final dir = makeFixture({
        'lib/main.dart': 'void main() {}\n',
        'lib/app/app.dart': "import 'theme.dart';\n",
        'lib/app/theme.dart': 'class Theme {}\n',
      });
      addTearDown(() => dir.deleteSync(recursive: true));

      final result = await run(dir);
      expect(result.exitCode, 0, reason: result.stderr.toString());
    });
  });

  group('rule 7 — presentation/ must not import core/api/ directly', () {
    test('a presentation/ file importing core/api/ is a violation', () async {
      final dir = makeFixture({
        'lib/main.dart': 'void main() {}\n',
        'lib/core/api/refresh_coordinator.dart': 'class RefreshCoordinator {}\n',
        'lib/features/stock/presentation/screens/list.dart':
            "import '../../../../core/api/refresh_coordinator.dart';\n",
        'test/features/stock/presentation/list_test.dart': 'void main() {}\n',
      });
      addTearDown(() => dir.deleteSync(recursive: true));

      final result = await run(dir);
      expect(result.exitCode, 1);
      expect(result.stderr.toString(), contains('[rule 7]'));
    });

    test('application/ (not presentation/) importing core/api/ is still allowed', () async {
      final dir = makeFixture({
        'lib/main.dart': 'void main() {}\n',
        'lib/core/api/refresh_coordinator.dart': 'class RefreshCoordinator {}\n',
        'lib/features/stock/application/controller.dart':
            "import '../../../core/api/refresh_coordinator.dart';\n",
        'test/features/stock/application/controller_test.dart': 'void main() {}\n',
      });
      addTearDown(() => dir.deleteSync(recursive: true));

      final result = await run(dir);
      expect(result.exitCode, 0, reason: result.stderr.toString());
    });
  });

  group('test-presence check', () {
    test('a feature with no test/features/<f>/ at all fails', () async {
      final dir = makeFixture({
        'lib/main.dart': 'void main() {}\n',
        'lib/features/stock/domain/entities/item.dart': 'class Item {}\n',
      });
      addTearDown(() => dir.deleteSync(recursive: true));

      final result = await run(dir);
      expect(result.exitCode, 1);
      expect(result.stderr.toString(), contains('[test-presence]'));
      expect(result.stderr.toString(), contains('features/stock'));
    });

    test('a feature with an EMPTY test/features/<f>/ (no _test.dart files) fails', () async {
      final dir = makeFixture({
        'lib/main.dart': 'void main() {}\n',
        'lib/features/stock/domain/entities/item.dart': 'class Item {}\n',
        'test/features/stock/README.md': 'not a test file\n',
      });
      addTearDown(() => dir.deleteSync(recursive: true));

      final result = await run(dir);
      expect(result.exitCode, 1);
      expect(result.stderr.toString(), contains('[test-presence]'));
    });

    test('a feature with at least one _test.dart file passes', () async {
      final dir = makeFixture({
        'lib/main.dart': 'void main() {}\n',
        'lib/features/stock/domain/entities/item.dart': 'class Item {}\n',
        'test/features/stock/domain/item_test.dart': 'void main() {}\n',
      });
      addTearDown(() => dir.deleteSync(recursive: true));

      final result = await run(dir);
      expect(result.exitCode, 0, reason: result.stderr.toString());
    });
  });
}
