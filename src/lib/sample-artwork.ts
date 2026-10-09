import generalPoster from "@/assets/settings-preview/the-general-poster.webp";
import generalStill from "@/assets/settings-preview/the-general-still.webp";
import sherlockPoster from "@/assets/settings-preview/sherlock-jr-poster.webp";
import kidPoster from "@/assets/settings-preview/the-kid-poster.webp";
import safetyPoster from "@/assets/settings-preview/safety-last-poster.webp";
import namakuraStill from "@/assets/settings-preview/namakura-gatana.webp";
import { useEffect, useSyncExternalStore } from "react";
import { topSeries, topMovies, meta as cinemetaMeta, type Meta } from "@/lib/cinemeta";
import { useSettings } from "@/lib/settings";

export type SampleArtwork = { poster: string; background: string; logo: string | null };

const ARTWORK: SampleArtwork = {
  poster: generalPoster,
  background: generalStill,
  logo: null,
};

export function useSampleArtwork(index = 0): SampleArtwork & { name: string; description?: string } {
  const sample = useSettingsSampleMeta(index);
  return {
    poster: sample.poster || ARTWORK.poster,
    background: sample.background || sample.poster || ARTWORK.background,
    logo: sample.logo || null,
    name: sample.name,
    description: sample.description,
  };
}

export const SETTINGS_SAMPLE_META = {
  id: "settings-preview-the-general",
  type: "movie" as const,
  name: "The General",
  poster: generalPoster,
  background: generalStill,
  releaseInfo: "1926",
  description: "Buster Keaton sets off to recover his stolen locomotive.",
};

export const ANIME_PREVIEW = namakuraStill;

export const SETTINGS_FILMS = [
  { id: "the-general", name: "The General", poster: generalPoster },
  { id: "sherlock-jr", name: "Sherlock Jr.", poster: sherlockPoster },
  { id: "the-kid", name: "The Kid", poster: kidPoster },
  { id: "safety-last", name: "Safety Last!", poster: safetyPoster },
];

const FALLBACK: Meta[] = [SETTINGS_SAMPLE_META, ...SETTINGS_FILMS.slice(1).map((film) => ({ ...film, type: "movie" as const }))];
let samples: Meta[] = FALLBACK;
let refreshedAt = 0;
let pending: Promise<void> | undefined;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

// Some catalog image URLs return a successful, almost-solid title placeholder.
// Check the thumbnail itself rather than treating HTTP success as usable art.
function hasPosterArtwork(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    const finish = (usable: boolean) => {
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      resolve(usable);
    };
    const timer = setTimeout(() => finish(false), 8000);
    image.onerror = () => finish(false);
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 32;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return finish(true);
        context.drawImage(image, 0, 0, 32, 32);
        const pixels = context.getImageData(0, 0, 32, 32).data;
        let dark = 0;
        let light = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) < 24) dark++;
          if (Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) > 235) light++;
        }
        finish(dark / 1024 < 0.92 && light / 1024 < 0.92);
      } catch {
        // A provider without CORS can still supply a valid loaded image.
        finish(true);
      }
    };
    // Metahub's catalog URL redirects without a CORS header. The image host
    // itself allows pixel inspection, so bypass that redirect for this probe.
    image.src = src.replace(/^https:\/\/images\.metahub\.space\//i, "https://live.metahub.space/");
  });
}

async function previewPicks(items: Meta[], onBatch: (picks: Meta[]) => void): Promise<Meta[]> {
  const candidates = items.filter((item) => item.poster && item.background && Number(item.imdbRating) > 0 && !item.adult).slice(0, 20);
  const picks: Meta[] = [];
  for (let index = 0; index < candidates.length; index += 4) {
    const batch = candidates.slice(index, index + 4);
    const usable = await Promise.all(batch.map((item) => hasPosterArtwork(item.poster!)));
    picks.push(...batch.filter((_, i) => usable[i]));
    if (usable.some(Boolean)) onBatch([...picks]);
  }
  return picks;
}

// Share one catalog request across all mounted previews and settings navigation.
function refreshSamples(): Promise<void> {
  if (pending) return pending;
  if (Date.now() - refreshedAt < 60 * 60 * 1000) return Promise.resolve();
  pending = (async () => {
    const publish = (picks: Meta[]) => {
      samples = picks;
      listeners.forEach((listener) => listener());
    };
    // Unrated announcements often carry title-only placeholder artwork.
    let picks = await previewPicks(await topSeries().catch(() => []), publish);
    if (!picks.length) picks = await previewPicks(await topMovies().catch(() => []), publish);
    if (picks.length) {
      const first = picks[0];
      if (!first.background || !first.description) {
        const detail = await cinemetaMeta(first.type === "movie" ? "movie" : "series", first.id).catch(() => null);
        if (detail) {
          picks = [{ ...first, ...detail, poster: first.poster }, ...picks.slice(1)];
          publish(picks);
        }
      }
    }
    // Avoid repeatedly retrying an offline provider on every slider change.
    refreshedAt = Date.now();
  })().finally(() => { pending = undefined; });
  return pending;
}

export function useSettingsSamples(): Meta[] {
  const { settings } = useSettings();
  const current = useSyncExternalStore(subscribe, () => samples, () => FALLBACK);
  useEffect(() => {
    if (settings.cinemetaEnabled) void refreshSamples();
  }, [settings.cinemetaEnabled]);
  return settings.cinemetaEnabled ? current : FALLBACK;
}

export function useSettingsSampleMeta(index = 0): Meta {
  const current = useSettingsSamples();
  return current[index % current.length];
}
