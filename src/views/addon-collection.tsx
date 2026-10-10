import { useEffect, useRef, useState, type ReactNode } from "react";
import { PickCard } from "@/components/pick-card";
import { fetchAddonCatalogPage, fetchAddonMeta } from "@/lib/addons";
import { narrowMediaType, type Meta, type MetaType } from "@/lib/cinemeta";
import { useScrollMemory, useView } from "@/lib/view";
import { useT } from "@/lib/i18n";

type CollectionVideo = NonNullable<Meta["videos"]>[number];

function memberType(id: string, fallback: "movie" | "series"): MetaType {
  if (id.startsWith("tmdb:tv:")) return "series";
  if (id.startsWith("tmdb:movie:")) return "movie";
  if (/^(kitsu|mal|anilist|anidb):/.test(id)) return "anime";
  return fallback;
}

function videoToMeta(v: CollectionVideo, fallback: "movie" | "series"): Meta | null {
  const id = v.id;
  if (!id) return null;
  const raw = v as Record<string, unknown>;
  const poster =
    typeof raw.poster === "string" ? raw.poster : typeof v.thumbnail === "string" ? v.thumbnail : undefined;
  return {
    id,
    type: memberType(id, fallback),
    name: v.name ?? v.title ?? id,
    poster,
    background: typeof raw.background === "string" ? raw.background : undefined,
    releaseInfo: typeof v.released === "string" ? v.released.slice(0, 4) : undefined,
  };
}

function dedupe(metas: Meta[], excludeId: string): Meta[] {
  const seen = new Set<string>();
  const out: Meta[] = [];
  for (const m of metas) {
    if (!m.id || m.id === excludeId || seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out;
}

export function AddonCollectionView({ meta }: { meta: Meta }) {
  const t = useT();
  const { setNavStack } = useView();
  const [members, setMembers] = useState<Meta[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroBg, setHeroBg] = useState<string | undefined>(meta.background);
  const [heroDesc, setHeroDesc] = useState<string | undefined>(meta.description);
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollMemory(`addon-collection-${meta.id}`, scrollRef);

  useEffect(() => {
    let cancelled = false;
    setMembers([]);
    setLoading(true);
    setHeroBg(meta.background);
    setHeroDesc(meta.description);
    const fallback = narrowMediaType(meta.type);
    const fromVideos = (m: Meta | null): Meta[] =>
      (m?.videos ?? []).map((v) => videoToMeta(v, fallback)).filter((x): x is Meta => x != null);

    (async () => {
      const base = meta.addonOrigin?.base;
      console.log("[harbor:collection] open", {
        id: meta.id,
        type: meta.type,
        base,
        addon: meta.addonOrigin?.name,
        cardVideos: meta.videos?.length ?? 0,
      });
      let found = dedupe(fromVideos(meta), meta.id);
      let full: Meta | null = null;
      if (found.length === 0 && base) {
        full = await fetchAddonMeta(base, meta.type, meta.id).catch((e) => {
          console.log("[harbor:collection] meta fetch threw", e);
          return null;
        });
        if (cancelled) return;
        console.log("[harbor:collection] fetched full meta", {
          ok: !!full,
          type: full?.type,
          videoCount: full?.videos?.length ?? 0,
          keys: full ? Object.keys(full) : [],
          sampleVideos: full?.videos?.slice(0, 4),
          sampleLinks: full?.links?.slice(0, 4),
        });
        if (full?.background) setHeroBg(full.background);
        if (full?.description) setHeroDesc(full.description);
        found = dedupe(fromVideos(full), meta.id);
        console.log("[harbor:collection] members mapped from videos:", found.length, found.slice(0, 4));
        if (found.length === 0) {
          const catalog = await fetchAddonCatalogPage(base, meta.type, meta.id, 0).catch((e) => {
            console.log("[harbor:collection] catalog fetch threw", e);
            return [];
          });
          if (cancelled) return;
          console.log("[harbor:collection] catalog fallback:", catalog.length, catalog.slice(0, 4));
          found = dedupe(catalog, meta.id);
        }
      }
      if (cancelled) return;
      if (found.length === 0) {
        console.log(
          "[harbor:collection] NO MEMBERS -> falling back to normal detail. Raw full meta:",
          full ? JSON.stringify(full).slice(0, 4000) : "null",
        );
        setNavStack((s) => {
          const top = s[s.length - 1];
          if (top.kind !== "addon-collection" || top.meta.id !== meta.id) return s;
          return [...s.slice(0, -1), { kind: "meta", meta: { ...meta, isCollection: false } }];
        });
        return;
      }
      console.log("[harbor:collection] SUCCESS", found.length, "members");
      setMembers(found);
      setLoading(false);
    })().catch((e) => {
      console.log("[harbor:collection] fatal", e);
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [meta, setNavStack]);

  const grid = "grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7";
  const count = members.length;

  return (
    <main ref={scrollRef} data-rail-flush className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
      {(heroBg || meta.poster) && (
        <div
          aria-hidden
          className="harbor-bleed-stremio pointer-events-none absolute inset-x-0 top-0 -z-10 h-[82vh] min-h-[600px] overflow-hidden"
        >
          {heroBg ? (
            <img src={heroBg} alt="" className="h-full w-full scale-105 object-cover" />
          ) : (
            <div
              className="h-full w-full scale-125"
              style={{
                backgroundImage: `url(${meta.poster})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: "blur(64px) saturate(1.35)",
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/55 to-canvas/5" />
          <div className="absolute inset-0 bg-gradient-to-r from-canvas/92 via-canvas/35 to-transparent" />
        </div>
      )}
      <div className="relative px-12 pt-28">
        <div className="mt-16 flex items-end gap-7 pb-2">
          {meta.poster && (
            <img
              src={meta.poster}
              alt=""
              draggable={false}
              className="hidden w-44 shrink-0 rounded-2xl shadow-[0_28px_64px_-22px_rgba(0,0,0,0.8)] ring-1 ring-edge-soft sm:block"
            />
          )}
          <div className="min-w-0 max-w-3xl">
            <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-ink-subtle">
              {t("Collection")}
            </p>
            <h1 className="mt-2 font-display text-[clamp(38px,5vw,64px)] font-medium leading-[1.01] tracking-tight text-ink [text-shadow:0_2px_24px_rgba(0,0,0,0.5)]">
              {meta.name}
            </h1>
            {count > 0 && (
              <div className="mt-3 text-[13.5px] font-medium text-ink-muted">
                <span>{count === 1 ? t("{n} title", { n: count }) : t("{n} titles", { n: count })}</span>
              </div>
            )}
            {heroDesc && (
              <p className="mt-4 line-clamp-4 max-w-2xl text-[16px] leading-relaxed text-ink/85 [text-shadow:0_1px_10px_rgba(0,0,0,0.5)]">
                {heroDesc}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="px-12 pb-16 pt-10">
        {count > 0 && (
          <h2 className="mb-4 text-[13px] font-bold uppercase tracking-[0.2em] text-ink-subtle">{t("Titles")}</h2>
        )}
        {loading ? (
          <div className={grid}>
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-elevated/40" />
            ))}
          </div>
        ) : count === 0 ? (
          <Notice>{t("No titles found in this collection.")}</Notice>
        ) : (
          <div className={grid}>
            {members.map((m) => (
              <PickCard key={m.id} meta={m} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-dashed border-edge px-6 py-16 text-center text-[14.5px] text-ink-muted">
      {children}
    </div>
  );
}
