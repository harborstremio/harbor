import { esportsEmbedUrl, esportsExternalUrl, type EsportsStream } from "./esports-streams";

/** Native PiP sessions carry the original public channel, never a resolved media URL. */
export function broadcastFromPipSession(
  session: { url: string; title: string | null },
  hostname: string,
): EsportsStream | null {
  if (!esportsExternalUrl(session.url)) return null;
  for (const platform of ["twitch", "youtube", "kick"] as const) {
    const stream = { url: session.url, title: session.title || platform, platform };
    if (esportsEmbedUrl(stream, hostname)) return stream;
  }
  return null;
}

export function broadcastPipSession(stream: EsportsStream) {
  return {
    url: stream.url,
    title: stream.title,
    startAtSec: 0,
    playing: true,
    volume: 1,
    muted: false,
    subtitle: null,
    subtitles: [],
  };
}
