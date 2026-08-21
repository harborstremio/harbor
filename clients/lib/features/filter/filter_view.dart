import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n_providers.dart';
import '../../app/nav_controller.dart';
import '../../app/providers.dart';
import '../../app/theme_controller.dart';
import '../../design/focus/focusable.dart';
import '../../design/focus/tv_row.dart';
import '../../design/layout/idiom.dart';
import '../../design/tokens.dart';
import '../../domain/addons/models.dart';
import '../../domain/catalog/filter_rails.dart';
import '../../domain/catalog/tmdb_person.dart' show creditToMeta, fetchPerson;
import '../../domain/feed/genre_spotlights.dart' show Spotlight;
import '../../domain/feed/spotlight_credits.dart' show spotlightCredits;
import '../../domain/i18n/translations.dart';
import '../../domain/nav/frame.dart';

/// The separator used to fold a topic's keyword list into a single string so it
/// can key a provider family (records can't hold a list with value equality).
const String _kwSep = '\u0001';

/// One filter rail's titles from TMDB discover. Keyed by the media type and the
/// (stable, computed-once) query params so it caches across rebuilds.
final _filterRailProvider =
    FutureProvider.family<
      List<MetaPreview>,
      ({String mediaType, Map<String, String> params})
    >((ref, args) async {
      final client = ref.watch(tmdbClientProvider);
      if (!client.hasKey) return const [];
      try {
        return await client.discover(args.mediaType, args.params);
      } catch (_) {
        return const [];
      }
    });

/// A genre spotlight rail — a person's ranked in-genre credits. Keyed by
/// primitive fields so it caches; the [Spotlight] is rebuilt inside.
final _spotlightRailProvider =
    FutureProvider.family<
      List<MetaPreview>,
      ({String name, String dept, bool presenter, int genreId, String related})
    >((ref, a) async {
      final client = ref.watch(tmdbClientProvider);
      if (!client.hasKey) return const [];
      try {
        final personId = await client.personIdByName(a.name);
        if (personId == null) return const [];
        final person = await fetchPerson(client, personId);
        if (person == null) return const [];
        final related = a.related.isEmpty
            ? const <int>[]
            : a.related.split(',').map(int.parse).toList();
        final spotlight = Spotlight(
          name: a.name,
          sub: '',
          dept: a.dept.isEmpty ? null : a.dept,
          presenter: a.presenter,
          relatedGenreIds: related,
        );
        return [
          for (final c in spotlightCredits(person, spotlight, a.genreId))
            creditToMeta(c),
        ];
      } catch (_) {
        return const [];
      }
    });

/// A genre topic rail — titles matching a set of keywords. Keyed by primitive
/// fields (keywords U+0001-joined) so it caches.
final _topicRailProvider =
    FutureProvider.family<
      List<MetaPreview>,
      ({String mediaType, String keywords, String genreIds, int voteCount})
    >((ref, a) async {
      final client = ref.watch(tmdbClientProvider);
      if (!client.hasKey) return const [];
      try {
        final ids = <int>[];
        for (final kw in a.keywords.split(_kwSep)) {
          final id = await client.keywordId(kw);
          if (id != null) ids.add(id);
        }
        if (ids.isEmpty) return const [];
        final params = <String, String>{
          'sort_by': 'vote_average.desc',
          'vote_count.gte': '${a.voteCount}',
          'with_keywords': ids.join('|'),
          if (a.genreIds.isNotEmpty) 'with_genres': a.genreIds,
        };
        return await client.discover(a.mediaType, params);
      } catch (_) {
        return const [];
      }
    });

/// The browse-filter view — a heading plus a set of curated discover rails for a
/// year, runtime, studio, country, language or network. Ported from the web
/// `FilterView`: discover rails plus, for a genre, its spotlight and topic rails.
class FilterView extends ConsumerStatefulWidget {
  const FilterView({super.key, required this.filter});

  final MetaFilter filter;

  @override
  ConsumerState<FilterView> createState() => _FilterViewState();
}

class _FilterViewState extends ConsumerState<FilterView> {
  late final List<AnyRail> _rails = filterRails(widget.filter);

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    final hasKey = ref.watch(settingsProvider).tmdbKey.isNotEmpty;
    if (!hasKey) return _noKey(t);
    return Container(
      color: t.canvas,
      child: ListView.separated(
        padding: const EdgeInsets.only(top: 8, bottom: 56),
        itemCount: _rails.length + 1,
        separatorBuilder: (_, _) => const SizedBox(height: 28),
        itemBuilder: (context, i) {
          if (i == 0) return _header(t);
          return _FilterRail(
            rail: _rails[i - 1],
            mediaType: widget.filter.mediaType,
            tokens: t,
            autofocusFirst: i == 1,
          );
        },
      ),
    );
  }

  Widget _header(HarborTokens t) {
    final d = _describe(widget.filter, ref.watch(translationsProvider));
    final idiom = Idiom.of(context);
    final g = pageGutter(idiom);
    return Padding(
      padding: EdgeInsets.fromLTRB(g, 32, g, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: t.elevated.withValues(alpha: 0.7),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(d.icon, color: t.inkMuted, size: 18),
              ),
              const SizedBox(width: 12),
              Text(
                d.kicker.toUpperCase(),
                style: TextStyle(
                  color: t.inkSubtle,
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 2.4,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            d.title,
            style: TextStyle(
              color: t.ink,
              fontSize: idiom.isPhone ? 30 : 44,
              height: 0.98,
              fontWeight: FontWeight.w600,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 10),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 640),
            child: Text(
              d.subtitle,
              style: TextStyle(color: t.inkMuted, fontSize: 15, height: 1.4),
            ),
          ),
          if (widget.filter case CountryFilter(:final name, :final iso))
            _mediaToggle(t, name, iso),
        ],
      ),
    );
  }

  /// The Movies/Shows toggle shown for a country filter, reopening it for the
  /// other media type (the web `MediaTypeToggle`).
  Widget _mediaToggle(HarborTokens t, String name, String iso) {
    final tr = ref.watch(translationsProvider);
    Widget chip(String label, String media) {
      final active = widget.filter.mediaType == media;
      return Focusable(
        tokens: t,
        scale: 1.0,
        borderRadius: 10,
        onPressed: active
            ? () {}
            : () => ref
                  .read(navControllerProvider.notifier)
                  .push(
                    Frame(
                      FrameKind.filter,
                      CountryFilter(media, name, iso).toArgs(),
                    ),
                  ),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            color: active ? t.accentSoft : t.canvas.withValues(alpha: 0.4),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: active ? t.accent : t.edgeSoft),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: active ? t.ink : t.inkMuted,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Row(
        children: [
          chip(tr.t('Movies'), 'movie'),
          const SizedBox(width: 8),
          chip(tr.t('Shows'), 'tv'),
        ],
      ),
    );
  }

  Widget _noKey(HarborTokens t) {
    return Container(
      color: t.canvas,
      alignment: Alignment.center,
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            'Add a TMDB key to browse by this filter.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: t.ink,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 6),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Text(
              'Year, runtime, language, and country filters need TMDB. Genre '
              'browsing falls back to Cinemeta automatically.',
              textAlign: TextAlign.center,
              style: TextStyle(color: t.inkMuted, fontSize: 12.5, height: 1.4),
            ),
          ),
        ],
      ),
    );
  }
}

({String kicker, String title, String subtitle, IconData icon}) _describe(
  MetaFilter f,
  Translations tr,
) {
  final media = f.mediaType == 'movie' ? 'Movies' : 'Shows';
  switch (f) {
    case YearFilter(:final value, :final mediaType):
      return (
        kicker: tr.t(mediaType == 'movie' ? 'Movies' : 'TV Shows'),
        title: '$value',
        subtitle: tr.t(
          'Everything from {year}, sorted across trending, top rated, and '
          'hidden gems.',
          {'year': value},
        ),
        icon: Icons.calendar_today,
      );
    case RuntimeFilter(:final value):
      final r = runtimeRange(value);
      return (
        kicker: tr.t('Runtime'),
        title: tr.t('Around {min} min', {'min': value}),
        subtitle: tr.t(
          '{media} between {lo}-{hi} minutes. Pick a length, not a wall '
          'of options.',
          {'media': tr.t(media), 'lo': r.lo, 'hi': r.hi},
        ),
        icon: Icons.schedule,
      );
    case StudioFilter(:final name):
      return (
        kicker: tr.t('Studio'),
        title: name,
        subtitle: tr.t(
          '{media} produced by {name}, ranked from biggest hits to overlooked '
          'gems.',
          {'media': tr.t(media), 'name': name},
        ),
        icon: Icons.apartment,
      );
    case CountryFilter(:final name):
      return (
        kicker: tr.t('Country'),
        title: name,
        subtitle: tr.t(
          '{media} from {name}: popular, acclaimed, and hidden alike.',
          {'media': tr.t(media), 'name': name},
        ),
        icon: Icons.public,
      );
    case LanguageFilter(:final name):
      final localName = tr.t(name);
      return (
        kicker: tr.t('Language'),
        title: localName,
        subtitle: tr.t(
          'Everything originally in {name}: movies and series across every '
          'genre, era, and hidden gems.',
          {'name': localName},
        ),
        icon: Icons.translate,
      );
    case NetworkFilter(:final name):
      return (
        kicker: tr.t('Network'),
        title: name,
        subtitle: tr.t(
          'Series from {name}: current hits, classics, and the deep cuts.',
          {'name': name},
        ),
        icon: Icons.tv,
      );
    case GenreFilter(:final name, :final mediaType):
      final localGenre = tr.tOr('genre.$name', name);
      return (
        kicker: tr.t(mediaType == 'movie' ? 'Genre' : 'TV Genre'),
        title: localGenre,
        subtitle: tr.t(
          'The best {genre} {media}, layered by mood. Browse trending, dive '
          "into a director's run, sort by decade, find quiet gems.",
          {
            'genre': localGenre.toLowerCase(),
            'media': tr.t(media).toLowerCase(),
          },
        ),
        icon: Icons.tag,
      );
  }
}

class _FilterRail extends ConsumerWidget {
  const _FilterRail({
    required this.rail,
    required this.mediaType,
    required this.tokens,
    this.autofocusFirst = false,
  });

  final AnyRail rail;
  final String mediaType;
  final HarborTokens tokens;

  /// Land the remote on this rail's first poster when the filter page opens on
  /// a TV (a push unmounts the tile that was focused, so nothing would be
  /// highlighted otherwise). Set on the first rail only.
  final bool autofocusFirst;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final r = rail;
    switch (r) {
      case StandardRail():
        return _row(
          ref,
          r.title,
          r.kicker,
          ref
                  .watch(
                    _filterRailProvider((
                      mediaType: r.mediaType ?? mediaType,
                      params: r.params,
                    )),
                  )
                  .value ??
              const [],
        );
      case SpotlightRail():
        final s = r.spotlight;
        return _row(
          ref,
          s.name,
          s.sub,
          ref
                  .watch(
                    _spotlightRailProvider((
                      name: s.name,
                      dept: s.dept ?? '',
                      presenter: s.presenter,
                      genreId: r.genreId,
                      related: s.relatedGenreIds.join(','),
                    )),
                  )
                  .value ??
              const [],
        );
      case TopicRail():
        final tp = r.topic;
        return _row(
          ref,
          tp.title,
          tp.kicker,
          ref
                  .watch(
                    _topicRailProvider((
                      mediaType: r.mediaType,
                      keywords: tp.keywords.join(_kwSep),
                      genreIds: tp.genreIds.join(','),
                      voteCount: tp.voteCount ?? 5,
                    )),
                  )
                  .value ??
              const [],
        );
    }
  }

  Widget _row(
    WidgetRef ref,
    String title,
    String kicker,
    List<MetaPreview> items,
  ) {
    if (items.isEmpty) return const SizedBox.shrink();
    return TvRow(
      title: title,
      kicker: kicker,
      items: items,
      tokens: tokens,
      viewAll: false,
      autofocusFirst: autofocusFirst,
      onSelect: (m) => ref
          .read(navControllerProvider.notifier)
          .push(Frame(FrameKind.meta, {'type': m.type, 'id': m.id})),
    );
  }
}
