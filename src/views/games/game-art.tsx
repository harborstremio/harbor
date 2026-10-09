import { useState } from "react";
import { gameLogoShape } from "@/lib/games/logo-art";

const unavailable = new Set<string>();

export function GameArt({ src, fallback, alt = "", className = "", eager = false, logo = false }: {
  src: string; fallback?: string; alt?: string; className?: string; eager?: boolean; logo?: boolean;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const [loaded, setLoaded] = useState("");
  const [shape, setShape] = useState<"compact" | "wide">("compact");
  const source = [src, fallback].find(url => url && !failed.includes(url) && !unavailable.has(url));
  if (!source) return <span className={`${className} games-art-empty`} aria-hidden="true" />;
  // Identity logos are hidden until decoded; native lazy loading cannot observe a hidden image.
  return <img className={className} src={source} alt={alt} loading={eager || logo ? "eager" : "lazy"} data-loaded={loaded === source}
    data-logo-shape={logo && loaded === source ? shape : undefined}
    decoding="async" onLoad={event => { setLoaded(source); if (logo) setShape(gameLogoShape(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)); }} onError={() => {
      unavailable.add(source);
      if (unavailable.size > 200) unavailable.delete(unavailable.values().next().value!);
      setFailed(previous => [...previous, source]);
    }} />;
}
