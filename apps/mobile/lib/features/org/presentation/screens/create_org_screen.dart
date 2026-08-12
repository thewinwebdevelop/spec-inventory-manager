import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/l10n.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/ui/app_toast.dart';
import '../../../../core/ui/error_banner.dart';
import '../../../../core/ui/labeled_text_field.dart';
import '../../application/create_org_controller.dart';
import '../../application/create_org_error.dart';
import '../../domain/entities/org_entities.dart';

/// S2 — สร้างร้านใหม่, mobile (ux-wireframe §3 + §13: full screen with a back
/// button, primary button full width).
///
/// One field. ux is explicit that timezone, currency and plan are NOT asked:
/// the server binds the plan, and the other two have one correct answer in
/// Phase 0 — so asking would be three decisions taken from somebody to reach
/// the same result.
///
/// The four states, honestly: there is no skeleton and no empty state here,
/// because the screen fetches nothing on entry (ux-wireframe §3 says so in
/// the states table — "ฟอร์มล้วน ไม่มี fetch ตอนเข้า"). What it does have is a
/// submitting state, an inline field error and a banner error, and those are
/// what the tests cover.
class CreateOrgScreen extends ConsumerStatefulWidget {
  const CreateOrgScreen({super.key, this.onCreated});

  /// Called after the new shop is already ACTIVE. Navigation belongs to the
  /// router (F-006); this screen refuses to grow a dependency on it early.
  final void Function(CreatedOrganization org)? onCreated;

  @override
  ConsumerState<CreateOrgScreen> createState() => _CreateOrgScreenState();
}

class _CreateOrgScreenState extends ConsumerState<CreateOrgScreen> {
  final _name = TextEditingController();
  final _nameFocus = FocusNode();

  @override
  void dispose() {
    _name.dispose();
    _nameFocus.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final created = await ref.read(createOrgControllerProvider.notifier).submit(_name.text);
    if (!mounted) return;

    if (created == null) {
      // Focus goes back to the field only for the error that is ABOUT the
      // field — pulling focus for a 503 would move the cursor away from what
      // the person typed for no reason.
      if (ref.read(createOrgControllerProvider).error is CreateOrgFieldError) {
        _nameFocus.requestFocus();
      }
      return;
    }
    showAppToast(context, AppLocalizations.of(context).orgCreateSuccessToast(created.name));
    widget.onCreated?.call(created);
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final state = ref.watch(createOrgControllerProvider);
    final error = state.error;

    return Scaffold(
      appBar: AppBar(title: Text(t.orgCreateTitle)),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.s6),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (error is CreateOrgBannerError)
                ErrorBanner(
                  message: _bannerMessage(t, error),
                  // No retry on the cap: pressing it again cannot create a
                  // shop the plan does not allow, and offering the button
                  // says otherwise.
                  onRetry: error.retry ? _submit : null,
                ),
              if (error is CreateOrgThrottled)
                // No countdown yet — `ThrottleCountdownController` lives in
                // `features/auth` and cross-feature imports are forbidden
                // (gate rule 4). Recorded as a debt rather than duplicated.
                ErrorBanner(message: t.orgCreateThrottled),
              LabeledTextField(
                label: t.orgCreateNameLabel,
                controller: _name,
                placeholder: t.orgCreateNamePlaceholder,
                enabled: !state.submitting,
                autofocus: true,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => state.submitting ? null : _submit(),
                errorText: error is CreateOrgFieldError
                    // The server's own message first: it is the only one that
                    // can name the rule actually broken.
                    ? (error.serverMessage ?? t.orgCreateNameError)
                    : null,
              ),
              const SizedBox(height: AppSpacing.s2),
              Text(
                t.orgCreateNameHelper,
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: AppSpacing.s6),
              _InfoBox(text: t.orgCreateInfo),
              const SizedBox(height: AppSpacing.s6),
              ElevatedButton(
                // Disabled while in flight: `POST /organizations` has no
                // Idempotency-Key (ux-wireframe §3), so a second tap is a
                // second shop.
                onPressed: state.submitting ? null : _submit,
                style: ElevatedButton.styleFrom(
                  minimumSize: const Size.fromHeight(AppSizes.tapTargetMin),
                ),
                child: Text(state.submitting ? t.orgCreateSubmitting : t.orgCreateSubmit),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _bannerMessage(AppLocalizations t, CreateOrgBannerError error) {
    return switch (error.banner) {
      // `limit` is non-null whenever the banner is `limitReached` — the
      // mapper falls back to `generic` when the server sent no usable number,
      // precisely so this line never has to invent one.
      CreateOrgBanner.limitReached => t.orgCreateLimitReached(error.limit ?? 0),
      CreateOrgBanner.provisioning => t.orgCreateProvisioningUnavailable,
      CreateOrgBanner.generic => t.orgCreateGenericError,
    };
  }
}

/// The "what you are about to get" box (ux-wireframe §3). Informational tone —
/// `accentSoft`, never a warning colour.
class _InfoBox extends StatelessWidget {
  const _InfoBox({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.s4),
      decoration: BoxDecoration(
        color: colors.accentSoft,
        borderRadius: BorderRadius.circular(AppRadius.card),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // The icon never carries the meaning alone (§14) — the sentence
          // next to it says everything.
          Icon(Icons.info_outline, size: 20, color: colors.accentText),
          const SizedBox(width: AppSpacing.s2),
          Expanded(
            child: Text(
              text,
              style: AppTypography.bodySm.copyWith(color: colors.accentText),
            ),
          ),
        ],
      ),
    );
  }
}
