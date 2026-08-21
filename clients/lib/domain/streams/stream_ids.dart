/// Builds the ordered list of content ids to query addons with, ported from
/// `src/lib/streams/stream-ids.ts`. Anime schemes and imdb mappings are emitted
/// alongside the base id so anime-aware and imdb-only addons both get a usable
/// id; `pickIds` later filters to what each addon accepts.
library;

/// The episode context for a stream query (series/anime). Fields mirror the web
/// `PlayEpisode` shape relevant to id construction.
class StreamEpisode {
  const StreamEpisode({
    required this.season,
    required this.episode,
    this.videoId,
    this.imdbId,
    this.imdbSeason,
    this.imdbEpisode,
    this.kitsuStreamId,
  });

  final int season;
  final int episode;

  /// An explicit addon video id for this episode, if the meta provided one.
  final String? videoId;

  /// The imdb id/season/episode mapping for anime that also map to imdb.
  final String? imdbId;
  final int? imdbSeason;
  final int? imdbEpisode;

  /// A ready-made `kitsu:<id>:<ep>` stream id, if resolved.
  final String? kitsuStreamId;
}

final RegExp _animeMetaRx = RegExp(r'^(kitsu|mal|anilist|anidb):');

/// Whether [id] is an anime-scheme meta id (`kitsu:`/`mal:`/`anilist:`/`anidb:`).
/// The id-prefix test the web calls `isAnimeMetaId` — used to skip anime for the
/// season-source lock, which keys on episode numbering that anime ids lack.
bool isAnimeMetaId(String id) => _animeMetaRx.hasMatch(id);

/// Returns the de-duplicated, priority-ordered ids to request for [metaId] and
/// an optional [episode]. [imdbId] is the resolved imdb id (or null when
/// keyless); [defaultVideoId] is a movie's default addon video id;
/// [omitEpisode] requests a season-pack id (no `:episode` suffix).
List<String> buildStreamIds(
  String metaId, {
  StreamEpisode? episode,
  String? imdbId,
  String? defaultVideoId,
  bool omitEpisode = false,
}) {
  final out = <String>[];
  final seen = <String>{};
  void push(String? s) {
    if (s == null || s.isEmpty || seen.contains(s)) return;
    seen.add(s);
    out.add(s);
  }

  if (episode?.videoId != null) push(episode!.videoId);
  if (episode == null && defaultVideoId != null) push(defaultVideoId);

  final animeMeta =
      _animeMetaRx.hasMatch(metaId) || episode?.kitsuStreamId != null;
  final mappedImdb =
      (episode?.imdbSeason != null && episode?.imdbEpisode != null)
      ? (episode!.imdbId ?? imdbId)
      : null;
  if (mappedImdb != null && mappedImdb.startsWith('tt')) {
    push(
      omitEpisode
          ? '$mappedImdb:${episode!.imdbSeason}'
          : '$mappedImdb:${episode!.imdbSeason}:${episode.imdbEpisode}',
    );
  }

  if (episode?.kitsuStreamId != null) {
    push(episode!.kitsuStreamId);
  } else if (metaId.startsWith('kitsu:') && episode != null) {
    push('kitsu:${metaId.split(':')[1]}:${episode.episode}');
  } else if ((metaId.startsWith('kitsu:') || metaId.startsWith('mal:')) &&
      episode == null) {
    push(metaId);
  } else if (metaId.startsWith('tt') && episode != null) {
    if (!animeMeta) {
      push(
        omitEpisode
            ? '$metaId:${episode.season}'
            : '$metaId:${episode.season}:${episode.episode}',
      );
    }
  } else if (metaId.startsWith('tt') && episode == null) {
    push(metaId);
  } else if (metaId.startsWith('tmdb:')) {
    if (episode != null) {
      if (!animeMeta) {
        push(
          omitEpisode
              ? '$metaId:${episode.season}'
              : '$metaId:${episode.season}:${episode.episode}',
        );
      }
    } else {
      push(metaId);
    }
  } else {
    if (episode != null) {
      push(
        omitEpisode
            ? '$metaId:${episode.season}'
            : '$metaId:${episode.season}:${episode.episode}',
      );
    } else {
      push(metaId);
    }
  }

  if (imdbId != null && imdbId.startsWith('tt')) {
    if (episode == null) {
      push(imdbId);
    } else if (!animeMeta) {
      push(
        omitEpisode
            ? '$imdbId:${episode.season}'
            : '$imdbId:${episode.season}:${episode.episode}',
      );
    }
  }

  return out;
}
