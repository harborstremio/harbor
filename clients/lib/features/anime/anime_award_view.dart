import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../app/anime_providers.dart';
import '../../app/nav_controller.dart';
import '../../app/providers.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/focusable.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/anime/anime_awards.dart';
import '../../domain/nav/frame.dart';
import '../../design/focus/tv_text_field.dart';

const Map<AwardSourceId, Color> _sourceTints = {
  AwardSourceId.crunchyroll: Color(0xFFF47521),
  AwardSourceId.taaf: Color(0xFFE91E63),
  AwardSourceId.jmaf: Color(0xFFC41E3A),
  AwardSourceId.rAnime: Color(0xFFFF4500),
  AwardSourceId.animationKobe: Color(0xFF8A6A3B),
};

/// The anime-award body page — its recorded winners by category, with a year
/// and title/category filter. Ported 1:1 from `AnimeAwardView`. Winners resolve
/// to a TMDB title on select when a TMDB key is configured.
class AnimeAwardView extends ConsumerStatefulWidget {
  const AnimeAwardView({super.key, required this.sourceId});

  final AwardSourceId sourceId;

  @override
  ConsumerState<AnimeAwardView> createState() => _AnimeAwardViewState();
}

class _AnimeAwardViewState extends ConsumerState<AnimeAwardView> {
  int? _year;
  String _query = '';
  final _searchCtrl = TextEditingController();

  Color get _tint => _sourceTints[widget.sourceId] ?? const Color(0xFFE8AA6C);

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    final async = ref.watch(animeAwardsProvider);
    return Container(
      color: t.canvas,
      child: async.when(
        loading: () => Center(
          child: CircularProgressIndicator(strokeWidth: 2, color: t.inkSubtle),
        ),
        error: (_, _) => Center(
          child: Text(
            "Couldn't load the awards.",
            style: TextStyle(color: t.inkMuted, fontSize: 14),
          ),
        ),
        data: (awards) => _content(t, awards.readSource(widget.sourceId)),
      ),
    );
  }

  Widget _content(
    HarborTokens t,
    ({
      AwardSourceMeta meta,
      List<AnimeAwardCategory> categories,
      List<int> years,
    })
    data,
  ) {
    final q = _query.trim().toLowerCase();
    final filtered = [
      for (final c in data.categories)
        if ([
              for (final w in c.winners)
                if ((_year == null || w.year == _year) &&
                    (q.isEmpty ||
                        w.title.toLowerCase().contains(q) ||
                        c.name.toLowerCase().contains(q)))
                  w,
            ]
            case final winners when winners.isNotEmpty)
          (category: c, winners: winners),
    ];
    final isFiltering = _year != null || q.isNotEmpty;
    final totalWins = data.categories.fold<int>(
      0,
      (n, c) => n + c.winners.length,
    );

    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(child: _banner(t, data.meta, data.years, totalWins)),
        if (data.categories.isEmpty)
          SliverToBoxAdapter(
            child: _note(t, 'No data shipped for this award yet.'),
          )
        else ...[
          SliverToBoxAdapter(child: _filterBar(t, data.years)),
          if (isFiltering && filtered.isEmpty)
            SliverToBoxAdapter(
              child: _note(t, 'No winners match these filters.'),
            ),
          SliverList.list(
            children: [
              for (final f in filtered)
                _categoryBlock(t, f.category, f.winners),
            ],
          ),
        ],
        const SliverToBoxAdapter(child: SizedBox(height: 80)),
      ],
    );
  }

  Widget _banner(
    HarborTokens t,
    AwardSourceMeta meta,
    List<int> years,
    int totalWins,
  ) {
    final span = years.isEmpty
        ? ''
        : years.length == 1
        ? '${years.first}'
        : '${years.last}–${years.first}';
    final idiom = Idiom.of(context);
    final phone = idiom.isPhone;
    final g = pageGutter(idiom);
    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: t.edgeSoft)),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [_tint.withValues(alpha: 0.13), t.canvas],
        ),
      ),
      child: Padding(
        padding: EdgeInsets.fromLTRB(g, phone ? 56 : 96, g, phone ? 28 : 40),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: _tint.withValues(alpha: 0.33)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.emoji_events, size: 11, color: _tint),
                        const SizedBox(width: 6),
                        Text(
                          'ANIME AWARD',
                          style: TextStyle(
                            color: _tint,
                            fontSize: 10.5,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 2.2,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    meta.name,
                    style: TextStyle(
                      color: t.ink,
                      fontSize: phone ? 30 : 48,
                      fontWeight: FontWeight.w500,
                      height: 0.98,
                      letterSpacing: -0.8,
                    ),
                  ),
                  const SizedBox(height: 10),
                  _statLine(t, totalWins, span),
                ],
              ),
            ),
            SizedBox(width: phone ? 14 : 24),
            SizedBox(
              height: phone ? 54 : 80,
              width: phone ? 120 : 200,
              child: _logo(meta.icon, t),
            ),
          ],
        ),
      ),
    );
  }

  Widget _statLine(HarborTokens t, int totalWins, String span) {
    final catCount = ref
        .read(animeAwardsProvider)
        .value!
        .readSource(widget.sourceId)
        .categories
        .length;
    final parts = <TextSpan>[
      TextSpan(
        text: '$totalWins',
        style: TextStyle(color: t.ink),
      ),
      TextSpan(text: ' recorded winners · '),
      TextSpan(
        text: '$catCount',
        style: TextStyle(color: t.ink),
      ),
      TextSpan(text: catCount == 1 ? ' category' : ' categories'),
      if (span.isNotEmpty) ...[
        const TextSpan(text: ' · '),
        TextSpan(
          text: span,
          style: TextStyle(color: t.ink),
        ),
      ],
    ];
    return RichText(
      text: TextSpan(
        style: TextStyle(
          color: _tint,
          fontSize: 13,
          fontWeight: FontWeight.w600,
          letterSpacing: 1.8,
        ),
        children: parts,
      ),
    );
  }

  Widget _logo(String path, HarborTokens t) {
    if (path.endsWith('.svg')) {
      return SvgPicture.asset(
        path,
        fit: BoxFit.contain,
        alignment: Alignment.centerRight,
        placeholderBuilder: (_) => const SizedBox.shrink(),
      );
    }
    return Image.asset(
      path,
      fit: BoxFit.contain,
      alignment: Alignment.centerRight,
      errorBuilder: (_, _, _) =>
          Icon(Icons.emoji_events, color: _tint, size: 48),
    );
  }

  Widget _filterBar(HarborTokens t, List<int> years) {
    final g = pageGutter(Idiom.of(context));
    return Padding(
      padding: EdgeInsets.fromLTRB(g, 24, g, 8),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: t.elevated.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: t.edgeSoft),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
              decoration: BoxDecoration(
                color: t.canvas.withValues(alpha: 0.4),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Icon(Icons.search, size: 15, color: t.inkSubtle),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TvTextField(
                      controller: _searchCtrl,
                      onChanged: (v) => setState(() => _query = v),
                      style: TextStyle(color: t.ink, fontSize: 13.5),
                      decoration: InputDecoration(
                        isCollapsed: true,
                        contentPadding: const EdgeInsets.symmetric(
                          vertical: 12,
                        ),
                        border: InputBorder.none,
                        hintText: 'Search winners or categories…',
                        hintStyle: TextStyle(
                          color: t.inkSubtle,
                          fontSize: 13.5,
                        ),
                      ),
                    ),
                  ),
                  if (_query.isNotEmpty)
                    Focusable(
                      tokens: t,
                      borderRadius: 999,
                      onPressed: () {
                        _searchCtrl.clear();
                        setState(() => _query = '');
                      },
                      child: Icon(Icons.close, size: 14, color: t.inkSubtle),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                _yearChip(t, null, 'All years'),
                for (final y in years) _yearChip(t, y, '$y'),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _yearChip(HarborTokens t, int? year, String label) {
    final active = _year == year;
    return Focusable(
      tokens: t,
      borderRadius: 999,
      onPressed: () => setState(() => _year = active ? null : year),
      child: Container(
        // Vertical padding, not height+alignment: a Text child under an
        // alignment expands the chip to the year-row Wrap's full width, one per
        // line. Padding content-sizes it (~32 tall) and keeps it centred.
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: active ? _tint : Colors.transparent,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: active ? _tint : t.edgeSoft),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: active ? t.canvas : t.inkMuted,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }

  Widget _categoryBlock(
    HarborTokens t,
    AnimeAwardCategory category,
    List<({int year, String title})> winners,
  ) {
    final g = pageGutter(Idiom.of(context));
    return Padding(
      padding: EdgeInsets.fromLTRB(g, 24, g, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.only(bottom: 8),
            decoration: BoxDecoration(
              border: Border(bottom: BorderSide(color: t.edgeSoft)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                if (category.isAOTY) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: _tint.withValues(alpha: 0.13),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      'GRAND',
                      style: TextStyle(
                        color: _tint,
                        fontSize: 10.5,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.8,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
                Expanded(
                  child: Text(
                    category.name,
                    style: TextStyle(
                      color: t.ink,
                      fontSize: 24,
                      fontWeight: FontWeight.w500,
                      letterSpacing: -0.4,
                    ),
                  ),
                ),
                Text(
                  winners.length == 1
                      ? '1 WINNER'
                      : '${winners.length} WINNERS',
                  style: TextStyle(
                    color: t.inkSubtle,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 1.6,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 4),
          LayoutBuilder(
            builder: (context, c) {
              final twoCol = c.maxWidth > 700;
              final width = twoCol ? (c.maxWidth - 40) / 2 : c.maxWidth;
              return Wrap(
                spacing: 40,
                children: [
                  for (final w in winners)
                    SizedBox(
                      width: width,
                      child: _WinnerRow(
                        year: w.year,
                        title: w.title,
                        tint: _tint,
                        tokens: t,
                      ),
                    ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _note(HarborTokens t, String text) {
    final g = pageGutter(Idiom.of(context));
    return Padding(
      padding: EdgeInsets.fromLTRB(g, 24, g, 0),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: t.elevated.withValues(alpha: 0.3),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: t.edgeSoft),
        ),
        child: Text(
          text,
          style: TextStyle(color: t.inkMuted, fontSize: 14, height: 1.5),
        ),
      ),
    );
  }
}

/// One winner line — year and title, resolving to a TMDB title on select when a
/// key is configured. Ported from `WinnerRow`.
class _WinnerRow extends ConsumerStatefulWidget {
  const _WinnerRow({
    required this.year,
    required this.title,
    required this.tint,
    required this.tokens,
  });

  final int year;
  final String title;
  final Color tint;
  final HarborTokens tokens;

  @override
  ConsumerState<_WinnerRow> createState() => _WinnerRowState();
}

class _WinnerRowState extends ConsumerState<_WinnerRow> {
  bool _resolving = false;

  Future<void> _open() async {
    if (_resolving) return;
    setState(() => _resolving = true);
    try {
      final tmdb = ref.read(tmdbClientProvider);
      final tv = await tmdb.searchTitle('tv', widget.title, year: widget.year);
      final hit =
          tv ??
          await tmdb.searchTitle('movie', widget.title, year: widget.year);
      if (hit != null && mounted) {
        ref
            .read(navControllerProvider.notifier)
            .push(Frame(FrameKind.meta, {'type': hit.type, 'id': hit.id}));
      }
    } finally {
      if (mounted) setState(() => _resolving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    final clickable = ref.watch(tmdbClientProvider).hasKey;
    final row = Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 52,
            child: Text(
              '${widget.year}',
              style: TextStyle(
                color: widget.tint,
                fontSize: 14,
                fontWeight: FontWeight.w600,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ),
          Expanded(
            child: Text(
              widget.title,
              style: TextStyle(
                color: _resolving ? t.inkSubtle : t.ink,
                fontSize: 14,
              ),
            ),
          ),
          if (clickable) Icon(Icons.north_east, size: 13, color: t.inkSubtle),
        ],
      ),
    );
    if (!clickable) {
      return DecoratedBox(
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(color: t.edgeSoft.withValues(alpha: 0.4)),
          ),
        ),
        child: row,
      );
    }
    return Focusable(
      tokens: t,
      borderRadius: 6,
      onPressed: _open,
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(color: t.edgeSoft.withValues(alpha: 0.4)),
          ),
        ),
        child: row,
      ),
    );
  }
}
