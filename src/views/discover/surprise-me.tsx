import { Dices } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePosterChain } from "@/components/poster";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function SurpriseMe({ pool }: { pool: Meta[] }) {
  const t = useT();
  const { openMeta } = useView();
  const lastRef = useRef<string | null>(null);
  const [tiles, setTiles] = useState<Meta[]>([]);

  useEffect(() => {
    if (tiles.length === 0 && pool.length > 0) setTiles(shuffle(pool).slice(0, 18));
  }, [pool, tiles.length]);

  const surprise = () => {
    if (!pool.length) return;
    let pick = pool[Math.floor(Math.random() * pool.length)];
    if (pool.length > 1) {
      while (pick.id === lastRef.current) pick = pool[Math.floor(Math.random() * pool.length)];
    }
    lastRef.current = pick.id;
    setTiles(shuffle(pool).slice(0, 18));
    openMeta(pick);
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <h2 className="text-[15px] font-semibold tracking-tight text-ink">{t("Can't decide?")}</h2>
      <button
        onClick={surprise}
        className="group relative flex min-h-[56px] flex-1 items-center overflow-hidden rounded-2xl ring-1 ring-edge-soft/50"
      >
        <div className="absolute inset-0 flex">
          {tiles.map((m, i) => (
            <SurpriseTile key={`${m.id}-${i}`} meta={m} />
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-canvas via-canvas/85 to-canvas/30" />
        <div className="relative flex items-center gap-3 px-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-canvas shadow-[0_6px_18px_-6px_rgba(0,0,0,0.6)] transition-transform duration-300 group-hover:rotate-[18deg] group-active:scale-90">
            <Dices size={18} strokeWidth={2.2} />
          </span>
          <span className="flex flex-col text-start leading-tight">
            <span className="text-[14px] font-semibold text-ink">{t("Surprise me")}</span>
            <span className="text-[11.5px] text-ink-muted">{t("Pick a random title")}</span>
          </span>
        </div>
      </button>
    </div>
  );
}

function SurpriseTile({ meta }: { meta: Meta }) {
  const { settings } = useSettings();
  const poster = usePosterChain(
    settings.rpdbKey,
    meta.id,
    meta.poster,
    meta.type === "series" ? "series" : "movie",
  );
  return (
    <img
      src={poster.src}
      alt=""
      draggable={false}
      loading="lazy"
      onError={poster.onError}
      className="h-full min-w-0 flex-1 object-cover transition-transform duration-700 group-hover:scale-[1.04]"
    />
  );
}
