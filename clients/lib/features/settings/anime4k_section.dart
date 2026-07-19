import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/anime4k_providers.dart';
import '../../app/i18n_providers.dart';
import '../../app/providers.dart';
import '../../design/focus/focusable.dart';
import '../../design/tokens.dart';
import '../../domain/player/anime4k_modes.dart';
import '../../domain/player/anime4k_store.dart';
import 'settings_controls.dart';

/// The Anime4K presets settings section — the native port of the web
/// `Anime4kShaderList`. It downloads the GPU shader pack on demand (the shaders
/// are not bundled), then exposes the quality tier and the six upscaling modes.
/// On first mount it probes for an already-installed pack and adopts it.
class Anime4kSection extends ConsumerStatefulWidget {
  const Anime4kSection({super.key, required this.tokens});

  final HarborTokens tokens;

  @override
  ConsumerState<Anime4kSection> createState() => _Anime4kSectionState();
}

class _Anime4kSectionState extends ConsumerState<Anime4kSection> {
  bool _busy = false;
  bool _justUpdated = false;
  String? _error;
  bool _probed = false;

  @override
  void initState() {
    super.initState();
    // Adopt an already-installed pack when no folder is recorded yet (a fresh
    // profile on a device where the shaders were downloaded before).
    WidgetsBinding.instance.addPostFrameCallback((_) => _probeInstalled());
  }

  Future<void> _probeInstalled() async {
    if (_probed) return;
    _probed = true;
    final settings = ref.read(settingsProvider);
    if (settings.getString('playerAnime4kFolder').isNotEmpty) return;
    final store = await ref.read(anime4kStoreProvider.future);
    final dir = await store.installedDir();
    if (dir == null || !mounted) return;
    _adopt(dir);
  }

  /// Records the installed folder and the resolved chain for the current mode.
  void _adopt(String dir) {
    final settings = ref.read(settingsProvider);
    final mode =
        anime4kModeFromId(settings.getString('playerAnime4kMode')) ??
        Anime4kMode.a;
    final tier = settings.getString('playerAnime4kTier') == 'fast'
        ? Anime4kTier.fast
        : Anime4kTier.hq;
    ref.read(settingsProvider.notifier)
      ..setValue('playerAnime4kFolder', dir)
      ..setValue('playerAnime4kShaders', anime4kChain(dir, mode, tier));
  }

  Future<void> _setup({bool force = false}) async {
    setState(() {
      _busy = true;
      _error = null;
      _justUpdated = false;
    });
    try {
      final store = await ref.read(anime4kStoreProvider.future);
      final dir = await store.download(force: force);
      if (!mounted) return;
      _adopt(dir);
      if (force) {
        setState(() => _justUpdated = true);
        Future.delayed(const Duration(milliseconds: 2200), () {
          if (mounted) setState(() => _justUpdated = false);
        });
      }
    } on Anime4kDownloadException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) {
        setState(
          () => _error = ref
              .read(translationsProvider)
              .t('Download failed. Check your connection and try again.'),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _pickMode(Anime4kMode mode) {
    final settings = ref.read(settingsProvider);
    final folder = settings.getString('playerAnime4kFolder');
    final tier = settings.getString('playerAnime4kTier') == 'fast'
        ? Anime4kTier.fast
        : Anime4kTier.hq;
    ref.read(settingsProvider.notifier)
      ..setValue('playerAnime4kMode', mode.id)
      ..setValue('playerAnime4kShaders', anime4kChain(folder, mode, tier));
  }

  void _pickTier(Anime4kTier tier) {
    final settings = ref.read(settingsProvider);
    final folder = settings.getString('playerAnime4kFolder');
    final mode =
        anime4kModeFromId(settings.getString('playerAnime4kMode')) ??
        Anime4kMode.a;
    ref.read(settingsProvider.notifier)
      ..setValue('playerAnime4kTier', tier == Anime4kTier.fast ? 'fast' : 'hq')
      ..setValue('playerAnime4kShaders', anime4kChain(folder, mode, tier));
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    final tr = ref.watch(translationsProvider);
    final settings = ref.watch(settingsProvider);
    final folder = settings.getString('playerAnime4kFolder');
    final mode =
        anime4kModeFromId(settings.getString('playerAnime4kMode')) ??
        Anime4kMode.a;
    final tier = settings.getString('playerAnime4kTier') == 'fast'
        ? Anime4kTier.fast
        : Anime4kTier.hq;

    return SettingsSection(
      tokens: t,
      title: tr.t('Anime4K presets'),
      subtitle: tr.t(
        'GPU shaders that sharpen lines and clean up gradients on anime as '
        'it plays. Pick a mode, Harbor handles the shaders.',
      ),
      children: [
        if (folder.isEmpty)
          _setupCard(t)
        else ...[
          SettingSegmented<Anime4kTier>(
            tokens: t,
            label: tr.t('Quality tier'),
            value: tier,
            onChanged: _pickTier,
            options: [
              SettingOption(value: Anime4kTier.hq, label: tr.t('Quality')),
              SettingOption(
                value: Anime4kTier.fast,
                label: tr.t('Performance'),
              ),
            ],
          ),
          SettingRadioGroup<Anime4kMode>(
            tokens: t,
            label: tr.t('Mode'),
            value: mode,
            onChanged: _pickMode,
            options: [
              for (final m in kAnime4kModes)
                SettingRadioOption(
                  value: m.mode,
                  label: tr.t(m.label),
                  sub: tr.t(m.sub),
                ),
            ],
          ),
          _installedFooter(t),
          if (_error != null) _errorBox(t, _error!),
        ],
      ],
    );
  }

  Widget _setupCard(HarborTokens t) {
    final tr = ref.watch(translationsProvider);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: t.canvas.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: t.edgeSoft),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            tr.t(
              'One-time setup downloads the shader pack (about 1 MB) into '
              'Harbor. No files to hunt down.',
            ),
            style: TextStyle(color: t.inkMuted, fontSize: 13, height: 1.4),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            _errorBox(t, _error!),
          ],
          const SizedBox(height: 14),
          _downloadButton(
            t,
            label: _busy
                ? tr.t('Downloading shaders…')
                : tr.t('Set up Anime4K'),
            icon: _busy ? Icons.hourglass_top : Icons.download,
            onPressed: _busy ? null : () => _setup(),
            filled: true,
          ),
        ],
      ),
    );
  }

  Widget _installedFooter(HarborTokens t) {
    final tr = ref.watch(translationsProvider);
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          children: [
            Icon(Icons.check_circle, size: 15, color: t.success),
            const SizedBox(width: 6),
            Text(
              tr.t('Shaders installed'),
              style: TextStyle(color: t.inkSubtle, fontSize: 12.5),
            ),
          ],
        ),
        _downloadButton(
          t,
          label: _busy
              ? tr.t('Updating…')
              : _justUpdated
              ? tr.t('Updated')
              : tr.t('Re-download'),
          icon: _busy
              ? Icons.hourglass_top
              : _justUpdated
              ? Icons.check
              : Icons.refresh,
          onPressed: _busy ? null : () => _setup(force: true),
          filled: false,
          accent: _justUpdated,
        ),
      ],
    );
  }

  Widget _errorBox(HarborTokens t, String message) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: t.danger.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: t.danger.withValues(alpha: 0.3)),
      ),
      child: Text(message, style: TextStyle(color: t.danger, fontSize: 12)),
    );
  }

  Widget _downloadButton(
    HarborTokens t, {
    required String label,
    required IconData icon,
    required VoidCallback? onPressed,
    required bool filled,
    bool accent = false,
  }) {
    final fg = filled
        ? t.canvas
        : accent
        ? t.success
        : t.inkSubtle;
    final child = Container(
      padding: EdgeInsets.symmetric(horizontal: filled ? 20 : 12, vertical: 10),
      decoration: BoxDecoration(
        color: filled ? t.ink : Colors.transparent,
        borderRadius: BorderRadius.circular(filled ? 24 : 10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: filled ? 16 : 13, color: fg),
          const SizedBox(width: 8),
          Text(
            label,
            style: TextStyle(
              color: fg,
              fontSize: filled ? 14 : 11.5,
              fontWeight: FontWeight.w600,
              letterSpacing: filled ? 0 : 1.2,
            ),
          ),
        ],
      ),
    );
    return Opacity(
      opacity: onPressed == null ? 0.7 : 1,
      child: Focusable(
        tokens: t,
        scale: 1.0,
        borderRadius: filled ? 24 : 10,
        onPressed: onPressed ?? () {},
        child: child,
      ),
    );
  }
}
