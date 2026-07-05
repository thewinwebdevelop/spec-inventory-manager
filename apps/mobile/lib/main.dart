import 'package:flutter/material.dart';

// T-000-09 — proves apps/mobile consumes the generated OpenAPI Dart client
// (T-000-07) from the api_client sibling package. Scope is "wired", not "feature complete":
// this placeholder only imports a generated type so the client is a real
// compile-time dependency, not a fabricated shape (see
// docs/features/F-000/architecture.md §4.3 — the client's *.g.dart companions
// are generated and committed in F-000 itself; D-015 superseded the original
// F-006/D-004 "green later" deferral after the nested-package language-version
// conflict forced an immediate fix. Full feature-level usage of the client
// beyond this wiring proof is still F-006's job).
import 'package:omnistock_api_client/omnistock_api_client.dart';

void main() {
  runApp(const OmniStockApp());
}

/// Placeholder root widget. No real screens/navigation/state in F-000 — see
/// docs/features/F-000/tasks.md T-000-09 scope note.
class OmniStockApp extends StatelessWidget {
  const OmniStockApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'OmniStock',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
        useMaterial3: true,
      ),
      home: const _ShellPage(),
    );
  }
}

class _ShellPage extends StatelessWidget {
  const _ShellPage();

  /// References the generated client's [HealthResponseStatusEnum] purely to
  /// keep the import a real, type-checked reference (not just an unused
  /// import) — see the file-level note above. This placeholder only reads the
  /// enum; it does not exercise a full [HealthResponse] builder round-trip
  /// (that belongs to F-006's feature work), but the `.g.dart` (built_value
  /// codegen) output IS generated and committed as of F-000 (D-015).
  String _describeWiring() => HealthResponseStatusEnum.ok.name;

  @override
  Widget build(BuildContext context) {
    final wiredStatus = _describeWiring();
    return Scaffold(
      appBar: AppBar(title: const Text('OmniStock')),
      body: Center(
        child: Text(
          'apps/mobile placeholder shell\n'
          'generated client wired (HealthResponseStatusEnum: $wiredStatus)',
          textAlign: TextAlign.center,
        ),
      ),
    );
  }
}
