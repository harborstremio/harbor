import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useSettings } from "@/lib/settings";
import { useIdleScreensaver } from "@/lib/screensaver/use-idle-screensaver";
import { useView } from "@/lib/view";
import type { AmbientItem } from "./ambient-overlay";

const AmbientOverlay = lazy(() =>
  import("./ambient-overlay").then((module) => ({ default: module.AmbientOverlay })),
);

const EXIT_MS = 460;

function toItems(metas: Meta[]): AmbientItem[] {
  const items: AmbientItem[] = [];
  const seen = new Set<string>();

  for (const meta of metas) {
    if (!meta.background || seen.has(meta.background)) continue;
    seen.add(meta.background);
    items.push({
      bg: meta.background,
      title: meta.name ?? "",
      sub: meta.releaseInfo ?? "",
    });
    if (items.length >= 16) break;
  }

  return items;
}

export function ScreensaverRoot() {
  const { settings } = useSettings();
  const { player, picker, topKind } = useView();
  const enabled = settings.screensaver;
  const delayMs = Math.max(1, settings.screensaverDelayMin || 5) * 60_000;
  const suppressed = !!player || !!picker || topKind === "live" || topKind === "vod";
  const { active, dismiss } = useIdleScreensaver(enabled, delayMs, suppressed);
  const [items, setItems] = useState<AmbientItem[]>([]);
  const fetchedForSession = useRef(false);
  const reduce = useMemo(
    () =>
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  useEffect(() => {
    if (!active || suppressed) {
      fetchedForSession.current = false;
      return;
    }
    if (fetchedForSession.current) return;
    fetchedForSession.current = true;

    let cancelled = false;
    void import("@/lib/feed/featured")
      .then(({ buildFeaturedFast }) => buildFeaturedFast(settings.tmdbKey, settings))
      .then(({ featured, reserve }) => {
        if (!cancelled) setItems(toItems([...featured, ...reserve]));
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });

    return () => {
      cancelled = true;
    };
  }, [active, settings, suppressed]);

  const wantShow = active && enabled && !suppressed && items.length > 0;
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let visibilityFrame: number | null = null;
    if (wantShow) {
      const mountFrame = requestAnimationFrame(() => {
        setMounted(true);
        visibilityFrame = requestAnimationFrame(() => setVisible(true));
      });
      return () => {
        cancelAnimationFrame(mountFrame);
        if (visibilityFrame != null) cancelAnimationFrame(visibilityFrame);
      };
    }

    const hideFrame = requestAnimationFrame(() => setVisible(false));
    const timeout = window.setTimeout(() => setMounted(false), suppressed ? 0 : EXIT_MS);
    return () => {
      cancelAnimationFrame(hideFrame);
      window.clearTimeout(timeout);
    };
  }, [suppressed, wantShow]);

  if (!mounted || suppressed) return null;
  return (
    <Suspense fallback={null}>
      <AmbientOverlay items={items} reduce={reduce} visible={visible} onDismiss={dismiss} />
    </Suspense>
  );
}
