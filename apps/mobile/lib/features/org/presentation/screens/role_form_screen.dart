import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/error/api_failure.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/session/capability_gate.dart';
import '../../../../core/session/session_controller.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/ui/app_toast.dart';
import '../../../../core/ui/confirm_dialog.dart';
import '../../../../core/ui/error_banner.dart';
import '../../../../core/ui/skeleton.dart';
import '../../../../core/ui/sticky_action_bar.dart';
import '../../application/org_providers.dart';
import '../../application/role_write_controller.dart';
import '../../application/role_write_error.dart';
import '../../domain/entities/role_entities.dart';
import '../../domain/role_form_model.dart';
import '../copy/role_display_copy.dart';
import '../copy/role_list_copy.dart';
import '../copy/role_viewer_reason_copy.dart';
import '../widgets/capability_checklist.dart';
import '../widgets/role_screen_parts.dart';

/// R3 create / clone. [fromRoleId] = clone (POST, pre-filled — there is no
/// clone endpoint). [replace] swaps out the current top route (R2 uses it,
/// so back from the form — and a successful create — lands on R1).
Future<void> openRoleCreateScreen(BuildContext context, {String? fromRoleId, bool replace = false}) {
  final route = MaterialPageRoute<void>(builder: (_) => RoleFormScreen.create(fromRoleId: fromRoleId));
  final nav = Navigator.of(context);
  return replace ? nav.pushReplacement(route) : nav.push(route);
}

/// R3 edit (or, when the server's `canEdit` says no, the read-only state).
Future<void> openRoleEditScreen(BuildContext context, String roleId) => Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => RoleFormScreen.edit(roleId: roleId)),
    );

/// R3 — ฟอร์มบทบาท: สร้าง / ทำสำเนา / แก้ (ux-wireframe R3, ui.md §3/§5) ·
/// T-003-M06. Mobile = full-screen push, checklist in `Disclosure` groups (all
/// open), one full-width `StickyActionBar` button, "ยกเลิก" = AppBar ←
/// (guarded by `PopScope` when there are unsaved changes).
///
/// ⛔ Write affordances follow the SERVER's verdicts only (`canCreate`,
/// `canEdit`, `canClone`) — never the local capability set (repo lesson
/// "client-invented server facts"). The one local-capability read is the
/// per-row "คุณไม่มีสิทธิ์นี้" hint, a UX guard; the server still decides
/// (`ROLE_EXCEEDS_ACTOR`).
///
/// ⛔ SR-14: on `409 ROLE_CHANGED` the role is re-read and shown; nothing is
/// resubmitted. Saving again is a new press of the button by the person.
///
/// Seams left for later tasks (each the ONLY place that task touches):
///  - M07 R3a: [_RoleFormState._confirmCapabilityChange] — the confirm dialog
///    (added/removed + impact + lost-own-capabilities) before a PATCH that
///    carries `capabilities`.
///  - M07 R3b: [_RoleConflict] holds the user's draft and the version they
///    started from; M07 renders the diff + "ใส่การแก้ของฉันกลับเข้าไป".
///  - M08 R4 / R5: [_ReadOnlyState] (full read list + clone/delete) and the
///    delete button in "การจัดการอื่น".
class RoleFormScreen extends ConsumerWidget {
  const RoleFormScreen.create({super.key, this.fromRoleId}) : roleId = null;
  const RoleFormScreen.edit({super.key, required String this.roleId}) : fromRoleId = null;

  final String? roleId;
  final String? fromRoleId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Same rule as R1: not left on a screen that is no longer reachable.
    return CapabilityScreenGuard(
      capability: manageRolesCapability,
      onDenied: () => Navigator.of(context).maybePop(),
      child: roleId == null ? _CreateBody(fromRoleId: fromRoleId) : _EditBody(roleId: roleId!),
    );
  }
}

const _emptyCatalog = CapabilityCatalogView(items: []);

// ── shared states ─────────────────────────────────────────────────────────

class _FrameScaffold extends StatelessWidget {
  const _FrameScaffold({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: Text(title)),
        body: SafeArea(child: child),
      );
}

class _LoadingState extends StatelessWidget {
  const _LoadingState({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) => _FrameScaffold(
        title: title,
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.screenPadding),
          children: const [SessionListSkeleton(key: ValueKey('role-form-skeleton'), rowCount: 6)],
        ),
      );
}

/// EmptyState-style panel: icon, title, body, actions.
class _StatePanel extends StatelessWidget {
  const _StatePanel({required this.icon, required this.title, required this.body, required this.actions});

  final IconData icon;
  final String title;
  final String body;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.screenPadding),
      child: Semantics(
        liveRegion: true,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Icon(icon, size: 32, color: colors.textMuted),
            const SizedBox(height: AppSpacing.s3),
            Text(title, style: AppTypography.headingSm, textAlign: TextAlign.center),
            const SizedBox(height: AppSpacing.s2),
            Text(body, style: AppTypography.bodySm.copyWith(color: colors.textMuted), textAlign: TextAlign.center),
            const SizedBox(height: AppSpacing.s4),
            ...actions,
          ],
        ),
      ),
    );
  }
}

Widget _backToList(BuildContext context, {bool tertiary = false}) {
  final t = AppLocalizations.of(context);
  void onPressed() => Navigator.of(context).pop();
  final style = ButtonStyle(minimumSize: WidgetStateProperty.all(const Size(0, AppSizes.tapTargetMin)));
  return tertiary
      ? TextButton(style: style, onPressed: onPressed, child: Text(t.roleFormBackToList))
      : OutlinedButton(style: style, onPressed: onPressed, child: Text(t.roleFormBackToList));
}

class _LoadErrorState extends StatelessWidget {
  const _LoadErrorState({required this.appBarTitle, required this.title, required this.body, required this.onRetry});

  final String appBarTitle;
  final String title;
  final String body;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    return _FrameScaffold(
      title: appBarTitle,
      child: _StatePanel(
        icon: Icons.error_outline,
        title: title,
        body: body,
        actions: [
          OutlinedButton(
            style: OutlinedButton.styleFrom(minimumSize: const Size(0, AppSizes.tapTargetMin)),
            onPressed: onRetry,
            child: Text(t.commonRetry),
          ),
          const SizedBox(height: AppSpacing.s2),
          Builder(builder: (c) => _backToList(c, tertiary: true)),
        ],
      ),
    );
  }
}

class _NotFoundState extends StatelessWidget {
  const _NotFoundState();

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    return _FrameScaffold(
      title: t.rolesListTitle,
      child: _StatePanel(
        icon: Icons.info_outline,
        title: t.roleFormNotFoundTitle,
        body: t.roleFormNotFoundBody,
        actions: [Builder(builder: (c) => _backToList(c))],
      ),
    );
  }
}

/// A 403 FORBIDDEN means our copy of the caller's capabilities is stale —
/// re-read it once; the guard then leaves on its own if it is really gone.
class _ForbiddenState extends ConsumerStatefulWidget {
  const _ForbiddenState();

  @override
  ConsumerState<_ForbiddenState> createState() => _ForbiddenStateState();
}

class _ForbiddenStateState extends ConsumerState<_ForbiddenState> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) unawaited(learnCapabilities(ref));
    });
  }

  @override
  Widget build(BuildContext context) =>
      _FrameScaffold(title: AppLocalizations.of(context).rolesListTitle, child: const RoleForbiddenPanel());
}

// ── create / clone ────────────────────────────────────────────────────────

class _CreateBody extends ConsumerStatefulWidget {
  const _CreateBody({required this.fromRoleId});

  final String? fromRoleId;

  @override
  ConsumerState<_CreateBody> createState() => _CreateBodyState();
}

class _CreateBodyState extends ConsumerState<_CreateBody> {
  bool _forbidden = false;

  void _retry() {
    ref.invalidate(roleDetailsProvider);
    ref.invalidate(capabilityCatalogProvider);
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final list = ref.watch(roleDetailsProvider);
    final catalog = ref.watch(capabilityCatalogProvider);

    if (_forbidden || list.error is ForbiddenFailure || catalog.error is ForbiddenFailure) {
      return const _ForbiddenState();
    }
    final page = list.valueOrNull;
    if (list.hasError && page == null) {
      return _LoadErrorState(
        appBarTitle: t.roleFormCreateTitle,
        title: t.rolesListLoadError,
        body: t.rolesListLoadErrorHint,
        onRetry: _retry,
      );
    }
    final catalogData = catalog.valueOrNull;
    if (page == null || (catalogData == null && !catalog.hasError)) {
      return _LoadingState(title: t.roleFormCreateTitle);
    }

    final cat = catalogData ?? _emptyCatalog;
    final fromId = widget.fromRoleId;
    final source = fromId == null ? null : page.items.where((r) => r.id == fromId).firstOrNull;
    final usable = source != null && source.canClone.allowed;
    final sourceName = usable ? roleRowName(t, source) : null;

    final verdict = page.canCreate;
    final writesOff = verdict.reason == 'writes_disabled';
    final blocked = !verdict.allowed && !writesOff
        ? roleCreateOrCloneBlockedCopy(t, verdict.reason ?? '', limit: page.limit)
        : null;

    return _RoleForm(
      // A new seed once the catalog arrives (clone needs it to pre-tick).
      key: ValueKey('create:${catalogData != null}:${fromId ?? ''}'),
      isEdit: false,
      isClone: usable,
      appBarTitle: t.roleFormCreateTitle,
      catalog: catalogData,
      onRetryCatalog: () => ref.invalidate(capabilityCatalogProvider),
      seedName: usable
          ? cloneName(sourceName!, [for (final r in page.items) ...[r.name, roleRowName(t, r)]])
          : '',
      seedSelection: usable ? cloneSelection(source.capabilities, cat) : const {},
      seedPassthrough: const [],
      canSubmit: verdict.allowed,
      submitBlockedNote: blocked,
      topBanners: [
        if (writesOff) RoleInfoBanner(title: t.roleReasonWritesDisabledTitle, body: t.roleReasonWritesDisabledBody),
        if (fromId != null && !usable) RoleInfoBanner(body: t.roleFormTemplateGoneNotice),
      ],
      header: [
        if (usable)
          Text(
            t.roleFormCloneIntro(sourceName!),
            style: AppTypography.bodySm.copyWith(color: context.appColors.textMuted),
          ),
      ],
      submit: (name, caps) => ref
          .read(roleWriteControllerProvider.notifier)
          .create(name: name.trim(), capabilities: caps),
      onSaved: (saved) {
        showAppToast(context, t.roleFormCreateSuccessToast(roleRowName(t, saved)));
        // R1 + toast (ux R3 โหมด). `pop`, not `maybePop`: the form is dirty
        // by definition and its own guard must not ask "ทิ้งการแก้ไข?" here.
        Navigator.of(context).pop();
      },
      onRefetchRole: () {},
      onForbidden: () => setState(() => _forbidden = true),
    );
  }
}

// ── edit ──────────────────────────────────────────────────────────────────

/// R3b seam (M07): what the person had when the 409 came back.
class _RoleConflict {
  const _RoleConflict({required this.startedFromVersion, required this.draftName, required this.draftCapabilities});

  final int startedFromVersion;
  final String draftName;
  final List<String> draftCapabilities;
}

enum _WriteOutcome { forbidden, notFound }

class _EditBody extends ConsumerStatefulWidget {
  const _EditBody({required this.roleId});

  final String roleId;

  @override
  ConsumerState<_EditBody> createState() => _EditBodyState();
}

class _EditBodyState extends ConsumerState<_EditBody> {
  /// The version the form is built on — changes only on save or a re-read.
  RoleDetailView? _snapshot;
  int _nonce = 0;
  _RoleConflict? _conflict;
  _WriteOutcome? _outcome;

  void _retry() {
    ref.invalidate(roleDetailProvider(widget.roleId));
    ref.invalidate(capabilityCatalogProvider);
  }

  Future<void> _reread() async {
    try {
      final fresh = await ref.refresh(roleDetailProvider(widget.roleId).future);
      if (!mounted) return;
      setState(() {
        _snapshot = fresh;
        _nonce++;
      });
    } on NotFoundFailure {
      if (mounted) setState(() => _outcome = _WriteOutcome.notFound);
    } on ApiFailure {
      // The provider now holds the error; the load-error state takes over.
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final roleAsync = ref.watch(roleDetailProvider(widget.roleId));
    final catalog = ref.watch(capabilityCatalogProvider);

    if (_outcome == _WriteOutcome.forbidden ||
        roleAsync.error is ForbiddenFailure ||
        catalog.error is ForbiddenFailure) {
      return const _ForbiddenState();
    }
    if (_outcome == _WriteOutcome.notFound || roleAsync.error is NotFoundFailure) {
      return const _NotFoundState();
    }
    if (roleAsync.hasError && !roleAsync.isLoading) {
      return _LoadErrorState(
        appBarTitle: t.rolesListTitle,
        title: t.roleFormLoadErrorTitle,
        body: t.roleFormLoadErrorHint,
        onRetry: _retry,
      );
    }
    final current = roleAsync.valueOrNull;
    final catalogData = catalog.valueOrNull;
    if (current == null || (catalogData == null && !catalog.hasError)) {
      return _LoadingState(title: t.rolesListTitle);
    }

    final base = _snapshot ?? current;
    final myRoleId = ref.watch(orgProfileProvider).valueOrNull?.myRoleId;
    final isMine = myRoleId != null && myRoleId == base.id;
    final colors = context.appColors;
    final muted = AppTypography.bodySm.copyWith(color: colors.textMuted);
    final header = [
      Text(roleRowUsageLine(t, base, isMine: isMine), style: muted),
      Text(roleLastEditedLine(t, roleLastEditedFrom(t, base.lastEdited)), style: muted),
    ];
    final conflictBanner = _conflict == null
        ? null
        : RoleWarningBanner(title: t.roleConflictTitle, body: t.roleConflictBody);

    // The server's CURRENT verdict decides between R3 and R4 — a refusal that
    // re-read the role (TARGET_NOT_BELOW_ACTOR, ROLE_HELD_…, ROLE_LOCKED,
    // ROLE_WRITES_DISABLED) lands here.
    if (!base.canEdit.allowed) {
      return _ReadOnlyState(role: base, header: header, conflictBanner: conflictBanner);
    }

    final cat = catalogData ?? _emptyCatalog;
    final seeded = initialSelection(base.capabilities, cat);
    final initialName = roleRowName(t, base);
    final initialCapabilities = payloadCapabilities(seeded.selection, seeded.passthrough, cat);

    RoleUpdate? bodyFor(String name, List<String> caps) => buildRoleUpdate(
          version: base.version,
          initialName: initialName,
          name: name,
          initialCapabilities: initialCapabilities,
          capabilities: caps,
        );

    final canClone = base.canClone;
    final cloneBlocked = !canClone.allowed && canClone.reason == 'role_limit_reached'
        ? roleCreateOrCloneBlockedCopy(t, 'role_limit_reached')
        : null;

    return _RoleForm(
      key: ValueKey('edit:${catalogData != null}:${base.id}:${base.version}:$_nonce'),
      isEdit: true,
      isClone: false,
      appBarTitle: roleRowName(t, base),
      catalog: catalogData,
      onRetryCatalog: () => ref.invalidate(capabilityCatalogProvider),
      seedName: initialName,
      seedSelection: seeded.selection,
      seedPassthrough: seeded.passthrough,
      canSubmit: true,
      topBanners: [if (conflictBanner != null) conflictBanner],
      header: header,
      buildUpdate: bodyFor,
      otherActions: canClone.allowed || cloneBlocked != null
          ? (dirty) => _OtherActions(
                onClone: canClone.allowed ? () => openRoleCreateScreen(context, fromRoleId: base.id) : null,
                cloneBlockedNote: cloneBlocked,
                showUnsavedNote: canClone.allowed && dirty,
              )
          : null,
      submit: (name, caps) {
        final body = bodyFor(name, caps);
        if (body == null) return Future.value(RoleWriteSaved(base));
        return ref.read(roleWriteControllerProvider.notifier).update(base.id, body);
      },
      onSaved: (saved) {
        setState(() {
          _conflict = null;
          _snapshot = saved;
          _nonce++;
        });
        showAppToast(context, t.roleFormSaveSuccessToast(roleRowName(t, saved)));
      },
      onRoleChanged: (draftName, draftCaps) async {
        setState(() => _conflict = _RoleConflict(
              startedFromVersion: base.version,
              draftName: draftName,
              draftCapabilities: draftCaps,
            ));
        await _reread();
      },
      onRefetchRole: _reread,
      onForbidden: () => setState(() => _outcome = _WriteOutcome.forbidden),
      onNotFound: () => setState(() => _outcome = _WriteOutcome.notFound),
    );
  }
}

/// The interim read-only state (M06): header + the server's reason, no form.
/// M08 replaces the body with the full R4 (capability read list, clone and
/// delete per §0.3 (ก) ordering).
class _ReadOnlyState extends StatelessWidget {
  const _ReadOnlyState({required this.role, required this.header, required this.conflictBanner});

  final RoleDetailView role;
  final List<Widget> header;
  final Widget? conflictBanner;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final reason = role.canEdit.reason ?? '';
    final banner = roleEditOrDeleteReasonBanner(t, reason);
    return _FrameScaffold(
      title: roleRowName(t, role),
      child: ListView(
        padding: const EdgeInsets.all(AppSpacing.screenPadding),
        children: [
          if (conflictBanner != null) ...[conflictBanner!, const SizedBox(height: AppSpacing.s3)],
          ...header,
          const SizedBox(height: AppSpacing.s4),
          RoleInfoBanner(
            title: banner.title,
            body: banner.body,
            icon: reason == 'writes_disabled' ? Icons.info_outline : Icons.lock_outline,
          ),
        ],
      ),
    );
  }
}

class _OtherActions extends StatelessWidget {
  const _OtherActions({required this.onClone, required this.cloneBlockedNote, required this.showUnsavedNote});

  final VoidCallback? onClone;
  final String? cloneBlockedNote;
  final bool showUnsavedNote;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final muted = AppTypography.bodySm.copyWith(color: context.appColors.textMuted);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(t.roleFormOtherActionsHeader, style: AppTypography.headingSm),
        const SizedBox(height: AppSpacing.s2),
        OutlinedButton(
          key: const ValueKey('role-form-clone'),
          style: OutlinedButton.styleFrom(minimumSize: const Size(0, AppSizes.tapTargetMin)),
          onPressed: onClone,
          child: Text(t.roleFormCloneCta),
        ),
        if (cloneBlockedNote != null) Text(cloneBlockedNote!, style: muted),
        if (showUnsavedNote) Text(t.roleFormCloneUnsavedNote, style: muted),
        // M08 (R5): "ลบบทบาทนี้" goes here, by `canDelete`.
      ],
    );
  }
}

// ── the form ──────────────────────────────────────────────────────────────

class _RoleForm extends ConsumerStatefulWidget {
  const _RoleForm({
    super.key,
    required this.isEdit,
    required this.isClone,
    required this.appBarTitle,
    required this.catalog,
    required this.onRetryCatalog,
    required this.seedName,
    required this.seedSelection,
    required this.seedPassthrough,
    required this.canSubmit,
    this.submitBlockedNote,
    this.topBanners = const [],
    this.header = const [],
    this.buildUpdate,
    this.otherActions,
    required this.submit,
    required this.onSaved,
    this.onRoleChanged,
    required this.onRefetchRole,
    required this.onForbidden,
    this.onNotFound,
  });

  final bool isEdit;
  final bool isClone;
  final String appBarTitle;

  /// `null` = the catalog failed to load (a danger banner replaces the list).
  final CapabilityCatalogView? catalog;
  final VoidCallback onRetryCatalog;
  final String seedName;
  final Set<String> seedSelection;
  final List<String> seedPassthrough;

  /// The server's verdict (create: `canCreate`; edit: `canEdit`).
  final bool canSubmit;
  final String? submitBlockedNote;
  final List<Widget> topBanners;
  final List<Widget> header;

  /// Edit: the PATCH body (`null` = nothing to save).
  final RoleUpdate? Function(String name, List<String> capabilities)? buildUpdate;
  final Widget Function(bool dirty)? otherActions;
  final Future<RoleWriteResult?> Function(String name, List<String> capabilities) submit;
  final void Function(RoleDetailView saved) onSaved;
  final Future<void> Function(String draftName, List<String> draftCapabilities)? onRoleChanged;
  final VoidCallback onRefetchRole;
  final VoidCallback onForbidden;

  /// Absent (create) → a 404 shows the generic save failure.
  final VoidCallback? onNotFound;

  @override
  ConsumerState<_RoleForm> createState() => _RoleFormState();
}

class _RoleFormState extends ConsumerState<_RoleForm> {
  late final TextEditingController _name = TextEditingController(text: widget.seedName);
  final _nameFocus = FocusNode(debugLabel: 'role-form-name');
  final _checklistKey = GlobalKey();
  final _scroll = ScrollController();
  late Set<String> _selection = {...widget.seedSelection};
  late List<String> _passthrough = [...widget.seedPassthrough];
  late final List<String> _seedCaps =
      payloadCapabilities(widget.seedSelection, widget.seedPassthrough, _cat);
  String? _nameError;
  String? _capsError;
  String? _banner;
  bool _selectedOnFocus = false;
  int _throttleLeft = 0;
  Timer? _throttleTimer;

  CapabilityCatalogView get _cat => widget.catalog ?? _emptyCatalog;

  @override
  void initState() {
    super.initState();
    _nameFocus.addListener(_selectOnFirstFocus);
  }

  @override
  void dispose() {
    _throttleTimer?.cancel();
    _scroll.dispose();
    _nameFocus.dispose();
    _name.dispose();
    super.dispose();
  }

  /// Clone: the first focus selects the suggestion so typing replaces it.
  void _selectOnFirstFocus() {
    if (!widget.isClone || _selectedOnFocus || !_nameFocus.hasFocus) return;
    _selectedOnFocus = true;
    _name.selection = TextSelection(baseOffset: 0, extentOffset: _name.text.length);
  }

  List<String> get _capabilities => payloadCapabilities(_selection, _passthrough, _cat);

  bool get _dirty {
    if (widget.isEdit) return widget.buildUpdate?.call(_name.text, _capabilities) != null;
    final caps = _capabilities;
    return _name.text.trim() != widget.seedName.trim() ||
        caps.length != _seedCaps.length ||
        Iterable<int>.generate(caps.length).any((i) => caps[i] != _seedCaps[i]);
  }

  void _startThrottle(int seconds) {
    _throttleTimer?.cancel();
    setState(() => _throttleLeft = seconds);
    _throttleTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return timer.cancel();
      setState(() => _throttleLeft = _throttleLeft - 1);
      if (_throttleLeft <= 0) timer.cancel();
    });
  }

  void _showChecklist() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final ctx = _checklistKey.currentContext;
      if (ctx != null) Scrollable.ensureVisible(ctx, alignment: 0.05);
    });
  }

  /// Banners and the name field live at the TOP of a lazily-built list: after
  /// a checklist tap the person is scrolled down, the banner would appear
  /// off-screen and the field would not even exist to take focus. So every
  /// error that renders up there brings the top back first.
  Future<void> _scrollToTop() async {
    if (!_scroll.hasClients || _scroll.offset == 0) return;
    final reduceMotion = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    if (reduceMotion) {
      _scroll.jumpTo(0);
    } else {
      await _scroll.animateTo(0, duration: const Duration(milliseconds: 200), curve: Curves.easeOut);
    }
  }

  void _focusName() {
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      await _scrollToTop();
      if (mounted) _nameFocus.requestFocus();
    });
  }

  void _showTop() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _scrollToTop();
    });
  }

  /// M07 (R3a) inserts the confirm dialog here — added / removed, "มีผลกับ
  /// สมาชิก N คน", and the lost-own-capabilities warning. Until then every
  /// change goes straight through.
  Future<bool> _confirmCapabilityChange(RoleUpdate body) async => true;

  Future<void> _onSubmit() async {
    final t = AppLocalizations.of(context);
    if (ref.read(roleWriteControllerProvider) || _throttleLeft > 0) return;
    final problem = validateRoleNameInput(_name.text);
    final empty = _selection.isEmpty;
    setState(() {
      _banner = null;
      _nameError = switch (problem) {
        RoleNameProblem.empty => t.roleFormNameEmptyError,
        RoleNameProblem.tooLong => t.roleFormNameTooLongError,
        null => null,
      };
      _capsError = empty ? t.roleFormEmptySelectionError : null;
    });
    if (problem != null) return _focusName();
    if (empty) return _showChecklist();

    final caps = _capabilities;
    if (widget.isEdit) {
      final body = widget.buildUpdate?.call(_name.text, caps);
      if (body != null && body.capabilities != null && !await _confirmCapabilityChange(body)) return;
    }
    final result = await widget.submit(_name.text, caps);
    if (!mounted || result == null) return;
    switch (result) {
      case RoleWriteSaved(:final role):
        widget.onSaved(role);
      case RoleWriteFailed(:final error):
        _handleFailure(t, error, caps);
    }
  }

  void _handleFailure(AppLocalizations t, RoleWriteError error, List<String> caps) {
    switch (error) {
      case RoleChangedError():
        // SR-14: re-read and show — the person decides whether to save again.
        widget.onRoleChanged?.call(_name.text.trim(), caps);
      case RoleFieldError(:final problem):
        setState(() {
          switch (problem) {
            case RoleFieldProblem.nameInvalidChars:
              _nameError = t.roleFormErrorNameInvalidChars;
            case RoleFieldProblem.nameTaken:
              _nameError = t.roleFormErrorNameTaken;
            case RoleFieldProblem.capabilitiesEmpty:
              _capsError = t.roleFormEmptySelectionError;
          }
        });
        error.field == RoleFormField.name ? _focusName() : _showChecklist();
      case RoleBannerError(:final untick, :final refetch):
        setState(() {
          _banner = _bannerCopy(t, error);
          if (untick.isNotEmpty) {
            final gone = untick.toSet();
            _selection = _selection.difference(gone);
            _passthrough = _passthrough.where((k) => !gone.contains(k)).toList();
          }
        });
        _showTop();
        if (refetch.contains(RoleRefetch.role)) widget.onRefetchRole();
      case RoleThrottledError(:final seconds):
        _startThrottle(seconds);
        _showTop();
      case RoleForbiddenError():
        widget.onForbidden();
      case RoleNotFoundError():
        if (widget.onNotFound != null) {
          widget.onNotFound!();
        } else {
          setState(() => _banner = t.roleFormErrorGeneric);
          _showTop();
        }
    }
  }

  String _bannerCopy(AppLocalizations t, RoleBannerError e) => switch (e.problem) {
        RoleBannerProblem.unknownCapability => t.roleFormErrorUnknownCapability,
        RoleBannerProblem.fullAccessReserved => t.roleFormErrorFullAccessReserved,
        RoleBannerProblem.roleLimitReached =>
          e.limit != null ? t.roleLimitReachedWithLimitBody(e.limit!) : t.roleLimitReachedUnknownLimitBody,
        RoleBannerProblem.roleLocked => t.roleReasonRoleLockedBody,
        RoleBannerProblem.exceedsActor => t.roleFormErrorExceedsActor,
        RoleBannerProblem.targetNotBelowActor => t.roleReasonEqualPermissionsInUseBody,
        RoleBannerProblem.heldRequiresManageMembers => t.roleReasonInUseRequiresManageMembersBody,
        RoleBannerProblem.writesDisabled => t.roleReasonWritesDisabledBody,
        RoleBannerProblem.busy => t.roleFormErrorBusy,
        RoleBannerProblem.generic => t.roleFormErrorGeneric,
      };

  Future<void> _confirmLeave() async {
    final t = AppLocalizations.of(context);
    final leave = await showConfirmDialog(
      context,
      title: t.roleFormDiscardTitle,
      body: t.roleFormDiscardBody,
      cancelLabel: t.roleFormDiscardCancel,
      confirmLabel: t.roleFormDiscardConfirm,
      destructive: true,
    );
    if (leave && mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final colors = context.appColors;
    final submitting = ref.watch(roleWriteControllerProvider);
    final viewerCaps = ref.watch(activeOrgProvider)?.capabilities ?? const <String>{};
    final view = buildChecklist(_cat, _selection, (k) => viewerCanGrant(viewerCaps, k, _cat));
    final dirty = _dirty;
    final throttled = _throttleLeft > 0;
    final counter = roleNameLength(_name.text);
    final submitEnabled = widget.canSubmit &&
        widget.catalog != null &&
        !throttled &&
        !submitting &&
        (!widget.isEdit || dirty);

    final label = submitting
        ? (widget.isEdit ? t.roleFormSubmitSaving : t.roleFormSubmitCreating)
        : (widget.isEdit ? t.roleFormSubmitSave : t.roleFormSubmitCreate);

    return PopScope(
      // While a write is in flight the person may still leave (web parity:
      // the guard is off during submit) — the write finishes either way.
      canPop: !dirty || submitting,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _confirmLeave();
      },
      child: Scaffold(
        appBar: AppBar(title: Text(widget.appBarTitle)),
        body: SafeArea(
          child: ListView(
            controller: _scroll,
            padding: const EdgeInsets.all(AppSpacing.screenPadding),
            children: [
              for (final b in widget.topBanners) ...[b, const SizedBox(height: AppSpacing.s3)],
              ...widget.header,
              if (widget.header.isNotEmpty) const SizedBox(height: AppSpacing.s3),
              if (throttled) ...[
                RoleWarningBanner(
                  icon: Icons.schedule,
                  tabularFigures: true,
                  body: t.roleFormErrorThrottled(
                    (_throttleLeft ~/ 60).toString().padLeft(2, '0'),
                    (_throttleLeft % 60).toString().padLeft(2, '0'),
                  ),
                ),
                const SizedBox(height: AppSpacing.s3),
              ],
              if (_banner != null) ErrorBanner(message: _banner!),
              _NameField(
                controller: _name,
                focusNode: _nameFocus,
                isEdit: widget.isEdit,
                enabled: !submitting,
                errorText: _nameError,
                counter: counter,
                onChanged: (_) => setState(() => _nameError = null),
              ),
              const SizedBox(height: AppSpacing.s6),
              KeyedSubtree(
                key: _checklistKey,
                child: widget.catalog != null
                    ? CapabilityChecklist(
                        view: view,
                        unknownCount: _passthrough.length,
                        errorText: _capsError,
                        enabled: !submitting,
                        onToggle: (key, checked) => setState(() {
                          _selection = toggleCapability(_selection, key, checked, _cat);
                          _capsError = null;
                        }),
                      )
                    : _CatalogError(onRetry: widget.onRetryCatalog),
              ),
              if (widget.otherActions != null) ...[
                const SizedBox(height: AppSpacing.s6),
                widget.otherActions!(dirty),
              ],
            ],
          ),
        ),
        bottomNavigationBar: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (widget.submitBlockedNote != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s4),
                child: Text(
                  widget.submitBlockedNote!,
                  textAlign: TextAlign.center,
                  style: AppTypography.bodySm.copyWith(color: colors.textMuted),
                ),
              ),
            StickyActionBar(label: label, onPressed: submitEnabled ? _onSubmit : null),
          ],
        ),
      ),
    );
  }
}

class _NameField extends StatelessWidget {
  const _NameField({
    required this.controller,
    required this.focusNode,
    required this.isEdit,
    required this.enabled,
    required this.errorText,
    required this.counter,
    required this.onChanged,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final bool isEdit;
  final bool enabled;
  final String? errorText;
  final int counter;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final colors = context.appColors;
    final over = counter > roleNameMaxLength;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(t.roleFormNameLabel, style: Theme.of(context).textTheme.labelSmall),
        const SizedBox(height: AppSpacing.s2),
        TextField(
          key: const ValueKey('role-form-name'),
          controller: controller,
          focusNode: focusNode,
          enabled: enabled,
          textInputAction: TextInputAction.done,
          style: Theme.of(context).textTheme.bodyLarge,
          onChanged: onChanged,
          decoration: InputDecoration(
            hintText: isEdit ? null : t.roleFormNamePlaceholder,
            errorText: errorText,
          ),
        ),
        const SizedBox(height: AppSpacing.s1),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Text(
                isEdit ? t.roleFormNameHelperEdit : t.roleFormNameHelperCreate,
                style: AppTypography.bodySm.copyWith(color: colors.textMuted),
              ),
            ),
            const SizedBox(width: AppSpacing.s2),
            Semantics(
              liveRegion: true,
              child: Text(
                t.roleFormNameCounter(counter),
                style: AppTypography.bodySm.copyWith(color: over ? colors.dangerText : colors.textMuted),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _CatalogError extends StatelessWidget {
  const _CatalogError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    return ErrorBanner(message: t.roleFormCatalogLoadError, onRetry: onRetry, retryLabel: t.commonRetry);
  }
}
