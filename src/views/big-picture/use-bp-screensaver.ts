import { useCallback, useEffect, useRef, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import type { AmbientItem } from "@/components/screensaver/ambient-overlay";
import { useBpT } from "./bp-i18n";

const TICK_MS = 4000;
const MAX_ITEMS = 16;
const ACTIVITY = ["pointerdown", "pointermove", "wheel", "touchstart", "keydown"] as const;

type RankedMeta = Meta & { rank?: number; rankLabel?: string };

function toItems(metas: Meta[], sub: (m: RankedMeta) => string): AmbientItem[] {
  const out: AmbientItem[] = [];
  const seen = new Set<string>();
  for (const m of metas as RankedMeta[]) {
    if (!m.background || seen.has(m.background)) continue;
    seen.add(m.background);
    out.push({ bg: m.background, title: m.name ?? "", sub: sub(m) });
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

export function useBpScreensaver(blocked: boolean): {
  active: boolean;
  items: AmbientItem[];
  wake: () => void;
} {
  const t = useBpT();
  const tRef = useRef(t);
  tRef.current = t;
  const { settings } = useSettings();
  const { player, picker, topKind } = useView();
  const enabled = settings.screensaver;
  const delayMs = Math.max(1, settings.screensaverDelayMin || 5) * 60000;
  const suppressed = blocked || !!player || !!picker || topKind === "live" || topKind === "vod";

  const [active, setActive] = useState(false);
  const [items, setItems] = useState<AmbientItem[]>([]);
  const activeRef = useRef(false);
  activeRef.current = active;
  const lastRef = useRef(0);
  const fetchedRef = useRef("");

  const wake = useCallback(() => {
    lastRef.current = performance.now();
    setActive(false);
  }, []);

  useEffect(() => {
    if (!enabled || suppressed) {
      setActive(false);
      return;
    }
    lastRef.current = performance.now();
    const seen = () => document.visibilityState === "visible";
    // Big Picture claims window keydown in the capture phase and stops
    // propagation, so a bubble listener never sees arrow navigation at all.
    for (const ev of ACTIVITY) {
      window.addEventListener(ev, wake, { passive: true, capture: true });
    }
    const bump = () => {
      if (seen()) lastRef.current = performance.now();
    };
    window.addEventListener("focus", bump);
    document.addEventListener("visibilitychange", bump);
    const id = window.setInterval(() => {
      if (activeRef.current || !seen()) return;
      if (performance.now() - lastRef.current >= delayMs) setActive(true);
    }, TICK_MS);
    return () => {
      for (const ev of ACTIVITY) window.removeEventListener(ev, wake, true);
      window.removeEventListener("focus", bump);
      document.removeEventListener("visibilitychange", bump);
      window.clearInterval(id);
    };
  }, [enabled, suppressed, delayMs, wake]);

  useEffect(() => {
    if (!active) return;
    const source = settings.heroFeed === "classic" ? "trending" : settings.heroFeed;
    if (fetchedRef.current === source) return;
    fetchedRef.current = source;
    let cancelled = false;
    // The claim is only kept when usable art actually arrived. Holding it after
    // a failure would leave items empty and the saver off for the whole session.
    const release = () => {
      if (fetchedRef.current === source) fetchedRef.current = "";
    };
    void import("@/lib/feed/hero-pool")
      .then((m) => m.fetchHeroFeed(source))
      .then((metas) => {
        const next = toItems(metas, (m) =>
          typeof m.rank === "number" && m.rankLabel
            ? tRef.current("#{rank} in {list} today", { rank: m.rank, list: m.rankLabel })
            : "",
        );
        if (cancelled || next.length === 0) {
          release();
          return;
        }
        setItems(next);
      })
      .catch(release);
    return () => {
      cancelled = true;
    };
  }, [active, settings.heroFeed]);

  return { active, items, wake };
}
