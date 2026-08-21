/// Whether a media [url] points at an on-device file (a finished download played
/// back locally) rather than a remote stream. Ported from the web `isLocalUrl`
/// (`src/lib/player/local-url.ts`): a `file:` URI, a Windows UNC (`\\…`) or
/// drive path (`C:\…`), or an absolute POSIX path (`/…`, how downloads are
/// stored) is local; anything with a network scheme (`http(s)://`, …) is remote.
///
/// Used both to route local playback through `VideoPlayerController.file` (a raw
/// path defeats `networkUrl`) and to hide the player's download button when the
/// source is already on disk.
bool isLocalMediaUrl(String url) {
  if (url.isEmpty) return false;
  if (url.startsWith('file:')) return true;
  if (url.startsWith(r'\\')) return true; // UNC path
  if (RegExp(r'^[a-z]:[\\/]', caseSensitive: false).hasMatch(url)) return true;
  if (url.startsWith('/')) return true; // absolute POSIX path (downloaded file)
  return false; // scheme://… → remote → streamable
}
