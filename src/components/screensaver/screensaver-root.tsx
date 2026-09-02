import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useBigPicture } from "@/lib/big-picture";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { useIdleScreensaver } from "@/lib/screensaver/use-idle-screensaver";
import type { AmbientItem } from "./ambient-overlay";

const AmbientOverlay = lazy(() =>
  import("./ambient-overlay").then((m) => ({ default: m.AmbientOverlay })),
);

const EXIT_MS = 460;

function toItems(metas: Meta[]): AmbientItem[] {
  const out: AmbientItem[] = [];
  const seen = new Set<string>();
  for (const m of metas) {
    if (!m.background || seen.has(m.background)) continue;
    seen.add(m.background);
    const r = m as Meta & { rank?: number; rankLabel?: string };
    const sub =
      typeof r.rank === "number" && r.rankLabel ? `#${r.rank} in ${r.rankLabel} today` : "";
    out.push({ bg: m.background, title: m.name ?? "", sub });
    if (out.length >= 16) break;
  }
  return out;
}

export function ScreensaverRoot() {
  const { settings } = useSettings();
  const { player, picker, topKind } = useView();
  const { active: bigPicture } = useBigPicture();
  const enabled = settings.screensaver;
  const delayMs = Math.max(1, settings.screensaverDelayMin || 5) * 60000;
  // Big Picture claims keydown in the capture phase, so this hook's bubble
  // listeners never see its navigation and it would idle out mid use.
  const suppressed =
    bigPicture || !!player || !!picker || topKind === "live" || topKind === "vod";
  const { active, dismiss } = useIdleScreensaver(enabled, delayMs, suppressed);

  const [items, setItems] = useState<AmbientItem[]>([]);
  const fetchedRef = useRef(false);
  const reduce = useMemo(
    () =>
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  useEffect(() => {
    fetchedRef.current = false;
  }, [settings.heroFeed]);

  useEffect(() => {
    if (!enabled) return;
    const warm = window.setTimeout(() => void import("./ambient-overlay"), 3000);
    return () => window.clearTimeout(warm);
  }, [enabled]);

  useEffect(() => {
    if (!active || fetchedRef.current) return;
    fetchedRef.current = true;
    let cancelled = false;
    const source = settings.heroFeed === "classic" ? "trending" : settings.heroFeed;
    void import("@/lib/feed/hero-pool")
      .then((m) => m.fetchHeroFeed(source))
      .then((metas) => {
        if (!cancelled) setItems(toItems(metas));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [active, settings.heroFeed]);

  const wantShow = active && !suppressed && items.length > 0;
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (wantShow) {
      setMounted(true);
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const id = window.setTimeout(() => setMounted(false), suppressed ? 0 : EXIT_MS);
    return () => window.clearTimeout(id);
  }, [wantShow, suppressed]);

  if (!mounted || suppressed) return null;
  return (
    <Suspense fallback={null}>
      <AmbientOverlay items={items} reduce={reduce} visible={visible} onDismiss={dismiss} neverDeep />
    </Suspense>
  );
}
