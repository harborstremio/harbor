import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../app/iptv_providers.dart';
import '../../app/nav_controller.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/focusable.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/iptv/vod.dart';
import '../../domain/nav/frame.dart';
import '../../design/focus/tv_text_field.dart';

/// The Xtream VOD view — the on-demand movies and series across every IPTV
/// source's playlists, classified into a browsable library with TMDB-enriched
/// posters. Ports the VOD surface of `views/vod` (`40-debrid-iptv-ai.md`).
class VodView extends ConsumerStatefulWidget {
  const VodView({super.key});

  @override
  ConsumerState<VodView> createState() => _VodViewState();
}

class _VodViewState extends ConsumerState<VodView> {
  bool _series = false; // false = Movies, true = Series
  String _query = '';

  void _play(String url, String title, {String? contentId}) {
    ref
        .read(navControllerProvider.notifier)
        .push(
          Frame(FrameKind.player, {
            'url': url,
            'title': title,
            'isLive': false,
            'contentType': 'movie',
            'contentId': ?contentId,
          }),
        );
  }

  Future<void> _openSeries(HarborTokens t, VodSeries series) async {
    await showDialog<void>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: 0.55),
      builder: (ctx) => _EpisodeDialog(
        tokens: t,
        series: series,
        onPlay: (ep) {
          Navigator.of(ctx).pop();
          _play(ep.url, '${series.title} · S${ep.season}E${ep.episode}');
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    final tr = ref.watch(translationsProvider);
    final sources = ref.watch(iptvSourcesProvider);
    if (sources.isEmpty) {
      return _Message(
        tokens: t,
        icon: Icons.movie_outlined,
        text: 'No IPTV sources yet.\nAdd a playlist in Live TV to browse VOD.',
      );
    }
    final playlists = ref.watch(iptvCachedPlaylistsProvider);
    if (playlists.isEmpty) {
      return Center(child: CircularProgressIndicator(color: t.accent));
    }
    final names = {for (final s in sources) s.id: s.name};
    final lib = buildVodLibrary(playlists, names);
    if (lib.movies.isEmpty && lib.series.isEmpty) {
      return _Message(
        tokens: t,
        icon: Icons.movie_outlined,
        text: tr.t('No on-demand movies or series in your sources.'),
      );
    }

    final q = _query.trim().toLowerCase();
    final movies = q.isEmpty
        ? lib.movies
        : [
            for (final m in lib.movies)
              if (m.title.toLowerCase().contains(q)) m,
          ];
    final series = q.isEmpty
        ? lib.series
        : [
            for (final s in lib.series)
              if (s.title.toLowerCase().contains(q)) s,
          ];

    final idiom = Idiom.of(context);
    final g = pageGutter(idiom);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _header(t, lib, idiom, g),
        _search(t, g),
        Expanded(
          child: _series ? _seriesGrid(t, series, g) : _movieGrid(t, movies, g),
        ),
      ],
    );
  }

  Widget _header(HarborTokens t, VodLibrary lib, Idiom idiom, double g) {
    final title = Text(
      ref.read(translationsProvider).t('On Demand'),
      style: TextStyle(
        color: t.ink,
        fontSize: idiom.isPhone ? 22 : 26,
        fontWeight: FontWeight.w700,
      ),
    );
    final movies = _Chip(
      tokens: t,
      label: 'Movies · ${lib.movies.length}',
      selected: !_series,
      onTap: () => setState(() => _series = false),
    );
    final series = _Chip(
      tokens: t,
      label: 'Series · ${lib.series.length}',
      selected: _series,
      onTap: () => setState(() => _series = true),
    );

    // On a phone the title and two filter chips can't share one row without
    // overflowing, so the chips wrap onto their own line below the title.
    if (idiom.isPhone) {
      return Padding(
        padding: EdgeInsets.fromLTRB(g, 18, g, 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            title,
            const SizedBox(height: 12),
            Wrap(spacing: 8, runSpacing: 8, children: [movies, series]),
          ],
        ),
      );
    }
    return Padding(
      padding: EdgeInsets.fromLTRB(g, 20, g, 8),
      child: Row(
        children: [
          title,
          const SizedBox(width: 18),
          movies,
          const SizedBox(width: 8),
          series,
        ],
      ),
    );
  }

  Widget _search(HarborTokens t, double g) => Padding(
    padding: EdgeInsets.fromLTRB(g, 4, g, 8),
    child: TvTextField(
      onChanged: (v) => setState(() => _query = v),
      style: TextStyle(color: t.ink),
      cursorColor: t.accent,
      decoration: InputDecoration(
        hintText: ref.read(translationsProvider).t('Search on-demand'),
        hintStyle: TextStyle(color: t.inkSubtle),
        prefixIcon: Icon(Icons.search, color: t.inkMuted),
        filled: true,
        fillColor: t.raised,
        isDense: true,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: t.edgeSoft),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: t.edgeSoft),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: t.accent, width: 2),
        ),
      ),
    ),
  );

  Widget _movieGrid(HarborTokens t, List<VodMovie> movies, double g) {
    if (movies.isEmpty) return _empty(t);
    return GridView.builder(
      padding: EdgeInsets.fromLTRB(
        g,
        8,
        g,
        24 + overscanInset(Idiom.of(context)).bottom,
      ),
      gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
        maxCrossAxisExtent: 168,
        childAspectRatio: 0.56,
        crossAxisSpacing: 14,
        mainAxisSpacing: 16,
      ),
      itemCount: movies.length,
      itemBuilder: (context, i) {
        final m = movies[i];
        return _PosterCard(
          tokens: t,
          kind: 'movie',
          title: m.title,
          year: m.year,
          logo: m.logo,
          autofocus: i == 0,
          onPressed: () => _play(m.url, m.title, contentId: m.id),
        );
      },
    );
  }

  Widget _seriesGrid(HarborTokens t, List<VodSeries> series, double g) {
    if (series.isEmpty) return _empty(t);
    return GridView.builder(
      padding: EdgeInsets.fromLTRB(
        g,
        8,
        g,
        24 + overscanInset(Idiom.of(context)).bottom,
      ),
      gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
        maxCrossAxisExtent: 168,
        childAspectRatio: 0.56,
        crossAxisSpacing: 14,
        mainAxisSpacing: 16,
      ),
      itemCount: series.length,
      itemBuilder: (context, i) {
        final s = series[i];
        return _PosterCard(
          tokens: t,
          kind: 'series',
          title: s.title,
          year: null,
          logo: s.logo,
          subtitle: '${s.episodes.length} episodes',
          autofocus: i == 0,
          onPressed: () => _openSeries(t, s),
        );
      },
    );
  }

  Widget _empty(HarborTokens t) => _Message(
    tokens: t,
    icon: Icons.search_off,
    text: 'Nothing matches "$_query".',
  );
}

class _PosterCard extends ConsumerWidget {
  const _PosterCard({
    required this.tokens,
    required this.kind,
    required this.title,
    required this.year,
    required this.logo,
    required this.onPressed,
    required this.autofocus,
    this.subtitle,
  });

  final HarborTokens tokens;
  final String kind;
  final String title;
  final int? year;
  final String? logo;
  final String? subtitle;
  final VoidCallback onPressed;
  final bool autofocus;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = tokens;
    final enriched = ref
        .watch(vodEnrichmentProvider((kind, title, year)))
        .asData
        ?.value;
    final poster = enriched?.poster ?? logo;
    return Focusable(
      tokens: t,
      autofocus: autofocus,
      onPressed: onPressed,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(child: _poster(t, poster)),
          Padding(
            padding: const EdgeInsets.fromLTRB(3, 7, 3, 0),
            child: Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: t.ink,
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          if (subtitle != null || year != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(3, 1, 3, 0),
              child: Text(
                subtitle ?? '$year',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: t.inkSubtle, fontSize: 11),
              ),
            ),
        ],
      ),
    );
  }

  Widget _poster(HarborTokens t, String? url) {
    final fallback = Container(
      color: t.surface,
      child: Center(
        child: Icon(Icons.movie_outlined, color: t.inkSubtle, size: 30),
      ),
    );
    if (url == null || url.isEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(11),
        child: fallback,
      );
    }
    return ClipRRect(
      borderRadius: BorderRadius.circular(11),
      child: Image.network(
        url,
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) => fallback,
        loadingBuilder: (ctx, child, progress) =>
            progress == null ? child : fallback,
      ),
    );
  }
}

class _EpisodeDialog extends StatelessWidget {
  const _EpisodeDialog({
    required this.tokens,
    required this.series,
    required this.onPlay,
  });

  final HarborTokens tokens;
  final VodSeries series;
  final void Function(VodEpisode) onPlay;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Center(
      child: FocusTraversalGroup(
        child: Material(
          color: Colors.transparent,
          child: Container(
            constraints: const BoxConstraints(maxWidth: 520, maxHeight: 640),
            margin: const EdgeInsets.symmetric(horizontal: 24),
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: t.elevated,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: t.edge),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  series.title,
                  style: TextStyle(
                    color: t.ink,
                    fontSize: 19,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${series.episodes.length} episodes · '
                  '${series.seasons.length} season(s)',
                  style: TextStyle(color: t.inkSubtle, fontSize: 12.5),
                ),
                const SizedBox(height: 12),
                Flexible(
                  child: ListView.builder(
                    shrinkWrap: true,
                    itemCount: series.episodes.length,
                    itemBuilder: (ctx, i) {
                      final ep = series.episodes[i];
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Focusable(
                          tokens: t,
                          borderRadius: 10,
                          scale: 1.02,
                          autofocus: i == 0,
                          onPressed: () => onPlay(ep),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 10,
                            ),
                            decoration: BoxDecoration(
                              color: t.raised,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  Icons.play_arrow,
                                  color: t.accent,
                                  size: 18,
                                ),
                                const SizedBox(width: 10),
                                Text(
                                  'S${ep.season}E${ep.episode}',
                                  style: TextStyle(
                                    color: t.inkMuted,
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    ep.title,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      color: t.ink,
                                      fontSize: 13,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({
    required this.tokens,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final HarborTokens tokens;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Focusable(
      tokens: t,
      borderRadius: 20,
      scale: 1.04,
      onPressed: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          color: selected ? t.accent : t.raised,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? t.canvas : t.ink,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

class _Message extends StatelessWidget {
  const _Message({
    required this.tokens,
    required this.icon,
    required this.text,
  });

  final HarborTokens tokens;
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: t.inkSubtle, size: 46),
          const SizedBox(height: 14),
          Text(
            text,
            textAlign: TextAlign.center,
            style: TextStyle(color: t.inkMuted, fontSize: 15, height: 1.4),
          ),
        ],
      ),
    );
  }
}
