import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../app/simkl_providers.dart';
import '../../design/focus/focusable.dart';
import '../../design/overlays/context_menu.dart';
import '../../design/tokens.dart';
import '../../domain/simkl/simkl_types.dart';

const _kMovieOrder = ['plantowatch', 'completed', 'dropped'];
const _kShowOrder = ['watching', 'plantowatch', 'hold', 'completed', 'dropped'];
const _kLabels = {
  'watching': 'Watching',
  'plantowatch': 'Plan to Watch',
  'hold': 'On Hold',
  'completed': 'Completed',
  'dropped': 'Dropped',
};
const _kSimklTeal = Color(0xFF1A7F8E);
const _kRemove = '__remove__';

/// The Simkl "Add to list" hero action, ported from web `AddToSimklButton`.
/// Shown on movie/series detail pages when Simkl is connected and the id
/// resolves to a Simkl target: unset → "Add to Simkl" (plantowatch); set → a
/// status pill whose menu switches status (movie: Plan/Completed/Dropped; show:
/// Watching/Plan/On Hold/Completed/Dropped) or removes the entry. Optimistic.
/// Self-hides otherwise. Target + current status come from
/// [simklListEntryProvider].
class SimklAddButton extends ConsumerStatefulWidget {
  const SimklAddButton({
    super.key,
    required this.type,
    required this.id,
    required this.tokens,
  });

  final String type;
  final String id;
  final HarborTokens tokens;

  @override
  ConsumerState<SimklAddButton> createState() => _SimklAddButtonState();
}

class _SimklAddButtonState extends ConsumerState<SimklAddButton> {
  bool _busy = false;
  bool _dirty = false;
  String? _status;

  @override
  Widget build(BuildContext context) {
    final data = ref
        .watch(simklListEntryProvider((type: widget.type, id: widget.id)))
        .value;
    if (data == null || data.target == null) return const SizedBox.shrink();
    final target = data.target!;
    final status = _dirty ? _status : data.status;
    final t = widget.tokens;
    final tr = ref.watch(translationsProvider);

    if (status == null) {
      return _pill(
        t,
        label: tr.t('Add to Simkl'),
        showAdd: true,
        active: false,
        onPressed: () {
          if (!_busy) _setTo(target, 'plantowatch');
        },
      );
    }
    return _pill(
      t,
      label: tr.t(_kLabels[status] ?? status),
      showChevron: true,
      active: true,
      onPressed: () {
        if (!_busy) _openMenu(context, t, tr, target, data.movie, status);
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
              // Simkl brand mark (no bundled logo asset — use the brand teal).
              Container(
                width: 18,
                height: 18,
                decoration: BoxDecoration(
                  color: _kSimklTeal,
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
    SimklTarget target,
    bool movie,
    String status,
  ) async {
    final order = movie ? _kMovieOrder : _kShowOrder;
    final chosen = await showContextMenu<String>(
      context: context,
      tokens: t,
      actions: [
        for (final s in order)
          ContextMenuAction(
            value: s,
            label: tr.t(_kLabels[s]!),
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
      await _remove(target);
    } else if (chosen != status) {
      await _setTo(target, chosen);
    }
  }

  Future<void> _setTo(SimklTarget target, String next) async {
    final prev = _dirty ? _status : null;
    setState(() {
      _busy = true;
      _dirty = true;
      _status = next;
    });
    try {
      final saved = await ref
          .read(simklClientProvider)
          .setListStatus(target, next);
      if (!mounted) return;
      setState(() {
        _status = saved;
        _busy = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _status = prev;
        _busy = false;
      });
    }
  }

  Future<void> _remove(SimklTarget target) async {
    final prev = _dirty ? _status : null;
    setState(() {
      _busy = true;
      _dirty = true;
      _status = null;
    });
    try {
      await ref.read(simklClientProvider).removeFromWatchlist(target);
      if (mounted) setState(() => _busy = false);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _status = prev;
        _busy = false;
      });
    }
  }
}
