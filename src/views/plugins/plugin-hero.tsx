import { useCallback, useEffect, useState } from "react";
import { meta as fetchMeta, narrowMediaType, type Meta } from "@/lib/cinemeta";
import { shuffle } from "@/lib/feed/tags";
import { browseFetcher, type BrowseCatalog } from "@/lib/catalog-browse";
import { HeroCarousel, type Slide } from "@/components/hero-carousel";
import { useSettings } from "@/lib/settings";
import { tmdbLogo, tmdbMovieImages } from "@/lib/providers/tmdb/tmdb-images";
import { loadCapstanDetail } from "@/lib/streams/plugins/extension/detail";

/** How many rows the hero reads from. Each is a request to someone's service, so it takes a few
 * rows of the selection rather than all of them; the rails below read the same first pages and
 * both go through one cache, so those reads cost a provider nothing on their own. */
const HERO_ROWS = 6;
/** As many slides as the home hero keeps. Each slide is a title whose own page is opened to find
 * its artwork, so this is also the number of items the hero asks a provider about. */
const HERO_SLIDES = 4;

/** The rows to read, one from each plugin before any plugin's second. Rows are listed plugin by
 * plugin, so taking them in that order would let one plugin with many rows fill the whole hero
 * and the selection would never be mixed. */
function rowsAcrossPlugins(catalogs: BrowseCatalog[], take: number): BrowseCatalog[] {
  const byPlugin = new Map<string, BrowseCatalog[]>();
  for (const cat of catalogs) {
    const held = byPlugin.get(cat.addonName);
    if (held) held.push(cat);
    else byPlugin.set(cat.addonName, [cat]);
  }
  const groups = [...byPlugin.values()];
  const out: BrowseCatalog[] = [];
  for (let depth = 0; out.length < take; depth++) {
    let reached = false;
    for (const group of groups) {
      const cat = group[depth];
      if (!cat) continue;
      reached = true;
      out.push(cat);
      if (out.length >= take) break;
    }
    if (!reached) break;
  }
  return out;
}

/** How many of the four slides may come from one plugin. The hero draws on several, and a hero
 * made of one plugin twice over is not what "all plugins" means. */
const MAX_PER_PLUGIN = 2;
/** How many items to remember from each row. Only the first page of a row was read, and only the
 * chosen items have their own page opened below, so sampling more than is used is free and gives
 * the choice something to choose from. */
const POOL_PER_ROW = 2;

function pluginOf(meta: Meta): string {
  return meta.addonOrigin?.id ?? meta.addonOrigin?.name ?? "";
}

/** A few items from each row of the selection, taken at random. A row is ordered by whatever the
 * provider thinks is best today, so taking its first item would put the same titles in the hero
 * on every visit. */
function poolFromRows(settled: PromiseSettledResult<Meta[]>[], perRow: number): Meta[] {
  const seen = new Set<string>();
  const out: Meta[] = [];
  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    // A slide is artwork, and a row without any is still a rail below.
    const usable = result.value.filter(
      (meta) => (meta.background || meta.poster) && !seen.has(meta.id),
    );
    // shuffle reorders the array it is handed, so it is handed a copy.
    for (const meta of shuffle([...usable]).slice(0, perRow)) {
      if (seen.has(meta.id)) continue;
      seen.add(meta.id);
      out.push(meta);
    }
  }
  return out;
}

/** Up to `take` items, never more than `cap` from any one plugin. */
function pickAcrossPlugins(pool: Meta[], take: number, cap: number): Meta[] {
  const taken = new Map<string, number>();
  const out: Meta[] = [];
  for (const meta of shuffle([...pool])) {
    const plugin = pluginOf(meta);
    const held = taken.get(plugin) ?? 0;
    if (held >= cap) continue;
    taken.set(plugin, held + 1);
    out.push(meta);
    if (out.length >= take) break;
  }
  return out;
}

/** What the hero shows for one item. A catalogue row carries a name and a poster and nothing
 * else; the rest -- artwork, logo, plot, year, runtime -- is on the item's own page, or held
 * against the title's own ids, which is where the home hero reads the same things from. */
async function slideFor(meta: Meta, tmdbKey: string): Promise<Meta> {
  const detail = await loadCapstanDetail(meta.id, meta.type, meta.addonOrigin).catch(() => null);
  const provider = detail?.meta;
  const canonical = detail?.canonicalId ?? null;

  let art = provider?.background;
  let logo: string | undefined;
  let title: Meta | null = null;
  if (canonical?.startsWith("tmdb:")) {
    // Both read the same asset request, so the second of these is answered from the first.
    const [urls, fromTmdb] = await Promise.all([
      tmdbMovieImages(tmdbKey, canonical).catch(() => [] as string[]),
      tmdbLogo(tmdbKey, canonical).catch(() => undefined),
    ]);
    art ??= urls[0];
    logo = fromTmdb;
  } else if (canonical) {
    const found = await fetchMeta(narrowMediaType(meta.type), canonical).catch(() => null);
    if (found) {
      title = found;
      art ??= found.background;
      logo = found.logo;
    }
  }

  return {
    ...meta,
    background: art,
    // A provider names no logo of its own, so this is the title's wordmark or nothing.
    logo: logo ?? meta.logo,
    // A provider wrote its own plot and year where it had them; the title's record fills the gaps.
    description: provider?.description ?? title?.description ?? meta.description,
    releaseInfo: provider?.releaseInfo ?? title?.releaseInfo ?? meta.releaseInfo,
    runtime: provider?.runtime ?? title?.runtime ?? meta.runtime,
  };
}

/** What the plugins have put up, as the home page's hero shows it.
 *
 * The pool is whatever the rows in view hold, so a chosen plugin's hero is made of that plugin's
 * items and nobody else's, and changing the choice changes what is featured. */
export function PluginHero({
  catalogs,
  showOrigin = false,
}: {
  catalogs: BrowseCatalog[];
  /** Whether to name the plugin each slide came from. Only worth it when the hero draws on
   * several of them: a selection that is one plugin puts up that plugin's items alone. */
  showOrigin?: boolean;
}) {
  const { settings } = useSettings();
  const tmdbKey = settings.tmdbKey;
  const [slides, setSlides] = useState<Slide[]>([]);
  const [active, setActive] = useState(0);
  const key = catalogs.map((c) => c.key).join("|");
  const onActive = useCallback((index: number) => setActive(index), []);

  useEffect(() => {
    let cancelled = false;
    setSlides([]);
    const rows = rowsAcrossPlugins(catalogs, HERO_ROWS);
    if (!rows.length) return;
    void (async () => {
      const settled = await Promise.allSettled(rows.map((cat) => browseFetcher(cat, null)(1)));
      const pool = poolFromRows(settled, POOL_PER_ROW);
      // One plugin in view means there is nothing to spread across, so the cap would only make the
      // hero shorter than it needs to be; it exists to stop one of several filling the hero.
      const cap = new Set(pool.map(pluginOf)).size > 1 ? MAX_PER_PLUGIN : HERO_SLIDES;
      const candidates = pickAcrossPlugins(pool, HERO_SLIDES, cap);
      if (cancelled || !candidates.length) return;
      const featured = await Promise.all(candidates.map((meta) => slideFor(meta, tmdbKey)));
      if (cancelled) return;
      // An item whose artwork is its own backdrop leads, and only such items are shown while there
      // are enough of them to turn between. One backdrop among four would otherwise leave a hero
      // that can never move, which is worse than a poster beside it.
      const wide = featured.filter((meta) => meta.background);
      const shown = wide.length > 1 ? wide : featured;
      setSlides(shown.slice(0, HERO_SLIDES).map((meta) => ({ meta })));
    })().catch(() => {
      if (!cancelled) setSlides([]);
    });
    return () => {
      cancelled = true;
    };
    // The rows are keyed by their ids: the same selection rebuilt as new objects is not a change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tmdbKey]);

  if (!slides.length) {
    // The hero's own frame, so the rails below do not shift when it arrives.
    return (
      <div data-plugins-hero>
        <div
          className={`animate-pulse rounded-2xl border border-edge-soft bg-elevated/25 ${
            settings.heroFull ? "h-[78vh] min-h-[640px] rounded-none" : "h-[560px]"
          }`}
        />
      </div>
    );
  }

  // The hero draws on several plugins at once, so whichever slide is on show is the only thing
  // that can say whose title it is.
  const origin = slides[Math.min(active, slides.length - 1)]?.meta.addonOrigin;

  return (
    <div data-plugins-hero className="relative">
      <HeroCarousel
        slides={slides}
        full={settings.heroFull}
        fullQuality={settings.heroFullQuality}
        playTrailers={settings.heroTrailers}
        onActive={onActive}
        bottomAlign
      />
      {showOrigin && origin && (
        <span className="pointer-events-none absolute start-6 bottom-10 z-30 flex items-center gap-2 rounded-full bg-canvas/85 py-1 ps-1.5 pe-3 text-[12.5px] font-medium text-ink-muted backdrop-blur-sm">
          {origin.logo ? (
            <img
              src={origin.logo}
              alt=""
              draggable={false}
              className="h-5 w-5 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-raised text-[10px] font-semibold text-ink">
              {origin.name.charAt(0).toUpperCase()}
            </span>
          )}
          {origin.name}
        </span>
      )}
    </div>
  );
}
