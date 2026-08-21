import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/download_providers.dart';
import '../../design/focus/focusable.dart';
import '../../design/tokens.dart';
import '../../domain/downloads/downloads_store.dart';

/// The per-episode offline-download control, ported from
/// `views/detail/episode-download-button.tsx`: a compact circular button that
/// opens the play-picker in download intent for this episode and, once a
/// download for it is live, mirrors its state — a progress ring plus
/// pause / resume / saved / retry — driven straight off the download engine.
class EpisodeDownloadButton extends ConsumerWidget {
  const EpisodeDownloadButton({
    super.key,
    required this.metaId,
    required this.season,
    required this.episode,
    required this.onDownload,
    required this.tokens,
    this.size = 34,
  });

  final String metaId;
  final int season;
  final int episode;

  /// Opens the picker in download intent for this episode (the idle / retry /
  /// re-download action); pause and resume are handled internally.
  final VoidCallback onDownload;
  final HarborTokens tokens;
  final double size;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = tokens;
    final engine = ref.watch(downloadEngineProvider);
    return ValueListenableBuilder<List<DownloadItem>>(
      valueListenable: engine.items,
      builder: (context, items, _) {
        DownloadItem? dl;
        for (final i in items) {
          if (i.metaId == metaId &&
              i.season == season &&
              i.episode == episode) {
            dl = i;
            break;
          }
        }
        final status = dl?.status;
        final downloading = status == DownloadStatus.downloading;
        final paused = status == DownloadStatus.paused;
        final ratio = (dl?.ratio ?? 0).clamp(0.0, 1.0);

        final IconData icon;
        final VoidCallback onPressed;
        if (downloading) {
          icon = Icons.pause;
          onPressed = () => engine.pause(dl!.id);
        } else if (paused) {
          icon = Icons.play_arrow;
          onPressed = () => engine.resume(dl!.id);
        } else {
          onPressed = onDownload;
          icon = switch (status) {
            DownloadStatus.done => Icons.check,
            DownloadStatus.error || DownloadStatus.interrupted => Icons.refresh,
            _ => Icons.download_rounded,
          };
        }

        final tone = switch (status) {
          DownloadStatus.done ||
          DownloadStatus.downloading ||
          DownloadStatus.paused => t.accent,
          DownloadStatus.error => t.danger,
          _ => t.ink,
        };
        final showRing = downloading || paused;

        return Focusable(
          tokens: t,
          scale: 1.0,
          borderRadius: 999,
          onPressed: onPressed,
          child: Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              color: t.canvas.withValues(alpha: 0.82),
              shape: BoxShape.circle,
              border: Border.all(color: t.edge),
            ),
            child: Stack(
              alignment: Alignment.center,
              children: [
                if (showRing)
                  SizedBox(
                    width: size - 7,
                    height: size - 7,
                    child: CircularProgressIndicator(
                      value: ratio < 0.03 ? 0.03 : ratio,
                      strokeWidth: 2.5,
                      backgroundColor: t.ink.withValues(alpha: 0.15),
                      color: t.accent,
                    ),
                  ),
                Icon(
                  icon,
                  size: showRing ? size * 0.4 : size * 0.5,
                  color: tone,
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
