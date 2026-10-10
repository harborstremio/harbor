import { Poster } from "@/components/poster";
import { HarborMark } from "@/components/icons/harbor-mark";
import { MusicPlaylistCover } from "./music-playlist-cover";
import "./music-mix-cover.css";

const ACCENTS = [
  "#4ad2c9",
  "#f5d90a",
  "#e8482f",
  "#c86bfa",
  "#7be04b",
  "#ff8cc6",
] as const;

export function mixAccent(index: number): string {
  return ACCENTS[(index - 1) % ACCENTS.length];
}

export function MusicMixCover({
  artwork,
  index,
  label,
  seed,
  portrait = false,
  numbered = true,
}: {
  artwork: readonly string[];
  index: number;
  label: string;
  seed: string;
  portrait?: boolean;
  numbered?: boolean;
}) {
  const accent = mixAccent(index);
  return (
    <span className="music-mix-cover" data-portrait={portrait || undefined} style={{ "--mix-accent": accent } as React.CSSProperties}>
      {portrait ? <Poster src={artwork[0] ?? ""} seed={seed} ratio="square" className="w-full rounded-md" /> : <MusicPlaylistCover artwork={artwork} seed={seed} className="rounded-md" />}
      <HarborMark className="music-mix-cover-mark" />
      <span className="music-mix-cover-band" aria-hidden="true">
        <span className="music-mix-cover-name">{label}</span>
        {numbered && <span className="music-mix-cover-index">{String(index).padStart(2, "0")}</span>}
      </span>
    </span>
  );
}
