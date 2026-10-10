import { useEffect, useRef, useState, type CSSProperties } from "react";
import { MusicGlyph } from "@/components/icons/music-glyph";
import { useT } from "@/lib/i18n";
import "./music-like-burst.css";

const SPOKES = [0, 45, 90, 135, 180, 225, 270, 315];

/** The dock and Quick listen share the same artwork and one-shot animation. */
export function MusicLikeButton({ liked, onToggle, className, size, dock = false }: {
  liked: boolean;
  onToggle: () => void;
  className?: string;
  size: number;
  dock?: boolean;
}) {
  const t = useT();
  const sequence = useRef(0);
  const [burst, setBurst] = useState(0);
  useEffect(() => { if (!liked) setBurst(0); }, [liked]);
  return <button type="button" className={className} data-like-burst
    data-music-dock-like={dock || undefined} data-burst={liked && burst || undefined}
    data-music-tooltip={dock ? "" : undefined}
    aria-pressed={liked} aria-label={t(liked ? "music.unsaveTrack" : "music.saveTrack")}
    onClick={() => { setBurst(liked ? 0 : ++sequence.current); onToggle(); }}>
    <MusicGlyph key={`heart:${liked ? burst : 0}`} name={liked ? "heart-filled" : "heart"} size={size} aria-hidden="true" />
    {burst > 0 && liked && <span key={`burst:${burst}`} className="dock-like-burst" aria-hidden="true"
      onAnimationEnd={event => { if (event.animationName === "dock-like-ring") setBurst(current => current === burst ? 0 : current); }}>
      <span className="dock-like-ring" />
      {SPOKES.map((rotate, i) => <span key={rotate} className="dock-like-dot"
        style={{ "--rotate": `${rotate}deg`, "--translate-y": i % 2 ? "-16px" : "-21px" } as CSSProperties} />)}
    </span>}
  </button>;
}
