// Pure download-preparation logic — the destination filename and the anti-stub
// content guards — ported from `src/lib/download/filename.ts` and the download
// engine spec in `docs/60`. The native engine uses these to name the `.part`
// target and to reject error pages / tiny stubs.

final RegExp _illegal = RegExp(r'[<>:"/\\|?*\x00-\x1F]');
final RegExp _trailing = RegExp(r'[. ]+$');

/// Strips filesystem-illegal characters and trailing dots/spaces, capped at 180
/// chars. Ports `sanitizeName`.
String sanitizeDownloadName(String name) {
  final s = name.replaceAll(_illegal, '').replaceAll(_trailing, '').trim();
  return s.length > 180 ? s.substring(0, 180) : s;
}

const Set<String> _videoExts = {
  'mkv',
  'mp4',
  'webm',
  'avi',
  'mov',
  'ts',
  'm4v',
};
final RegExp _extRe = RegExp(
  r'\.([a-z0-9]{2,5})(?:$|\?)',
  caseSensitive: false,
);

/// The video extension from [url]'s path (one of the known containers), or
/// `mkv` by default. Ports `extensionFromUrl`.
String extensionFromUrl(String url) {
  try {
    final path = Uri.parse(url).path;
    final m = _extRe.firstMatch(path);
    if (m != null) {
      final ext = m.group(1)!.toLowerCase();
      if (_videoExts.contains(ext)) return ext;
    }
  } catch (_) {
    return 'mkv';
  }
  return 'mkv';
}

String _qualityTag(String? streamLabel) {
  if (streamLabel == null) return '';
  var cleaned = sanitizeDownloadName(
    streamLabel,
  ).replaceAll(RegExp(r'\s+'), ' ').trim();
  if (cleaned.length > 40) cleaned = cleaned.substring(0, 40);
  return cleaned.isNotEmpty ? ' [$cleaned]' : '';
}

/// The default download filename: `Title - S01E02 [tag].mkv` for an episode,
/// `Title (2021) [tag].mkv` when a release year is known, else `Title [tag].mkv`.
/// Ports `buildDefaultFilename`.
String buildDefaultFilename({
  required String name,
  required String url,
  String? releaseInfo,
  int? season,
  int? episode,
  String? streamLabel,
}) {
  final ext = extensionFromUrl(url);
  final title = sanitizeDownloadName(name.isNotEmpty ? name : 'video');
  final tag = _qualityTag(streamLabel);
  if (season != null && episode != null) {
    final s = season.toString().padLeft(2, '0');
    final e = episode.toString().padLeft(2, '0');
    return '$title - S${s}E$e$tag.$ext';
  }
  if (releaseInfo != null && releaseInfo.isNotEmpty) {
    return '$title (${sanitizeDownloadName(releaseInfo)})$tag.$ext';
  }
  return '$title$tag.$ext';
}

/// A declared `Content-Length` at or below this is treated as an error page, not
/// video (the anti-stub guard).
const int kMinDeclaredBytes = 65536; // 64 KiB

/// A finished download smaller than this is rejected as a stub.
const int kMinVideoBytes = 512 * 1024; // 512 KiB

/// Whether a `Content-Type` looks like an error page rather than video — it
/// starts with `text/` or names html/json/xml. Ports the anti-stub content
/// guard.
bool isStubContentType(String? contentType) {
  if (contentType == null) return false;
  final ct = contentType.toLowerCase();
  return ct.startsWith('text/') ||
      ct.contains('html') ||
      ct.contains('json') ||
      ct.contains('xml');
}
