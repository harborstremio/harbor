import type { MusicCatalogItem } from "./types";

/** Only provider-issued catalog identities become external links; local paths stay local. */
export function musicSourceLink(item: MusicCatalogItem): { name: string; url: string } | null {
  if (
    item.kind === "artist" &&
    /^(?:youtube|youtube_music|youtube-music|youtubemusic)$/.test(item.connectorId ?? "") &&
    /^UC[\w-]{22}$/.test(item.id)
  )
    return { name: "YouTube Music", url: `https://www.youtube.com/channel/${item.id}` };
  const billboard = /^billboard:hot-100:(\d{4}-\d{2}-\d{2}):\d+$/.exec(item.id);
  if (item.connectorId === "catalog" && billboard)
    return { name: "Billboard", url: `https://www.billboard.com/charts/hot-100/${billboard[1]}/` };
  const spotify = /^spotify:(album|artist|track|playlist):([A-Za-z0-9]{22})$/.exec(item.id);
  if (item.connectorId === "spotify" && spotify && spotify[1] === item.kind) {
    return { name: "Spotify", url: `https://open.spotify.com/${spotify[1]}/${spotify[2]}` };
  }
  const deezer = /^deezer:(album|artist|track):(\d+)$/.exec(item.id);
  if (deezer) return { name: "Deezer", url: `https://www.deezer.com/${deezer[1]}/${deezer[2]}` };
  const apple = /^itunes:(album|artist):(\d+)$/.exec(item.id);
  if (apple)
    return { name: "Apple Music", url: `https://music.apple.com/us/${apple[1]}/${apple[2]}` };
  const mb =
    /^musicbrainz:(artist|release|release-group|recording):([\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12})$/i.exec(
      item.id,
    );
  if (mb)
    return {
      name: "MusicBrainz",
      url: `https://musicbrainz.org/${mb[1].toLowerCase()}/${mb[2].toLowerCase()}`,
    };
  return null;
}
