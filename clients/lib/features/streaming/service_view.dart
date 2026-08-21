import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/nav_controller.dart';
import '../../app/providers.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/focusable.dart';
import '../../design/focus/focusable_poster.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/addons/models.dart';
import '../../domain/catalog/streaming.dart';
import '../../domain/nav/frame.dart';
import '../home/top_rank_card.dart';
import 'service_logo.dart';

/// The per-service catalog view, ported from `src/views/service.tsx`: a tinted
/// hero header, a focusable category filter rail, and either the "All" layout
/// (Top-10 rank rails + "More" shelves for movies and series) or a poster grid
/// for a specific category — with batched infinite scroll.
class ServiceView extends ConsumerStatefulWidget {
  const ServiceView({super.key, required this.service});

  final String service;

  @override
  ConsumerState<ServiceView> createState() => _ServiceViewState();
}

class _ServiceViewState extends ConsumerState<ServiceView> {
  final ScrollController _scroll = ScrollController();
  ServiceCategory _category = kServiceCategories.first;
  ServiceBucket _bucket = const ServiceBucket(movies: [], series: []);
  int _batch = 0;
  bool _loading = true;
  bool _fetching = false;
  bool _hasMore = true;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    _reload();
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  /// Resets to the first batch when the service or category changes.
  void _reload() {
    setState(() {
      _bucket = const ServiceBucket(movies: [], series: []);
      _batch = 0;
      _loading = true;
      _hasMore = true;
    });
    _fetchBatch();
  }

  Future<void> _fetchBatch() async {
    if (_fetching) return;
    _fetching = true;
    final batch = _batch;
    final meta = kServices[widget.service];
    if (meta == null) {
      setState(() {
        _loading = false;
        _fetching = false;
        _hasMore = false;
      });
      return;
    }
    final client = ref.read(tmdbClientProvider);
    final region = ref.read(settingsProvider).region;
    try {
      final b = await fetchServiceCategory(
        client,
        providerIds: providerIdsFor(meta),
        region: region,
        category: _category,
        batch: batch,
      );
      if (!mounted) return;
      setState(() {
        if (b.isEmpty) _hasMore = false;
        if (batch == 0) {
          _bucket = b;
        } else {
          final movies = _capped(_dedupe([..._bucket.movies, ...b.movies]));
          final series = _capped(_dedupe([..._bucket.series, ...b.series]));
          if (movies.length >= kServiceMaxPerBucket &&
              series.length >= kServiceMaxPerBucket) {
            _hasMore = false;
          }
          _bucket = ServiceBucket(movies: movies, series: series);
        }
        _loading = false;
        _fetching = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _fetching = false;
      });
    }
  }

  static List<MetaPreview> _dedupe(List<MetaPreview> metas) {
    final seen = <String>{};
    final out = <MetaPreview>[];
    for (final m in metas) {
      if (seen.add(m.id)) out.add(m);
    }
    return out;
  }

  static List<MetaPreview> _capped(List<MetaPreview> l) =>
      l.length > kServiceMaxPerBucket ? l.sublist(0, kServiceMaxPerBucket) : l;

  void _onScroll() {
    if (_fetching || _loading || !_hasMore) return;
    if (_scroll.position.pixels >= _scroll.position.maxScrollExtent - 1200) {
      setState(() => _batch += 1);
      _fetchBatch();
    }
  }

  void _selectCategory(ServiceCategory c) {
    if (c.id == _category.id) return;
    setState(() => _category = c);
    _reload();
  }

  void _openMeta(MetaPreview m) => ref
      .read(navControllerProvider.notifier)
      .push(Frame(FrameKind.meta, {'type': m.type, 'id': m.id}));

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    final meta = kServices[widget.service];
    if (meta == null) return const SizedBox.shrink();
    final region = ref.watch(settingsProvider).region;

    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: RadialGradient(
          center: const Alignment(-0.4, -1),
          radius: 1.1,
          colors: [Color(meta.tint).withValues(alpha: 0.22), t.canvas],
          stops: const [0, 0.65],
        ),
      ),
      child: CustomScrollView(
        controller: _scroll,
        slivers: [
          SliverToBoxAdapter(child: _header(meta, region, t)),
          SliverToBoxAdapter(child: _pills(t)),
          ..._content(meta, t),
          const SliverToBoxAdapter(child: SizedBox(height: 48)),
        ],
      ),
    );
  }

  Widget _header(StreamingServiceMeta meta, String region, HarborTokens t) {
    final g = pageGutter(Idiom.of(context));
    return Padding(
      padding: EdgeInsets.fromLTRB(g, 40, g, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'POPULAR ON',
            style: TextStyle(
              color: t.inkSubtle,
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
              letterSpacing: 2.2,
            ),
          ),
          const SizedBox(height: 14),
          SizedBox(
            height: 56,
            child: ServiceLogoLarge(service: widget.service),
          ),
          const SizedBox(height: 14),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: Text(
              'The most-watched movies and series on ${meta.name} right now '
              'in $region.',
              style: TextStyle(color: t.inkMuted, fontSize: 14.5, height: 1.5),
            ),
          ),
        ],
      ),
    );
  }

  Widget _pills(HarborTokens t) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(0, 8, 0, 8),
      child: SizedBox(
        height: 48,
        child: FocusTraversalGroup(
          policy: ReadingOrderTraversalPolicy(),
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: EdgeInsets.symmetric(
              horizontal: pageGutter(Idiom.of(context)),
            ),
            itemCount: kServiceCategories.length,
            separatorBuilder: (_, _) => const SizedBox(width: 8),
            itemBuilder: (context, i) {
              final c = kServiceCategories[i];
              final active = c.id == _category.id;
              return Focusable(
                tokens: t,
                autofocus: i == 0,
                borderRadius: 999,
                onPressed: () => _selectCategory(c),
                child: Container(
                  alignment: Alignment.center,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  decoration: BoxDecoration(
                    color: active ? t.ink : t.canvas.withValues(alpha: 0.4),
                    borderRadius: BorderRadius.circular(999),
                    border: active ? null : Border.all(color: t.surface),
                  ),
                  child: Text(
                    c.label,
                    style: TextStyle(
                      color: active ? t.canvas : t.inkMuted,
                      fontSize: 13.5,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }

  List<Widget> _content(StreamingServiceMeta meta, HarborTokens t) {
    if (_loading && _bucket.isEmpty) {
      return [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(top: 80),
            child: Center(
              child: CircularProgressIndicator(color: t.accent, strokeWidth: 2),
            ),
          ),
        ),
      ];
    }
    if (_bucket.isEmpty) {
      return [SliverToBoxAdapter(child: _empty(t))];
    }
    if (_category.id == 'all') {
      return [
        SliverList(delegate: SliverChildListDelegate(_allSections(meta, t))),
      ];
    }
    // A specific category: a single de-duped poster grid.
    final merged = _dedupe([..._bucket.movies, ..._bucket.series]);
    return [
      SliverPadding(
        padding: EdgeInsets.fromLTRB(
          pageGutter(Idiom.of(context)),
          24,
          pageGutter(Idiom.of(context)),
          0,
        ),
        sliver: SliverGrid(
          gridDelegate: SliverGridDelegateWithMaxCrossAxisExtent(
            maxCrossAxisExtent: scaledPosterCell(
              180,
              ref.watch(settingsProvider).getDouble('posterScale'),
            ),
            childAspectRatio: posterGridAspect(
              2 / 3.4,
              ref.watch(settingsProvider).getBool('hidePosterTitles'),
            ),
            crossAxisSpacing: 20,
            mainAxisSpacing: 28,
          ),
          delegate: SliverChildBuilderDelegate(
            (context, i) => FocusablePoster(
              item: merged[i],
              tokens: t,
              onPressed: () => _openMeta(merged[i]),
            ),
            childCount: merged.length,
          ),
        ),
      ),
    ];
  }

  List<Widget> _allSections(StreamingServiceMeta meta, HarborTokens t) {
    final sections = <Widget>[];
    final movies = _bucket.movies;
    final series = _bucket.series;

    void railRows(String name, List<MetaPreview> list) {
      if (list.length >= 10) {
        sections.add(
          TopRankRail(
            title: 'Top 10 $name on ${meta.name}',
            items: list.take(10).toList(),
          ),
        );
        if (list.length > 10) {
          sections.add(const SizedBox(height: 28));
          sections.add(_shelf('More $name', list.sublist(10), t));
        }
      } else if (list.isNotEmpty) {
        sections.add(_shelf('$name on ${meta.name}', list, t));
      }
    }

    railRows('Movies', movies);
    if (sections.isNotEmpty && series.isNotEmpty) {
      sections.add(const SizedBox(height: 28));
    }
    railRows('Series', series);
    return [const SizedBox(height: 24), ...sections];
  }

  Widget _shelf(String title, List<MetaPreview> items, HarborTokens t) {
    final g = pageGutter(Idiom.of(context));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.fromLTRB(g, 4, g, 10),
          child: Text(
            title,
            style: TextStyle(
              color: t.ink,
              fontSize: scaledRowTitle(
                20,
                ref.watch(settingsProvider).getDouble('rowTitleScale'),
              ),
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        SizedBox(
          height: scaledRailHeight(
            ref.watch(settingsProvider).getDouble('posterScale'),
            hideTitles: ref.watch(settingsProvider).getBool('hidePosterTitles'),
          ),
          child: FocusTraversalGroup(
            policy: ReadingOrderTraversalPolicy(),
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: EdgeInsets.symmetric(horizontal: g),
              itemCount: items.length,
              separatorBuilder: (_, _) => const SizedBox(width: 14),
              itemBuilder: (context, i) => FocusablePoster(
                item: items[i],
                tokens: t,
                width: scaledPosterCell(
                  150,
                  ref.watch(settingsProvider).getDouble('posterScale'),
                ),
                onPressed: () => _openMeta(items[i]),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _empty(HarborTokens t) {
    final hasKey = ref.read(tmdbClientProvider).hasKey;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        pageGutter(Idiom.of(context)),
        64,
        pageGutter(Idiom.of(context)),
        64,
      ),
      child: Center(
        child: Text(
          hasKey
              ? 'Nothing matched this filter. Try another category or change '
                    'your region in Settings.'
              : 'Add a TMDB key in Settings → Library to power this view.',
          textAlign: TextAlign.center,
          style: TextStyle(color: t.inkMuted, fontSize: 14),
        ),
      ),
    );
  }
}

/// The 56px hero logo (kept separate so the header can size it).
class ServiceLogoLarge extends StatelessWidget {
  const ServiceLogoLarge({super.key, required this.service});
  final String service;

  @override
  Widget build(BuildContext context) => Align(
    alignment: Alignment.centerLeft,
    child: ServiceLogo(service: service, height: 56),
  );
}
