import { useEffect, useId, useRef } from "react";
import { X } from "@/components/icons/music-icons";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { Poster } from "@/components/poster";
import { useT } from "@/lib/i18n";
import { artistPlaylistTracks, useArtistPlaylists } from "@/lib/music/playlist-membership";
import { MUSIC_EXPLORE_EVENT, MUSIC_PLAYLIST_EVENT, MUSIC_SEARCH_EVENT } from "@/lib/music/navigation";
import { enqueueMusic } from "@/lib/music/player";
import { useMusicPlayback } from "@/lib/music/use-music-playback";
import { MusicTrackRow } from "./music-track-row";
import { useMusicSourcePicker } from "./music-source-picker";
import { useMusicPlaylistPicker } from "./music-playlist-picker";
import { useMusicNavigate } from "./music-navigate";

export default function ArtistPlaylistSongs({ artist, artwork, onClose }: { artist: string; artwork?: string | null; onClose: () => void }) {
  const t = useT();
  const { playlists } = useArtistPlaylists(artist);
  const tracks = artistPlaylistTracks(playlists, artist);
  const player = useMusicPlayback();
  const { openSourcePicker } = useMusicSourcePicker();
  const { openPlaylistPicker } = useMusicPlaylistPicker();
  const { goToArtist } = useMusicNavigate();
  const { closing, close } = useModalExit(onClose);
  const titleId = useId();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const origin = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    root.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    return () => {
      // Do not steal focus from a source or playlist picker opened from this dialog.
      if (!document.querySelector('[role="dialog"][aria-modal="true"]') && origin?.isConnected) origin.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    const events = [MUSIC_EXPLORE_EVENT, MUSIC_PLAYLIST_EVENT, MUSIC_SEARCH_EVENT];
    events.forEach((event) => window.addEventListener(event, close));
    return () => events.forEach((event) => window.removeEventListener(event, close));
  }, [close]);
  return <ModalShell closing={closing} onDismiss={close} width={680} labelledBy={titleId}>
    <div ref={root} className="flex min-h-0 flex-col" onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const targets = [...root.current!.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]')].filter((node) => node.getClientRects().length);
      if (event.shiftKey && document.activeElement === targets[0]) { event.preventDefault(); targets.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === targets.at(-1)) { event.preventDefault(); targets[0]?.focus(); }
    }}>
      <header className="flex items-center gap-4 px-5 py-4">
        {artwork && <div className="size-12 shrink-0 overflow-hidden rounded-full" aria-hidden="true">
          <Poster src={artwork} seed={artist} ratio="square" className="w-full [--poster-radius:0px]" />
        </div>}
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="truncate text-xl font-semibold">{artist}</h2>
          <p className="mt-1 text-xs text-ink-muted">{tracks.length === 1 ? t("music.playlists.artistSong") : t("music.playlists.artistSongs", { tracks: tracks.length })}</p>
        </div>
        <button type="button" onClick={close} aria-label={t("common.close")}
          className="grid size-8 shrink-0 place-items-center rounded-md text-ink-muted hover:bg-elevated hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"><X size={18} /></button>
      </header>
      <div className="min-h-0 overflow-y-auto px-5 pb-5">
        <div className="flex flex-col gap-2">
          {tracks.map((track, index) => {
            const current = player.current?.id === track.id && player.current?.connectorId === track.connectorId;
            return <MusicTrackRow key={`${track.connectorId}:${track.id}:${index}`} track={track} index={index + 1} showDuration
              nowPlaying={current} paused={current && player.phase === "paused"} loading={current && player.phase === "resolving"}
              onPlay={() => { onClose(); openSourcePicker(track, tracks); }}
              onAddToQueue={() => enqueueMusic(track)}
              onAddToPlaylist={() => { onClose(); openPlaylistPicker(track); }}
              onGoToArtist={() => goToArtist(track.artist, track)} />;
          })}
        </div>
        {!tracks.length && <p className="py-5 text-sm text-ink-muted">{t("music.row.emptyRow")}</p>}
      </div>
    </div>
  </ModalShell>;
}
