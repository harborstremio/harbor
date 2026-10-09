import { useState } from "react";
import { Check, Heart, LoaderCircle } from "@/components/icons/music-icons";
import { useT } from "@/lib/i18n";
import { searchTyped } from "@/lib/music/catalog";
import { artistIdentityKey } from "@/lib/music/artist-authority";
import { toggleMusicLiked } from "@/lib/music/player";
import type { MusicTrack } from "@/lib/music/types";

type Song = { title: string; artist: string; album: string; artwork: string };
type State = "idle" | "saving" | "saved" | "error";

function bestMatch(tracks: MusicTrack[], song: Song): MusicTrack | null {
  const title = artistIdentityKey(song.title);
  const artist = artistIdentityKey(song.artist);
  const exact = tracks.find(
    (track) =>
      artistIdentityKey(track.title) === title && artistIdentityKey(track.artist) === artist,
  );
  if (exact) return exact;
  const loose = tracks.find(
    (track) =>
      artistIdentityKey(track.title).includes(title) ||
      title.includes(artistIdentityKey(track.title)),
  );
  return loose ?? tracks[0] ?? null;
}

export function SongIdSave({ song, compact }: { song: Song; compact: boolean }) {
  const t = useT();
  const [state, setState] = useState<State>("idle");

  const save = async () => {
    if (state === "saving" || state === "saved") return;
    setState("saving");
    try {
      const results = await searchTyped(`${song.artist} ${song.title}`.trim(), 12);
      const track = bestMatch(results.tracks, song);
      if (!track) throw new Error("no match");
      toggleMusicLiked(track);
      setState("saved");
    } catch {
      setState("error");
    }
  };

  const label =
    state === "saved"
      ? t("music.saved")
      : state === "error"
        ? t("music.action.error")
        : t("music.dock.part.like");

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={state === "saving" || state === "saved"}
      onClick={(event) => {
        event.stopPropagation();
        void save();
      }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-white/10 text-white/85 transition-colors hover:bg-white/20 hover:text-white disabled:opacity-100 ${compact ? "size-9" : "size-11"}`}
    >
      {state === "saving" ? (
        <LoaderCircle
          size={compact ? 16 : 18}
          aria-hidden="true"
          className="animate-spin motion-reduce:animate-none"
        />
      ) : state === "saved" ? (
        <Check size={compact ? 16 : 18} aria-hidden="true" />
      ) : (
        <Heart
          size={compact ? 16 : 18}
          aria-hidden="true"
          className={state === "error" ? "opacity-50" : undefined}
        />
      )}
    </button>
  );
}
