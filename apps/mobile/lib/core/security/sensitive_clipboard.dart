import 'package:flutter/services.dart';

/// ★ M-07 — copying a national ID without handing it to every other device the
/// person owns.
///
/// Copy is a requirement, not an accident: M-07 (ข) asks whether the number can
/// be copied, because an owner reading thirteen digits to an accountant should
/// not have to transcribe them by eye. The security review's point was that the
/// ordinary clipboard replicates it well beyond this app's controls:
///
///  - **Android 13+** renders a PREVIEW of the copied content in a system
///    overlay — outside the `FLAG_SECURE` window, so the guard on the screen
///    does not cover it — and syncs the clipboard to paired Chromebooks.
///  - **iOS** replicates the pasteboard to the user's other Apple devices via
///    Universal Clipboard, where it persists indefinitely.
///
/// So the copy goes through a first-party channel that marks the clip:
/// `ClipDescription.EXTRA_IS_SENSITIVE` on Android (which suppresses the
/// preview), and `localOnly` + a short `expirationDate` on iOS (no Universal
/// Clipboard, and the system clears it).
///
/// Same shape as [ScreenshotGuard]: a tiny first-party `MethodChannel` rather
/// than a plugin for a one-call surface.
class SensitiveClipboard {
  SensitiveClipboard._();

  static const _channel = MethodChannel('omnistock/sensitive_clipboard');

  /// Copies [text], marked sensitive where the platform supports it.
  ///
  /// Returns whether the SENSITIVE path was taken. `false` means the value is
  /// on the ordinary clipboard — which is what Flutter's own `Clipboard` would
  /// have done, and is the honest fallback for a platform with no native
  /// handler (`flutter test`, desktop) rather than silently copying nothing.
  /// The return value exists so that "was it protected?" is answerable instead
  /// of assumed; nothing depends on it yet.
  static Future<bool> copy(String text) async {
    try {
      await _channel.invokeMethod<void>('copy', {'text': text});
      return true;
    } on MissingPluginException {
      await Clipboard.setData(ClipboardData(text: text));
      return false;
    } on PlatformException {
      await Clipboard.setData(ClipboardData(text: text));
      return false;
    }
  }
}
