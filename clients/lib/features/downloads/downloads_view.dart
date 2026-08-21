import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/download_providers.dart';
import '../../app/i18n_providers.dart';
import '../../app/nav_controller.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/focusable.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/downloads/download_engine.dart';
import '../../domain/downloads/download_groups.dart';
import '../../domain/downloads/downloads_store.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/nav/frame.dart';

/// The Downloads view, ported from `views/downloads.tsx` (`docs/60`): saved and
/// in-progress downloads grouped as movies / series, each with status-specific
/// progress and actions (pause / resume / cancel / delete / play).
class DownloadsView extends ConsumerWidget {
  const DownloadsView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(tokensProvider);
    final tr = ref.watch(translationsProvider);
    final engine = ref.watch(downloadEngineProvider);
    return ValueListenableBuilder<List<DownloadItem>>(
      valueListenable: engine.items,
      builder: (context, items, _) {
        final groups = buildDownloadGroups(items);
        final g = pageGutter(Idiom.of(context));
        return SafeArea(
          child: Padding(
            padding: EdgeInsets.fromLTRB(g, 32, g, 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  tr.tOr('nav.downloads', 'Downloads'),
                  style: TextStyle(
                    color: t.ink,
                    fontSize: 30,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _subtitle(items, tr),
                  style: TextStyle(color: t.inkMuted, fontSize: 13.5),
                ),
                const SizedBox(height: 24),
                Expanded(
                  child: items.isEmpty
                      ? Center(
                          child: Text(
                            tr.t('Nothing downloaded yet.'),
                            style: TextStyle(color: t.inkSubtle, fontSize: 15),
                          ),
                        )
                      : ListView.separated(
                          // Clear the TV overscan crop so the last card isn't
                          // eaten by the bezel.
                          padding: EdgeInsets.only(
                            bottom: overscanInset(Idiom.of(context)).bottom,
                          ),
                          itemCount: groups.length,
                          separatorBuilder: (_, _) =>
                              const SizedBox(height: 14),
                          itemBuilder: (context, i) => _Group(
                            group: groups[i],
                            engine: engine,
                            tokens: t,
                            autofocusFirst: i == 0,
                          ),
                        ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  String _subtitle(List<DownloadItem> items, Translations tr) {
    if (items.isEmpty) {
      return tr.t('Saved movies and episodes for offline watching');
    }
    final active = items
        .where((i) => i.status == DownloadStatus.downloading)
        .length;
    final saved = items
        .where((i) => i.status == DownloadStatus.done)
        .fold<int>(0, (s, i) => s + (i.totalBytes ?? i.receivedBytes));
    final parts = <String>[
      items.length == 1
          ? tr.t('{n} item', {'n': 1})
          : tr.t('{n} items', {'n': items.length}),
      if (active > 0) tr.t('{n} downloading', {'n': active}),
      if (saved > 0) tr.t('{size} saved', {'size': _fmtBytes(saved)}),
    ];
    return parts.join(' · ');
  }
}

class _Group extends ConsumerWidget {
  const _Group({
    required this.group,
    required this.engine,
    required this.tokens,
    this.autofocusFirst = false,
  });
  final DownloadGroup group;
  final DownloadEngine engine;
  final HarborTokens tokens;
  final bool autofocusFirst;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = tokens;
    if (group.kind == DownloadGroupKind.movie) {
      return _DownloadCard(
        item: group.items.first,
        engine: engine,
        tokens: t,
        autofocusFirst: autofocusFirst,
      );
    }
    final tr = ref.watch(translationsProvider);
    final first = group.items.first;
    final n = group.items.length;
    final saved = group.items
        .where((i) => i.status == DownloadStatus.done)
        .fold<int>(0, (s, i) => s + (i.totalBytes ?? i.receivedBytes));
    final meta = [
      n == 1 ? tr.t('{n} episode', {'n': 1}) : tr.t('{n} episodes', {'n': n}),
      if (saved > 0) tr.t('{size} saved', {'size': _fmtBytes(saved)}),
    ].join('  ·  ');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // The show card header: poster + title + episode count / size, matching
        // the web `ShowGroup`.
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 10),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: SizedBox(
                  width: 36,
                  height: 52,
                  child: first.poster != null
                      ? CachedNetworkImage(
                          imageUrl: first.poster!,
                          fit: BoxFit.cover,
                          errorWidget: (_, _, _) =>
                              ColoredBox(color: t.elevated),
                        )
                      : ColoredBox(color: t.elevated),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      first.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: t.ink,
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      meta,
                      style: TextStyle(color: t.inkSubtle, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        for (final (idx, item) in group.items.indexed) ...[
          _DownloadCard(
            item: item,
            engine: engine,
            tokens: t,
            autofocusFirst: autofocusFirst && idx == 0,
          ),
          const SizedBox(height: 8),
        ],
      ],
    );
  }
}

class _DownloadCard extends ConsumerWidget {
  const _DownloadCard({
    required this.item,
    required this.engine,
    required this.tokens,
    this.autofocusFirst = false,
  });
  final DownloadItem item;
  final DownloadEngine engine;
  final HarborTokens tokens;

  /// When true (the first card of the first group), the primary action button
  /// takes focus on entry so the TV remote lands on Downloads with a target.
  final bool autofocusFirst;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = tokens;
    final tr = ref.watch(translationsProvider);
    final downloading = item.status == DownloadStatus.downloading;
    return Container(
      decoration: BoxDecoration(
        color: t.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: t.edgeSoft),
      ),
      padding: const EdgeInsets.all(14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: SizedBox(
              width: 60,
              height: 90,
              child: item.poster != null
                  ? CachedNetworkImage(
                      imageUrl: item.poster!,
                      fit: BoxFit.cover,
                      errorWidget: (_, _, _) => ColoredBox(color: t.elevated),
                    )
                  : ColoredBox(color: t.elevated),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.subtitle ?? item.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: t.ink,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _statusLine(tr),
                  style: TextStyle(
                    color: item.status == DownloadStatus.error
                        ? t.danger
                        : t.inkMuted,
                    fontSize: 12.5,
                  ),
                ),
                if (downloading) ...[
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(999),
                    child: LinearProgressIndicator(
                      value: item.ratio > 0 ? item.ratio.clamp(0.0, 1.0) : null,
                      minHeight: 4,
                      backgroundColor: t.raised,
                      color: t.accent,
                    ),
                  ),
                ],
                const SizedBox(height: 10),
                Wrap(
                  spacing: 10,
                  runSpacing: 8,
                  children: _actions(
                    context,
                    ref,
                    t,
                    tr,
                    autofocusFirst: autofocusFirst,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _statusLine(Translations tr) {
    switch (item.status) {
      case DownloadStatus.downloading:
        final total = item.totalBytes;
        final pct = (item.ratio.clamp(0.0, 1.0) * 100).round();
        return total != null
            ? '$pct%  ·  ${_fmtBytes(item.receivedBytes)} / ${_fmtBytes(total)}'
            : _fmtBytes(item.receivedBytes);
      case DownloadStatus.paused:
        return '${tr.t('Paused')}  ·  ${_fmtBytes(item.receivedBytes)}';
      case DownloadStatus.done:
        return '${tr.t('Saved')}  ·  '
            '${_fmtBytes(item.totalBytes ?? item.receivedBytes)}';
      case DownloadStatus.error:
        return item.error ?? tr.t('Download failed');
      case DownloadStatus.canceled:
        return tr.t('Canceled');
      case DownloadStatus.interrupted:
        return tr.t('Interrupted — re-download to finish');
    }
  }

  List<Widget> _actions(
    BuildContext context,
    WidgetRef ref,
    HarborTokens t,
    Translations tr, {
    bool autofocusFirst = false,
  }) {
    switch (item.status) {
      case DownloadStatus.downloading:
        return [
          _btn(
            t,
            tr.t('Pause'),
            Icons.pause,
            () => engine.pause(item.id),
            autofocus: autofocusFirst,
          ),
          _btn(t, tr.t('Cancel'), Icons.close, () => engine.cancel(item.id)),
        ];
      case DownloadStatus.paused:
        return [
          _btn(
            t,
            tr.t('Resume'),
            Icons.play_arrow,
            () => engine.resume(item.id),
            autofocus: autofocusFirst,
          ),
          _btn(
            t,
            tr.t('Delete'),
            Icons.delete_outline,
            () => engine.remove(item.id),
          ),
        ];
      case DownloadStatus.done:
        return [
          _btn(
            t,
            tr.t('Play'),
            Icons.play_arrow,
            () => _play(ref),
            filled: true,
            autofocus: autofocusFirst,
          ),
          _btn(
            t,
            tr.t('Delete'),
            Icons.delete_outline,
            () => engine.remove(item.id),
          ),
        ];
      case DownloadStatus.error:
      case DownloadStatus.canceled:
      case DownloadStatus.interrupted:
        return [
          _btn(
            t,
            tr.t('Delete'),
            Icons.delete_outline,
            () => engine.remove(item.id),
            autofocus: autofocusFirst,
          ),
        ];
    }
  }

  void _play(WidgetRef ref) {
    ref
        .read(navControllerProvider.notifier)
        .push(
          Frame(FrameKind.player, {
            'url': item.path,
            'title': item.title,
            'notWebReady': true,
            'contentId': item.metaId,
            'contentType': item.season != null ? 'series' : 'movie',
            'season': ?item.season,
            'episode': ?item.episode,
          }),
        );
  }

  Widget _btn(
    HarborTokens t,
    String label,
    IconData icon,
    VoidCallback onPressed, {
    bool filled = false,
    bool autofocus = false,
  }) => Focusable(
    tokens: t,
    scale: 1.0,
    borderRadius: 999,
    autofocus: autofocus,
    onPressed: onPressed,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: filled ? t.ink : t.raised,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: filled ? t.canvas : t.inkMuted),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              color: filled ? t.canvas : t.ink,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    ),
  );
}

String _fmtBytes(int bytes) {
  if (bytes < 1024) return '$bytes B';
  const units = ['KB', 'MB', 'GB', 'TB'];
  var v = bytes / 1024;
  var i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return '${v.toStringAsFixed(v >= 10 ? 0 : 1)} ${units[i]}';
}
