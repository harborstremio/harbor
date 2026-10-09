import { useEffect, useState } from "react";
import { cacheGet, cachePeek, cacheSet } from "@/lib/providers/tmdb/brand-cache";

export type LogoTone = "light" | "dark";

export const LOGO_FILTER: Record<LogoTone, string> = {
  light: "drop-shadow(0 4px 18px rgba(0,0,0,0.55))",
  dark: "grayscale(1) invert(1) contrast(1.15) drop-shadow(0 4px 18px rgba(0,0,0,0.55))",
};

const SAMPLE = 64;
const pending = new Map<string, Promise<LogoTone>>();

function probeUrl(src: string): string {
  const small = src.replace(/\/t\/p\/(w\d+|original)\//, "/t/p/w92/");
  return `${small}${small.includes("?") ? "&" : "?"}tone=1`;
}

function classify(data: Uint8ClampedArray): LogoTone {
  let opaque = 0;
  let faint = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 96) continue;
    opaque += 1;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const chroma = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    if (Math.max(lum, chroma * 0.9) < 0.42) faint += 1;
  }
  return opaque > 0 && faint / opaque > 0.5 ? "dark" : "light";
}

function measure(src: string): Promise<LogoTone> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) return resolve("light");
      try {
        const scale = Math.min(SAMPLE / img.naturalWidth, SAMPLE / img.naturalHeight, 1);
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve("light");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(classify(ctx.getImageData(0, 0, w, h).data));
      } catch {
        resolve("light");
      }
    };
    img.onerror = () => resolve("light");
    img.src = probeUrl(src);
  });
}

async function resolveTone(src: string): Promise<LogoTone> {
  const key = `tone:${src}`;
  const stored = await cacheGet<LogoTone>(key);
  if (stored) return stored;
  const tone = await measure(src);
  await cacheSet(key, tone);
  return tone;
}

export function logoTone(src: string): LogoTone | Promise<LogoTone> {
  const hit = cachePeek<LogoTone>(`tone:${src}`);
  if (hit) return hit;
  const running = pending.get(src);
  if (running) return running;
  const p = resolveTone(src).finally(() => pending.delete(src));
  pending.set(src, p);
  return p;
}

export function useLogoTone(src: string | null): LogoTone | null {
  const [tone, setTone] = useState<LogoTone | null>(() => (src ? cachePeek<LogoTone>(`tone:${src}`) : null));
  useEffect(() => {
    if (!src) return;
    const hit = logoTone(src);
    if (typeof hit === "string") {
      setTone(hit);
      return;
    }
    let alive = true;
    setTone(null);
    void hit.then((t) => {
      if (alive) setTone(t);
    });
    return () => {
      alive = false;
    };
  }, [src]);
  return src ? tone : null;
}
