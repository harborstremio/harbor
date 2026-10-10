import { ListPlus } from "@/components/icons/music-icons";
import { useT } from "@/lib/i18n";
import { useMusicPlaylistPicker } from "./music-playlist-picker";
import type { MusicTrack } from "@/lib/music/types";

/** The watch page uses the same searchable destinations as every music track menu. */
export function MusicAddToPlaylist({ track }: { track: MusicTrack }) {
  const t = useT();
  const { openPlaylistPicker } = useMusicPlaylistPicker();
  return <button type="button" onClick={() => openPlaylistPicker(track)}
    className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] text-ink-muted ring-1 ring-white/10 transition-colors hover:text-ink">
    <ListPlus className="size-4" aria-hidden />{t("music.playlist.save")}
  </button>;
}