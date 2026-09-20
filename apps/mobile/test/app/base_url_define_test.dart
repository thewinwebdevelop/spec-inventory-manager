import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// ★ B-17 — the app, its own integration test and the runbook must name the
/// SAME environment key.
///
/// What went wrong: `--dart-define=API_BASE_URL=…` was read by
/// `integration_test/org_flow_test.dart` and by nothing else. `lib/main.dart`
/// hardcoded `http://localhost:3000`, and inside an emulator (or on a phone)
/// `localhost` is the DEVICE — so the real app could not reach any API at all,
/// while E-10 passed four cases against a real one every CI run. The harness
/// built the provider graph itself from the define and never came through
/// `main.dart`: two layers, each self-consistent, disagreeing with each other.
/// It surfaced only when a person followed the §12.2 runbook by hand.
///
/// A behaviour test cannot catch this. `String.fromEnvironment` is resolved at
/// COMPILE time, so a running test sees whatever the test build was given and
/// can say nothing about what `main.dart` asks for — which is exactly why this
/// one reads source. The rule it enforces is not "the URL is correct" (nobody
/// can know that here) but "the three places that talk about this key agree",
/// and disagreement is the failure that actually happened.
void main() {
  // `flutter test` runs with `apps/mobile/` as the process CWD (same
  // assumption `test/tool/check_boundaries_test.dart` documents).
  final root = Directory.current.path;

  /// Every `String.fromEnvironment('KEY')` named in [source].
  Set<String> definesIn(String source) => RegExp(
        r"String\.fromEnvironment\(\s*'([A-Z0-9_]+)'",
      ).allMatches(source).map((m) => m.group(1)!).toSet();

  final mainSource = File('$root/lib/main.dart').readAsStringSync();
  final harnessSource =
      File('$root/integration_test/org_flow_test.dart').readAsStringSync();

  test('★ the app entrypoint reads its base URL from a --dart-define', () {
    expect(
      definesIn(mainSource),
      contains('API_BASE_URL'),
      reason: 'lib/main.dart hardcoded the base URL — a build cannot be '
          'pointed at any API, and only a person running the app by hand '
          'would ever find out',
    );
  });

  test('★ the app and its integration test read the SAME key', () {
    // The two ends are paired by this string alone; nothing compiles the pair.
    // If the harness were changed to `API_URL` and main.dart left on
    // `API_BASE_URL`, CI would stay green and every hand-run build would break
    // again in exactly the same silent way.
    expect(
      definesIn(mainSource).intersection(definesIn(harnessSource)),
      contains('API_BASE_URL'),
    );
  });

  test('the runbook tells a person the key the app actually reads', () {
    // §12.2 is walked by a HUMAN following that file. A runbook naming a flag
    // the app ignores is worse than no runbook: it makes the failure look like
    // the API being down.
    final runbook =
        File('$root/../../docs/features/F-002/manual-pass-runbook.md')
            .readAsStringSync();
    expect(runbook, contains('API_BASE_URL'));
    // 10.0.2.2, not localhost, is the whole reason the define has to exist.
    expect(runbook, contains('10.0.2.2'));
  });

  test('SELF-CHECK: the extractor finds nothing in source that has no define',
      () {
    expect(definesIn("const url = 'http://localhost:3000';"), isEmpty);
    expect(definesIn("String.fromEnvironment('OTHER_KEY')"), {'OTHER_KEY'});
  });
}
