import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/anilist_providers.dart';
import '../../app/i18n_providers.dart';
import '../../design/focus/focusable.dart';
import '../../design/overlays/context_menu.dart';
import '../../design/tokens.dart';
import '../../domain/anilist/anilist_mutations.dart';

const _kStatusOrder = [
  'CURRENT',
  'PLANNING',
  'COMPLETED',
  'REPEATING',
  'PAUSED',
  'DROPPED',
];
const _kStatusLabels = {
  'CURRENT': 'Watching',
  'PLANNING': 'Plan to Watch',
  'COMPLETED': 'Completed',
  'REPEATING': 'Rewatching',
  'PAUSED': 'On Hold',
  'DROPPED': 'Dropped',
};
const _kAnilistBlue = Color(0xFF02A9FF);
const _kRemove = '__remove__';

/// The AniList "Add to list" hero action, ported from web `AddToAnilistButton`.
/// Shown on anime detail pages when AniList is connected and the title resolves
/// to an AniList media id. Unset → "Add to AniList" (writes PLANNING); set → a
/// status pill whose menu switches status (CURRENT/PLANNING/COMPLETED/REPEATING/
/// PAUSED/DROPPED) or removes the entry. Writes are optimistic. Self-hides
/// otherwise. The status + entry-id come from [anilistListEntryProvider].
class AnilistAddButton extends ConsumerStatefulWidget {
  const AnilistAddButton({
    super.key,
    required this.harborId,
    required this.tokens,
  });

  final String harborId;
  final HarborTokens tokens;

  @override
  ConsumerState<AnilistAddButton> createState() => _AnilistAddButtonState();
}

class _AnilistAddButtonState extends ConsumerState<AnilistAddButton> {
  bool _busy = false;
  // Once the user acts, the local optimistic state wins over the provider.
  bool _dirty = false;
  String? _status;
  int? _entryId;

  @override
  Widget build(BuildContext context) {
    final data = ref.watch(anilistListEntryProvider(widget.harborId)).value;
    if (data == null || data.mediaId == null) return const SizedBox.shrink();
    final mediaId = data.mediaId!;
    final status = _dirty ? _status : data.status;
    final entryId = _dirty ? _entryId : data.entryId;
    final t = widget.tokens;
    final tr = ref.watch(translationsProvider);

    if (status == null) {
      return _pill(
        t,
        label: tr.t('Add to AniList'),
        showAdd: true,
        active: false,
        onPressed: () {
          if (!_busy) _setTo(mediaId, 'PLANNING');
        },
      );
    }
    return _pill(
      t,
      label: tr.t(_kStatusLabels[status] ?? status),
      showChevron: true,
      active: true,
      onPressed: () {
        if (!_busy) _openMenu(context, t, tr, mediaId, status, entryId);
      },
    );
  }

  Widget _pill(
    HarborTokens t, {
    required String label,
    required bool active,
    required VoidCallback onPressed,
    bool showAdd = false,
    bool showChevron = false,
  }) {
    return Focusable(
      tokens: t,
      borderRadius: 999,
      onPressed: onPressed,
      child: Opacity(
        opacity: _busy ? 0.6 : 1,
        child: Container(
          height: 48,
          padding: const EdgeInsets.symmetric(horizontal: 20),
          decoration: BoxDecoration(
            color: active ? t.ink.withValues(alpha: 0.10) : t.canvas,
            border: Border.all(color: active ? t.ink : t.edge),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              // AniList brand mark (no bundled logo asset — use the brand blue).
              Container(
                width: 18,
                height: 18,
                decoration: BoxDecoration(
                  color: _kAnilistBlue,
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
              const SizedBox(width: 10),
              if (showAdd) ...[
                Icon(Icons.add, size: 16, color: t.ink),
                const SizedBox(width: 4),
              ],
              Text(
                label,
                style: TextStyle(
                  color: t.ink,
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                ),
              ),
              if (showChevron) ...[
                const SizedBox(width: 8),
                Icon(Icons.keyboard_arrow_down, size: 18, color: t.inkMuted),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _openMenu(
    BuildContext context,
    HarborTokens t,
    dynamic tr,
    int mediaId,
    String status,
    int? entryId,
  ) async {
    final chosen = await showContextMenu<String>(
      context: context,
      tokens: t,
      actions: [
        for (final s in _kStatusOrder)
          ContextMenuAction(
            value: s,
            label: tr.t(_kStatusLabels[s]!),
            icon: s == status ? Icons.check : Icons.radio_button_unchecked,
          ),
        ContextMenuAction(
          value: _kRemove,
          label: tr.t('Remove from list'),
          icon: Icons.delete_outline,
          danger: true,
        ),
      ],
    );
    if (chosen == null || _busy) return;
    if (chosen == _kRemove) {
      await _remove(entryId);
    } else if (chosen != status) {
      await _setTo(mediaId, chosen);
    }
  }

  Future<void> _setTo(int mediaId, String next) async {
    final prevStatus = _dirty ? _status : null;
    setState(() {
      _busy = true;
      _dirty = true;
      _status = next;
    });
    final client = ref.read(anilistClientProvider);
    final token = ref.read(anilistSessionStoreProvider).read()?.accessToken;
    if (token == null || token.isEmpty) {
      if (mounted) setState(() => _busy = false);
      return;
    }
    try {
      final saved = await saveAnilistListEntry(
        client,
        accessToken: token,
        mediaId: mediaId,
        status: next,
      );
      if (!mounted) return;
      setState(() {
        if (saved != null) {
          if (saved.status.isNotEmpty) _status = saved.status;
          _entryId = saved.id;
        }
        _busy = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _status = prevStatus;
        _busy = false;
      });
    }
  }

  Future<void> _remove(int? entryId) async {
    if (entryId == null) return;
    setState(() {
      _busy = true;
      _dirty = true;
      _status = null;
      _entryId = null;
    });
    final client = ref.read(anilistClientProvider);
    final token = ref.read(anilistSessionStoreProvider).read()?.accessToken;
    if (token == null || token.isEmpty) {
      if (mounted) setState(() => _busy = false);
      return;
    }
    try {
      await deleteAnilistListEntry(
        client,
        accessToken: token,
        entryId: entryId,
      );
      if (mounted) setState(() => _busy = false);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _status = null; // best-effort; the provider re-fetch reconciles
        _entryId = entryId;
        _busy = false;
      });
    }
  }
}
