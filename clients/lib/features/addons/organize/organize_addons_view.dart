import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/addons_providers.dart';
import '../../../app/nav_controller.dart';
import '../../../app/providers.dart';
import '../../../app/stremio_auth.dart';
import '../../../app/theme_controller.dart';
import '../../../design/focus/focusable.dart';
import '../../../design/tokens.dart';
import '../../../domain/addons/models.dart';
import '../../../domain/addons/reorder.dart';
import 'organize_backups.dart';
import 'organize_section.dart';
import 'organize_utils.dart';

enum _Phase { loading, loadError, ready, saving }

/// The Organize-addons page: reorder the Stremio account collection (synced) and
/// the device-only addons, with order backups and a verified save. Ported 1:1
/// from `OrganizeAddonsPage`. Pushed as its own frame from the Installed tab.
class OrganizeAddonsView extends ConsumerStatefulWidget {
  const OrganizeAddonsView({super.key});

  @override
  ConsumerState<OrganizeAddonsView> createState() => _OrganizeAddonsViewState();
}

class _OrganizeAddonsViewState extends ConsumerState<OrganizeAddonsView> {
  _Phase _phase = _Phase.loading;
  SaveStep? _step;
  Notice? _notice;
  String? _authKey;

  List<CollectionAddon> _baselineCloud = const [];
  List<CollectionAddon> _workingCloud = const [];
  List<InstalledAddon> _baselineDevice = const [];
  List<InstalledAddon> _workingDevice = const [];

  List<AddonOrderBackup> _backups = const [];
  bool _backupsOpen = false;
  bool _backedUp = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _phase = _Phase.loading;
      _notice = null;
    });
    final session = await ref.read(stremioSessionProvider.future);
    if (!mounted) return;
    final authKey = session?.authKey;
    _authKey = authKey;
    _backups = ref.read(addonOrderStoreProvider).loadBackups();
    final device = ref.read(installedAddonsProvider);

    if (authKey == null || authKey.isEmpty) {
      setState(() {
        _baselineCloud = const [];
        _workingCloud = const [];
        _baselineDevice = device;
        _workingDevice = [...device];
        _phase = _Phase.ready;
      });
      return;
    }

    final res = await ref.read(stremioApiProvider).addonCollectionGet(authKey);
    if (!mounted) return;
    final raw = res.valueOrNull;
    if (raw == null) {
      setState(() => _phase = _Phase.loadError);
      return;
    }
    final cloud = _asCollection(raw);
    final cloudUrls = {for (final a in cloud) a['transportUrl']};
    final device2 = [
      for (final d in device)
        if (!cloudUrls.contains(d.transportUrl)) d,
    ];
    setState(() {
      _baselineCloud = cloud;
      _workingCloud = [...cloud];
      _baselineDevice = device2;
      _workingDevice = [...device2];
      _phase = _Phase.ready;
    });
  }

  List<CollectionAddon> _asCollection(List<dynamic> raw) => [
    for (final a in raw)
      if (a is Map) a.cast<String, dynamic>(),
  ];

  bool get _cloudDirty =>
      !sequencesEqual(urlsOfCloud(_workingCloud), urlsOfCloud(_baselineCloud));
  bool get _deviceDirty => !sequencesEqual(
    urlsOfDevice(_workingDevice),
    urlsOfDevice(_baselineDevice),
  );
  bool get _dirty => _cloudDirty || _deviceDirty;
  bool get _saving => _phase == _Phase.saving;

  void _close() => ref.read(navControllerProvider.notifier).back();

  void _refreshBackups() => setState(
    () => _backups = ref.read(addonOrderStoreProvider).loadBackups(),
  );

  Future<void> _mirrorLocal() async {
    final urls = [
      ...urlsOfCloud(_workingCloud),
      ...urlsOfDevice(_workingDevice),
    ];
    await ref.read(addonOrderStoreProvider).saveDisplayOrder(urls);
    await ref.read(installedAddonsProvider.notifier).reorder(urls);
  }

  void _onSaved() {
    ref.invalidate(addonsCatalogProvider);
    _close();
  }

  Future<void> _handleSave() async {
    if (!_dirty || _phase != _Phase.ready) return;
    setState(() => _notice = null);
    final authKey = _authKey;
    final store = ref.read(addonOrderStoreProvider);
    try {
      if (_cloudDirty && authKey != null) {
        setState(() {
          _phase = _Phase.saving;
          _step = SaveStep.checking;
        });
        final api = ref.read(stremioApiProvider);
        final result = await store.saveCollectionOrder(
          baseline: _baselineCloud,
          next: _workingCloud,
          alreadyBackedUp: _backedUp,
          fetch: () async {
            final r = await api.addonCollectionGet(authKey);
            final v = r.valueOrNull;
            return v == null ? null : _asCollection(v);
          },
          write: (items) async {
            final r = await api.addonCollectionSet(authKey, items);
            return r.isOk;
          },
          onStep: (s) {
            if (mounted) setState(() => _step = s);
          },
        );
        if (!mounted) return;
        if (result is SaveSuccess) {
          _backedUp = true;
          await _mirrorLocal();
          if (mounted) _onSaved();
          return;
        }
        if (result is SaveWriteFailure || result is SaveVerifyFailure) {
          _backedUp = true;
        }
        _refreshBackups();
        setState(() {
          _phase = _Phase.ready;
          _notice = noticeFor(result);
        });
        return;
      }
      await _mirrorLocal();
      if (mounted) _onSaved();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _phase = _Phase.ready;
        _notice = const Notice(
          tone: NoticeTone.danger,
          text:
              'Something unexpected went wrong. Nothing may have been written. '
              'Retry to re-check.',
          retry: true,
        );
      });
    }
  }

  Future<void> _handleBackupNow() async {
    if (_workingCloud.isEmpty) return;
    await ref.read(addonOrderStoreProvider).pushBackup(_workingCloud);
    if (!mounted) return;
    _refreshBackups();
    setState(
      () => _notice = const Notice(
        tone: NoticeTone.info,
        text:
            'Backed up. The current account order is saved in the Backups '
            'panel.',
      ),
    );
  }

  void _handleRestore(AddonOrderBackup b) {
    setState(() {
      _workingCloud = applyOrderToItems(
        _baselineCloud,
        b.urls,
        (m) => m['transportUrl'] as String?,
      );
      _backupsOpen = false;
      _notice = const Notice(
        tone: NoticeTone.info,
        text:
            'Backup loaded into the editor. Addons added since stay at the end. '
            'Nothing changes until you press Save.',
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    return Container(
      color: t.canvas,
      child: Column(
        children: [
          _header(t),
          if (_backupsOpen && _showBackups)
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 8),
              child: Container(
                constraints: const BoxConstraints(maxWidth: 1160),
                decoration: BoxDecoration(
                  color: t.elevated,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: t.edge),
                ),
                child: OrganizeBackupsPanel(
                  tokens: t,
                  backups: _backups,
                  busy: _saving,
                  canBackup: _workingCloud.isNotEmpty && _phase == _Phase.ready,
                  onBackupNow: _handleBackupNow,
                  onRestore: _handleRestore,
                ),
              ),
            ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(24, 8, 24, 48),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 1160),
                  child: _body(t),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  bool get _showBackups => _authKey != null && _phase != _Phase.loadError;

  Widget _header(HarborTokens t) => Container(
    padding: const EdgeInsets.fromLTRB(24, 20, 24, 20),
    decoration: BoxDecoration(
      border: Border(bottom: BorderSide(color: t.edgeSoft)),
    ),
    child: Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 1160),
        child: Row(
          children: [
            _circleButton(t, Icons.arrow_back, _saving ? null : _close),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Organize addons',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w500,
                      color: t.ink,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'The order decides who answers first when you press Play. '
                    'Drag, use the arrows, or jump anything straight to the top.',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 13, color: t.inkMuted),
                  ),
                ],
              ),
            ),
            if (_showBackups) ...[const SizedBox(width: 12), _backupsButton(t)],
            if (_phase != _Phase.loadError) ...[
              const SizedBox(width: 10),
              _pill(
                t,
                'Cancel',
                filled: false,
                onPressed: _saving ? null : _close,
              ),
              const SizedBox(width: 10),
              _saveButton(t),
            ],
          ],
        ),
      ),
    ),
  );

  Widget _backupsButton(HarborTokens t) => Focusable(
    tokens: t,
    borderRadius: 999,
    onPressed: () => setState(() => _backupsOpen = !_backupsOpen),
    child: Container(
      height: 44,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: _backupsOpen ? t.raised : t.elevated,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: _backupsOpen ? t.edge : t.edgeSoft),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.history, size: 15, color: t.inkMuted),
          const SizedBox(width: 8),
          Text(
            'Backups',
            style: TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w600,
              color: t.inkMuted,
            ),
          ),
          if (_backups.isNotEmpty) ...[
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 1),
              decoration: BoxDecoration(
                color: t.accent.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                '${_backups.length}',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: t.accent,
                ),
              ),
            ),
          ],
          const SizedBox(width: 6),
          Icon(
            _backupsOpen ? Icons.expand_less : Icons.expand_more,
            size: 14,
            color: t.inkMuted,
          ),
        ],
      ),
    ),
  );

  Widget _saveButton(HarborTokens t) {
    final enabled = _dirty && _phase == _Phase.ready;
    final label = _saving && _step != null ? stepLabel(_step!) : 'Save order';
    final child = Container(
      height: 44,
      padding: const EdgeInsets.symmetric(horizontal: 24),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: t.ink,
        borderRadius: BorderRadius.circular(999),
        border: enabled && !_saving
            ? Border.all(color: t.accent.withValues(alpha: 0.5), width: 2)
            : null,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_saving) ...[
            SizedBox(
              width: 15,
              height: 15,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation(t.canvas),
              ),
            ),
            const SizedBox(width: 8),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: t.canvas,
            ),
          ),
        ],
      ),
    );
    if (!enabled) return Opacity(opacity: 0.4, child: child);
    return Focusable(
      tokens: t,
      borderRadius: 999,
      onPressed: _handleSave,
      child: child,
    );
  }

  Widget _body(HarborTokens t) {
    if (_phase == _Phase.loadError) return _loadError(t);
    return LayoutBuilder(
      builder: (context, constraints) {
        final wide = constraints.maxWidth >= 900;
        final sections = _sections(t);
        final sidebar = _goodToKnow(t);
        if (!wide) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [sections, const SizedBox(height: 24), sidebar],
          );
        }
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: sections),
            const SizedBox(width: 24),
            SizedBox(width: 360, child: sidebar),
          ],
        );
      },
    );
  }

  Widget _sections(HarborTokens t) {
    final children = <Widget>[];
    if (_notice != null) {
      children.add(_noticeBanner(t, _notice!));
      children.add(const SizedBox(height: 24));
    }
    if (_authKey != null) {
      children.add(
        SectionCard(
          tokens: t,
          title: 'Your Stremio account',
          sub:
              'This order syncs to every Stremio app signed into this account.',
          count: _workingCloud.length,
          child: _phase == _Phase.loading
              ? SkeletonRows(tokens: t)
              : _workingCloud.isEmpty
              ? _dashed(t, 'No addons are synced to this account yet.')
              : OrganizeList(
                  tokens: t,
                  entries: entriesOfCloud(_workingCloud),
                  busy: _saving,
                  onReorder: (from, to) => setState(
                    () => _workingCloud = moveItem(_workingCloud, from, to),
                  ),
                  onMove: (i, delta) => setState(
                    () => _workingCloud = moveItem(_workingCloud, i, i + delta),
                  ),
                  onMoveTop: (i) => setState(
                    () => _workingCloud = moveItem(_workingCloud, i, 0),
                  ),
                ),
        ),
      );
      if (_workingDevice.isNotEmpty) {
        children.add(const SizedBox(height: 24));
        children.add(_deviceSection(t));
      }
    } else {
      children.add(
        SectionCard(
          tokens: t,
          title: 'On this device',
          sub:
              'Sign in to Stremio to organize the addons synced to your '
              'account.',
          count: _workingDevice.length,
          child: _phase == _Phase.loading
              ? SkeletonRows(tokens: t)
              : _deviceList(t),
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: children,
    );
  }

  Widget _deviceSection(HarborTokens t) => SectionCard(
    tokens: t,
    title: 'On this device only',
    sub: 'These live in Harbor on this computer and never touch your account.',
    count: _workingDevice.length,
    child: _deviceList(t),
  );

  Widget _deviceList(HarborTokens t) => OrganizeList(
    tokens: t,
    entries: entriesOfDevice(_workingDevice),
    busy: _saving,
    onReorder: (from, to) =>
        setState(() => _workingDevice = moveItem(_workingDevice, from, to)),
    onMove: (i, delta) =>
        setState(() => _workingDevice = moveItem(_workingDevice, i, i + delta)),
    onMoveTop: (i) =>
        setState(() => _workingDevice = moveItem(_workingDevice, i, 0)),
  );

  Widget _goodToKnow(HarborTokens t) => Container(
    padding: const EdgeInsets.all(20),
    decoration: BoxDecoration(
      color: t.elevated.withValues(alpha: 0.4),
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: t.edgeSoft),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(Icons.info_outline, size: 15, color: t.inkMuted),
            const SizedBox(width: 8),
            Text(
              'Good to know',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w500,
                color: t.ink,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        for (final line in const [
          'Number 1 gets asked first for streams when you press Play.',
          "The order also decides which addon's rows win on your Home screen.",
          'Nothing changes until you press Save. Leaving this page discards '
              'edits.',
          'The Backups button at the top keeps your last five orders. One '
              'click restores any of them.',
          'Harbor double-checks with Stremio after saving, so a half-written '
              "order can't slip through.",
        ]) ...[
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Text(
              line,
              style: TextStyle(fontSize: 13, height: 1.5, color: t.inkMuted),
            ),
          ),
        ],
      ],
    ),
  );

  Widget _noticeBanner(HarborTokens t, Notice n) {
    final danger = n.tone == NoticeTone.danger;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: BoxDecoration(
        color: danger
            ? t.danger.withValues(alpha: 0.15)
            : t.elevated.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: danger ? t.danger.withValues(alpha: 0.3) : t.edge,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            n.text,
            style: TextStyle(
              fontSize: 13.5,
              height: 1.5,
              color: danger ? t.danger : t.inkMuted,
            ),
          ),
          if (n.retry || n.reload) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                if (n.retry) _smallButton(t, 'Retry', _handleSave),
                if (n.retry && n.reload) const SizedBox(width: 10),
                if (n.reload) _smallButton(t, 'Reload list', _load),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _loadError(HarborTokens t) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 80),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Text(
            "Couldn't load your Stremio collection. Nothing can be reordered "
            'safely without it.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 15, height: 1.5, color: t.inkMuted),
          ),
        ),
        const SizedBox(height: 20),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _pill(t, 'Try again', filled: true, onPressed: _load),
            const SizedBox(width: 12),
            _pill(t, 'Go back', filled: false, onPressed: _close),
          ],
        ),
      ],
    ),
  );

  Widget _dashed(HarborTokens t, String text) => Container(
    width: double.infinity,
    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
    decoration: BoxDecoration(
      color: t.canvas.withValues(alpha: 0.3),
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: t.edgeSoft),
    ),
    child: Text(text, style: TextStyle(fontSize: 13.5, color: t.inkSubtle)),
  );

  Widget _circleButton(HarborTokens t, IconData icon, VoidCallback? onPressed) {
    final child = Container(
      width: 44,
      height: 44,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: t.elevated,
        shape: BoxShape.circle,
        border: Border.all(color: t.edgeSoft),
      ),
      child: Icon(icon, size: 18, color: t.inkMuted),
    );
    if (onPressed == null) return Opacity(opacity: 0.4, child: child);
    return Focusable(
      tokens: t,
      borderRadius: 999,
      onPressed: onPressed,
      child: child,
    );
  }

  Widget _pill(
    HarborTokens t,
    String label, {
    required bool filled,
    VoidCallback? onPressed,
  }) {
    final child = Container(
      height: 44,
      padding: const EdgeInsets.symmetric(horizontal: 20),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: filled ? t.ink : t.elevated,
        borderRadius: BorderRadius.circular(999),
        border: filled ? null : Border.all(color: t.edgeSoft),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 13.5,
          fontWeight: FontWeight.w600,
          color: filled ? t.canvas : t.inkMuted,
        ),
      ),
    );
    if (onPressed == null) return Opacity(opacity: 0.4, child: child);
    return Focusable(
      tokens: t,
      borderRadius: 999,
      onPressed: onPressed,
      child: child,
    );
  }

  Widget _smallButton(HarborTokens t, String label, VoidCallback onPressed) =>
      Focusable(
        tokens: t,
        borderRadius: 999,
        onPressed: onPressed,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            color: t.raised,
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
              color: t.inkMuted,
            ),
          ),
        ),
      );
}
