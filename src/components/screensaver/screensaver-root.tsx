import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useBigPicture } from "@/lib/big-picture";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { usePlaybackStatus } from "@/lib/player/playback-clock";
import { useIdleScreensaver } from "@/lib/screensaver/use-idle-screensaver";
import { activeScreensaverMedia, onScreensaverPreview } from "@/lib/screensaver/media";
import type { AmbientItem } from "./ambient-overlay";

const CatBoatOverlay = lazy(() =>
  import("./cat-boat-overlay").then((m) => ({ default: m.CatBoatOverlay })),
);

const AmbientOverlay = lazy(() =>
  import("./ambient-overlay").then((m) => ({ default: m.AmbientOverlay })),
);

const CustomMediaOverlay = lazy(() =>
  import("./custom-media-overlay").then((m) => ({ default: m.CustomMediaOverlay })),
);

const HalloweenOverlay = lazy(() =>
  import("./halloween-overlay").then((m) => ({ default: m.HalloweenOverlay })),
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
  const playerStatus = usePlaybackStatus();
  const enabled = settings.screensaver;
  const catBoat = settings.screensaverStyle === "catBoat";
  const halloween = settings.screensaverStyle === "halloween";
  const [failedId, setFailedId] = useState<string | null>(null);
  const picked =
    settings.screensaverStyle === "custom"
      ? activeScreensaverMedia(settings.screensaverMedia, settings.screensaverMediaId)
      : null;
  const customMedia = picked && picked.id !== failedId ? picked : null;
  const ambient = !catBoat && !halloween && !customMedia;
  const delayMs = Math.max(1, settings.screensaverDelayMin || 5) * 60000;
  // Big Picture claims keydown in the capture phase, so this hook's bubble
  // listeners never see its navigation and it would idle out mid use.
  // Suppress while the player is actively playing (an idle ambient overlay
  // over moving video would obscure the content), but allow it once playback
  // is paused or stopped so an idle viewer still gets the screensaver.
  const activelyPlaying = !!player && playerStatus === "playing";
  const suppressed =
    bigPicture || activelyPlaying || !!picker || topKind === "live" || topKind === "vod";
  const { active, dismiss } = useIdleScreensaver(enabled, delayMs, suppressed);
  const [preview, setPreview] = useState(false);
  useEffect(() => onScreensaverPreview(() => setPreview(true)), []);
  useEffect(() => {
    if (!preview) return;
    const armedAt = performance.now() + 700;
    const stop = () => {
      if (performance.now() < armedAt) return;
      setPreview(false);
    };
    const events = ["pointerdown", "keydown", "wheel"] as const;
    for (const ev of events) window.addEventListener(ev, stop, true);
    return () => {
      for (const ev of events) window.removeEventListener(ev, stop, true);
    };
  }, [preview]);
  const showing = active || preview;
  const dismissAll = () => {
    dismiss();
    setPreview(false);
  };

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
    const warm = window.setTimeout(
      () =>
        void (catBoat
          ? import("./cat-boat-overlay")
          : halloween
            ? import("./halloween-overlay")
          : customMedia
            ? import("./custom-media-overlay")
            : import("./ambient-overlay")),
      3000,
    );
    return () => window.clearTimeout(warm);
  }, [enabled, catBoat, halloween, customMedia]);

  useEffect(() => {
    if (!ambient || !showing || fetchedRef.current) return;
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
  }, [showing, settings.heroFeed, ambient]);

  const wantShow =
    showing && !suppressed && (catBoat || halloween || !!customMedia || items.length > 0);
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
      {catBoat ? (
        <CatBoatOverlay reduce={reduce} visible={visible} onDismiss={dismissAll} />
      ) : halloween ? (
        <HalloweenOverlay reduce={reduce} visible={visible} onDismiss={dismissAll} />
      ) : customMedia ? (
        <CustomMediaOverlay
          media={customMedia}
          visible={visible}
          onDismiss={dismissAll}
          onFail={() => setFailedId(customMedia.id)}
        />
      ) : (
        <AmbientOverlay
          items={items}
          reduce={reduce}
          visible={visible}
          onDismiss={dismissAll}
          neverDeep
        />
      )}
    </Suspense>
  );
}
