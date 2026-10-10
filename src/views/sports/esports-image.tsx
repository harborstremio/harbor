import { useState } from "react";
import { Shield } from "lucide-react";
import "./esports-image.css";

export function EsportsGameLogo({
  game,
}: {
  game: { id: string; logo: string; shortName: string };
}) {
  const [failed, setFailed] = useState(false);
  // Publisher wordmarks include very different transparent canvases. Display
  // their visible bounds without modifying or replacing the original artwork.
  const bounds: Record<string, [number, number, string]> = {
    cs2: [639, 360, "0 117 639 132"],
    r6: [640, 101, "344 26 278 54"],
    cod: [640, 360, "5 125 631 112"],
    apex: [640, 360, "42 0 557 359"],
    pubg: [640, 360, "18 77 603 205"],
  };
  const box = bounds[game.id];
  const className = `ea-game-logo ea-game-logo-${game.id}`;
  if (!box || failed)
    return (
      <EsportsImage
        src={failed ? undefined : game.logo}
        name={game.shortName}
        className={className}
      />
    );
  return (
    <span className={`ea-image ${className}`} aria-hidden="true">
      <svg viewBox={box[2]}>
        <image href={game.logo} width={box[0]} height={box[1]} onError={() => setFailed(true)} />
      </svg>
    </span>
  );
}

export function EsportsImage({
  src,
  name,
  className = "",
  fallback,
}: {
  src?: string;
  name: string;
  className?: string;
  fallback?: string;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const [loaded, setLoaded] = useState("");
  const url = [src, fallback].find((value) => value && !failed.includes(value));
  const ready = !!url && loaded === url;
  return (
    <span className={`ea-image ${className}`} aria-hidden="true" data-image-ready={ready}>
      {url && (
        <img
          key={url}
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(url)}
          onError={() => setFailed((prev) => [...prev, url])}
        />
      )}
      {!ready && (
        <span className="ea-image-fallback">
          <Shield size={32} />
          <b>
            {name
              .split(/\s+/)
              .slice(0, 2)
              .map((word) => word[0])
              .join("")
              .toUpperCase()}
          </b>
        </span>
      )}
    </span>
  );
}
