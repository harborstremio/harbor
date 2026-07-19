import 'local_cw.dart';

/// The Trakt watched-set keys that would mark a Continue-Watching entry's current
/// position watched: the movie key (`imdb:tt…` / `tmdb:<n>`) for a movie, or the
/// current-episode key (`imdb:tt…:<s>:<e>` / `tmdb:<n>:<s>:<e>`) for a series.
/// Ported 1:1 from web `libraryItemWatchedKeys`. Returns `const []` for ids/types
/// no key scheme covers (anime ids, a series with no known episode, etc.).
List<String> cwEntryWatchedKeys(LocalCwEntry e) {
  final id = e.id;
  if (id.isEmpty) return const [];
  final hasEp = e.season != null && e.episode != null;

  if (RegExp(r'^tt\d+$').hasMatch(id)) {
    if (e.type == 'movie') return ['imdb:$id'];
    if (e.type == 'series' && hasEp) {
      return ['imdb:$id:${e.season}:${e.episode}'];
    }
    return const [];
  }

  if (id.startsWith('tmdb:')) {
    final parts = id.split(':');
    final num = int.tryParse(parts.length > 2 ? parts[2] : '');
    if (num == null) return const [];
    if (parts.length > 1 && parts[1] == 'movie') return ['tmdb:$num'];
    if (parts.length > 1 && parts[1] == 'tv' && hasEp) {
      return ['tmdb:$num:${e.season}:${e.episode}'];
    }
  }

  return const [];
}

/// Whether the Trakt [watched] keyset marks [e]'s current position watched — the
/// green "Watched on Trakt" check on a Continue-Watching card (web
/// `isLibraryItemWatched`). False when the set is empty (Trakt off / not loaded).
bool isCwEntryWatched(LocalCwEntry e, Set<String> watched) {
  if (watched.isEmpty) return false;
  for (final k in cwEntryWatchedKeys(e)) {
    if (watched.contains(k)) return true;
  }
  return false;
}
