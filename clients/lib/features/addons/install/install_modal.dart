import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/net/safe_launch.dart';
import '../../../app/theme_controller.dart';
import '../../../design/focus/focusable.dart';
import '../../../design/layout/idiom.dart';
import '../../../design/tokens.dart';
import '../../../domain/addons/addon_url.dart';
import '../../../domain/addons/install_resolve.dart';
import '../../../domain/addons/models.dart';
import '../../../design/focus/tv_text_field.dart';
import '../../companion/companion_sheet.dart';

const _emerald = Color(0xFF34D399);
const _amber = Color(0xFFFCD34D);

/// What the modal is doing, ported from `Mode`.
sealed class AddonInstallMode {
  const AddonInstallMode();
}

class InstallModeAdd extends AddonInstallMode {
  const InstallModeAdd(this.url);
  final String url;
}

class InstallModeManage extends AddonInstallMode {
  const InstallModeManage(this.target);
  final ManageTarget target;
}

/// The result the host returns after actually installing, ported from the
/// `onInstall` resolution.
class InstallOutcome {
  const InstallOutcome({required this.replaced, required this.manifest});
  final bool replaced;
  final Manifest manifest;
}

typedef InstallRunner =
    Future<InstallOutcome?> Function(String url, {String? replaceTransportUrl});

/// The staged addon install / manage modal, ported 1:1 from `AddonInstallModal`:
/// paste or pre-seed a URL, read its manifest, preview the match (fresh / update
/// / re-configure), then run a three-step install with a success pane.
class AddonInstallModal extends ConsumerStatefulWidget {
  const AddonInstallModal({
    super.key,
    required this.mode,
    required this.onClose,
    required this.onInstall,
  });

  final AddonInstallMode mode;
  final VoidCallback onClose;
  final InstallRunner onInstall;

  @override
  ConsumerState<AddonInstallModal> createState() => _AddonInstallModalState();
}

class _AddonInstallModalState extends ConsumerState<AddonInstallModal> {
  late final TextEditingController _controller;
  ResolveMatch? _resolved;
  bool _loading = false;
  String? _error;
  List<({String label, bool done})>? _stages;
  ({bool replaced, Manifest manifest})? _done;

  bool get _managing => widget.mode is InstallModeManage;

  @override
  void initState() {
    super.initState();
    final mode = widget.mode;
    _controller = TextEditingController(
      text: mode is InstallModeAdd ? mode.url : '',
    );
    if (mode is InstallModeAdd && mode.url.trim().isNotEmpty) {
      _tryResolve(mode.url.trim());
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _tryResolve(String raw) async {
    setState(() {
      _loading = true;
      _error = null;
      _resolved = null;
    });
    final repo = ref.read(installedAddonsRepoProvider);
    final normalized = repo.normalizeAddonUrl(raw);
    final failure = normalized.failureOrNull;
    if (failure != null) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = failure.message;
        });
      }
      return;
    }
    final url = normalized.valueOrNull!;
    final res = await ref.read(addonClientProvider).manifest(url);
    if (!mounted) return;
    final manifest = res.valueOrNull;
    if (manifest == null) {
      setState(() {
        _loading = false;
        _error = res.failureOrNull?.message ?? "Couldn't read that addon URL.";
      });
      return;
    }
    final installed = ref.read(installedAddonsProvider);
    final mode = widget.mode;
    final match = classifyResolve(
      manifest: manifest,
      url: url,
      installedIds: {for (final a in installed) a.id},
      installed: installed,
      manage: mode is InstallModeManage ? mode.target : null,
    );
    setState(() {
      _loading = false;
      _resolved = match;
    });
  }

  Future<void> _openSetup(ManageTarget target) async {
    final configureUrl = configureUrlOf(target.transportUrl);
    if (Idiom.of(context).isTv) {
      // A TV has no usable browser: hand the setup page to a phone and drop the
      // install link it returns into the paste field so the existing preview +
      // Update flow resolves and confirms it (keeps the modal open).
      final installUrl = await configureOnPhone(
        context,
        ref,
        configureUrl: configureUrl,
        addonName: target.name,
      );
      if (installUrl != null && installUrl.isNotEmpty && mounted) {
        _controller.text = installUrl;
        await _tryResolve(installUrl.trim());
      }
      return;
    }
    await launchExternalUrl(configureUrl);
    widget.onClose();
  }

  Future<void> _submit() async {
    final resolved = _resolved;
    if (resolved == null) {
      await _tryResolve(_controller.text.trim());
      return;
    }
    final fresh = resolved.matchKind == AddonMatchKind.fresh;
    setState(() {
      _stages = [
        (
          label: fresh ? 'Reading manifest' : 'Reading new manifest',
          done: true,
        ),
        (
          label: fresh ? 'Saving to library' : 'Swapping configuration',
          done: false,
        ),
        (label: 'Syncing to Stremio', done: false),
      ];
    });
    await Future<void>.delayed(const Duration(milliseconds: 220));
    if (!mounted) return;
    setState(() => _stages = _mark(1));
    try {
      final result = await widget.onInstall(
        resolved.url,
        replaceTransportUrl: resolved.replaceTransportUrl,
      );
      if (!mounted) return;
      setState(() => _stages = _mark(2));
      await Future<void>.delayed(const Duration(milliseconds: 280));
      if (!mounted) return;
      setState(() {
        if (result != null) {
          _done = (replaced: result.replaced, manifest: resolved.manifest);
        } else {
          _stages = null;
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Install failed.';
        _stages = null;
      });
    }
  }

  List<({String label, bool done})> _mark(int index) => [
    for (var i = 0; i < _stages!.length; i++)
      (label: _stages![i].label, done: i == index ? true : _stages![i].done),
  ];

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    final busy = _stages != null || _done != null;
    return Positioned.fill(
      child: GestureDetector(
        onTap: busy ? null : widget.onClose,
        child: ColoredBox(
          color: Colors.black.withValues(alpha: 0.72),
          child: Center(
            child: GestureDetector(
              onTap: () {},
              child: ConstrainedBox(
                constraints: const BoxConstraints(
                  maxWidth: 560,
                  maxHeight: 640,
                ),
                child: Container(
                  margin: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: t.elevated,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: t.edge),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _header(t),
                      Flexible(
                        child: SingleChildScrollView(
                          padding: const EdgeInsets.fromLTRB(24, 20, 24, 20),
                          child: _content(t),
                        ),
                      ),
                      if (_done == null && _stages == null) _footer(t),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _header(HarborTokens t) {
    final mode = widget.mode;
    final eyebrow = _managing ? 'MANAGE ADDON' : 'INSTALL ADDON';
    final title = mode is InstallModeManage ? mode.target.name : 'Add from URL';
    final busy = _stages != null && _done == null;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: t.edgeSoft)),
      ),
      child: Row(
        children: [
          if (mode is InstallModeManage) ...[
            _logoBox(t, 40, mode.target.logo, mode.target.name, circle: true),
            const SizedBox(width: 12),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  eyebrow,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 3.08,
                    color: t.inkSubtle,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                    color: t.ink,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          _closeButton(t, busy),
        ],
      ),
    );
  }

  Widget _closeButton(HarborTokens t, bool disabled) {
    final child = Container(
      width: 36,
      height: 36,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: t.raised, shape: BoxShape.circle),
      child: Icon(Icons.close, size: 16, color: t.inkMuted),
    );
    if (disabled) return Opacity(opacity: 0.4, child: child);
    return Focusable(
      tokens: t,
      borderRadius: 999,
      onPressed: widget.onClose,
      child: child,
    );
  }

  Widget _content(HarborTokens t) {
    if (_done != null) return _successPane(t, _done!);
    if (_stages != null) return _installingPane(t, _stages!);
    final mode = widget.mode;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (mode is InstallModeManage) _manageStep1(t, mode.target),
        _pasteRow(t),
        if (_error != null) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: t.danger.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: t.danger.withValues(alpha: 0.3)),
            ),
            child: Text(
              _error!,
              style: TextStyle(fontSize: 12.5, color: t.danger),
            ),
          ),
        ],
        if (_resolved != null) ...[
          const SizedBox(height: 20),
          _manifestPreview(t, _resolved!),
        ],
      ],
    );
  }

  Widget _manageStep1(HarborTokens t, ManageTarget target) => Opacity(
    opacity: _resolved != null ? 0.5 : 1,
    child: Container(
      margin: const EdgeInsets.only(bottom: 20),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: t.canvas.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: t.edgeSoft),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _stepDot(t, '1'),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  "Configure on the addon's setup page",
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                    color: t.ink,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.only(left: 28),
            child: Text(
              "Click below to open ${target.name}'s setup page. Pick your "
              'options, then copy the install link it gives you and paste it '
              'below to update the addon.',
              style: TextStyle(fontSize: 12.5, height: 1.5, color: t.inkMuted),
            ),
          ),
          const SizedBox(height: 10),
          Padding(
            padding: const EdgeInsets.only(left: 28),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Focusable(
                tokens: t,
                borderRadius: 999,
                onPressed: () => _openSetup(target),
                child: Container(
                  height: 36,
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: t.raised,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.settings, size: 12, color: t.inkMuted),
                      const SizedBox(width: 6),
                      Text(
                        'Open setup page',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: t.inkMuted,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.only(left: 28),
            child: Text(
              "Heads-up: a few addons (like AIOStatus) don't pre-fill from the "
              'URL. If the form loads blank, paste the existing manifest URL '
              'into their "Import from URL" field to restore your settings.',
              style: TextStyle(fontSize: 11.5, height: 1.5, color: t.inkSubtle),
            ),
          ),
        ],
      ),
    ),
  );

  Widget _pasteRow(HarborTokens t) {
    final managing = _managing;
    final field = Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
      decoration: BoxDecoration(
        color: t.canvas.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: t.edgeSoft),
      ),
      child: Row(
        children: [
          Expanded(
            child: TvTextField(
              controller: _controller,
              onChanged: (_) {
                if (_resolved != null || _error != null) {
                  setState(() {
                    _resolved = null;
                    _error = null;
                  });
                }
              },
              onSubmitted: (v) {
                if (v.trim().isNotEmpty && !_loading) _tryResolve(v.trim());
              },
              style: TextStyle(fontSize: 13.5, color: t.ink),
              decoration: InputDecoration(
                isDense: true,
                border: InputBorder.none,
                hintText: 'https://...manifest.json or stremio://...',
                hintStyle: TextStyle(fontSize: 13.5, color: t.inkSubtle),
              ),
            ),
          ),
          ValueListenableBuilder<TextEditingValue>(
            valueListenable: _controller,
            builder: (context, value, _) {
              if (value.text.trim().isEmpty) return const SizedBox.shrink();
              return Focusable(
                tokens: t,
                borderRadius: 999,
                onPressed: _loading
                    ? () {}
                    : () => _tryResolve(_controller.text.trim()),
                child: Container(
                  height: 28,
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: t.raised,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: _loading
                      ? SizedBox(
                          width: 11,
                          height: 11,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation(t.inkMuted),
                          ),
                        )
                      : Text(
                          'Read',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: t.inkMuted,
                          ),
                        ),
                ),
              );
            },
          ),
        ],
      ),
    );
    if (!managing) return field;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _stepDot(t, '2'),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Or paste the install link manually',
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w600,
                  color: t.ink,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Padding(padding: const EdgeInsets.only(left: 28), child: field),
      ],
    );
  }

  Widget _manifestPreview(HarborTokens t, ResolveMatch r) {
    final m = r.manifest;
    final name = m.name ?? '';
    final chips = <String>[...m.types, ...m.resources];
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: t.canvas.withValues(alpha: 0.3),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: t.edge),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _logoBox(t, 64, m.logo, name),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              color: t.ink,
                            ),
                          ),
                        ),
                        if (r.isUpdate) ...[
                          const SizedBox(width: 8),
                          _updateBadge(t),
                        ],
                      ],
                    ),
                    if (m.version != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        'v${m.version}',
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w500,
                          letterSpacing: 1.38,
                          color: t.inkSubtle,
                        ),
                      ),
                    ],
                    if (m.description != null && m.description!.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        m.description!,
                        style: TextStyle(
                          fontSize: 13,
                          height: 1.5,
                          color: t.inkMuted,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          if (r.matchKind == AddonMatchKind.hostnameMatch &&
              r.replaceName != null) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: _amber.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: _amber.withValues(alpha: 0.2)),
              ),
              child: Text(
                "Looks like a re-configure of ${r.replaceName}. We'll replace "
                "the existing entry so you don't end up with two copies.",
                style: TextStyle(
                  fontSize: 12,
                  height: 1.5,
                  color: _amber.withValues(alpha: 0.9),
                ),
              ),
            ),
          ],
          if (chips.isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.only(top: 12),
              decoration: BoxDecoration(
                border: Border(top: BorderSide(color: t.edgeSoft)),
              ),
              child: Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [for (final c in chips) _chip(t, c)],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _installingPane(
    HarborTokens t,
    List<({String label, bool done})> stages,
  ) {
    final m = _resolved?.manifest;
    final isUpdate = _resolved?.isUpdate ?? false;
    return Column(
      children: [
        const SizedBox(height: 8),
        _logoBox(t, 64, m?.logo, m?.name ?? '', rounded: true),
        const SizedBox(height: 20),
        Text(
          isUpdate
              ? 'Updating ${m?.name ?? 'addon'}'
              : 'Installing ${m?.name ?? 'addon'}',
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w600,
            color: t.ink,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          "Hang tight, won't be a sec.",
          style: TextStyle(fontSize: 12.5, color: t.inkSubtle),
        ),
        const SizedBox(height: 20),
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 320),
          child: Column(
            children: [
              for (final s in stages) ...[
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    children: [
                      Container(
                        width: 20,
                        height: 20,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: s.done
                              ? _emerald.withValues(alpha: 0.2)
                              : t.raised,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: s.done
                                ? _emerald.withValues(alpha: 0.4)
                                : t.edgeSoft,
                          ),
                        ),
                        child: s.done
                            ? const Icon(Icons.check, size: 11, color: _emerald)
                            : SizedBox(
                                width: 10,
                                height: 10,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  valueColor: AlwaysStoppedAnimation(
                                    t.inkSubtle,
                                  ),
                                ),
                              ),
                      ),
                      const SizedBox(width: 10),
                      Text(
                        s.label,
                        style: TextStyle(
                          fontSize: 12.5,
                          color: s.done ? t.ink : t.inkMuted,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 8),
      ],
    );
  }

  Widget _successPane(HarborTokens t, ({bool replaced, Manifest manifest}) d) =>
      Column(
        children: [
          const SizedBox(height: 8),
          Container(
            width: 56,
            height: 56,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: _emerald.withValues(alpha: 0.2),
              shape: BoxShape.circle,
              border: Border.all(color: _emerald.withValues(alpha: 0.4)),
            ),
            child: const Icon(Icons.check, size: 28, color: _emerald),
          ),
          const SizedBox(height: 16),
          Text(
            d.replaced ? 'Updated' : 'Installed',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w600,
              color: t.ink,
            ),
          ),
          const SizedBox(height: 6),
          Text.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: d.manifest.name,
                  style: TextStyle(fontWeight: FontWeight.w600, color: t.ink),
                ),
                TextSpan(
                  text: d.replaced
                      ? ' is now using your new configuration.'
                      : ' is ready. Open Discover or hit Play on a title to '
                            'use it.',
                ),
              ],
            ),
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, height: 1.5, color: t.inkMuted),
          ),
          const SizedBox(height: 20),
          Focusable(
            tokens: t,
            borderRadius: 999,
            onPressed: widget.onClose,
            child: Container(
              height: 40,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: t.ink,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                'Done',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: t.canvas,
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
        ],
      );

  Widget _footer(HarborTokens t) {
    final resolved = _resolved;
    final canSubmit =
        (resolved != null || _controller.text.trim().isNotEmpty) && !_loading;
    final label = resolved == null
        ? (_loading ? 'Reading' : 'Continue')
        : (resolved.isUpdate ? 'Update' : 'Install');
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: t.edgeSoft)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          Focusable(
            tokens: t,
            borderRadius: 999,
            onPressed: widget.onClose,
            child: Container(
              height: 40,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: t.raised,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                'Cancel',
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: t.inkMuted,
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          _submitButton(t, label, canSubmit),
        ],
      ),
    );
  }

  Widget _submitButton(HarborTokens t, String label, bool enabled) {
    final child = Container(
      height: 40,
      padding: const EdgeInsets.symmetric(horizontal: 20),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: t.ink,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: t.canvas,
        ),
      ),
    );
    if (!enabled) return Opacity(opacity: 0.4, child: child);
    return Focusable(
      tokens: t,
      borderRadius: 999,
      onPressed: _submit,
      child: child,
    );
  }

  Widget _stepDot(HarborTokens t, String n) => Container(
    width: 20,
    height: 20,
    alignment: Alignment.center,
    decoration: BoxDecoration(color: t.ink, shape: BoxShape.circle),
    child: Text(
      n,
      style: TextStyle(
        fontSize: 10.5,
        fontWeight: FontWeight.bold,
        color: t.canvas,
      ),
    ),
  );

  Widget _updateBadge(HarborTokens t) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 1),
    decoration: BoxDecoration(
      color: _amber.withValues(alpha: 0.15),
      borderRadius: BorderRadius.circular(999),
      border: Border.all(color: _amber.withValues(alpha: 0.3)),
    ),
    child: Text(
      'UPDATE',
      style: TextStyle(
        fontSize: 10,
        fontWeight: FontWeight.bold,
        letterSpacing: 1.4,
        color: _amber,
      ),
    ),
  );

  Widget _chip(HarborTokens t, String label) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
    decoration: BoxDecoration(
      color: t.raised,
      borderRadius: BorderRadius.circular(999),
    ),
    child: Text(
      label.toUpperCase(),
      style: TextStyle(
        fontSize: 10.5,
        fontWeight: FontWeight.w600,
        letterSpacing: 1.26,
        color: t.inkMuted,
      ),
    ),
  );

  Widget _logoBox(
    HarborTokens t,
    double size,
    String? logo,
    String name, {
    bool circle = false,
    bool rounded = false,
  }) {
    final radius = circle ? size / 2 : (rounded ? 16.0 : size * 0.22);
    final initial = name.trim().isEmpty ? '?' : name.trim()[0].toUpperCase();
    return Container(
      width: size,
      height: size,
      clipBehavior: Clip.antiAlias,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: t.raised,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: t.edgeSoft),
      ),
      child: (logo != null && logo.isNotEmpty)
          ? CachedNetworkImage(
              imageUrl: logo,
              fit: BoxFit.contain,
              errorWidget: (_, _, _) => _initial(t, initial, size),
            )
          : _initial(t, initial, size),
    );
  }

  Widget _initial(HarborTokens t, String initial, double size) => Text(
    initial,
    style: TextStyle(
      fontSize: size * 0.34,
      fontWeight: FontWeight.w500,
      color: t.inkSubtle,
    ),
  );
}
