import { useState } from "react";
import { awardSourceMeta, type AwardSourceId, type AwardWin } from "@/lib/anime-awards";
import { useAwardIcon } from "@/lib/award-icons";

export function BpAwardSourceIcon({
  source,
  className = "",
  title,
}: {
  source: AwardSourceId;
  className?: string;
  title?: string;
}) {
  const [broken, setBroken] = useState("");
  const custom = useAwardIcon(source);
  const src = custom ?? awardSourceMeta(source).iconSmall;
  if (!src || broken === src) return null;
  // The bundled Kobe mark is dark monochrome and disappears against the canvas.
  const invert = !custom && source === "animation_kobe" ? "brightness-0 invert" : "";
  return (
    <img
      src={src}
      alt=""
      title={title}
      draggable={false}
      onError={() => setBroken(src)}
      className={`shrink-0 object-contain ${invert} ${className}`}
    />
  );
}

export function BpAwardIcon({ win, className }: { win: AwardWin; className?: string }) {
  return <BpAwardSourceIcon source={win.source} className={className} />;
}
