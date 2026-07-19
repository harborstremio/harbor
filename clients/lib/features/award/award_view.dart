import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/awards_providers.dart';
import '../../app/nav_controller.dart';
import '../../app/providers.dart';
import '../../app/theme_controller.dart';
import '../../design/awards/award_icons.dart';
import '../../design/focus/focusable.dart';
import '../../design/focus/focusable_poster.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/addons/models.dart';
import '../../domain/awards/award_page.dart';
import '../../domain/awards/awards_catalog.dart';
import '../../domain/awards/wikidata_awards.dart';
import '../../domain/nav/frame.dart';
import 'award_list.dart';

/// The Award page for a body (Oscars, Emmys, …): a laurel hero, the body's
/// blurb, its winning films, and rails of its celebrated actors, directors, and
/// writers. Ported from `views/award.tsx` (gallery mode). Requires a TMDB key
/// for posters and people (a clear prompt shows otherwise).
class AwardView extends ConsumerStatefulWidget {
  const AwardView({super.key, required this.type});

  final AwardType type;

  @override
  ConsumerState<AwardView> createState() => _AwardViewState();
}

class _AwardViewState extends ConsumerState<AwardView> {
  static const _preview = 18;
  static const _page = 24;

  static const _modeKey = 'harbor.award.viewmode';

  AwardFilmPager? _pager;
  List<MetaPreview> _films = const [];
  bool _loadingFilms = true;
  bool _loadingMore = false;
  bool _filmsDone = false;
  bool _expanded = false;
  int _target = _preview;

  /// 'gallery' (posters + people) or 'list' (the winner history). Persisted.
  late String _mode;

  @override
  void initState() {
    super.initState();
    _mode = ref.read(kvStoreProvider).getString(_modeKey) == 'list'
        ? 'list'
        : 'gallery';
  }

  void _selectMode(String mode) {
    if (_mode == mode) return;
    setState(() => _mode = mode);
    ref.read(kvStoreProvider).setString(_modeKey, mode);
  }

  Future<void> _startFilms(AwardSeeds seeds) async {
    final pager = AwardFilmPager(seeds.films);
    _pager = pager;
    final client = ref.read(tmdbClientProvider);
    if (!client.hasKey) {
      if (mounted) {
        setState(() {
          _loadingFilms = false;
          _filmsDone = true;
        });
      }
      return;
    }
    await pager.loadUntil(client, _preview);
    if (!mounted) return;
    setState(() {
      _films = pager.resolved;
      _filmsDone = pager.done;
      _loadingFilms = false;
    });
  }

  Future<void> _loadMore() async {
    final pager = _pager;
    if (pager == null || _loadingMore || _loadingFilms || _filmsDone) return;
    final client = ref.read(tmdbClientProvider);
    if (!client.hasKey) return;
    setState(() => _loadingMore = true);
    _target += _page;
    await pager.loadUntil(client, _target);
    if (!mounted) return;
    setState(() {
      _films = pager.resolved;
      _filmsDone = pager.done;
      _loadingMore = false;
    });
  }

  void _viewAll() {
    setState(() => _expanded = true);
    _loadMore();
  }

  void _openMeta(MetaPreview m) => ref
      .read(navControllerProvider.notifier)
      .push(Frame(FrameKind.meta, {'type': m.type, 'id': m.id}));

  void _openPerson(int id) => ref
      .read(navControllerProvider.notifier)
      .push(Frame(FrameKind.person, {'id': id}));

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    final meta = kAwardCatalog[widget.type];
    final tint = laurelColorFor(widget.type);
    final hasKey = ref.watch(tmdbClientProvider).hasKey;

    // Kick off film resolution once the seeds are ready.
    final seeds = ref.watch(awardSeedsProvider(widget.type));
    if (seeds.hasValue && _pager == null) {
      final s = seeds.value!;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && _pager == null) _startFilms(s);
      });
    }

    final peopleAsync = ref.watch(awardPeopleProvider(widget.type));
    final people = peopleAsync.value ?? kEmptyAwardPeople;
    final loadingPeople = peopleAsync.isLoading;

    if (meta == null) return const SizedBox.shrink();

    final idiom = Idiom.of(context);
    final g = pageGutter(idiom);

    return ColoredBox(
      color: t.canvas,
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _AwardHero(
              type: widget.type,
              tint: tint,
              films: _films,
              tokens: t,
              idiom: idiom,
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(g, 40, g, idiom.isPhone ? 64 : 96),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 1180),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 760),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              meta.description,
                              style: TextStyle(
                                color: t.inkMuted,
                                fontSize: 16.5,
                                height: 1.65,
                              ),
                            ),
                            if (meta.tagline.isNotEmpty) ...[
                              const SizedBox(height: 12),
                              Text(
                                meta.tagline.toUpperCase(),
                                style: TextStyle(
                                  color: t.inkSubtle,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  letterSpacing: 2.1,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(height: 32),
                      _ModeToggle(
                        mode: _mode,
                        tint: tint,
                        tokens: t,
                        onSelect: _selectMode,
                      ),
                      const SizedBox(height: 32),
                      if (_mode == 'list')
                        AwardList(type: widget.type, tint: tint, tokens: t)
                      else if (!hasKey)
                        _prompt(
                          t,
                          'Add a TMDB key in Settings to unlock posters and '
                          'the artists behind this award.',
                        )
                      else ...[
                        _FilmGrid(
                          films: _films,
                          total:
                              _pager?.total ?? seeds.value?.films.length ?? 0,
                          loading: _loadingFilms,
                          loadingMore: _loadingMore,
                          expanded: _expanded,
                          done: _filmsDone,
                          onViewAll: _viewAll,
                          onLoadMore: _loadMore,
                          onOpen: _openMeta,
                          tint: tint,
                          tokens: t,
                        ),
                        const SizedBox(height: 56),
                        _PeopleRail(
                          title: 'Celebrated actors',
                          people: people.actors,
                          loading: loadingPeople,
                          tint: tint,
                          tokens: t,
                          onOpen: _openPerson,
                        ),
                        _PeopleRail(
                          title: 'Acclaimed directors',
                          people: people.directors,
                          loading: loadingPeople,
                          tint: tint,
                          tokens: t,
                          onOpen: _openPerson,
                        ),
                        _PeopleRail(
                          title: 'Honored writers',
                          people: people.writers,
                          loading: loadingPeople,
                          tint: tint,
                          tokens: t,
                          onOpen: _openPerson,
                        ),
                        if (!_loadingFilms &&
                            !loadingPeople &&
                            _films.isEmpty &&
                            people.actors.isEmpty &&
                            people.directors.isEmpty &&
                            people.writers.isEmpty)
                          _prompt(
                            t,
                            'No winners are catalogued for this award yet.',
                          ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _prompt(HarborTokens t, String text) => Container(
    padding: const EdgeInsets.all(24),
    decoration: BoxDecoration(
      color: t.elevated.withValues(alpha: 0.3),
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: t.edgeSoft),
    ),
    child: Text(
      text,
      style: TextStyle(color: t.inkMuted, fontSize: 14, height: 1.5),
    ),
  );
}

/// The Gallery / Full-list switch. Ported from the web `ModeToggle`.
class _ModeToggle extends StatelessWidget {
  const _ModeToggle({
    required this.mode,
    required this.tint,
    required this.tokens,
    required this.onSelect,
  });

  final String mode;
  final Color tint;
  final HarborTokens tokens;
  final void Function(String) onSelect;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: t.elevated.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: t.edgeSoft),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _tab('gallery', 'Gallery', Icons.grid_view_rounded, t),
          _tab('list', 'Full list', Icons.view_list_rounded, t),
        ],
      ),
    );
  }

  Widget _tab(String value, String label, IconData icon, HarborTokens t) {
    final active = mode == value;
    return Focusable(
      tokens: t,
      scale: 1.0,
      borderRadius: 999,
      onPressed: () => onSelect(value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: active ? tint : Colors.transparent,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 15, color: active ? t.canvas : t.inkMuted),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                color: active ? t.canvas : t.inkMuted,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AwardHero extends StatelessWidget {
  const _AwardHero({
    required this.type,
    required this.tint,
    required this.films,
    required this.tokens,
    required this.idiom,
  });

  final AwardType type;
  final Color tint;
  final List<MetaPreview> films;
  final HarborTokens tokens;
  final Idiom idiom;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    final phone = idiom.isPhone;
    final g = pageGutter(idiom);
    final meta = kAwardCatalog[type]!;
    final imgs = <String>[];
    for (final f in films) {
      final u = f.background ?? f.poster;
      if (u != null && !imgs.contains(u)) imgs.add(u);
      if (imgs.length >= 10) break;
    }
    final tiles = imgs.length >= 3
        ? [for (var i = 0; i < 10; i++) imgs[i % imgs.length]]
        : const <String>[];
    final years = DateTime.now().year - meta.founded;

    return SizedBox(
      height: phone ? 380 : 460,
      child: Stack(
        fit: StackFit.expand,
        children: [
          ColoredBox(color: t.canvas),
          if (tiles.isNotEmpty)
            ShaderMask(
              blendMode: BlendMode.dstIn,
              shaderCallback: (rect) => const LinearGradient(
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
                colors: [Colors.transparent, Colors.transparent, Colors.white],
                stops: [0.0, 0.14, 0.6],
              ).createShader(rect),
              child: GridView.count(
                crossAxisCount: 5,
                physics: const NeverScrollableScrollPhysics(),
                padding: const EdgeInsets.all(8),
                mainAxisSpacing: 8,
                crossAxisSpacing: 8,
                childAspectRatio: 16 / 9,
                children: [
                  for (final src in tiles)
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: CachedNetworkImage(
                        imageUrl: src,
                        fit: BoxFit.cover,
                        color: Colors.white.withValues(alpha: 0.82),
                        colorBlendMode: BlendMode.modulate,
                        errorWidget: (_, _, _) => ColoredBox(color: t.surface),
                      ),
                    ),
                ],
              ),
            ),
          // Left-to-right and bottom scrims so the title stays legible.
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  t.canvas,
                  t.canvas.withValues(alpha: 0.75),
                  t.canvas.withValues(alpha: 0.15),
                ],
              ),
            ),
          ),
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.bottomCenter,
                end: Alignment.topCenter,
                colors: [
                  t.canvas,
                  t.canvas.withValues(alpha: 0.1),
                  Colors.transparent,
                ],
              ),
            ),
          ),
          Align(
            alignment: Alignment.bottomCenter,
            child: Padding(
              padding: EdgeInsets.fromLTRB(g, 0, g, phone ? 32 : 44),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 1180),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            meta.shorthand.toUpperCase(),
                            style: TextStyle(
                              color: t.inkSubtle,
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 4,
                            ),
                          ),
                          SizedBox(height: phone ? 12 : 16),
                          Text(
                            meta.title,
                            style: TextStyle(
                              color: t.ink,
                              fontSize: phone ? 36 : 60,
                              fontWeight: FontWeight.w500,
                              height: 0.98,
                              letterSpacing: -1,
                            ),
                          ),
                          if (meta.founded > 0) ...[
                            SizedBox(height: phone ? 12 : 18),
                            Text.rich(
                              TextSpan(
                                children: [
                                  TextSpan(text: 'Founded ${meta.founded}'),
                                  TextSpan(
                                    text: '   ·   ',
                                    style: TextStyle(
                                      color: t.inkSubtle.withValues(alpha: 0.4),
                                    ),
                                  ),
                                  TextSpan(
                                    text: '$years years',
                                    style: TextStyle(color: tint),
                                  ),
                                ],
                                style: TextStyle(
                                  color: t.inkMuted,
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    SizedBox(width: phone ? 14 : 24),
                    Laurel(
                      size: phone ? 120 : 200,
                      color: tint,
                      child: AwardLogo(type: type, size: phone ? 50 : 82),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FilmGrid extends StatelessWidget {
  const _FilmGrid({
    required this.films,
    required this.total,
    required this.loading,
    required this.loadingMore,
    required this.expanded,
    required this.done,
    required this.onViewAll,
    required this.onLoadMore,
    required this.onOpen,
    required this.tint,
    required this.tokens,
  });

  final List<MetaPreview> films;
  final int total;
  final bool loading;
  final bool loadingMore;
  final bool expanded;
  final bool done;
  final VoidCallback onViewAll;
  final VoidCallback onLoadMore;
  final void Function(MetaPreview) onOpen;
  final Color tint;
  final HarborTokens tokens;

  static const _preview = 18;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    if (loading && films.isEmpty) {
      return Padding(
        padding: const EdgeInsets.only(top: 24),
        child: Center(
          child: CircularProgressIndicator(color: tint, strokeWidth: 2),
        ),
      );
    }
    if (films.isEmpty) return const SizedBox.shrink();
    final shown = expanded ? films : films.take(_preview).toList();
    final canViewAll = !expanded && total > _preview && films.isNotEmpty;
    final phone = Idiom.of(context).isPhone;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionHeader('Winning films & shows', total, tint, t, phone: phone),
        const SizedBox(height: 24),
        FocusTraversalGroup(
          policy: ReadingOrderTraversalPolicy(),
          child: Wrap(
            spacing: 16,
            runSpacing: 28,
            children: [
              for (final (i, m) in shown.indexed)
                FocusablePoster(
                  item: m,
                  tokens: t,
                  // Land the remote on the first film so the award gallery opens
                  // with a visible focus target on a TV.
                  autofocus: i == 0,
                  onPressed: () => onOpen(m),
                ),
            ],
          ),
        ),
        if (canViewAll) ...[
          const SizedBox(height: 24),
          Center(
            child: _pillButton(
              t,
              tint,
              'View all $total winners',
              Icons.keyboard_arrow_down_rounded,
              onViewAll,
            ),
          ),
        ],
        if (expanded && !done) ...[
          const SizedBox(height: 24),
          Center(
            child: loadingMore
                ? CircularProgressIndicator(color: tint, strokeWidth: 2)
                : _pillButton(
                    t,
                    tint,
                    'Load more',
                    Icons.keyboard_arrow_down_rounded,
                    onLoadMore,
                  ),
          ),
        ],
      ],
    );
  }
}

Widget _sectionHeader(
  String title,
  int count,
  Color tint,
  HarborTokens t, {
  bool phone = false,
}) => Row(
  crossAxisAlignment: CrossAxisAlignment.center,
  children: [
    Container(
      width: 4,
      height: 28,
      decoration: BoxDecoration(
        color: tint,
        borderRadius: BorderRadius.circular(999),
      ),
    ),
    const SizedBox(width: 12),
    // The title flexes so a long section name ellipsizes instead of shoving
    // the count off a narrow phone row.
    Expanded(
      child: Text(
        title,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          color: t.ink,
          fontSize: phone ? 22 : 30,
          fontWeight: FontWeight.w500,
          letterSpacing: -0.5,
        ),
      ),
    ),
    if (count > 0) ...[
      const SizedBox(width: 12),
      Text(
        count == 1 ? '1 TITLE' : '$count TITLES',
        style: TextStyle(
          color: t.inkSubtle,
          fontSize: 12,
          fontWeight: FontWeight.w600,
          letterSpacing: 2.1,
        ),
      ),
    ],
  ],
);

Widget _pillButton(
  HarborTokens t,
  Color tint,
  String label,
  IconData icon,
  VoidCallback onTap,
) => Focusable(
  tokens: t,
  borderRadius: 999,
  onPressed: onTap,
  child: Container(
    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 11),
    decoration: BoxDecoration(
      color: t.elevated.withValues(alpha: 0.5),
      borderRadius: BorderRadius.circular(999),
      border: Border.all(color: t.edgeSoft),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label,
          style: TextStyle(
            color: t.ink,
            fontSize: 13.5,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(width: 8),
        Icon(icon, size: 16, color: tint),
      ],
    ),
  ),
);

class _PeopleRail extends StatelessWidget {
  const _PeopleRail({
    required this.title,
    required this.people,
    required this.loading,
    required this.tint,
    required this.tokens,
    required this.onOpen,
  });

  final String title;
  final List<AwardPerson> people;
  final bool loading;
  final Color tint;
  final HarborTokens tokens;
  final void Function(int id) onOpen;

  @override
  Widget build(BuildContext context) {
    if (!loading && people.isEmpty) return const SizedBox.shrink();
    final t = tokens;
    final phone = Idiom.of(context).isPhone;
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionHeader(title, 0, tint, t, phone: phone),
          const SizedBox(height: 18),
          SizedBox(
            height: 240,
            child: loading && people.isEmpty
                ? Center(
                    child: CircularProgressIndicator(
                      color: tint,
                      strokeWidth: 2,
                    ),
                  )
                : FocusTraversalGroup(
                    policy: ReadingOrderTraversalPolicy(),
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: people.length,
                      separatorBuilder: (_, _) => const SizedBox(width: 16),
                      itemBuilder: (context, i) => _PersonCard(
                        person: people[i],
                        tint: tint,
                        tokens: t,
                        onOpen: () => onOpen(people[i].id),
                      ),
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

class _PersonCard extends StatelessWidget {
  const _PersonCard({
    required this.person,
    required this.tint,
    required this.tokens,
    required this.onOpen,
  });

  final AwardPerson person;
  final Color tint;
  final HarborTokens tokens;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return SizedBox(
      width: 132,
      child: Focusable(
        tokens: t,
        borderRadius: 12,
        onPressed: onOpen,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: AspectRatio(
                aspectRatio: 2 / 3,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    person.photo != null
                        ? CachedNetworkImage(
                            imageUrl: person.photo!,
                            fit: BoxFit.cover,
                            placeholder: (_, _) => ColoredBox(color: t.surface),
                            errorWidget: (_, _, _) => _fallback(t),
                          )
                        : _fallback(t),
                    if (person.wins > 1)
                      Positioned(
                        top: 8,
                        right: 8,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: tint,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            '${person.wins}×',
                            style: TextStyle(
                              color: t.canvas,
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              person.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: t.ink,
                fontSize: 13.5,
                fontWeight: FontWeight.w600,
              ),
            ),
            if (person.work != null && person.work!.isNotEmpty) ...[
              const SizedBox(height: 2),
              Text(
                person.work!,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: t.inkSubtle, fontSize: 11.5),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _fallback(HarborTokens t) => ColoredBox(
    color: t.surface,
    child: Center(
      child: Icon(Icons.person_outline, color: t.inkSubtle, size: 32),
    ),
  );
}
