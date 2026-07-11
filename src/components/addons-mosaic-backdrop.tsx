import { listAddons, type SAAddon } from "@/lib/providers/stremio-addons";
import { useEffect, useMemo, useState } from "react";

const SLOT_COUNT = 6;

type Slot = {
  url: string;
  top: string;
  left: string;
  size: number;
  rotate: number;
  hue: number;
};

const POSITIONS: Array<{ top: string; left: string }> = [
  { top: "4%", left: "8%" },
  { top: "10%", left: "62%" },
  { top: "18%", left: "30%" },
  { top: "32%", left: "78%" },
  { top: "44%", left: "12%" },
  { top: "52%", left: "44%" },
  { top: "66%", left: "72%" },
  { top: "78%", left: "20%" },
  { top: "84%", left: "58%" },
];

export function AddonsMosaicBackdrop() {
  const [slots, setSlots] = useState<Slot[]>([]);

  useEffect(() => {
    let cancelled = false;
    listAddons({ sort_by: "stars", order: "desc", limit: 50, nsfw: "exclude" })
      .then((res) => {
        if (cancelled) return;
        const seen = new Set<string>();
        const usable: SAAddon[] = [];
        for (const a of res.addons) {
          const logo = a.manifest?.logo;
          if (!logo) continue;
          const u = String(logo);
          if (seen.has(u)) continue;
          seen.add(u);
          usable.push(a);
          if (usable.length >= SLOT_COUNT) break;
        }
        if (cancelled) return;
        const next = usable.map((a, i) => buildSlot(a, i));
        setSlots(next);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fade = useMemo(
    () =>
      "radial-gradient(ellipse 80% 60% at 50% 0%, transparent 0%, var(--color-canvas) 70%), linear-gradient(180deg, transparent 0%, transparent 30%, var(--color-canvas) 100%)",
    [],
  );

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" style={{ contain: "strict" }}>
      <div className="absolute inset-0" style={{ background: "var(--color-canvas)" }} />
      <div className="absolute inset-0">
        {slots.map((s, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              top: s.top,
              left: s.left,
              width: s.size,
              height: s.size,
              transform: `rotate(${s.rotate}deg)`,
              filter: `blur(40px) saturate(1.4) hue-rotate(${s.hue}deg)`,
              opacity: 0.18,
              backgroundImage: `url(${s.url})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              borderRadius: "50%",
            }}
          />
        ))}
      </div>
      <div className="absolute inset-0" style={{ background: fade }} />
    </div>
  );
}

function buildSlot(a: SAAddon, i: number): Slot {
  const pos = POSITIONS[i % POSITIONS.length];
  const seed = hashString(a.slug);
  return {
    url: a.manifest!.logo!,
    top: pos.top,
    left: pos.left,
    size: 320 + (seed % 5) * 40,
    rotate: ((seed >> 3) % 60) - 30,
    hue: ((seed >> 5) % 60) - 30,
  };
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}
