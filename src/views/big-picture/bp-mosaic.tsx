import { memo, useMemo } from "react";
import type { Meta } from "@/lib/cinemeta";
import { bpCardArt, bpViewportWidth } from "./bp-art";
import { useBpDecorMotion } from "./bp-decor-motion";

const COLUMNS = 6;
const PER_COLUMN = 4;
const COL_VW = 11;
const SCALE = 1.55;

const MASK: Record<string, string> = {
  ambient: "radial-gradient(120% 100% at 50% 40%, #000 0%, rgba(0,0,0,0.55) 45%, transparent 78%)",
  stage: "radial-gradient(135% 115% at 50% 45%, #000 0%, rgba(0,0,0,0.72) 58%, transparent 92%)",
};

function BpMosaicBody({
  metas,
  posters: supplied,
  variant = "ambient",
}: {
  metas?: Meta[];
  posters?: readonly string[];
  variant?: "ambient" | "stage";
}) {
  const drift = useBpDecorMotion();
  const columns = useMemo(() => {
    const posters: readonly string[] =
      supplied ??
      ((metas ?? [])
        .map((m) => bpCardArt(m.poster, (COL_VW * SCALE * bpViewportWidth()) / 100))
        .filter(Boolean) as string[]);
    if (posters.length < COLUMNS * 2) return [];
    const out: string[][] = [];
    for (let c = 0; c < COLUMNS; c += 1) {
      const col: string[] = [];
      for (let i = 0; i < PER_COLUMN; i += 1) {
        col.push(posters[(c * PER_COLUMN + i) % posters.length]);
      }
      out.push([...col, ...col]);
    }
    return out;
  }, [metas, supplied]);

  if (columns.length === 0) return null;

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${
        variant === "stage" ? "opacity-[0.32]" : "opacity-[0.13]"
      }`}
      style={{ maskImage: MASK[variant], WebkitMaskImage: MASK[variant] }}
    >
      <div
        className="absolute left-1/2 top-1/2 flex gap-[1.6vw]"
        style={{ transform: `translate(-50%, -50%) rotate(-14deg) scale(${SCALE})` }}
      >
        {columns.map((col, ci) => (
          <div
            key={ci}
            className="flex flex-col gap-[1.6vw]"
            style={{
              width: `${COL_VW}vw`,
              animation: drift ? `bp-mosaic-drift ${74 + ci * 9}s linear infinite` : undefined,
              animationDirection: ci % 2 === 0 ? "normal" : "reverse",
            }}
          >
            {col.map((src, i) => (
              <img
                key={`${ci}-${i}`}
                src={src}
                alt=""
                loading="lazy"
                decoding="async"
                className="w-full rounded-md object-cover"
                style={{ aspectRatio: "2 / 3" }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export const BpMosaic = memo(BpMosaicBody);
