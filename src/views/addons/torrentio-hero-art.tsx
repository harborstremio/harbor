import torrentioBannerLogo from "@/assets/addon-logos/torrentio.png";
import { useEffect, useState } from "react";

import { getCinemetaPosterCache, loadCinemetaPosters } from "./cinemeta-posters";

const POSTER_SLOTS = 18;

export function TorrentioHeroArt() {
  const [posters, setPosters] = useState<string[]>(() => getCinemetaPosterCache() ?? []);

  useEffect(() => {
    if (posters.length > 0) return;
    let cancelled = false;
    loadCinemetaPosters().then((list) => {
      if (cancelled) return;
      setPosters(list);
    });
    return () => {
      cancelled = true;
    };
  }, [posters.length]);

  const tiles = posters.slice(0, POSTER_SLOTS);

  return (
    <div className="pointer-events-none absolute inset-y-0 end-0 hidden w-[62%] md:block">
      {tiles.length > 0 && (
        <div
          className="absolute -inset-y-6 inset-x-0 grid auto-rows-fr grid-cols-6 gap-1.5 opacity-35"
          style={{
            maskImage:
              "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.15) 30%, rgba(0,0,0,0.65) 65%, black 100%)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.15) 30%, rgba(0,0,0,0.65) 65%, black 100%)",
          }}
        >
          {tiles.map((url, i) => (
            <div key={`${url}-${i}`} className="overflow-hidden rounded-md bg-elevated/30">
              <img
                src={url}
                alt=""
                draggable={false}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover saturate-[0.7] contrast-[0.9]"
              />
            </div>
          ))}
        </div>
      )}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to right, var(--color-surface) 0%, color-mix(in oklab, var(--color-surface) 75%, transparent) 45%, color-mix(in oklab, var(--color-surface) 35%, transparent) 100%)",
        }}
      />
      <div className="absolute inset-0 flex items-center justify-end pe-[8%]">
        <div className="relative">
          <div
            className="absolute -inset-16 rounded-full opacity-70"
            style={{
              background:
                "radial-gradient(closest-side, color-mix(in oklab, var(--color-accent) 40%, transparent), transparent 72%)",
            }}
          />
          <div
            className="relative flex h-[164px] w-[164px] items-center justify-center rounded-[36px] bg-canvas/95 ring-1"
            style={{
              boxShadow:
                "0 36px 80px -20px rgba(0,0,0,0.95), 0 0 0 1px color-mix(in oklab, var(--color-accent) 35%, transparent)",
            }}
          >
            <img src={torrentioBannerLogo} alt="" draggable={false} className="h-[120px] w-[120px] object-contain" />
          </div>
        </div>
      </div>
    </div>
  );
}
