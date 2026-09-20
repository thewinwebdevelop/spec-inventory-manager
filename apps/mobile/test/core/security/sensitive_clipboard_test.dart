// ★ M-07 — copying a national ID goes through the marked path, or says it did
// not.
//
// The security review's residual risk: copy is a requirement (M-07 (ข)), and
// the ordinary clipboard replicates the value beyond this app's controls —
// Android 13+ renders a system preview OUTSIDE the FLAG_SECURE window this
// screen holds, and iOS syncs the pasteboard to the person's other devices.
//
// A widget test cannot observe an OS clipboard, so what is pinned here is the
// contract with the native side: the call is made, with the value, on the
// right channel — and the fallback is honest about not being protected rather
// than pretending.
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/security/sensitive_clipboard.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const channel = MethodChannel('omnistock/sensitive_clipboard');
  final messenger = TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;

  tearDown(() {
    messenger.setMockMethodCallHandler(channel, null);
    messenger.setMockMethodCallHandler(SystemChannels.platform, null);
  });

  test('★ sends the value on the sensitive channel', () async {
    MethodCall? seen;
    messenger.setMockMethodCallHandler(channel, (call) async {
      seen = call;
      return null;
    });

    final protected = await SensitiveClipboard.copy('0105560123454');

    expect(protected, isTrue);
    expect(seen?.method, 'copy');
    expect((seen?.arguments as Map)['text'], '0105560123454');
  });

  test('★ with no native handler it still copies — and reports it was NOT protected', () async {
    // `flutter test` has no platform channel, and neither does a desktop build
    // without the handler. Copying nothing would break the feature silently;
    // copying while claiming protection would be worse. So: copy, and return
    // false.
    final plainClipboardCalls = <MethodCall>[];
    messenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
      plainClipboardCalls.add(call);
      return null;
    });

    final protected = await SensitiveClipboard.copy('0105560123454');

    expect(protected, isFalse, reason: 'the caller must be able to tell');
    expect(
      plainClipboardCalls.map((c) => c.method),
      contains('Clipboard.setData'),
      reason: 'the number should still be on the clipboard',
    );
  });

  test('a native error falls back the same way', () async {
    messenger.setMockMethodCallHandler(channel, (call) async {
      throw PlatformException(code: 'BOOM');
    });
    final plainClipboardCalls = <MethodCall>[];
    messenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
      plainClipboardCalls.add(call);
      return null;
    });

    expect(await SensitiveClipboard.copy('0105560123454'), isFalse);
    expect(plainClipboardCalls.map((c) => c.method), contains('Clipboard.setData'));
  });
}
