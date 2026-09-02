import { registerUiCatalog, uiCatalogLoaded } from "./translate";
import type { UiLanguage } from "./languages";

type CatalogModule = { default: Record<string, string> };
type TranslatedLanguage = Exclude<UiLanguage, "en">;

const loaders = {
  ar: () => import("./locales/ar"),
  de: () => import("./locales/de"),
  es: () => import("./locales/es"),
  fr: () => import("./locales/fr"),
  hi: () => import("./locales/hi"),
  id: () => import("./locales/id"),
  it: () => import("./locales/it"),
  ja: () => import("./locales/ja"),
  ko: () => import("./locales/ko"),
  pl: () => import("./locales/pl"),
  pt: () => import("./locales/pt"),
  ru: () => import("./locales/ru"),
  tr: () => import("./locales/tr"),
  vi: () => import("./locales/vi"),
  zh: () => import("./locales/zh"),
} satisfies Record<TranslatedLanguage, () => Promise<CatalogModule>>;

const inflight = new Map<TranslatedLanguage, Promise<void>>();

/**
 * Fetch one non-English catalog on demand.
 *
 * English is compiled in and remains the fallback while a local catalog chunk
 * loads. Explicit import functions keep every unselected locale off the boot
 * path without hiding the available chunks from Vite.
 */
export function ensureUiLocale(lang: UiLanguage): Promise<void> {
  if (lang === "en" || uiCatalogLoaded(lang)) return Promise.resolve();
  const running = inflight.get(lang);
  if (running) return running;
  const load = loaders[lang]()
    .then((module) => registerUiCatalog(lang, module.default))
    .catch(() => {
      /* English is already the fallback, so a failed locale degrades, never breaks */
    })
    .finally(() => inflight.delete(lang));
  inflight.set(lang, load);
  return load;
}
