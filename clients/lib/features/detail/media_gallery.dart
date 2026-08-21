import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../design/focus/focusable.dart';
import '../../design/layout/idiom.dart';
import '../../design/lightbox.dart';
import '../../design/tokens.dart';
import '../../domain/catalog/tmdb_details.dart';

/// The detail media gallery, ported from `media-gallery.tsx`: tabs for the
/// backdrops / posters / logos the detail carries, each a focusable rail of
/// tiles that open a full-screen lightbox. (The Videos tab lands with the
/// trailer player; the download / set-as-backdrop tile actions with the
/// downloader.)
class MediaGallery extends StatefulWidget {
  const MediaGallery({
    super.key,
    required this.gallery,
    required this.tokens,
    this.videos = const [],
    this.onPlayVideo,
  });

  final GalleryImages gallery;
  final HarborTokens tokens;

  /// The title's YouTube videos (trailers + extras) — the "Videos" tab. Empty
  /// hides the tab. Ported from the web gallery's `collectVideos`.
  final List<ExtraVideo> videos;
  final void Function(ExtraVideo video)? onPlayVideo;

  @override
  State<MediaGallery> createState() => _MediaGalleryState();
}

class _MediaGalleryState extends State<MediaGallery> {
  String? _active;

  List<({String id, String label, List<String> images})> get _tabs {
    final g = widget.gallery;
    return [
      // Videos lead, matching web (Videos / Backdrops / Posters / Logos).
      if (widget.videos.isNotEmpty)
        (id: 'videos', label: 'Videos', images: const []),
      if (g.backdrops.isNotEmpty)
        (id: 'backdrops', label: 'Backdrops', images: g.backdrops),
      if (g.posters.isNotEmpty)
        (id: 'posters', label: 'Posters', images: g.posters),
      if (g.logos.isNotEmpty) (id: 'logos', label: 'Logos', images: g.logos),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    final tabs = _tabs;
    if (tabs.isEmpty) return const SizedBox.shrink();
    final active = tabs.firstWhere(
      (tab) => tab.id == _active,
      orElse: () => tabs.first,
    );

    final g = pageGutter(Idiom.of(context));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.fromLTRB(g, 0, g, 12),
          child: Row(
            children: [
              Text(
                'Media',
                style: TextStyle(
                  color: t.ink,
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(width: 16),
              // The tab chips scroll horizontally so a title with all three
              // sets (Backdrops / Posters / Logos) never overflows the header
              // on a phone.
              Expanded(
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      for (final tab in tabs) ...[
                        _TabChip(
                          label: tab.label,
                          count: tab.id == 'videos'
                              ? widget.videos.length
                              : tab.images.length,
                          selected: tab.id == active.id,
                          tokens: t,
                          onPressed: () => setState(() => _active = tab.id),
                        ),
                        const SizedBox(width: 8),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        SizedBox(
          height: active.id == 'posters'
              ? 252
              : active.id == 'logos'
              ? 132
              : 190,
          child: FocusTraversalGroup(
            policy: ReadingOrderTraversalPolicy(),
            child: active.id == 'videos'
                ? ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: EdgeInsets.symmetric(horizontal: g),
                    itemCount: widget.videos.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 16),
                    itemBuilder: (context, i) => _VideoTile(
                      video: widget.videos[i],
                      tokens: t,
                      onPlay: () => widget.onPlayVideo?.call(widget.videos[i]),
                    ),
                  )
                : ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: EdgeInsets.symmetric(horizontal: g),
                    itemCount: active.images.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 16),
                    itemBuilder: (context, i) => _MediaTile(
                      kind: active.id,
                      url: active.images[i],
                      tokens: t,
                      onOpen: () =>
                          showImageLightbox(context, active.images, i, t),
                    ),
                  ),
          ),
        ),
      ],
    );
  }
}

class _TabChip extends StatelessWidget {
  const _TabChip({
    required this.label,
    required this.count,
    required this.selected,
    required this.tokens,
    required this.onPressed,
  });

  final String label;
  final int count;
  final bool selected;
  final HarborTokens tokens;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Focusable(
      tokens: tokens,
      borderRadius: 999,
      onPressed: onPressed,
      child: Container(
        height: 30,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? tokens.raised : Colors.transparent,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: selected ? tokens.edge : Colors.transparent,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: TextStyle(
                color: selected ? tokens.ink : tokens.inkMuted,
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(width: 6),
            Text(
              '$count',
              style: TextStyle(color: tokens.inkSubtle, fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }
}

/// A "Videos" tab tile — a 16:9 YouTube thumbnail with a play badge and the
/// video name/type, opening the trailer overlay on press. Ports web `VideoTile`.
class _VideoTile extends StatelessWidget {
  const _VideoTile({
    required this.video,
    required this.tokens,
    required this.onPlay,
  });

  final ExtraVideo video;
  final HarborTokens tokens;
  final VoidCallback onPlay;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Focusable(
      tokens: t,
      borderRadius: 12,
      onPressed: onPlay,
      child: SizedBox(
        width: 190 * 16 / 9,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    CachedNetworkImage(
                      imageUrl:
                          'https://img.youtube.com/vi/${video.ytId}/hqdefault.jpg',
                      fit: BoxFit.cover,
                      errorWidget: (_, _, _) => ColoredBox(color: t.surface),
                    ),
                    Center(
                      child: Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.55),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.play_arrow,
                          color: Colors.white,
                          size: 26,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              video.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: t.ink,
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
              ),
            ),
            Text(
              video.type,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: t.inkSubtle, fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }
}

class _MediaTile extends StatelessWidget {
  const _MediaTile({
    required this.kind,
    required this.url,
    required this.tokens,
    required this.onOpen,
  });

  final String kind;
  final String url;
  final HarborTokens tokens;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final (width, aspect) = switch (kind) {
      'posters' => (152.0, 2 / 3),
      'logos' => (220.0, 220 / 120),
      _ => (300.0, 16 / 9),
    };
    return Focusable(
      tokens: tokens,
      borderRadius: 12,
      onPressed: onOpen,
      child: SizedBox(
        width: width,
        child: AspectRatio(
          aspectRatio: aspect,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: kind == 'logos'
                ? Container(
                    color: tokens.canvas.withValues(alpha: 0.3),
                    padding: const EdgeInsets.all(18),
                    child: CachedNetworkImage(
                      imageUrl: url,
                      fit: BoxFit.contain,
                    ),
                  )
                : CachedNetworkImage(
                    imageUrl: url,
                    fit: BoxFit.cover,
                    placeholder: (_, _) => ColoredBox(color: tokens.surface),
                  ),
          ),
        ),
      ),
    );
  }
}

