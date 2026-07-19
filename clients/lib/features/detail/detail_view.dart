import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/foundation.dart' show listEquals;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/anilist_providers.dart';
import '../../app/download_providers.dart';
import '../../app/feed_providers.dart';
import '../../app/i18n_providers.dart';
import '../../app/trailer_providers.dart';
import '../../domain/trailer/trailer.dart';
import 'detail_hero_trailer.dart';
import 'trailer_overlay.dart';
import '../../app/nav_controller.dart';
import '../../app/providers.dart';
import '../../app/stremio_auth.dart';
import '../../app/theme_controller.dart';
import '../../core/net/safe_launch.dart';
import '../../design/focus/focusable.dart';
import '../../design/focus/focusable_poster.dart';
import '../../design/focus/tv_row.dart';
import '../../design/layout/idiom.dart';
import 'anilist_add_button.dart';
import 'anilist_comments_section.dart';
import '../../domain/i18n/translations.dart';
import 'simkl_add_button.dart';
import 'upcoming.dart';
import 'letterboxd_reviews_section.dart';
import 'anime_episodes.dart';
import 'anime_season_picker.dart';
import 'trakt_comments_section.dart';
import '../../design/tokens.dart';
import '../../domain/addons/models.dart';
import '../../domain/anime/anime_detail.dart' show isAnimeId;
import '../../domain/anime/anime_franchise.dart';
import '../../domain/catalog/tmdb.dart';
import '../../domain/catalog/tmdb_details.dart';
import '../../domain/catalog/tmdb_watch.dart';
import '../../domain/downloads/downloads_store.dart';
import '../../domain/player/audio_track_select.dart';
import '../../domain/stremio/stremio_watched.dart';
import '../../domain/detail/detail_customization.dart';
import '../../domain/discover/affinity.dart' show EventKind, ProfileSnapshot;
import '../../domain/discover/profile.dart'
    show profileFromDetail, profileFromMeta;
import '../../domain/catalog/filter_rails.dart';
import '../../domain/nav/frame.dart';
import 'add_to_list_menu.dart';
import 'awards_block.dart';
import 'episode_download_button.dart';
import 'meta_awards_corner.dart';
import 'hero_ratings.dart';
import 'media_gallery.dart';
import 'season_episodes.dart';

/// The detail page for a title, ported from `src/views/detail.tsx`: a full-bleed
/// backdrop hero (tagline, logo-or-title plate, meta-pill line, Play/Watchlist
/// actions), a synopsis, the cast/crew info, and — for a series — the episode
/// list. Consumes the rich [detailProvider] (TMDB when keyed, Cinemeta fallback)
/// plus [metaProvider] for the series episode videos.
class DetailView extends ConsumerStatefulWidget {
  const DetailView({super.key, required this.type, required this.id});

  final String type;
  final String id;

  @override
  ConsumerState<DetailView> createState() => _DetailViewState();
}

class _DetailViewState extends ConsumerState<DetailView> {
  bool _tracked = false;
  Timer? _dwell;

  @override
  void dispose() {
    _dwell?.cancel();
    super.dispose();
  }

  /// Feeds the taste affinity: an `open` event when the title resolves, and a
  /// stronger `dwell` if the detail is still on screen eight seconds later.
  /// Ported from the `open`/`dwell` tracking in `detail.tsx`.
  void _track(ProfileSnapshot snapshot) {
    if (_tracked) return;
    _tracked = true;
    final store = ref.read(affinityStoreProvider);
    store.trackEvent(widget.id, EventKind.open, meta: snapshot);
    _dwell = Timer(const Duration(seconds: 8), () {
      store.trackEvent(widget.id, EventKind.dwell, meta: snapshot);
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    // Anime ids (kitsu/mal/anilist/anidb) are unknown to TMDB and Cinemeta, so
    // they resolve through the dedicated anime detail assembly. The base detail
    // renders first; the merged detail (TMDB logo, wide art, richer crew) swaps
    // in once its extras land. A tt/tmdb title that is really an anime is
    // detected from its loaded imdb id/year and swapped to the anime detail.
    final AsyncValue<TmdbDetail?> detailAsync;
    String? animeId;
    if (isAnimeId(widget.id)) {
      animeId = widget.id;
      detailAsync = _resolveAnimeDetail(animeId);
    } else {
      final baseAsync = ref.watch(
        detailProvider((type: widget.type, id: widget.id)),
      );
      final detected = ref
          .watch(
            detectedAnimeKitsuIdProvider((
              id: widget.id,
              imdbId: baseAsync.value?.imdbId,
              year: baseAsync.value?.year,
            )),
          )
          .value;
      if (detected != null) {
        animeId = 'kitsu:$detected';
        detailAsync = _resolveAnimeDetail(animeId, whileLoading: baseAsync);
      } else {
        detailAsync = baseAsync;
      }
    }
    final metaAsync = ref.watch(
      metaProvider((type: widget.type, id: widget.id)),
    );
    final detail = detailAsync.value;
    final meta = metaAsync.value;

    if (!_tracked && (detail != null || meta != null)) {
      final snapshot = detail != null
          ? profileFromDetail(detail)
          : profileFromMeta(MetaPreview(meta!.json));
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _track(snapshot);
      });
    }

    // Still loading with nothing to show yet.
    if (detail == null && meta == null) {
      if (detailAsync.isLoading || metaAsync.isLoading) {
        return Center(
          child: CircularProgressIndicator(color: t.accent, strokeWidth: 2),
        );
      }
      return _centered(
        ref.read(translationsProvider).t('Could not load this title.'),
        t,
      );
    }

    return _DetailBody(
      type: widget.type,
      id: widget.id,
      animeId: animeId,
      detail: detail,
      meta: meta,
      tokens: t,
    );
  }

  /// Resolves the anime detail for [animeId], preferring the extras-merged
  /// detail once it lands and otherwise showing [whileLoading] (the base TMDB
  /// detail for a detected title) or the anime base's own loading/error state.
  AsyncValue<TmdbDetail?> _resolveAnimeDetail(
    String animeId, {
    AsyncValue<TmdbDetail?>? whileLoading,
  }) {
    final key = (type: widget.type, id: animeId);
    final base = ref.watch(animeDetailProvider(key));
    final merged = ref.watch(animeMergedDetailProvider(key));
    final resolved = merged.value ?? base.value?.detail;
    if (resolved != null) return AsyncValue.data(resolved);
    return whileLoading ?? base.whenData((r) => r?.detail);
  }

  Widget _centered(String text, HarborTokens t) => Center(
    child: Text(text, style: TextStyle(color: t.inkMuted, fontSize: 16)),
  );
}

class _DetailBody extends ConsumerWidget {
  const _DetailBody({
    required this.type,
    required this.id,
    required this.detail,
    required this.meta,
    required this.tokens,
    this.animeId,
  });

  final String type;
  final String id;
  final TmdbDetail? detail;
  final Meta? meta;
  final HarborTokens tokens;

  /// The canonical Kitsu-scheme id when this title is (or is detected as) an
  /// anime — its episode list, franchise and stream resolution use this.
  final String? animeId;

  bool get _isSeries => type == 'series';

  /// The anime id to drive the anime UI: the id itself when it is an anime
  /// scheme, else the detected canonical id (or null when not anime).
  String? get _effectiveAnimeId => isAnimeId(id) ? id : animeId;

  /// Opens the year browse filter for the title's release year (the web year
  /// pill): the first four characters of the year string, movie or tv.
  void _openYearFilter(WidgetRef ref) {
    final raw = _year;
    if (raw == null) return;
    final head = raw.length >= 4 ? raw.substring(0, 4) : raw;
    final year = int.tryParse(head);
    if (year == null) return;
    ref
        .read(navControllerProvider.notifier)
        .push(
          Frame(
            FrameKind.filter,
            YearFilter(_isSeries ? 'tv' : 'movie', year).toArgs(),
          ),
        );
  }

  /// The genre pills' labels and (when the genre is browsable) their filters.
  /// For a keyed title the TMDB genre ids are normalised to their Harbor names
  /// (e.g. `Science Fiction` → `Sci-Fi`); a Cinemeta title's names are looked up
  /// directly. A genre with no id is shown but not tappable.
  List<({String label, GenreFilter? filter})> _genreChips() {
    final mt = _isSeries ? 'tv' : 'movie';
    final out = <({String label, GenreFilter? filter})>[];
    final rich = detail?.genresRich ?? const <({int id, String name})>[];
    if (rich.isNotEmpty) {
      for (final g in rich) {
        final webName = genreNameById(g.id, series: _isSeries);
        out.add((
          label: webName ?? g.name,
          filter: webName == null ? null : GenreFilter(mt, webName, g.id),
        ));
      }
    } else {
      for (final name in _genres) {
        final gid = (_isSeries ? kTvGenres : kMovieGenres)[name];
        out.add((
          label: name,
          filter: gid == null ? null : GenreFilter(mt, name, gid),
        ));
      }
    }
    return out;
  }

  /// Opens the runtime browse filter for a movie's length (the web runtime
  /// pill; the runtime filter is movie-only).
  void _openRuntimeFilter(WidgetRef ref) {
    final match = RegExp(r'\d+').firstMatch(_runtime ?? '');
    final minutes = match == null ? null : int.tryParse(match.group(0)!);
    if (minutes == null) return;
    ref
        .read(navControllerProvider.notifier)
        .push(
          Frame(FrameKind.filter, RuntimeFilter('movie', minutes).toArgs()),
        );
  }

  // Merged hero fields: the rich TMDB detail wins, with the Cinemeta meta as the
  // fallback (mirroring `detail?.x ?? meta.x` in the web).
  String get _title =>
      (detail?.title.isNotEmpty ?? false) ? detail!.title : (meta?.name ?? '');
  String? get _logo => detail?.logo ?? meta?.logo;
  String? get _backdrop => upsizeTmdb(detail?.backdrop) ?? meta?.background;
  String get _tagline => detail?.tagline ?? '';
  String? get _year => detail?.year ?? meta?.releaseInfo;
  String? get _runtime => detail?.runtime ?? meta?.runtime;
  String? get _rating => detail?.rating ?? meta?.imdbRating?.toString();
  List<String> get _genres => (detail?.genres.isNotEmpty ?? false)
      ? detail!.genres
      : (meta?.genres ?? const []);
  String get _overview => (detail?.overview.isNotEmpty ?? false)
      ? detail!.overview
      : (meta?.description ?? '');

  /// The deduped, hi-res backdrop pool for the hero carousel: the primary hero
  /// backdrop first, then the title's gallery backdrops. Ports the web
  /// `backdropPool` memo (detail.tsx) — each url upgraded to the original size
  /// via [toHiResBackdrop] and deduped, non-TMDB urls (e.g. Cinemeta
  /// backgrounds) passing through unchanged.
  List<String> get _backdropPool {
    final seen = <String>{};
    final pool = <String>[];
    for (final b in [_backdrop, ...?detail?.gallery.backdrops]) {
      final hi = toHiResBackdrop(b);
      if (hi == null || hi.isEmpty || !seen.add(hi)) continue;
      pool.add(hi);
    }
    return pool;
  }

  /// The most-recently-played episode of this series, drawn from the local
  /// resume store and the local continue-watching store across the title's
  /// candidate ids (meta id, imdb id, `tmdb:tv:*`). Ports the local sources of
  /// the web `lastPlay`; null for movies or a never-played series.
  ({int season, int episode})? _resolveResumeEpisode(WidgetRef ref) {
    if (!_isSeries) return null;
    final resume = ref.read(resumeStoreProvider);
    final cw = ref.read(localCwStoreProvider);
    final ids = <String>{
      id,
      if (detail?.imdbId != null && detail!.imdbId!.isNotEmpty) detail!.imdbId!,
      if (detail != null && detail!.id > 0 && detail!.kind == 'tv')
        'tmdb:tv:${detail!.id}',
    };
    ({int season, int episode, int t})? best;
    void consider(int season, int episode, int t) {
      if (season < 1 || episode < 1) return;
      if (best == null || t > best!.t) {
        best = (season: season, episode: episode, t: t);
      }
    }

    for (final cid in ids) {
      final e = cw.entry(cid);
      if (e != null &&
          e.type == 'series' &&
          e.season != null &&
          e.episode != null) {
        consider(e.season!, e.episode!, e.t);
      }
      final lp = resume.lastPlayedEpisode(cid);
      if (lp != null) consider(lp.season, lp.episode, lp.t);
    }
    final b = best;
    return b == null ? null : (season: b.season, episode: b.episode);
  }

  /// Opens the episode-detail page for a keyed series episode, passing the TMDB
  /// series id and imdb id the page needs for its rich detail and ratings.
  void _openEpisodeDetail(WidgetRef ref, int season, int episode) {
    ref
        .read(navControllerProvider.notifier)
        .push(
          Frame(FrameKind.episodeDetail, {
            'type': type,
            'id': id,
            'season': season,
            'episode': episode,
            'title': _title,
            'tvId': ?detail?.id,
            'seriesImdbId': ?detail?.imdbId,
          }),
        );
  }

  void _openPicker(
    WidgetRef ref, {
    int? season,
    int? episode,
    bool download = false,
    bool downloadSeason = false,
    String? overrideId,
  }) {
    // A detected/anime episode resolves streams under its canonical Kitsu id.
    final pickerId = overrideId ?? id;
    // Pass the trust context (year, release date, anime flag) the picker's
    // stream filter conditions on.
    final yearMatch = RegExp(r'\d{4}').firstMatch(_year ?? '');
    final yearInt = yearMatch != null ? int.parse(yearMatch.group(0)!) : null;
    ref
        .read(navControllerProvider.notifier)
        .push(
          Frame(FrameKind.picker, {
            'type': type,
            'id': pickerId,
            'season': ?season,
            'episode': ?episode,
            'title': _title,
            'year': ?yearInt,
            'releaseDate': ?detail?.releaseDate,
            'isAnime': isAnimeContent(pickerId, _genres),
            if (downloadSeason)
              'intent': 'download-season'
            else if (download)
              'intent': 'download',
            'poster': ?(meta?.poster ?? detail?.poster),
            // Instant play (off for downloads) auto-fires the best source; the
            // per-season lock also auto-fires an episode so the season keeps
            // playing from the locked release (web autoPlay: instantPlay ||
            // seasonSourceLock).
            'autoPlay':
                !download &&
                !downloadSeason &&
                (ref.read(settingsProvider).getBool('instantPlay') ||
                    (season != null &&
                        ref
                            .read(settingsProvider)
                            .getBool('seasonSourceLock'))),
          }),
        );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = tokens;
    ref.watch(translationsProvider); // repaint the rails on a language change
    // Content sections use the phone-native gutter (16) below the tablet/tv 48.
    final g = pageGutter(Idiom.of(context));
    final heroHeight = (MediaQuery.of(context).size.height * 0.66).clamp(
      480.0,
      720.0,
    );
    final videos = meta?.videos ?? const <VideoRef>[];
    // The hero always offers Play; for a series it resolves the resume episode
    // and labels itself "Resume S:E" (web `smartPlayLabel`/`lastPlay`).
    final resume = _resolveResumeEpisode(ref);

    // Warm the stream picker for the hero's play target while the viewer reads
    // the detail page, so instant play starts on an in-flight (or already
    // resolved) fetch instead of a cold one — the biggest chunk of the pre-play
    // wait. streamPickerProvider is cached and non-autoDispose, so this read is
    // idempotent and stays warm until the picker mounts and watches it. Gated on
    // instantPlay (the same setting that auto-fires Play), and keyed exactly like
    // the hero's _openPicker call so the picker hits the warm entry.
    if (ref.read(settingsProvider).getBool('instantPlay')) {
      final PickerKey playKey = _isSeries
          ? (
              type: type,
              id: id,
              season: resume?.season ?? 1,
              episode: resume?.episode ?? 1,
            )
          : (type: type, id: id, season: null, episode: null);
      ref.read(streamPickerProvider(playKey).future).ignore();
    }

    // Series watched-episode sync: when the local manual-watched state changes,
    // push the merged watched set up to the Stremio account's `state.watched`
    // bitmap (non-anime only). Mirrors the web detail effect.
    if (_isSeries && !isAnimeContent(id, _genres)) {
      ref.listen(manualWatchedProvider, (_, _) => _syncSeriesWatched(ref));
    }

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _hero(context, ref, heroHeight, resume),
          const SizedBox(height: 40),
          if (_overview.isNotEmpty)
            Padding(
              padding: EdgeInsets.symmetric(horizontal: g),
              child: _Synopsis(text: _overview, tokens: t),
            ),
          // Anime: the enriched Kitsu episode list. Keyed series: the TMDB
          // season/episode grid. Otherwise the flat Cinemeta video list.
          if (_effectiveAnimeId != null) ...[
            const SizedBox(height: 32),
            AnimeEpisodesList(
              type: type,
              id: _effectiveAnimeId!,
              background: detail?.backdrop,
              tokens: t,
              onPlay: (ep) => _openPicker(
                ref,
                overrideId: _effectiveAnimeId,
                season: ep.seasonNumber,
                episode: ep.number,
              ),
            ),
          ] else if (detail != null &&
              detail!.kind == 'tv' &&
              detail!.seasons.isNotEmpty) ...[
            const SizedBox(height: 32),
            SeasonEpisodesGrid(
              tvId: detail!.id,
              metaId: id,
              title: _title,
              seasons: detail!.seasons,
              tokens: t,
              imdbId: detail!.imdbId,
              onPlay: (s, e) => _openPicker(ref, season: s, episode: e),
              onOpenDetail: (s, e) => _openEpisodeDetail(ref, s, e),
              onDownload: (s, e) =>
                  _openPicker(ref, season: s, episode: e, download: true),
              onDownloadSeason: (s) =>
                  _openPicker(ref, season: s, episode: 1, downloadSeason: true),
            ),
          ] else if (videos.isNotEmpty) ...[
            const SizedBox(height: 32),
            Padding(
              padding: EdgeInsets.symmetric(horizontal: g),
              child: _Episodes(
                metaId: id,
                videos: videos,
                tokens: t,
                onPlay: (v) =>
                    _openPicker(ref, season: v.season, episode: v.episode),
                onDownload: (v) => _openPicker(
                  ref,
                  season: v.season,
                  episode: v.episode,
                  download: true,
                ),
              ),
            ),
          ],
          if (detail != null &&
              (detail!.kind == 'movie' || detail!.kind == 'tv') &&
              detail!.id > 0) ...[
            const SizedBox(height: 36),
            Padding(
              padding: EdgeInsets.symmetric(horizontal: g),
              child: _WatchOnRail(
                type: detail!.kind,
                id: detail!.id,
                tokens: t,
              ),
            ),
          ],
          // Anime "Watch on" streaming-service chips (Kitsu streamers), ported
          // from the web StreamingLinks. Self-hides when there are none.
          if (_effectiveAnimeId != null) ...[
            const SizedBox(height: 36),
            Padding(
              padding: EdgeInsets.symmetric(horizontal: g),
              child: _AnimeWatchOnRail(
                type: type,
                id: _effectiveAnimeId!,
                tokens: t,
              ),
            ),
          ],
          _DetailRails(sections: _railSections(ref, t, g), tokens: t),
          if (detail?.imdbId != null && detail!.imdbId!.startsWith('tt')) ...[
            const SizedBox(height: 40),
            AwardsBlock(
              imdbId: detail!.imdbId!,
              title: _title,
              year: int.tryParse(
                RegExp(r'\d{4}').firstMatch(_year ?? '')?.group(0) ?? '',
              ),
              tokens: t,
            ),
          ],
          if (ref.watch(settingsProvider).getBool('showTraktComments') &&
              !isAnimeContent(id, _genres))
            TraktCommentsSection(type: type, id: id, tokens: t),
          if (ref.watch(settingsProvider).getBool('showAnilistComments') &&
              isAnimeContent(id, _genres))
            AnilistCommentsSection(harborId: id, tokens: t),
          // Letterboxd community reviews (films only; the section self-hides when
          // there are none). Scraped public data — no connection required.
          if (type == 'movie')
            LetterboxdReviewsSection(type: type, id: id, tokens: t),
          const SizedBox(height: 64),
        ],
      ),
    );
  }

  void _openMeta(WidgetRef ref, MetaPreview m) => ref
      .read(navControllerProvider.notifier)
      .push(Frame(FrameKind.meta, {'type': m.type, 'id': m.id}));

  /// The detail rail sections (crew, cast, collection, recommendations, similar,
  /// gallery) as keyed entries, ported from the `railSections` in `detail.tsx`.
  /// Rendered — ordered, hideable, editable — by [_DetailRails].
  List<_RailSection> _railSections(WidgetRef ref, HarborTokens t, double g) {
    final d = detail;
    final tr = ref.read(translationsProvider);
    final out = <_RailSection>[];

    if (d != null &&
        (d.directors.isNotEmpty ||
            d.creators.isNotEmpty ||
            d.writers.isNotEmpty)) {
      out.add(
        _RailSection(
          'crew',
          tr.t('Crew'),
          Padding(
            padding: EdgeInsets.symmetric(horizontal: g),
            child: _CrewGrid(detail: d, tokens: t),
          ),
        ),
      );
    }
    if (d != null && d.cast.isNotEmpty) {
      out.add(
        _RailSection('cast', tr.t('Cast'), _CastRail(cast: d.cast, tokens: t)),
      );
    }
    final collection = d?.collection;
    if (collection != null) {
      out.add(
        _RailSection(
          'collection',
          tr.t('Collection'),
          _CollectionRail(
            collectionId: collection.id,
            collectionName: collection.name,
            currentId: id,
            tokens: t,
          ),
        ),
      );
    }
    final recs = d?.recommendations ?? const <MetaPreview>[];
    if (recs.isNotEmpty) {
      out.add(
        _RailSection(
          'moreLikeThis',
          tr.t('More Like This'),
          TvRow(
            title: tr.t('More Like This'),
            items: recs,
            tokens: t,
            onSelect: (m) => _openMeta(ref, m),
          ),
        ),
      );
    }
    final similar = d?.similar ?? const <MetaPreview>[];
    if (similar.isNotEmpty) {
      out.add(
        _RailSection(
          'similar',
          tr.t('You Might Also Like'),
          TvRow(
            title: tr.t('You Might Also Like'),
            items: similar,
            tokens: t,
            onSelect: (m) => _openMeta(ref, m),
          ),
        ),
      );
    }
    final gallery = d?.gallery;
    // The "Videos" tab: trailer candidates first (labelled "Trailer"), then the
    // extra YouTube videos, deduped by id. Ports the web gallery's collectVideos.
    final videos = <ExtraVideo>[];
    final seenYt = <String>{};
    for (final id in d?.trailerCandidates ?? const <String>[]) {
      if (id.isNotEmpty && seenYt.add(id)) {
        videos.add(ExtraVideo(ytId: id, name: 'Trailer', type: 'Trailer'));
      }
    }
    for (final v in d?.extraVideos ?? const <ExtraVideo>[]) {
      if (v.ytId.isNotEmpty && seenYt.add(v.ytId)) videos.add(v);
    }
    if (gallery != null &&
        (gallery.backdrops.isNotEmpty ||
            gallery.posters.isNotEmpty ||
            gallery.logos.isNotEmpty ||
            videos.isNotEmpty)) {
      out.add(
        _RailSection(
          'mediaGallery',
          tr.t('Gallery'),
          Builder(
            builder: (context) => MediaGallery(
              gallery: gallery,
              tokens: t,
              videos: videos,
              onPlayVideo: (v) =>
                  showTrailerOverlay(context, ref, ytId: v.ytId, title: _title),
            ),
          ),
        ),
      );
    }
    final info = _infoRows(ref, d);
    if (info.isNotEmpty) {
      out.add(
        _RailSection(
          'info',
          tr.t('Information'),
          _InfoBlock(rows: info, tokens: t, title: tr.t('Information')),
        ),
      );
    }
    return out;
  }

  /// The label/value pairs for the Information section, ported from the web
  /// `InfoBlock`. Values the web renders as filter chips are shown as text here
  /// (the filter browse view is not built yet); the data itself is identical.
  List<_InfoRow> _infoRows(WidgetRef ref, TmdbDetail? d) {
    if (d == null) return const [];
    String? money(int? n) {
      if (n == null || n <= 0) return null;
      if (n >= 1000000000) return '\$${(n / 1000000000).toStringAsFixed(2)}B';
      return '\$${(n / 1000000).toStringAsFixed(0)}M';
    }

    final mt = d.kind == 'movie' ? 'movie' : 'tv';
    void push(MetaFilter f) => ref
        .read(navControllerProvider.notifier)
        .push(Frame(FrameKind.filter, f.toArgs()));

    final tr = ref.read(translationsProvider);
    final rows = <_InfoRow>[];
    void add(String label, String? value) {
      if (value != null && value.isNotEmpty) {
        rows.add(_InfoRow(tr.t(label), text: value));
      }
    }

    void chips(String label, List<_InfoChip> items) {
      if (items.isNotEmpty) rows.add(_InfoRow(tr.t(label), chips: items));
    }

    add('Status', d.status);
    if (d.kind == 'tv' && d.numberOfSeasons > 0) {
      add(
        'Seasons',
        '${d.numberOfSeasons} · ${d.numberOfEpisodes} ${tr.t('episodes')}',
      );
    }
    if (d.kind == 'tv') {
      add('First aired', d.firstAirDate);
      add('Last aired', d.lastAirDate);
    }
    // Networks / studios / countries open their browse filter when TMDB gave us
    // the id (the rich lists); otherwise they fall back to a plain name line.
    if (d.networksRich.isNotEmpty) {
      chips('Networks', [
        for (final n in d.networksRich.take(4))
          _InfoChip(n.name, () => push(NetworkFilter(mt, n.name, n.id))),
      ]);
    } else if (d.networks.isNotEmpty) {
      add('Networks', d.networks.take(4).join(' · '));
    }
    if (d.productionCompaniesRich.isNotEmpty) {
      chips('Studio', [
        for (final c in d.productionCompaniesRich.take(3))
          _InfoChip(c.name, () => push(StudioFilter(mt, c.name, c.id))),
      ]);
    } else if (d.productionCompanies.isNotEmpty) {
      add('Studio', d.productionCompanies.take(3).join(' · '));
    }
    if (d.productionCountriesRich.isNotEmpty) {
      chips('Country', [
        for (final c in d.productionCountriesRich)
          _InfoChip(c.name, () => push(CountryFilter(mt, c.name, c.iso))),
      ]);
    } else if (d.productionCountries.isNotEmpty) {
      add('Country', d.productionCountries.join(' · '));
    }
    if (d.spokenLanguages.isNotEmpty) {
      add('Original language', d.spokenLanguages.first);
    }
    if (d.originalTitle.isNotEmpty && d.originalTitle != d.title) {
      add('Original title', d.originalTitle);
    }
    // Genres open their browse filter when TMDB gave us the ids (the rich list,
    // 1:1 with the hero genre pills); otherwise fall back to a plain name line.
    if (d.genresRich.isNotEmpty) {
      chips('Genres', [
        for (final g in d.genresRich)
          _InfoChip(
            genreNameById(g.id, series: _isSeries) ?? g.name,
            () => push(
              GenreFilter(
                mt,
                genreNameById(g.id, series: _isSeries) ?? g.name,
                g.id,
              ),
            ),
          ),
      ]);
    } else if (d.genres.isNotEmpty) {
      add('Genres', d.genres.join(' · '));
    }
    add('Budget', money(d.budget));
    add('Revenue', money(d.revenue));
    if (d.rating != null && d.rating!.isNotEmpty) {
      add(
        'Rating',
        '${d.rating} · ${_thousands(d.voteCount)} ${tr.t('votes')}',
      );
    }
    return rows;
  }

  Widget _hero(
    BuildContext context,
    WidgetRef ref,
    double height,
    ({int season, int episode})? resume,
  ) {
    final t = tokens;
    // The muted, looping hero autoplay trailer (when enabled and available).
    final settings = ref.watch(settingsProvider);
    // The backdrop pool + carousel gate (web `backdropPool`/`carouselOn`). When
    // the carousel is on and the title has >= 2 distinct backdrops, the hero
    // rotates through them; otherwise it shows the single primary backdrop.
    final pool = _backdropPool;
    final carouselOn =
        settings.getBool('heroBackdropCarousel') && pool.length >= 2;
    final trailerId = trailerCandidate(
      detail?.trailerCandidates ?? const [],
      detail?.trailerYtId,
    );
    final heroTrailerOn =
        settings.getBool('detailTrailerAutoplay') && trailerId != null;
    final heroStream = heroTrailerOn
        ? ref.watch(
            trailerStreamProvider((
              ytId: trailerId,
              quality: TrailerQuality.fromWire(
                settings.getString('trailerQuality'),
              ),
            )).select((a) => a.value),
          )
        : null;
    final heroMuted = heroTrailerOn && ref.watch(heroTrailerMutedProvider);
    final imdbId = detail?.imdbId ?? (id.startsWith('tt') ? id : null);
    final ratings = ref
        .watch(
          detailRatingsProvider((
            imdbId: imdbId,
            mediaType: _isSeries ? 'show' : 'movie',
          )),
        )
        .value;
    // Primary IMDb rating priority: fresh Harbor IMDb → OMDB → Cinemeta → detail
    // rating. The Cinemeta layer supplies the real IMDb score for a keyed TMDB
    // title (whose own `_rating` is only the TMDB vote average).
    final harborImdb = imdbId != null
        ? ref.watch(harborImdbRatingProvider(imdbId)).value
        : null;
    final cinemetaRating = (imdbId != null && !id.startsWith('tt'))
        ? ref
              .watch(
                metaProvider((
                  type: _isSeries ? 'series' : 'movie',
                  id: imdbId,
                )),
              )
              .value
              ?.imdbRating
              ?.toString()
        : null;
    final ratingsWidget = HeroRatings(
      rating: harborImdb != null
          ? harborImdb.toStringAsFixed(1)
          : (ratings?.omdb?.imdbRating ?? cinemetaRating ?? _rating),
      ratingSource: imdbId != null ? 'imdb' : 'tmdb',
      omdb: ratings?.omdb,
      mdblist: ratings?.mdblist,
      settings: ref.watch(settingsProvider),
      tokens: t,
      imdbId: imdbId,
      mediaType: type == 'series' ? 'tv' : 'movie',
    );
    return SizedBox(
      height: height,
      width: double.infinity,
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (pool.isNotEmpty)
            _HeroBackdrop(pool: pool, carouselOn: carouselOn)
          else
            ColoredBox(color: t.surface.withValues(alpha: 0.2)),
          // The autoplay trailer plays over the backdrop but below the scrims,
          // so the title/actions stay readable.
          if (heroStream != null)
            DetailHeroVideo(stream: heroStream, muted: heroMuted),
          // Bottom-up scrim (canvas -> transparent at ~45%).
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.bottomCenter,
                end: Alignment.topCenter,
                colors: [
                  t.canvas,
                  t.canvas.withValues(alpha: 0.55),
                  Colors.transparent,
                ],
                stops: const [0, 0.45, 1],
              ),
            ),
          ),
          // Left-to-right scrim.
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
                colors: [
                  t.canvas.withValues(alpha: 0.85),
                  t.canvas.withValues(alpha: 0.35),
                  Colors.transparent,
                ],
              ),
            ),
          ),
          // The hero trailer's mute toggle (above the scrims so it is tappable).
          // Nudge it clear of the TV overscan crop so the remote-focusable
          // control isn't clipped by the bezel (no offset on phone/tablet).
          if (heroStream != null)
            Positioned(
              top: 16 + overscanInset(Idiom.of(context)).top,
              right: 16 + overscanInset(Idiom.of(context)).right,
              child: Focusable(
                tokens: t,
                borderRadius: 999,
                onPressed: () =>
                    ref.read(heroTrailerMutedProvider.notifier).toggle(),
                child: Container(
                  width: 40,
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.5),
                    shape: BoxShape.circle,
                    border: Border.all(color: t.edgeSoft),
                  ),
                  child: Icon(
                    heroMuted
                        ? Icons.volume_off_rounded
                        : Icons.volume_up_rounded,
                    size: 18,
                    color: t.ink,
                  ),
                ),
              ),
            ),
          // Awards badge in the bottom-right corner (decorative).
          if (imdbId != null && imdbId.startsWith('tt'))
            Positioned.fill(
              child: IgnorePointer(
                child: MetaAwardsCorner(
                  imdbId: imdbId,
                  name: _title,
                  year: int.tryParse(
                    RegExp(r'\d{4}').firstMatch(_year ?? '')?.group(0) ?? '',
                  ),
                  isAnime: isAnimeContent(id, _genres),
                  tokens: t,
                ),
              ),
            ),
          Align(
            alignment: Alignment.bottomLeft,
            child: Padding(
              padding: EdgeInsets.fromLTRB(
                pageGutter(Idiom.of(context)),
                0,
                pageGutter(Idiom.of(context)),
                40,
              ),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 780),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (_tagline.isNotEmpty) ...[
                      Text(
                        _tagline.toUpperCase(),
                        style: TextStyle(
                          color: t.inkSubtle,
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          letterSpacing: 2.8,
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],
                    _TitlePlate(title: _title, logo: _logo, tokens: t),
                    const SizedBox(height: 22),
                    _metaLine(ref, t, ratingsWidget),
                    const SizedBox(height: 30),
                    _actions(context, ref, resume),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _metaLine(WidgetRef ref, HarborTokens t, Widget ratings) {
    final pills = <Widget>[
      if (_year != null)
        _Pill(
          tokens: t,
          onPressed: () => _openYearFilter(ref),
          child: _pillText(_year!, t),
        ),
      // The rich ratings pill (IMDb/RT/Metacritic/… badges) carries the primary
      // rating; it renders nothing when disabled or no scores are present.
      ratings,
      if (_runtime != null)
        _Pill(
          tokens: t,
          // The runtime filter is movie-only; a series' runtime pill stays
          // informational.
          onPressed: _isSeries ? null : () => _openRuntimeFilter(ref),
          child: _pillText(_runtime!, t),
        ),
      for (final gc in _genreChips().take(3))
        _Pill(
          tokens: t,
          onPressed: gc.filter == null
              ? null
              : () => ref
                    .read(navControllerProvider.notifier)
                    .push(Frame(FrameKind.filter, gc.filter!.toArgs())),
          child: _pillText(gc.label, t),
        ),
    ];
    return Wrap(
      spacing: 12,
      runSpacing: 10,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: pills,
    );
  }

  Widget _pillText(String s, HarborTokens t) => Text(
    s,
    style: TextStyle(
      color: t.inkMuted,
      fontSize: 13,
      fontWeight: FontWeight.w500,
    ),
  );

  Widget _actions(
    BuildContext context,
    WidgetRef ref,
    ({int season, int episode})? resume,
  ) {
    final t = tokens;
    final tr = ref.read(translationsProvider);
    final inWatchlist = ref.watch(watchlistProvider).contains(id);
    final inFavorites = ref.watch(mediaFavoritesProvider).contains(id);
    final trailerId = trailerCandidate(
      detail?.trailerCandidates ?? const [],
      detail?.trailerYtId,
    );
    // The anime franchise season picker leads the action row when the title is
    // part of a multi-entry franchise.
    final animeId = _effectiveAnimeId;
    final franchise = animeId != null
        ? (ref.watch(animeFranchiseProvider((type: type, id: animeId))).value ??
              const <FranchiseEntry>[])
        : const <FranchiseEntry>[];
    // Series resume onto the last-played episode; a fresh series starts at
    // S1:E1. Movies play with no episode. Mirrors the web `smartPlay`.
    final playLabel = _isSeries && resume != null
        ? tr.t('Resume S{s}:E{e}', {'s': resume.season, 'e': resume.episode})
        : tr.t('Play');
    // Unreleased titles swap Play for an "Upcoming" pill (still searchable, in
    // case of an early release), ported from the web UpcomingCta.
    void onPlay() => _isSeries
        ? _openPicker(
            ref,
            season: resume?.season ?? 1,
            episode: resume?.episode ?? 1,
          )
        : _openPicker(ref);
    final upcoming = titleUpcoming(
      hasDetail: detail != null,
      kind: detail?.kind,
      releaseDate: detail?.releaseDate,
      firstAirDate: detail?.firstAirDate,
      status: detail?.status,
      metaReleaseInfo: meta?.releaseInfo,
    );
    final upcomingDate = detail?.kind == 'movie'
        ? detail?.releaseDate
        : detail?.firstAirDate;
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      children: [
        if (franchise.length > 1)
          AnimeSeasonPicker(
            franchise: franchise,
            currentId: id,
            tokens: t,
            onSelect: (f) => _openMeta(ref, f.meta),
          ),
        if (upcoming)
          _UpcomingCta(tokens: t, tr: tr, date: upcomingDate, onTry: onPlay)
        else
          Focusable(
            tokens: t,
            autofocus: true,
            borderRadius: 999,
            onPressed: onPlay,
            child: Container(
              height: 48,
              padding: const EdgeInsets.symmetric(horizontal: 28),
              decoration: BoxDecoration(
                color: t.ink,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.play_arrow, color: t.canvas, size: 20),
                  const SizedBox(width: 8),
                  Text(
                    playLabel,
                    style: TextStyle(
                      color: t.canvas,
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
        if (trailerId != null)
          Focusable(
            tokens: t,
            borderRadius: 999,
            onPressed: () => showTrailerOverlay(
              context,
              ref,
              ytId: trailerId,
              title: _title,
            ),
            child: Container(
              height: 48,
              width: 48,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: t.canvas.withValues(alpha: 0.55),
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: t.edge),
              ),
              child: Icon(Icons.smart_display_outlined, color: t.ink, size: 22),
            ),
          ),
        Focusable(
          tokens: t,
          autofocus: false,
          borderRadius: 999,
          onPressed: () => ref
              .read(watchlistProvider.notifier)
              .toggle(
                id: id,
                type: type,
                name: _title,
                poster: meta?.poster ?? detail?.poster,
              ),
          child: Container(
            height: 48,
            padding: const EdgeInsets.symmetric(horizontal: 24),
            decoration: BoxDecoration(
              color: inWatchlist
                  ? t.ink.withValues(alpha: 0.1)
                  : t.canvas.withValues(alpha: 0.8),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: inWatchlist ? t.ink : t.edge),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  inWatchlist ? Icons.check : Icons.add,
                  color: t.ink,
                  size: 18,
                ),
                const SizedBox(width: 8),
                Text(
                  inWatchlist ? tr.t('In Watchlist') : tr.t('Add to Watchlist'),
                  style: TextStyle(
                    color: t.ink,
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ),
        // Favorite toggle (local media-favorites), ported from the detail
        // page's star action — a filled star, accent-tinted once favorited
        // (matching the web `text-accent` and the sibling Mark-watched button).
        Focusable(
          tokens: t,
          borderRadius: 999,
          onPressed: () => ref
              .read(mediaFavoritesProvider.notifier)
              .toggle(
                id: id,
                type: type,
                name: _title,
                poster: meta?.poster ?? detail?.poster,
              ),
          child: Container(
            height: 48,
            width: 48,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: inFavorites
                  ? t.accentSoft
                  : t.canvas.withValues(alpha: 0.55),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: inFavorites ? t.accent : t.edge),
            ),
            child: Icon(
              inFavorites ? Icons.star : Icons.star_border,
              color: inFavorites ? t.accent : t.ink,
              size: 22,
            ),
          ),
        ),
        // Download for offline (movies only), ported from the hero action
        // overflow's canDownload={type === "movie"} entry: opens the picker in
        // download intent so a chosen source is saved rather than played.
        if (type == 'movie') _downloadButton(ref, t),
        // Mark-watched (movies only), ported from the detail action bar's
        // markThisMovieWatched — a one-way mark, accent once watched.
        if (type == 'movie' &&
            ref.watch(settingsProvider).getBool('showWatchedButton'))
          _watchedButton(ref, t),
        // Add to custom list (opens the list menu), ported from the hero
        // action overflow's AddToListMenu.
        Builder(
          builder: (context) => Focusable(
            tokens: t,
            borderRadius: 999,
            onPressed: () => showAddToListMenu(
              context,
              itemId: id,
              type: type,
              name: _title,
              poster: meta?.poster ?? detail?.poster,
            ),
            child: Container(
              height: 48,
              width: 48,
              decoration: BoxDecoration(
                color: t.canvas.withValues(alpha: 0.8),
                shape: BoxShape.circle,
                border: Border.all(color: t.edge),
              ),
              child: Icon(Icons.playlist_add, color: t.ink, size: 22),
            ),
          ),
        ),
        // AniList list-status pill (anime only; self-hides unless AniList is
        // connected and the title resolves to a media id), ported from the web
        // hero AddToAnilistButton.
        if (isAnimeContent(id, _genres))
          AnilistAddButton(harborId: id, tokens: t),
        // Simkl list-status pill (movie + series; self-hides unless Simkl is
        // connected and the id resolves to a target), ported from the web hero
        // AddToSimklButton.
        SimklAddButton(type: type, id: id, tokens: t),
      ],
    );
  }

  /// Pushes the series' merged watched-episode set to the Stremio account. The
  /// bitmap is indexed by the full Cinemeta video order, so the whole list is
  /// passed unfiltered (specials keep their slot); the manual tri-state is read
  /// per episode so the account's untouched episodes are preserved.
  void _syncSeriesWatched(WidgetRef ref) {
    final m = meta;
    if (m == null || m.videos.isEmpty) return;
    final videos = [
      for (final v in m.videos)
        WatchedVideo(id: v.id, season: v.season, episode: v.episode),
    ];
    final store = ref.read(manualWatchedStoreProvider);
    final manual = <String, bool?>{
      for (final v in videos)
        if (v.season != null && v.episode != null)
          '${v.season}:${v.episode}': store.state(id, v.season!, v.episode!),
    };
    ref
        .read(stremioWatchedSyncProvider)
        .pushEpisodes(
          metaId: id,
          imdbId: detail?.imdbId,
          name: _title,
          poster: meta?.poster ?? detail?.poster,
          background: _backdrop,
          videos: videos,
          manual: manual,
        );
  }

  Widget _watchedButton(WidgetRef ref, HarborTokens t) {
    final watched = ref.watch(movieWatchedProvider).contains(id);
    return Focusable(
      tokens: t,
      borderRadius: 999,
      onPressed: () => ref
          .read(movieWatchedProvider.notifier)
          .mark(
            id,
            imdbId: detail?.imdbId ?? (id.startsWith('tt') ? id : null),
            tmdbId: detail?.id,
            name: _title,
            poster: meta?.poster ?? detail?.poster,
            background: _backdrop,
          ),
      child: Container(
        width: 48,
        height: 48,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: watched ? t.accentSoft : t.canvas.withValues(alpha: 0.8),
          border: Border.all(color: watched ? t.accent : t.edge),
        ),
        child: Icon(Icons.check, color: watched ? t.accent : t.ink, size: 20),
      ),
    );
  }

  /// The offline-download control, ported from the hero action overflow's
  /// download entry: with no active download it opens the picker in download
  /// intent; while a download for this movie is live it mirrors its state and
  /// pauses / resumes / retries it (web `activeDownloadFor` + pause/resume).
  Widget _downloadButton(WidgetRef ref, HarborTokens t) {
    final engine = ref.watch(downloadEngineProvider);
    return ValueListenableBuilder<List<DownloadItem>>(
      valueListenable: engine.items,
      builder: (context, items, _) {
        DownloadItem? dl;
        for (final i in items) {
          if (i.metaId == id && i.season == null && i.episode == null) {
            dl = i;
            break;
          }
        }
        final active = dl;
        final (
          IconData icon,
          VoidCallback onPressed,
          bool lit,
        ) = switch (active?.status) {
          DownloadStatus.downloading => (
            Icons.pause,
            () => engine.pause(active!.id),
            true,
          ),
          DownloadStatus.paused => (
            Icons.play_arrow,
            () => engine.resume(active!.id),
            true,
          ),
          DownloadStatus.done => (
            Icons.download_done,
            () => ref
                .read(navControllerProvider.notifier)
                .setView(FrameKind.downloads),
            true,
          ),
          _ => (
            Icons.download_outlined,
            () => _openPicker(ref, download: true),
            false,
          ),
        };
        return Focusable(
          tokens: t,
          borderRadius: 999,
          onPressed: onPressed,
          child: Container(
            width: 48,
            height: 48,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: lit ? t.accentSoft : t.canvas.withValues(alpha: 0.8),
              border: Border.all(color: lit ? t.accent : t.edge),
            ),
            child: Icon(icon, color: lit ? t.accent : t.ink, size: 20),
          ),
        );
      },
    );
  }
}

/// Groups an integer with thousands separators (the web `toLocaleString`),
/// e.g. `1234567` -> `1,234,567`.
String _thousands(int n) {
  final s = n.abs().toString();
  final buf = StringBuffer(n < 0 ? '-' : '');
  for (var i = 0; i < s.length; i++) {
    if (i != 0 && (s.length - i) % 3 == 0) buf.write(',');
    buf.write(s[i]);
  }
  return buf.toString();
}

/// The hero backdrop layer. With the carousel on and >= 2 backdrops it rotates
/// through the pool on a 12s timer, cross-fading between stills (web
/// `carouselOn` + the 1200ms opacity transition in detail.tsx). With the
/// carousel off it just shows the primary backdrop.
class _HeroBackdrop extends StatefulWidget {
  const _HeroBackdrop({required this.pool, required this.carouselOn});
  final List<String> pool;
  final bool carouselOn;

  @override
  State<_HeroBackdrop> createState() => _HeroBackdropState();
}

class _HeroBackdropState extends State<_HeroBackdrop> {
  int _idx = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _sync();
  }

  @override
  void didUpdateWidget(_HeroBackdrop old) {
    super.didUpdateWidget(old);
    // A new title (different pool) resets to the first backdrop, mirroring the
    // web `setBackdropIdx(0)` on a meta change; toggling the setting re-arms.
    if (!listEquals(old.pool, widget.pool)) _idx = 0;
    if (old.carouselOn != widget.carouselOn ||
        old.pool.length != widget.pool.length) {
      _sync();
    }
  }

  void _sync() {
    _timer?.cancel();
    if (!widget.carouselOn || widget.pool.length < 2) return;
    _timer = Timer.periodic(const Duration(seconds: 12), (_) {
      if (!mounted) return;
      setState(() => _idx = (_idx + 1) % widget.pool.length);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Carousel off: a single image, no cross-fade stack (web `backdropPool[0]`).
    if (!widget.carouselOn || widget.pool.length < 2) {
      return CachedNetworkImage(
        imageUrl: widget.pool.first,
        fit: BoxFit.cover,
        fadeInDuration: const Duration(milliseconds: 600),
      );
    }
    // Carousel on: every backdrop stacked, the active one faded in over 1200ms
    // (matches the web transition). All are mounted so the swap is preloaded.
    return Stack(
      fit: StackFit.expand,
      children: [
        for (var i = 0; i < widget.pool.length; i++)
          AnimatedOpacity(
            opacity: i == _idx ? 1 : 0,
            duration: const Duration(milliseconds: 1200),
            child: CachedNetworkImage(
              imageUrl: widget.pool[i],
              fit: BoxFit.cover,
              fadeInDuration: const Duration(milliseconds: 600),
            ),
          ),
      ],
    );
  }
}

/// A tappable network / studio / country name that opens its browse filter.
class _InfoChip {
  const _InfoChip(this.name, this.onTap);
  final String name;
  final VoidCallback onTap;
}

/// One Information row: a label plus either a plain value or filter chips.
class _InfoRow {
  const _InfoRow(this.label, {this.text, this.chips});
  final String label;
  final String? text;
  final List<_InfoChip>? chips;
}

/// The Information section: a responsive grid of label/value pairs, ported from
/// the web `InfoBlock`. Network, studio and country values render as focusable
/// chips that open the corresponding browse filter.
class _InfoBlock extends StatelessWidget {
  const _InfoBlock({
    required this.rows,
    required this.tokens,
    required this.title,
  });

  final List<_InfoRow> rows;
  final HarborTokens tokens;
  final String title;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: pageGutter(Idiom.of(context))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              color: t.ink,
              fontSize: 22,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 24),
          LayoutBuilder(
            builder: (context, constraints) {
              final columns = constraints.maxWidth >= 1000
                  ? 3
                  : constraints.maxWidth >= 640
                  ? 2
                  : 1;
              const gap = 40.0;
              final cellWidth =
                  (constraints.maxWidth - gap * (columns - 1)) / columns;
              return Wrap(
                spacing: gap,
                runSpacing: 20,
                children: [
                  for (final row in rows)
                    SizedBox(
                      width: cellWidth,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            row.label.toUpperCase(),
                            style: TextStyle(
                              color: t.inkSubtle,
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              letterSpacing: 2,
                            ),
                          ),
                          const SizedBox(height: 6),
                          if (row.chips != null)
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                for (final chip in row.chips!) _chip(t, chip),
                              ],
                            )
                          else
                            Text(
                              row.text ?? '',
                              style: TextStyle(color: t.ink, fontSize: 14.5),
                            ),
                        ],
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

  Widget _chip(HarborTokens t, _InfoChip chip) => Focusable(
    tokens: t,
    scale: 1.0,
    borderRadius: 8,
    onPressed: chip.onTap,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: t.raised,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: t.edgeSoft),
      ),
      child: Text(chip.name, style: TextStyle(color: t.ink, fontSize: 14)),
    ),
  );
}

/// One keyed detail rail section (for ordering / hiding).
class _RailSection {
  const _RailSection(this.key, this.label, this.widget);
  final String key;
  final String label;
  final Widget widget;
}

/// Renders the detail rails in the user's order, with hidden rails removed —
/// plus a "Customize layout" edit mode (move up/down, hide/show, reset) ported
/// from `ContentRails`. Backed by [detailCustomizationProvider].
class _DetailRails extends ConsumerStatefulWidget {
  const _DetailRails({required this.sections, required this.tokens});
  final List<_RailSection> sections;
  final HarborTokens tokens;

  @override
  ConsumerState<_DetailRails> createState() => _DetailRailsState();
}

class _DetailRailsState extends ConsumerState<_DetailRails> {
  bool _edit = false;

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    if (widget.sections.isEmpty) return const SizedBox.shrink();

    final tr = ref.watch(translationsProvider);
    final c = ref.watch(detailCustomizationProvider);
    final g = pageGutter(Idiom.of(context));
    final byKey = {for (final s in widget.sections) s.key: s};
    final available = [for (final s in widget.sections) s.key];
    final ordered = orderedSectionKeys(available, c);
    final hasChanges = c.order.isNotEmpty || c.hidden.isNotEmpty;

    final children = <Widget>[
      Padding(
        padding: EdgeInsets.fromLTRB(g, 24, g, 0),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            if (_edit && hasChanges) ...[
              _chip(
                tr.t('Reset'),
                Icons.restart_alt,
                () => ref.read(detailCustomizationProvider.notifier).reset(),
                t,
              ),
              const SizedBox(width: 8),
            ],
            _chip(
              _edit ? tr.t('Done editing') : tr.t('Customize layout'),
              _edit ? Icons.check : Icons.tune,
              () => setState(() => _edit = !_edit),
              t,
              filled: _edit,
            ),
          ],
        ),
      ),
    ];

    for (final key in ordered) {
      final section = byKey[key];
      if (section == null) continue;
      final hidden = c.hidden.contains(key);
      if (hidden && !_edit) continue;
      children.add(const SizedBox(height: 36));
      if (_edit) {
        children.add(_editControls(section, hidden, available, t, g));
      }
      children.add(
        hidden
            ? Opacity(opacity: 0.4, child: IgnorePointer(child: section.widget))
            : section.widget,
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: children,
    );
  }

  Widget _editControls(
    _RailSection s,
    bool hidden,
    List<String> available,
    HarborTokens t,
    double g,
  ) {
    final notifier = ref.read(detailCustomizationProvider.notifier);
    return Padding(
      padding: EdgeInsets.fromLTRB(g, 0, g, 8),
      child: Row(
        children: [
          Text(
            s.label,
            style: TextStyle(
              color: t.inkSubtle,
              fontSize: 12,
              fontWeight: FontWeight.w700,
              letterSpacing: 1,
            ),
          ),
          const Spacer(),
          _iconBtn(
            Icons.keyboard_arrow_up,
            () => notifier.move(available, s.key, -1),
            t,
          ),
          const SizedBox(width: 6),
          _iconBtn(
            Icons.keyboard_arrow_down,
            () => notifier.move(available, s.key, 1),
            t,
          ),
          const SizedBox(width: 6),
          _iconBtn(
            hidden ? Icons.visibility_off : Icons.visibility,
            () => notifier.toggleHidden(s.key),
            t,
          ),
        ],
      ),
    );
  }

  Widget _iconBtn(IconData icon, VoidCallback onPressed, HarborTokens t) =>
      Focusable(
        tokens: t,
        borderRadius: 8,
        onPressed: onPressed,
        child: Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            color: t.raised,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: t.edgeSoft),
          ),
          child: Icon(icon, size: 18, color: t.inkMuted),
        ),
      );

  Widget _chip(
    String label,
    IconData icon,
    VoidCallback onPressed,
    HarborTokens t, {
    bool filled = false,
  }) => Focusable(
    tokens: t,
    borderRadius: 8,
    onPressed: onPressed,
    child: Container(
      height: 32,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(
        color: filled ? t.ink : t.canvas.withValues(alpha: 0.8),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: filled ? t.ink : t.edgeSoft),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: filled ? t.canvas : t.inkMuted),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              color: filled ? t.canvas : t.inkMuted,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    ),
  );
}

/// The crew grid, ported from the `crew` rail section: labelled credit blocks
/// for directors / creators / writers / producers / cinematography / music /
/// editors, wrapped into responsive columns.
class _CrewGrid extends StatelessWidget {
  const _CrewGrid({required this.detail, required this.tokens});
  final TmdbDetail detail;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) {
    final credits = <(String, List<PersonRef>)>[];
    void add(String label, List<PersonRef> people) {
      if (people.isEmpty) return;
      credits.add((label, people));
    }

    add(
      detail.directors.length == 1 ? 'Director' : 'Directors',
      detail.directors,
    );
    add(detail.creators.length == 1 ? 'Creator' : 'Creators', detail.creators);
    add(
      detail.writers.length == 1 ? 'Writer' : 'Writers',
      detail.writers.take(6).toList(),
    );
    add('Producers', detail.producers.take(6).toList());
    add('Cinematography', detail.cinematography);
    add('Music', detail.composer);
    add(detail.editor.length == 1 ? 'Editor' : 'Editors', detail.editor);
    if (credits.isEmpty) return const SizedBox.shrink();
    // 300px credit blocks flow in a Wrap (several per row on wide). On a phone
    // narrower than a block, the block clamps to the pane so it never overflows.
    return LayoutBuilder(
      builder: (context, c) {
        final blockWidth = c.maxWidth < 300 ? c.maxWidth : 300.0;
        return Wrap(
          spacing: 48,
          runSpacing: 24,
          children: [
            for (final (label, people) in credits)
              SizedBox(
                width: blockWidth,
                child: _Credit(label: label, people: people, tokens: tokens),
              ),
          ],
        );
      },
    );
  }
}

class _Credit extends ConsumerWidget {
  const _Credit({
    required this.label,
    required this.people,
    required this.tokens,
  });
  final String label;
  final List<PersonRef> people;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = tokens;
    final nameStyle = TextStyle(color: t.ink, fontSize: 15, height: 1.35);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label.toUpperCase(),
          style: TextStyle(
            color: t.inkSubtle,
            fontSize: 12,
            fontWeight: FontWeight.w500,
            letterSpacing: 2.2,
          ),
        ),
        const SizedBox(height: 4),
        // Each resolved (real TMDB id) person is a tappable, TV-focusable name
        // that opens their person page, 1:1 with web `Credit`; unresolved names
        // stay inert text. Comma-separated, wrapping as needed.
        Wrap(
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            for (var i = 0; i < people.length; i++) ...[
              if (people[i].id > 0)
                Focusable(
                  tokens: t,
                  borderRadius: 6,
                  scale: 1.0,
                  onPressed: () => ref
                      .read(navControllerProvider.notifier)
                      .push(Frame(FrameKind.person, {'id': people[i].id})),
                  child: Text(people[i].name, style: nameStyle),
                )
              else
                Text(people[i].name, style: nameStyle),
              if (i < people.length - 1) Text(', ', style: nameStyle),
            ],
          ],
        ),
      ],
    );
  }
}

/// The cast rail, ported from the `cast` rail section: portrait cards with the
/// actor photo (or a seeded placeholder), name, and character.
class _CastRail extends StatelessWidget {
  const _CastRail({required this.cast, required this.tokens});
  final List<CastEntry> cast;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) {
    final g = pageGutter(Idiom.of(context));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.fromLTRB(g, 0, g, 12),
          child: Text(
            'Cast · ${cast.length}',
            style: TextStyle(
              color: tokens.ink,
              fontSize: 20,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        SizedBox(
          height: 244,
          // Contain D-pad left/right to this rail in reading order, like every
          // other detail rail (TvRow / _CollectionRail).
          child: FocusTraversalGroup(
            policy: ReadingOrderTraversalPolicy(),
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: EdgeInsets.symmetric(horizontal: g),
              itemCount: cast.length,
              separatorBuilder: (_, _) => const SizedBox(width: 16),
              itemBuilder: (context, i) =>
                  _CastCard(cast: cast[i], tokens: tokens),
            ),
          ),
        ),
      ],
    );
  }
}

class _CastCard extends ConsumerWidget {
  const _CastCard({required this.cast, required this.tokens});
  final CastEntry cast;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final path = cast.profilePath;
    final photo = path == null
        ? null
        : (path.startsWith('http') ? path : '$tmdbImg/w185$path');
    // Only resolved (real TMDB id) cast members open a person view.
    final resolved = cast.id > 0;
    final rank = resolved
        ? ref.watch(rankingsProvider).value?.rankOf(cast.id)
        : null;
    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: AspectRatio(
            aspectRatio: 2 / 3,
            child: Stack(
              fit: StackFit.expand,
              children: [
                photo != null
                    ? CachedNetworkImage(
                        imageUrl: photo,
                        fit: BoxFit.cover,
                        placeholder: (_, _) => _placeholder(),
                        errorWidget: (_, _, _) => _placeholder(),
                      )
                    : _placeholder(),
                if (rank != null)
                  Positioned(
                    top: 8,
                    left: 8,
                    child: _RankBadge(rank: rank, tokens: tokens),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          cast.name,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: tokens.ink,
            fontSize: 13,
            fontWeight: FontWeight.w500,
          ),
        ),
        if (cast.character.isNotEmpty)
          Text(
            cast.character,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: tokens.inkSubtle,
              fontSize: 12,
              height: 1.15,
            ),
          ),
      ],
    );

    if (!resolved) return SizedBox(width: 124, child: content);
    return SizedBox(
      width: 124,
      child: Focusable(
        tokens: tokens,
        borderRadius: 12,
        onPressed: () => ref
            .read(navControllerProvider.notifier)
            .push(Frame(FrameKind.person, {'id': cast.id})),
        child: content,
      ),
    );
  }

  Widget _placeholder() => ColoredBox(
    color: tokens.surface,
    child: Center(child: Icon(Icons.person, color: tokens.inkSubtle, size: 40)),
  );
}

/// The "Watch on" rail — the streaming providers a title is available on in the
/// user's region, ported from `WatchOn`. Informational chips (provider deep
/// links land with the external-URL subsystem). Hidden while empty.
class _WatchOnRail extends ConsumerWidget {
  const _WatchOnRail({
    required this.type,
    required this.id,
    required this.tokens,
  });
  final String type;
  final int id;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final providers = ref
        .watch(watchProvidersProvider((type: type, id: id)))
        .value;
    if (providers == null || providers.isEmpty) return const SizedBox.shrink();
    final t = tokens;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'WATCH ON',
          style: TextStyle(
            color: t.inkSubtle,
            fontSize: 12,
            fontWeight: FontWeight.w700,
            letterSpacing: 2,
          ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            for (final p in providers)
              _WatchProviderChip(provider: p, tokens: t),
          ],
        ),
      ],
    );
  }
}

/// A single "Watch on" provider chip. When the provider carries a deep link it
/// is Focusable (TV-remote reachable) and opens the provider page on the web —
/// 1:1 with web `WatchOn`, whose chips open `p.link`. A link-less provider stays
/// display-only.
class _WatchProviderChip extends StatelessWidget {
  const _WatchProviderChip({required this.provider, required this.tokens});

  final WatchProvider provider;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    final p = provider;
    final chip = Container(
      height: 44,
      padding: const EdgeInsets.fromLTRB(8, 0, 14, 0),
      decoration: BoxDecoration(
        color: t.elevated,
        border: Border.all(color: t.edgeSoft),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: CachedNetworkImage(
              imageUrl: p.logo,
              width: 28,
              height: 28,
              fit: BoxFit.contain,
              errorWidget: (_, _, _) => const SizedBox(width: 28, height: 28),
            ),
          ),
          const SizedBox(width: 10),
          Text(
            p.name,
            style: TextStyle(
              color: t.ink,
              fontSize: 13.5,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
    if (p.link.isEmpty) return chip;
    return Focusable(
      tokens: t,
      borderRadius: 12,
      onPressed: () => launchExternalUrl(p.link),
      child: Semantics(button: true, label: p.name, child: chip),
    );
  }
}

/// The anime "Watch on" rail — the streaming services (Kitsu streamers) a title
/// is available on, ported from the web `StreamingLinks`. Each is a brand-tinted
/// chip that opens the service; deduped by service+url, self-hides when empty.
/// (Flutter has no bundled service logos, so it uses web's brand-colour text
/// fallback for every chip.)
class _AnimeWatchOnRail extends ConsumerWidget {
  const _AnimeWatchOnRail({
    required this.type,
    required this.id,
    required this.tokens,
  });

  final String type;
  final String id;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final streamers =
        ref.watch(animeDetailProvider((type: type, id: id))).value?.streamers ??
        const [];
    if (streamers.isEmpty) return const SizedBox.shrink();
    final t = tokens;
    final seen = <String>{};
    final unique = [
      for (final s in streamers)
        if (s.url.isNotEmpty && seen.add('${s.service.toLowerCase()}|${s.url}'))
          s,
    ];
    if (unique.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'WATCH ON',
          style: TextStyle(
            color: t.inkSubtle,
            fontSize: 12,
            fontWeight: FontWeight.w700,
            letterSpacing: 2,
          ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            for (final s in unique)
              Focusable(
                tokens: t,
                borderRadius: 12,
                onPressed: () => launchExternalUrl(s.url),
                child: Container(
                  height: 44,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: t.elevated,
                    border: Border.all(
                      color: _animeStreamerColor(
                        s.service,
                      ).withValues(alpha: 0.4),
                    ),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    s.service,
                    style: TextStyle(
                      color: _animeStreamerColor(s.service),
                      fontSize: 13.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

/// The brand colour for an anime streaming service, ported from the web
/// `animeStreamerInfo` map (colour only — the logos are web-bundled assets).
Color _animeStreamerColor(String service) {
  final k = service.toLowerCase();
  if (k.contains('crunchyroll')) return const Color(0xFFF47521);
  if (k.contains('funimation')) return const Color(0xFF5B0BB5);
  if (k.contains('netflix')) return const Color(0xFFE50914);
  if (k.contains('hulu')) return const Color(0xFF1CE783);
  if (k.contains('hidive')) return const Color(0xFF00AEEF);
  if (k.contains('amazon') || k.contains('prime')) {
    return const Color(0xFF00A8E1);
  }
  if (k.contains('disney')) return const Color(0xFF3B7DED);
  if (k.contains('youtube')) return const Color(0xFFFF0000);
  if (k.contains('vrv')) return const Color(0xFFC9B800);
  if (k.contains('tubi')) return const Color(0xFFFA382F);
  if (k.contains('hoopla')) return const Color(0xFF2C7BE5);
  if (k.contains('apple')) return const Color(0xFFB8B8B8);
  if (k.contains('max')) return const Color(0xFF9B6CFF);
  return const Color(0xFFA4906A);
}

/// The hero "Upcoming" call-to-action shown in place of Play for an unreleased
/// title — a calendar pill with a friendly countdown, still searchable on press
/// (in case of an early release). Ported from the web `UpcomingCta`.
class _UpcomingCta extends StatelessWidget {
  const _UpcomingCta({
    required this.tokens,
    required this.tr,
    required this.date,
    required this.onTry,
  });

  final HarborTokens tokens;
  final Translations tr;
  final String? date;
  final VoidCallback onTry;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    final friendly = upcomingDateLabel(tr, date);
    return Tooltip(
      message: tr.t(
        'Not officially released yet. Click to search anyway in case of an early release.',
      ),
      child: Focusable(
        tokens: t,
        autofocus: true,
        borderRadius: 999,
        onPressed: onTry,
        child: Container(
          height: 48,
          padding: const EdgeInsets.symmetric(horizontal: 24),
          decoration: BoxDecoration(
            color: t.elevated.withValues(alpha: 0.4),
            border: Border.all(color: t.edge),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.event_outlined, color: t.inkMuted, size: 18),
              const SizedBox(width: 9),
              Text(
                tr.t('Upcoming'),
                style: TextStyle(
                  color: t.inkMuted,
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (friendly.isNotEmpty) ...[
                const SizedBox(width: 8),
                Text(
                  '· $friendly',
                  style: TextStyle(
                    color: t.inkSubtle,
                    fontSize: 13.5,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// The "Top N" rank badge overlaid on a ranked cast member's poster, ported
/// from `RankBadge`.
class _RankBadge extends StatelessWidget {
  const _RankBadge({required this.rank, required this.tokens});
  final int rank;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: tokens.canvas.withValues(alpha: 0.95),
        border: Border.all(color: tokens.edgeSoft.withValues(alpha: 0.6)),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            'TOP',
            style: TextStyle(
              color: tokens.inkSubtle,
              fontSize: 8.5,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.4,
            ),
          ),
          const SizedBox(width: 3),
          Text(
            '$rank',
            style: TextStyle(
              color: tokens.accent,
              fontSize: 10.5,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

/// The collection rail, ported from `collection-row.tsx`: the sibling films of
/// the belonging collection (this title excluded), under a focusable header that
/// opens the full collection view. Hidden while the collection loads or when no
/// siblings remain.
class _CollectionRail extends ConsumerWidget {
  const _CollectionRail({
    required this.collectionId,
    required this.collectionName,
    required this.currentId,
    required this.tokens,
  });

  final int collectionId;
  final String collectionName;
  final String currentId;
  final HarborTokens tokens;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final coll = ref.watch(collectionProvider(collectionId)).value;
    if (coll == null) return const SizedBox.shrink();
    final parts = coll.parts.where((p) => p.id != currentId).toList();
    if (parts.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 36),
        Padding(
          padding: EdgeInsets.fromLTRB(
            pageGutter(Idiom.of(context)),
            0,
            pageGutter(Idiom.of(context)),
            12,
          ),
          child: Focusable(
            tokens: tokens,
            borderRadius: 8,
            onPressed: () => ref
                .read(navControllerProvider.notifier)
                .push(Frame(FrameKind.collection, {'id': collectionId})),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Flexible(
                  child: Text(
                    collectionName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: tokens.ink,
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(width: 6),
                Icon(Icons.chevron_right, color: tokens.inkSubtle, size: 22),
              ],
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
              padding: EdgeInsets.symmetric(
                horizontal: pageGutter(Idiom.of(context)),
              ),
              itemCount: parts.length,
              separatorBuilder: (_, _) => const SizedBox(width: 14),
              itemBuilder: (context, i) => FocusablePoster(
                item: parts[i],
                tokens: tokens,
                width: scaledPosterCell(
                  150,
                  ref.watch(settingsProvider).getDouble('posterScale'),
                ),
                onPressed: () => ref
                    .read(navControllerProvider.notifier)
                    .push(
                      Frame(FrameKind.meta, {
                        'type': parts[i].type,
                        'id': parts[i].id,
                      }),
                    ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// The hero title: the logo image when it loads, else the large title text.
class _TitlePlate extends StatefulWidget {
  const _TitlePlate({
    required this.title,
    required this.logo,
    required this.tokens,
  });
  final String title;
  final String? logo;
  final HarborTokens tokens;

  @override
  State<_TitlePlate> createState() => _TitlePlateState();
}

class _TitlePlateState extends State<_TitlePlate> {
  bool _logoFailed = false;

  @override
  void didUpdateWidget(_TitlePlate old) {
    super.didUpdateWidget(old);
    if (old.logo != widget.logo) _logoFailed = false;
  }

  @override
  Widget build(BuildContext context) {
    final phone = Idiom.of(context).isPhone;
    final logo = widget.logo;
    if (logo != null && !_logoFailed) {
      return ConstrainedBox(
        // The logo plate shrinks on a phone so it (and the title fallback) never
        // dwarfs the narrower hero.
        constraints: BoxConstraints(
          maxHeight: phone ? 84 : 124,
          maxWidth: phone ? 300 : 440,
        ),
        child: Align(
          alignment: Alignment.centerLeft,
          child: CachedNetworkImage(
            imageUrl: logo,
            fit: BoxFit.contain,
            alignment: Alignment.centerLeft,
            errorWidget: (_, _, _) {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (mounted) setState(() => _logoFailed = true);
              });
              return _titleText(phone);
            },
          ),
        ),
      );
    }
    return _titleText(phone);
  }

  Widget _titleText(bool phone) => Text(
    widget.title,
    style: TextStyle(
      color: widget.tokens.ink,
      fontSize: phone ? 40 : 64,
      fontWeight: FontWeight.w500,
      height: 0.95,
      letterSpacing: -1,
    ),
  );
}

class _Pill extends StatelessWidget {
  const _Pill({required this.child, required this.tokens, this.onPressed});
  final Widget child;
  final HarborTokens tokens;

  /// When set, the pill becomes a focusable button (year / runtime browse).
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final box = Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: tokens.canvas.withValues(alpha: 0.85),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: tokens.edgeSoft),
      ),
      child: child,
    );
    if (onPressed == null) return box;
    return Focusable(
      tokens: tokens,
      scale: 1.0,
      borderRadius: 999,
      onPressed: onPressed!,
      child: box,
    );
  }
}

/// The synopsis paragraph with a Show more / Show less toggle when clamped.
class _Synopsis extends StatefulWidget {
  const _Synopsis({required this.text, required this.tokens});
  final String text;
  final HarborTokens tokens;

  @override
  State<_Synopsis> createState() => _SynopsisState();
}

class _SynopsisState extends State<_Synopsis> {
  bool _expanded = false;

  @override
  void didUpdateWidget(_Synopsis old) {
    super.didUpdateWidget(old);
    if (old.text != widget.text) _expanded = false;
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tokens;
    final style = TextStyle(color: t.inkMuted, fontSize: 16, height: 1.5);
    // Whether the text overflows four lines at the current width.
    final overflows = LayoutBuilder(
      builder: (context, constraints) {
        final tp = TextPainter(
          text: TextSpan(text: widget.text, style: style),
          maxLines: 4,
          textDirection: Directionality.of(context),
        )..layout(maxWidth: constraints.maxWidth);
        final didOverflow = tp.didExceedMaxLines;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.text,
              maxLines: _expanded ? null : 4,
              overflow: _expanded ? TextOverflow.clip : TextOverflow.ellipsis,
              style: style,
            ),
            if (didOverflow || _expanded)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Focusable(
                  tokens: t,
                  borderRadius: 8,
                  onPressed: () => setState(() => _expanded = !_expanded),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        _expanded ? 'Show less' : 'Show more',
                        style: TextStyle(
                          color: t.inkMuted,
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Icon(
                        _expanded
                            ? Icons.keyboard_arrow_up
                            : Icons.keyboard_arrow_down,
                        size: 16,
                        color: t.inkMuted,
                      ),
                    ],
                  ),
                ),
              ),
          ],
        );
      },
    );
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 780),
      child: overflows,
    );
  }
}

class _Episodes extends StatelessWidget {
  const _Episodes({
    required this.metaId,
    required this.videos,
    required this.tokens,
    required this.onPlay,
    this.onDownload,
  });

  final String metaId;
  final List<VideoRef> videos;
  final HarborTokens tokens;
  final void Function(VideoRef) onPlay;

  /// Opens the picker in download intent for an episode; when set, each row
  /// with a season/episode shows a download control.
  final void Function(VideoRef)? onDownload;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Episodes',
          style: TextStyle(
            color: tokens.ink,
            fontSize: 22,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 12),
        for (var i = 0; i < videos.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Focusable(
              tokens: tokens,
              borderRadius: 12,
              onPressed: () => onPlay(videos[i]),
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: tokens.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: tokens.edgeSoft),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      width: 64,
                      child: Text(
                        _epLabel(videos[i]),
                        style: TextStyle(
                          color: tokens.accent,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            videos[i].title ?? 'Episode',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(color: tokens.ink, fontSize: 15),
                          ),
                          if (videos[i].overview != null) ...[
                            const SizedBox(height: 4),
                            Text(
                              videos[i].overview!,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: tokens.inkSubtle,
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    if (onDownload != null &&
                        videos[i].season != null &&
                        videos[i].episode != null) ...[
                      const SizedBox(width: 10),
                      EpisodeDownloadButton(
                        metaId: metaId,
                        season: videos[i].season!,
                        episode: videos[i].episode!,
                        onDownload: () => onDownload!(videos[i]),
                        tokens: tokens,
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }

  String _epLabel(VideoRef v) {
    if (v.season != null && v.episode != null) {
      return 'S${v.season} E${v.episode}';
    }
    if (v.episode != null) return 'E${v.episode}';
    return '•';
  }
}
