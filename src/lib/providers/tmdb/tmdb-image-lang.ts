import { loadStoredSettings } from "@/lib/settings/load";
import { normalizeLang } from "@/lib/subtitles/language";

export function imageLangPriority(): (string | null)[] {
  const names = loadStoredSettings().tmdbImageLangs ?? [];
  const out: (string | null)[] = [];
  for (const name of names) {
    if (/^original$/i.test(name.trim())) {
      if (!out.includes(null)) out.push(null);
      continue;
    }
    const code = normalizeLang(name);
    if (code && !out.includes(code)) out.push(code);
  }
  return out.length ? out : ["en", null];
}

function effectiveOrder(originalLang?: string | null): (string | null)[] {
  const orig = originalLang ? normalizeLang(originalLang) || originalLang : null;
  const order: (string | null)[] = [];
  const add = (c: string | null) => {
    if (!order.includes(c)) order.push(c);
  };
  for (const c of imageLangPriority()) {
    if (c === null) {
      if (orig) add(orig);
      add(null);
    } else add(c);
  }
  if (orig) add(orig);
  add(null);
  return order;
}

export function imageLangParam(originalLang?: string | null): string {
  return effectiveOrder(originalLang)
    .map((c) => c ?? "null")
    .join(",");
}

export function imageLangRank(
  iso: string | null | undefined,
  originalLang?: string | null,
): number {
  const order = effectiveOrder(originalLang);
  const idx = order.indexOf(iso ?? null);
  return idx === -1 ? -1 : order.length - idx;
}

export function imageRequestLang(): string {
  for (const c of imageLangPriority()) if (c) return c;
  return "";
}

export function pickedImageLangs(): string[] {
  return imageLangPriority().filter((c): c is string => c !== null);
}

export function shouldLocalizePosters(): boolean {
  const top = imageRequestLang();
  return !!top && top !== "en";
}
