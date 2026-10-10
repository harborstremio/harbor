import type { MusicTrack } from "@/lib/music/types";

export type SpooktoberSong = {
  id: string;
  title: string;
  creator: string;
  album?: string;
  poster: string;
  duration?: number;
  explicit?: boolean;
};

export type SpooktoberPlaylistData = {
  id: string;
  title: string;
  description: string;
  art: string[];
  coverIds: string[];
  songIds: string[];
};

export type SpooktoberMusicData = {
  songs: SpooktoberSong[];
  playlists: SpooktoberPlaylistData[];
};

export function spooktoberAsset(path: string): string {
  if (/^https?:\/\//i.test(path) || path.startsWith("/spooktober/")) return path;
  return `/spooktober/${path.replace(/^\.?\//, "")}`;
}

/** Match Harbor's catalog identity, and let its source picker resolve the full recording. */
export function spooktoberSongToTrack(song: SpooktoberSong): MusicTrack {
  const sourceId = /^music-(\d+)$/.exec(song.id)?.[1];
  const duration = Math.max(0, Math.round(Number(song.duration) || 0));
  return {
    id: sourceId ? `itunes:track:${sourceId}` : `spooktober:${song.id}`,
    connectorId: "catalog",
    sourceId,
    title: song.title,
    artist: song.creator,
    album: song.album,
    artwork: spooktoberAsset(song.poster),
    durationSeconds: duration,
    durationLabel: `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}`,
    explicit: song.explicit,
    mediaKind: "audio",
  };
}

let dataRequest: Promise<SpooktoberMusicData> | null = null;

export function loadSpooktoberMusic(): Promise<SpooktoberMusicData> {
  if (dataRequest) return dataRequest;
  dataRequest = Promise.all(
    ["music.json", "playlist-data.json"].map(async (file) => {
      const response = await fetch(`/spooktober/${file}`, { cache: "no-cache" });
      if (!response.ok) throw new Error(`Spooktober music: ${response.status}`);
      const value: unknown = await response.json();
      if (!Array.isArray(value)) throw new Error("Invalid Spooktober music data");
      return value;
    }),
  )
    .then(([songData, playlistData]) => {
      const songs = songData as SpooktoberSong[];
      const playlists = playlistData as SpooktoberPlaylistData[];
      const ids = new Set(songs.map((song) => song.id));
      if (
        !songs.every((song) => song.id && song.title && song.creator && song.poster) ||
        !playlists.every(
          (playlist) =>
            playlist.id &&
            playlist.title &&
            Array.isArray(playlist.art) &&
            Array.isArray(playlist.coverIds) &&
            Array.isArray(playlist.songIds) &&
            playlist.songIds.every((id) => ids.has(id)),
        )
      ) {
        throw new Error("Incomplete Spooktober music data");
      }
      return { songs, playlists };
    })
    .catch((error: unknown) => {
      dataRequest = null;
      throw error;
    });
  return dataRequest;
}

export type SpooktoberVideo = {
  id: string;
  title: string;
  artist: string;
  image?: string;
};

export function spooktoberVideoToTrack(video: SpooktoberVideo): MusicTrack {
  return {
    id: video.id,
    sourceId: video.id,
    connectorId: "youtube",
    title: video.title,
    artist: video.artist,
    artwork: video.image ? spooktoberAsset(video.image) : "",
    durationSeconds: 0,
    durationLabel: "",
    mediaKind: "video",
  };
}
