import { useState } from "react";
import { ListMusic } from "@/components/icons/music-icons";
import { posterPlate } from "@/components/poster";
import { useProxiedImageSrc } from "@/lib/remote-image-proxy";

const GRID: Record<number, string> = {
  1: "grid-cols-1 grid-rows-1",
  2: "grid-cols-2 grid-rows-1",
  3: "grid-cols-2 grid-rows-2",
  4: "grid-cols-2 grid-rows-2",
};

export function MusicPlaylistCover({
  artwork,
  seed,
  className = "rounded-md",
  glyphSize = 24,
}: {
  artwork: readonly (string | null | undefined)[];
  seed: string;
  className?: string;
  glyphSize?: number;
}) {
  const tiles: string[] = [];
  for (const url of artwork) {
    if (typeof url !== "string") continue;
    const trimmed = url.trim();
    if (!trimmed || tiles.includes(trimmed)) continue;
    tiles.push(trimmed);
    if (tiles.length === 4) break;
  }

  return (
    <span className={`relative block w-full overflow-hidden bg-elevated ${className}`}>
      <span aria-hidden="true" className="block" style={{ paddingTop: "100%" }} />
      {tiles.length === 0 ? (
        <span className="absolute inset-0 grid place-items-center text-ink-subtle">
          <ListMusic size={glyphSize} aria-hidden="true" />
        </span>
      ) : (
        <span className={`absolute inset-0 grid ${GRID[tiles.length] ?? GRID[4]}`}>
          {tiles.map((url, index) => (
            <MosaicTile
              key={`${index}:${url}`}
              src={url}
              seed={`${seed}:${index}`}
              span={tiles.length === 3 && index === 2}
            />
          ))}
        </span>
      )}
    </span>
  );
}

function MosaicTile({ src, seed, span }: { src: string; seed: string; span: boolean }) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const resolved = useProxiedImageSrc(src);
  return (
    <span
      className={`relative block overflow-hidden ${span ? "col-span-2" : ""}`}
      style={state === "failed" ? { background: posterPlate(seed) } : undefined}
    >
      {state !== "ready" && state !== "failed" && (
        <span aria-hidden="true" className="harbor-shimmer absolute inset-0" />
      )}
      {state !== "failed" && resolved && (
        <img
          key={resolved}
          src={resolved}
          alt=""
          aria-hidden="true"
          draggable={false}
          loading="lazy"
          decoding="async"
          onLoad={() => setState("ready")}
          onError={() => setState("failed")}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ease-out ${
            state === "ready" ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </span>
  );
}
