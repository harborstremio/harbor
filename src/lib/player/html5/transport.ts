/** notWebReady describes browser compatibility, not a container or live stream. */
export function html5Transport(url: string, legacyLiveTs = false): "hls" | "mpegts" | "file" {
  let path = url.split(/[?#]/)[0];
  try { path = new URL(url).pathname; } catch { /* Local or relative media path. */ }
  path = path.toLowerCase();
  if (path.endsWith(".m3u8")) return "hls";
  if (path.endsWith(".ts") || path.endsWith(".m2ts")) return "mpegts";
  if (/\.(mp4|m4v|webm|mov|mkv|avi|mpd|mp3|m4a|ogg|wav|flac)$/.test(path)) return "file";
  // Retain established extensionless playlist/live endpoint support, but an
  // explicit file extension above always wins over the directory name.
  if (path.includes("/playlist/")) return "hls";
  if (legacyLiveTs) return "mpegts";
  // Opaque signed URLs belong to the media element. Guessing from query tokens
  // can hand an MP4 to an HLS parser and continually retry a valid file.
  return "file";
}
