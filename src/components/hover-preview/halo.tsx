import type { PreviewArt } from "@/lib/hover-preview/preview-data";
import {
  EASE_OUT,
  HALO_BLUR_PX,
  HALO_INSET_PX,
  HALO_MORPH_MS,
  HALO_OPACITY,
  HALO_SATURATE,
} from "@/lib/hover-preview/timing";
import { forwardRef, useEffect, useRef, useState } from "react";

import { posterPlate } from "../poster";

type HaloSource = { art: PreviewArt; seed: string };

function sameSource(a: HaloSource, b: HaloSource): boolean {
  return a.art.mode === b.art.mode && a.art.src === b.art.src && a.seed === b.seed;
}

function haloStyle(source: HaloSource): React.CSSProperties {
  const base: React.CSSProperties = {
    filter: `blur(${HALO_BLUR_PX}px) saturate(${HALO_SATURATE})`,
  };
  if (source.art.src) {
    base.backgroundImage = `url(${source.art.src})`;
    base.backgroundSize = "cover";
    base.backgroundPosition = "center";
  } else {
    base.background = posterPlate(source.seed);
  }
  return base;
}

export const PreviewHalo = forwardRef<HTMLDivElement, HaloSource>(function PreviewHalo({ art, seed }, ref) {
  const [stack, setStack] = useState<Array<{ key: number; source: HaloSource }>>([{ key: 0, source: { art, seed } }]);
  const nextKey = useRef(1);
  const last = useRef<HaloSource>({ art, seed });
  const incomingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const source = { art, seed };
    if (sameSource(last.current, source)) return;
    last.current = source;
    setStack((s) => [...s.slice(-1), { key: nextKey.current++, source }]);
  }, [art, seed]);

  useEffect(() => {
    if (stack.length < 2) return;
    const el = incomingRef.current;
    if (!el) return;
    const anim = el.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: HALO_MORPH_MS,
      easing: EASE_OUT,
      fill: "backwards",
    });
    anim.onfinish = () => setStack((s) => s.slice(-1));
    return () => anim.cancel();
  }, [stack]);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute overflow-hidden rounded-2xl"
      style={{ inset: HALO_INSET_PX, opacity: HALO_OPACITY }}
    >
      {stack.map((item, i) => (
        <div
          key={item.key}
          ref={i === stack.length - 1 && i > 0 ? incomingRef : undefined}
          className="absolute inset-0"
        >
          <div className="absolute inset-0 scale-[1.15]" style={haloStyle(item.source)} />
        </div>
      ))}
    </div>
  );
});
