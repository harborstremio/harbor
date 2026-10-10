import { Play } from "@/components/icons/music-icons";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { marqueeDurationMs } from "@/components/player/subtitle-menu/marquee-motion";
import { isRecentRelease } from "@/lib/music/release-recency";
import { Poster } from "@/components/poster";
import { Row } from "@/components/row";
import type { MusicTrack } from "@/lib/music/types";
import type { MusicBand, MusicBandContext } from "./music-band-types";
import "./music-new-release-ctas.css";

const MAX_CARDS = 10;

/** One card per release, not per track, so a six track drop does not fill the row with itself. */
function releases(tracks: readonly MusicTrack[]): MusicTrack[] {
  const seen = new Set<string>();
  const out: MusicTrack[] = [];
  for (const track of tracks.filter((track) => isRecentRelease(track.releaseDate))
    .sort((a, b) => b.releaseDate!.localeCompare(a.releaseDate!))) {
    const title = (track.album || track.title).trim();
    const artist = track.artist.trim();
    if (!title || !artist) continue;
    const key = `${artist.toLocaleLowerCase()}|${title.toLocaleLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(track);
    if (out.length >= MAX_CARDS) break;
  }
  return out;
}

function ReleaseTitle({ text }: { text: string }) {
  const viewport = useRef<HTMLSpanElement>(null);
  const line = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);
  useEffect(() => {
    const card = viewport.current?.closest("button");
    if (!card) return;
    const measure = () => {
      if (!viewport.current || !line.current) return;
      const overflow = Math.max(0, line.current.scrollWidth - viewport.current.clientWidth);
      setShift(getComputedStyle(line.current).direction === "rtl" ? overflow : -overflow);
    };
    const reset = () => setShift(0);
    card.addEventListener("pointerenter", measure);
    card.addEventListener("pointerleave", reset);
    card.addEventListener("focus", measure);
    card.addEventListener("blur", reset);
    return () => {
      card.removeEventListener("pointerenter", measure);
      card.removeEventListener("pointerleave", reset);
      card.removeEventListener("focus", measure);
      card.removeEventListener("blur", reset);
    };
  }, [text]);
  return <span className="music-cta-line" ref={viewport} title={text}>
    <span ref={line} dir="auto" className="harbor-marquee-line" data-marquee={shift !== 0 || undefined}
      style={shift ? ({ "--harbor-marquee": `${shift}px`, animationDuration: `${marqueeDurationMs(Math.abs(shift)) / 0.52}ms` } as CSSProperties) : undefined}>
      {text}
    </span>
  </span>;
}

export function newReleaseCtaBand(ctx: MusicBandContext): MusicBand | null {
  const cards = releases(ctx.data.fresh);
  if (cards.length < 2) return null;
  const t = ctx.t;
  return {
    key: "music:new-release-ctas",
    title: t("music.newRelease.title"),
    catalog: false,
    render: (title) => (
      <Row title={title} headerDescription={t("music.newRelease.subtitle")} min={340} shape="cta" scrollKey="music:newReleaseCtas">
        {cards.map((track) => (
          <button
            key={`${track.connectorId ?? ""}:${track.id}`}
            type="button"
            className="music-cta-card"
            onClick={() => ctx.playTrack(track, cards)}
            aria-label={t("music.newRelease.listen", { title: track.album || track.title })}
          >
            <span className="music-cta-art">
              <Poster src={track.artwork} seed={track.id} ratio="square" lazy className="h-full w-full [--poster-radius:0px]" />
            </span>
            <span className="music-cta-body">
              <span className="music-cta-eyebrow">{t("music.newRelease.eyebrow")}</span>
              <ReleaseTitle text={t("music.newRelease.outNow", { title: track.album || track.title })} />
              <span className="music-cta-artist">{track.artist}</span>
              <span className="music-cta-play">
                <Play size={13} fill="currentColor" aria-hidden="true" />
                {t("music.newRelease.action")}
              </span>
            </span>
          </button>
        ))}
      </Row>
    ),
  };
}
