// T-003-M07 · CM3-01 — `lostCapabilities` ported to pure Dart, pinned by the
// SAME golden-vector file the server's U-RB-09 and web's CW3-01 read.
//
// ⛔ The vectors are READ from
// `packages/core-domain/src/rbac/fixtures/lost-capabilities.vectors.json` at
// test time — never copied here (test-plan CW3-01 / CM3-01). A vector added
// there is checked here on the next run with no edit to this file.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/session/capabilities.dart';
import 'package:mobile/features/org/domain/capability_expansion.dart';

/// `flutter test` runs with cwd = `apps/mobile` (same convention as
/// `test/app/base_url_define_test.dart`).
final _vectorsFile = File(
  '${Directory.current.path}/../../packages/core-domain/src/rbac/fixtures/lost-capabilities.vectors.json',
);

typedef _Vector = ({String name, String registry, List<String> before, List<String> after, List<String> lost});

List<String> _strings(Object? v) => (v! as List).cast<String>().toList();

({Map<String, List<CapabilityEdge>> registries, List<_Vector> vectors}) _load() {
  final json = jsonDecode(_vectorsFile.readAsStringSync()) as Map<String, Object?>;
  final registries = <String, List<CapabilityEdge>>{
    for (final e in (json['registries']! as Map<String, Object?>).entries)
      e.key: [
        for (final r in (e.value! as List).cast<Map<String, Object?>>())
          CapabilityEdge(key: r['key']! as String, implies: _strings(r['implies'])),
      ],
  };
  final vectors = <_Vector>[
    for (final v in (json['vectors']! as List).cast<Map<String, Object?>>())
      (
        name: v['name']! as String,
        registry: v['registry']! as String,
        before: _strings(v['before']),
        after: _strings(v['after']),
        lost: _strings(v['lost']),
      ),
  ];
  return (registries: registries, vectors: vectors);
}

void main() {
  test('the golden file is there (read, not copied)', () {
    expect(_vectorsFile.existsSync(), isTrue, reason: _vectorsFile.path);
  });

  final golden = _load();

  group('CM3-01 · golden vectors', () {
    test('not vacuous: ≥ 8 vectors, some lose something, some lose nothing, implies + full_access covered', () {
      expect(golden.vectors.length, greaterThanOrEqualTo(8));
      expect(golden.vectors.any((v) => v.lost.isNotEmpty), isTrue);
      expect(golden.vectors.any((v) => v.lost.isEmpty), isTrue);
      expect(golden.vectors.any((v) => v.before.contains(fullAccessCapability)), isTrue);
      expect(
        golden.registries.values.any((r) => r.any((e) => e.implies.isNotEmpty)),
        isTrue,
        reason: 'an implies edge must be exercised',
      );
    });

    for (final v in golden.vectors) {
      test('${v.name} → lost = the vector\'s `lost`', () {
        final registry = golden.registries[v.registry];
        expect(registry, isNotNull, reason: 'unknown registry ${v.registry}');
        expect(lostCapabilities(v.before, v.after, registry!), v.lost);
      });
    }

    test('control: a wrong answer is caught (the comparison is not vacuous)', () {
      final v = golden.vectors.firstWhere((x) => x.lost.isNotEmpty);
      final registry = golden.registries[v.registry]!;
      // Swapping the arguments must change the answer for a vector that loses something.
      expect(lostCapabilities(v.after, v.before, registry), isNot(equals(v.lost)));
    });
  });

  group('expandCapabilities', () {
    const registry = [
      CapabilityEdge(key: 'full_access', implies: []),
      CapabilityEdge(key: 'manage_x', implies: ['view_x']),
      CapabilityEdge(key: 'view_x', implies: []),
      CapabilityEdge(key: 'b_cap', implies: []),
    ];

    test('full_access → every registry key; unknown keys kept; sorted by code unit', () {
      expect(expandCapabilities(['zz_unknown', 'full_access'], registry),
          ['b_cap', 'full_access', 'manage_x', 'view_x', 'zz_unknown']);
    });

    test('manage_x → + view_x; duplicates once', () {
      expect(expandCapabilities(['manage_x', 'manage_x'], registry), ['manage_x', 'view_x']);
    });

    test('code-unit order, not locale order (uppercase before lowercase)', () {
      expect(expandCapabilities(['b', 'B', 'a'], const []), ['B', 'a', 'b']);
    });
  });
}
