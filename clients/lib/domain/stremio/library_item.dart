/// The playback state of a [LibraryItem] — position/duration (milliseconds) and
/// the last-played episode. Ported from the web `LibraryItem.state`.
class LibraryState {
  const LibraryState({
    this.timeOffset = 0,
    this.duration = 0,
    this.season,
    this.episode,
    this.videoId,
    this.flaggedWatched = 0,
    this.watched = false,
    this.lastWatched,
  });

  final int timeOffset;
  final int duration;
  final int? season;
  final int? episode;
  final String? videoId;

  /// Stremio's explicit watched flag (`1` when the user marked it watched).
  final int flaggedWatched;

  /// Whether Stremio recorded a watched timestamp (truthy `state.watched`).
  final bool watched;

  /// The ISO timestamp of the last play (`state.lastWatched`) — the history
  /// tab's watched-at source, preferred over the item's `_mtime`.
  final String? lastWatched;

  factory LibraryState.fromJson(Map<String, dynamic> j) {
    final w = j['watched'];
    return LibraryState(
      timeOffset: (j['timeOffset'] as num?)?.toInt() ?? 0,
      duration: (j['duration'] as num?)?.toInt() ?? 0,
      season: (j['season'] as num?)?.toInt(),
      episode: (j['episode'] as num?)?.toInt(),
      videoId: j['video_id']?.toString(),
      flaggedWatched: (j['flaggedWatched'] as num?)?.toInt() ?? 0,
      watched: w != null && w != false && w != '' && w != 0,
      lastWatched: j['lastWatched']?.toString(),
    );
  }
}

/// A Stremio library entry (`datastoreGet` "libraryItem"). Holds the saved
/// title plus its playback state; `removed`/`temp` mark whether it is a genuine
/// bookmark (`temp` = auto-added on play) or a tombstone.
class LibraryItem {
  const LibraryItem({
    required this.id,
    required this.type,
    required this.name,
    this.poster,
    this.background,
    this.removed = false,
    this.temp = false,
    this.state,
    this.mtime,
  });

  final String id;
  final String type;
  final String name;
  final String? poster;
  final String? background;
  final bool removed;
  final bool temp;
  final LibraryState? state;

  /// The ISO timestamp of the item's last modification (`_mtime`) — the history
  /// tab's date fallback when the state has no `lastWatched`.
  final String? mtime;

  /// Has playback progress — a continue-watching candidate (`timeOffset > 0`).
  bool get inProgress => (state?.timeOffset ?? 0) > 0;

  /// In the watchlist at all — everything except a real removal tombstone
  /// (`removed && !temp`). Ports the web `filterLibrary` base rule.
  bool get inWatchlist => !(removed && !temp);

  /// Explicitly bookmarked (not just auto-added on play), for
  /// `libraryBookmarkedOnly`.
  bool get bookmarked => !removed && !temp;

  factory LibraryItem.fromJson(Map<String, dynamic> j) => LibraryItem(
    id: (j['_id'] ?? j['id'] ?? '').toString(),
    type: (j['type'] ?? 'movie').toString(),
    name: (j['name'] ?? '').toString(),
    poster: j['poster']?.toString(),
    background: j['background']?.toString(),
    removed: j['removed'] == true,
    temp: j['temp'] == true,
    state: j['state'] is Map
        ? LibraryState.fromJson((j['state'] as Map).cast<String, dynamic>())
        : null,
    mtime: j['_mtime']?.toString(),
  );
}
