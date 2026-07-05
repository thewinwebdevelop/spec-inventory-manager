import 'package:flutter/material.dart';

// T-000-09 — proves apps/mobile consumes the generated OpenAPI Dart client
// (T-000-07) from the api_client sibling package. Scope is "wired", not "feature complete":
// this placeholder only imports a generated type so the client is a real
// compile-time dependency, not a fabricated shape (see
// docs/features/F-000/architecture.md §4.3 — Dart client full analyzer-green
// is deferred to F-006 / D-004).
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
  /// import) — see the file-level note above. Builder instantiation of
  /// [HealthResponse] itself is deferred: its `.g.dart` (built_value codegen)
  /// output isn't generated in F-000 scope (wired-only, F-006 makes it green).
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
