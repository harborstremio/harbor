import '../../core/abort_signal.dart';
import '../streams/episode_file.dart';
import '../streams/parser/stream_enums.dart';

/// A debrid operation result: success with data, or a typed failure carrying a
/// load-bearing [code] string (never thrown across the boundary). Ported from
/// `DebridResult<T>` in `src/lib/debrid/types.ts`.
sealed class DebridResult<T> {
  const DebridResult();
  bool get isOk => this is DebridOk<T>;
  T? get dataOrNull => this is DebridOk<T> ? (this as DebridOk<T>).data : null;
}

final class DebridOk<T> extends DebridResult<T> {
  const DebridOk(this.data);
  final T data;
}

final class DebridErr<T> extends DebridResult<T> {
  const DebridErr(this.code, {this.status = 0, this.raw});
  final String code;
  final int status;
  final Object? raw;

  /// Re-type this failure for a different success type (for early returns where
  /// the generic parameter differs).
  DebridErr<U> to<U>() => DebridErr<U>(code, status: status, raw: raw);
}

/// A debrid account summary.
class Account {
  const Account({
    required this.slug,
    this.username,
    this.email,
    required this.premium,
    this.premiumUntil,
    this.trafficUsed,
    this.trafficLimit,
  });

  final DebridSlug slug;
  final String? username;
  final String? email;
  final bool premium;
  final int? premiumUntil;
  final int? trafficUsed;
  final int? trafficLimit;
}

typedef CacheMap = Map<String, bool>;

/// A subtitle track attached to a resolved link.
class SubtitleRef {
  const SubtitleRef({required this.url, this.lang, this.id});
  final String url;
  final String? lang;
  final String? id;
}

/// A directly-playable link produced by resolution.
class DirectLink {
  const DirectLink({
    required this.url,
    this.fileIdx,
    this.filename,
    this.filesize,
    this.headers,
    this.notWebReady,
    this.subtitles,
  });

  final String url;
  final int? fileIdx;
  final String? filename;
  final int? filesize;
  final Map<String, String>? headers;
  final bool? notWebReady;
  final List<SubtitleRef>? subtitles;
}

/// A file within a debrid torrent/transfer.
class DebridFile {
  const DebridFile({
    required this.id,
    required this.name,
    required this.size,
    this.selected,
    this.url,
  });
  final String id;
  final String name;
  final int size;
  final bool? selected;
  final String? url;
}

class Transfer {
  const Transfer({
    required this.id,
    required this.hash,
    this.name,
    required this.ready,
    required this.files,
  });
  final String id;
  final String hash;
  final String? name;
  final bool ready;
  final List<DebridFile> files;
}

class LibraryFile {
  const LibraryFile({required this.id, required this.name, required this.size});
  final String id;
  final String name;
  final int size;
}

class LibraryEntry {
  const LibraryEntry({
    required this.slug,
    required this.id,
    required this.hash,
    required this.name,
    this.size,
    this.files,
  });
  final DebridSlug slug;
  final String id;
  final String hash;
  final String name;
  final int? size;
  final List<LibraryFile>? files;
}

/// A queued cache job id (TorBox `queueCache`).
class QueueId {
  const QueueId(this.id);
  final String id;
}

/// The common interface every debrid provider implements. Providers that do not
/// support an optional operation return a `DebridErr('unsupported')` rather than
/// omitting the method, ported from the `DebridStore` type.
abstract interface class DebridStore {
  DebridSlug get slug;
  String get name;

  Future<DebridResult<Account>> account(AbortSignal signal);
  Future<DebridResult<CacheMap>> cacheCheck(
    List<String> hashes,
    AbortSignal signal,
  );
  Future<DebridResult<DirectLink>> playableUrl(
    String magnet,
    int? fileIdx,
    AbortSignal signal, {
    EpisodeHint? hint,
  });
  Future<DebridResult<QueueId>> queueCache(String magnet, AbortSignal signal);
  Future<DebridResult<List<LibraryEntry>>> listLibrary(AbortSignal signal);
  Future<DebridResult<List<DebridFile>>> listTorrentFiles(
    String hash,
    AbortSignal signal,
  );
}

/// Video file extensions used by the shared file-picking logic.
const List<String> kVideoExts = [
  '.mkv',
  '.mp4',
  '.avi',
  '.m4v',
  '.webm',
  '.ts',
  '.mov',
  '.wmv',
];

/// `listLibrary` cache lifetime (5 minutes).
const int kLibraryTtlMs = 5 * 60000;

/// Returns [hash] unchanged if it is already a magnet, else builds a magnet URI.
String magnetFromHash(String hash) {
  if (hash.startsWith('magnet:')) return hash;
  return 'magnet:?xt=urn:btih:$hash';
}

/// Extracts the lowercased info-hash from a magnet, or lowercases a bare hash.
String hashFromMagnet(String input) {
  if (!input.startsWith('magnet:')) return input.toLowerCase();
  final m = RegExp(r'xt=urn:btih:([A-Fa-f0-9]+)').firstMatch(input);
  return m != null ? m.group(1)!.toLowerCase() : input.toLowerCase();
}
