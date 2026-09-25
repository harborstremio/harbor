import { useState } from "react";
import { ListMusic } from "lucide-react";
import { MoreLikeThisIcon } from "@/components/icons/more-like-this-icon";
import { useT } from "@/lib/i18n";
import { requestMusicPlaylist } from "@/lib/music/navigation";
import { useArtistPlaylists, useTrackPlaylists } from "@/lib/music/playlist-membership";
import { reopenMusicMix, useMusicTrackContext } from "@/lib/music/recent-context";
import type { MusicTrack } from "@/lib/music/types";

const NAME_LIMIT = 3;

function joinNames(
  names: string[],
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  if (names.length <= NAME_LIMIT) return names.join(", ");
  return t("music.playlists.andMore", {
    names: names.slice(0, NAME_LIMIT).join(", "),
    count: names.length - NAME_LIMIT,
  });
}

export function MusicTrackPlaylistChip({
  track,
  compact = false,
}: {
  track: Pick<MusicTrack, "id" | "connectorId" | "title" | "artist"> | null | undefined;
  compact?: boolean;
}) {
  const t = useT();
  const playlists = useTrackPlaylists(track);
  if (!playlists.length) return null;
  const names = playlists.map((playlist) => playlist.name);
  const label =
    playlists.length === 1
      ? t("music.playlists.inOne", { name: names[0] })
      : t("music.playlists.inMany", { count: playlists.length });
  return (
    <button
      type="button"
      data-music-playlist-chip
      className="music-playlist-chip inline-flex min-w-0 shrink items-center gap-1 text-[10px] font-medium leading-none text-ink-muted"
      title={joinNames(names, t)}
      aria-label={joinNames(names, t)}
      onClick={(event) => {
        event.stopPropagation();
        requestMusicPlaylist(playlists[0].id, track?.id);
      }}
    >
      <ListMusic size={12} aria-hidden="true" className="shrink-0" />
      {!compact && <span className="truncate">{label}</span>}
    </button>
  );
}

export function MusicTrackMixChip({
  track,
  compact = false,
}: {
  track: Pick<MusicTrack, "id" | "connectorId" | "title" | "artist"> | null | undefined;
  compact?: boolean;
}) {
  const t = useT();
  const context = useMusicTrackContext(track);
  const [busy, setBusy] = useState(false);
  const seed = context?.kind === "similar" ? context.seed : undefined;
  if (!context || !seed) return null;
  const label = t("music.similar.fromMix", { name: context.name });
  return (
    <button
      type="button"
      data-music-mix-chip
      disabled={busy}
      className="music-playlist-chip inline-flex min-w-0 shrink items-center gap-1 text-[10px] font-medium leading-none text-ink-muted disabled:opacity-60"
      title={label}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        if (busy) return;
        setBusy(true);
        void reopenMusicMix(seed)
          .catch(() => {})
          .finally(() => setBusy(false));
      }}
    >
      <MoreLikeThisIcon size={12} className="shrink-0" />
      {!compact && <span className="truncate">{label}</span>}
    </button>
  );
}

export function MusicArtistPlaylistNote({ artist }: { artist: string | null | undefined }) {
  const t = useT();
  const { trackCount, playlists } = useArtistPlaylists(artist);
  if (!trackCount) return null;
  const names = playlists.map((playlist) => playlist.name);
  const summary =
    trackCount === 1
      ? t("music.playlists.artistSong")
      : t("music.playlists.artistSongs", { tracks: trackCount });
  return (
    <p
      data-music-playlist-note
      className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] text-ink-subtle"
    >
      <ListMusic size={13} aria-hidden="true" className="shrink-0" />
      <span>{summary}</span>
      {names.length > 0 && (
        <span className="min-w-0 truncate text-ink-muted">{joinNames(names, t)}</span>
      )}
    </p>
  );
}
