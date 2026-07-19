import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../app/theme_controller.dart';
import '../../app/wrapped_providers.dart';
import '../../design/focus/rpdb_poster_image.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/i18n/translations.dart';
import '../../domain/wrapped/wrapped_types.dart';

/// The "Stats" / Wrapped year-in-review screen, ported from `views/wrapped.tsx`
/// + `views/wrapped/cards.tsx`. Reached from the Library header's Stats button.
/// A single scroll page of cards (hero totals, watch split, top titles, top
/// genres, a year heatmap) — no interactive rows, so the whole page captures
/// the D-pad up/down to scroll for the TV remote; BACK exits via the shell.
class WrappedView extends ConsumerStatefulWidget {
  const WrappedView({super.key});

  @override
  ConsumerState<WrappedView> createState() => _WrappedViewState();
}

class _WrappedViewState extends ConsumerState<WrappedView> {
  final _scroll = ScrollController();

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  KeyEventResult _onKey(FocusNode _, KeyEvent e) {
    if (e is KeyUpEvent) return KeyEventResult.ignored;
    const step = 240.0;
    double? target;
    if (e.logicalKey == LogicalKeyboardKey.arrowDown) {
      target = _scroll.offset + step;
    } else if (e.logicalKey == LogicalKeyboardKey.arrowUp) {
      target = _scroll.offset - step;
    } else if (e.logicalKey == LogicalKeyboardKey.pageDown) {
      target = _scroll.offset + step * 3;
    } else if (e.logicalKey == LogicalKeyboardKey.pageUp) {
      target = _scroll.offset - step * 3;
    } else {
      return KeyEventResult.ignored; // let BACK / others bubble to the shell
    }
    if (!_scroll.hasClients) return KeyEventResult.handled;
    _scroll.animateTo(
      target.clamp(0.0, _scroll.position.maxScrollExtent),
      duration: const Duration(milliseconds: 180),
      curve: Curves.easeOut,
    );
    return KeyEventResult.handled;
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    final tr = ref.watch(translationsProvider);
    final async = ref.watch(wrappedStatsProvider);
    final idiom = Idiom.of(context);
    final gutter = idiom.isPhone ? 20.0 : 32.0;

    Widget body;
    if (async.isLoading) {
      body = Column(
        children: [
          for (var i = 0; i < 4; i++) ...[
            _ShimmerBlock(tokens: t),
            const SizedBox(height: 16),
          ],
        ],
      );
    } else {
      final stats = async.value;
      if (stats == null || stats.source == WrappedSource.empty) {
        body = _WrappedEmpty(tokens: t, tr: tr);
      } else {
        // The enrichment second phase (web `enrichTopTitles`): the Top genres
        // ranking arrives after the base stats, so the card fills in when ready.
        final genres =
            ref.watch(wrappedGenresProvider).asData?.value ?? stats.topGenres;
        body = Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _HeroCard(stats: stats, tokens: t, tr: tr),
            const SizedBox(height: 16),
            _SplitCard(stats: stats, tokens: t, tr: tr),
            const SizedBox(height: 16),
            _TopTitlesCard(stats: stats, tokens: t, tr: tr),
            if (genres.isNotEmpty) ...[
              const SizedBox(height: 16),
              _GenresCard(genres: genres, tokens: t, tr: tr),
            ],
            const SizedBox(height: 16),
            _HeatmapCard(stats: stats, tokens: t, tr: tr),
          ],
        );
      }
    }

    return ColoredBox(
      color: t.canvas,
      child: Focus(
        autofocus: true,
        onKeyEvent: _onKey,
        child: SingleChildScrollView(
          controller: _scroll,
          padding: EdgeInsets.fromLTRB(gutter, 24, gutter, 96),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 720),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    tr.t('MY LIBRARY'),
                    style: TextStyle(
                      color: t.inkSubtle,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 3,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    tr.t('Stats'),
                    style: TextStyle(
                      color: t.ink,
                      fontSize: 36,
                      fontWeight: FontWeight.w600,
                      height: 1.05,
                    ),
                  ),
                  const SizedBox(height: 24),
                  body,
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// A card shell — a rounded, bordered panel. [tint] adds the accent gradient the
/// web hero card uses.
class _WCard extends StatelessWidget {
  const _WCard({required this.tokens, required this.child, this.tint = false});
  final HarborTokens tokens;
  final Widget child;
  final bool tint;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: tint ? null : tokens.elevated.withValues(alpha: 0.45),
        gradient: tint
            ? LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  tokens.accent.withValues(alpha: 0.15),
                  tokens.elevated.withValues(alpha: 0.5),
                  tokens.elevated.withValues(alpha: 0.3),
                ],
              )
            : null,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: tokens.edgeSoft.withValues(alpha: 0.6)),
      ),
      child: child,
    );
  }
}

class _CardLabel extends StatelessWidget {
  const _CardLabel(this.text, {required this.tokens});
  final String text;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Text(
      text.toUpperCase(),
      style: TextStyle(
        color: tokens.inkSubtle,
        fontSize: 11,
        fontWeight: FontWeight.w600,
        letterSpacing: 2.6,
      ),
    ),
  );
}

class _HeroCard extends StatelessWidget {
  const _HeroCard({required this.stats, required this.tokens, required this.tr});
  final WrappedStats stats;
  final HarborTokens tokens;
  final Translations tr;

  @override
  Widget build(BuildContext context) {
    return _WCard(
      tokens: tokens,
      tint: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 40,
            runSpacing: 16,
            crossAxisAlignment: WrapCrossAlignment.end,
            children: [
              _Stat(
                value: _fmt(stats.estimatedHours),
                unit: tr.t('hours watched'),
                tokens: tokens,
                big: true,
              ),
              _Stat(
                value: _fmt(stats.totalTitles),
                unit: tr.t('titles'),
                tokens: tokens,
              ),
              _Stat(
                value: _fmt(stats.totalPlays),
                unit: tr.t('plays'),
                tokens: tokens,
              ),
            ],
          ),
          if (stats.source == WrappedSource.local) ...[
            const SizedBox(height: 16),
            Text(
              tr.t(
                'Estimated from your local history. Connect Trakt or Simkl for the full picture.',
              ),
              style: TextStyle(color: tokens.inkSubtle, fontSize: 12),
            ),
          ],
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({
    required this.value,
    required this.unit,
    required this.tokens,
    this.big = false,
  });
  final String value;
  final String unit;
  final HarborTokens tokens;
  final bool big;

  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        value,
        style: TextStyle(
          color: tokens.ink,
          fontSize: big ? 56 : 38,
          fontWeight: FontWeight.w600,
          height: 1,
        ),
      ),
      const SizedBox(height: 4),
      Text(unit, style: TextStyle(color: tokens.inkMuted, fontSize: 13)),
    ],
  );
}

class _SplitCard extends StatelessWidget {
  const _SplitCard({
    required this.stats,
    required this.tokens,
    required this.tr,
  });
  final WrappedStats stats;
  final HarborTokens tokens;
  final Translations tr;

  @override
  Widget build(BuildContext context) {
    final s = stats.split;
    final total = (s.movies + s.series + s.anime) == 0
        ? 1
        : (s.movies + s.series + s.anime);
    final rows = [
      (Icons.movie_outlined, tr.t('Movies'), s.movies, const Color(0xFF38BDF8)),
      (Icons.tv_outlined, tr.t('Series'), s.series, const Color(0xFFA78BFA)),
      (Icons.pets_outlined, tr.t('Anime'), s.anime, const Color(0xFF34D399)),
    ];
    return _WCard(
      tokens: tokens,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _CardLabel(tr.t('What you watched'), tokens: tokens),
          for (final r in rows)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                children: [
                  Icon(r.$1, size: 18, color: tokens.inkMuted),
                  const SizedBox(width: 12),
                  SizedBox(
                    width: 64,
                    child: Text(
                      r.$2,
                      style: TextStyle(color: tokens.inkMuted, fontSize: 13.5),
                    ),
                  ),
                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(999),
                      child: LinearProgressIndicator(
                        value: r.$3 / total,
                        minHeight: 10,
                        backgroundColor: tokens.canvas.withValues(alpha: 0.7),
                        valueColor: AlwaysStoppedAnimation(r.$4),
                      ),
                    ),
                  ),
                  SizedBox(
                    width: 40,
                    child: Text(
                      '${r.$3}',
                      textAlign: TextAlign.end,
                      style: TextStyle(
                        color: tokens.ink,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        fontFeatures: const [FontFeature.tabularFigures()],
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _TopTitlesCard extends StatelessWidget {
  const _TopTitlesCard({
    required this.stats,
    required this.tokens,
    required this.tr,
  });
  final WrappedStats stats;
  final HarborTokens tokens;
  final Translations tr;

  @override
  Widget build(BuildContext context) {
    if (stats.topTitles.isEmpty) return const SizedBox.shrink();
    return _WCard(
      tokens: tokens,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _CardLabel(tr.t('Top titles'), tokens: tokens),
          for (var i = 0; i < stats.topTitles.length; i++)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                children: [
                  SizedBox(
                    width: 20,
                    child: Text(
                      '${i + 1}',
                      textAlign: TextAlign.end,
                      style: TextStyle(color: tokens.inkSubtle, fontSize: 15),
                    ),
                  ),
                  const SizedBox(width: 12),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(6),
                    child: SizedBox(
                      width: 36,
                      height: 52,
                      child: RpdbPosterImage(
                        metaId: stats.topTitles[i].id,
                        rawPoster: stats.posters[stats.topTitles[i].id],
                        type: stats.topTitles[i].type == WatchType.movie
                            ? 'movie'
                            : 'series',
                        tokens: tokens,
                        fallback: () => ColoredBox(
                          color: tokens.surface.withValues(alpha: 0.6),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      stats.topTitles[i].title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: tokens.ink, fontSize: 14.5),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '${stats.topTitles[i].count}',
                    style: TextStyle(
                      color: tokens.inkMuted,
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _GenresCard extends StatelessWidget {
  const _GenresCard({
    required this.genres,
    required this.tokens,
    required this.tr,
  });
  final List<({String genre, int count})> genres;
  final HarborTokens tokens;
  final Translations tr;

  @override
  Widget build(BuildContext context) {
    final max = genres.first.count == 0 ? 1 : genres.first.count;
    return _WCard(
      tokens: tokens,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _CardLabel(tr.t('Top genres'), tokens: tokens),
          for (final g in genres)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                children: [
                  SizedBox(
                    width: 112,
                    child: Text(
                      g.genre,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: tokens.ink, fontSize: 13.5),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(999),
                      child: LinearProgressIndicator(
                        value: g.count / max,
                        minHeight: 8,
                        backgroundColor: tokens.canvas.withValues(alpha: 0.7),
                        valueColor: AlwaysStoppedAnimation(
                          tokens.accent.withValues(alpha: 0.8),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _HeatmapCard extends StatelessWidget {
  const _HeatmapCard({
    required this.stats,
    required this.tokens,
    required this.tr,
  });
  final WrappedStats stats;
  final HarborTokens tokens;
  final Translations tr;

  Color _heat(int count, int max) {
    if (count == 0) return tokens.canvas.withValues(alpha: 0.5);
    final r = count / (max == 0 ? 1 : max);
    if (r > 0.75) return tokens.accent;
    if (r > 0.5) return tokens.accent.withValues(alpha: 0.7);
    if (r > 0.25) return tokens.accent.withValues(alpha: 0.45);
    return tokens.accent.withValues(alpha: 0.25);
  }

  String _key(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    if (stats.heatmap.isEmpty) return const SizedBox.shrink();
    final map = {for (final c in stats.heatmap) c.date: c.count};
    final max = stats.heatmap.map((c) => c.count).fold<int>(0, (a, b) => b > a ? b : a);
    // The trailing 364 days, laid out in week columns (web parity).
    final end = DateTime.now();
    final cells = <({String key, int count})>[];
    for (var i = 363; i >= 0; i--) {
      final d = end.subtract(Duration(days: i));
      final k = _key(d);
      cells.add((key: k, count: map[k] ?? 0));
    }
    final weeks = <List<({String key, int count})>>[];
    for (var i = 0; i < cells.length; i += 7) {
      weeks.add(cells.sublist(i, (i + 7).clamp(0, cells.length)));
    }
    return _WCard(
      tokens: tokens,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _CardLabel(tr.t('Your watch year'), tokens: tokens),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final w in weeks)
                  Padding(
                    padding: const EdgeInsets.only(right: 3),
                    child: Column(
                      children: [
                        for (final c in w)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 3),
                            child: Container(
                              width: 10,
                              height: 10,
                              decoration: BoxDecoration(
                                color: _heat(c.count, max),
                                borderRadius: BorderRadius.circular(3),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _WrappedEmpty extends StatelessWidget {
  const _WrappedEmpty({required this.tokens, required this.tr});
  final HarborTokens tokens;
  final Translations tr;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 72),
      decoration: BoxDecoration(
        color: tokens.canvas.withValues(alpha: 0.3),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: tokens.edgeSoft,
          style: BorderStyle.solid,
        ),
      ),
      child: Column(
        children: [
          Icon(Icons.bar_chart_rounded, size: 28, color: tokens.inkSubtle),
          const SizedBox(height: 16),
          Text(
            tr.t('Nothing to show yet'),
            style: TextStyle(
              color: tokens.ink,
              fontSize: 22,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 360),
            child: Text(
              tr.t(
                'Connect Trakt or Simkl, or start watching, and your stats will build themselves.',
              ),
              textAlign: TextAlign.center,
              style: TextStyle(
                color: tokens.inkMuted,
                fontSize: 13.5,
                height: 1.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ShimmerBlock extends StatelessWidget {
  const _ShimmerBlock({required this.tokens});
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) => Container(
    height: 150,
    decoration: BoxDecoration(
      color: tokens.elevated.withValues(alpha: 0.4),
      borderRadius: BorderRadius.circular(24),
    ),
  );
}

/// Groups an integer with thousands separators (web `toLocaleString`).
String _fmt(int n) {
  final s = n.abs().toString();
  final b = StringBuffer(n < 0 ? '-' : '');
  for (var i = 0; i < s.length; i++) {
    if (i != 0 && (s.length - i) % 3 == 0) b.write(',');
    b.write(s[i]);
  }
  return b.toString();
}
