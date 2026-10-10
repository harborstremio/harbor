import { useEffect, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/settings";
import { peekBpEnrich } from "./use-bp-enrich";
import { resolveMeta } from "@/lib/meta-resource";
import { tmdbDetails, type TmdbDetail } from "@/lib/providers/tmdb/tmdb-details";
import { tmdbCollection } from "@/lib/providers/tmdb/tmdb-collection";
import { tmdbWatchProviders, type WatchProvider } from "@/lib/providers/tmdb/tmdb-watch";
import { readBpMeta } from "./bp-focus-meta";
import { parseBpMetaId as parseId } from "./bp-logic";

export { parseBpMetaId } from "./bp-logic";

const NO_PROVIDERS: WatchProvider[] = [];

export type BpDetailData = {
  meta: Meta | null;
  detail: TmdbDetail | null;
  collection: { name: string; parts: Meta[] } | null;
  providers: WatchProvider[];
  loading: boolean;
};

export function useBpDetail(metaId: string): BpDetailData {
  const { authKey } = useAuth();
  const { settings } = useSettings();
  const { type, id } = parseId(metaId);
  const seed = readBpMeta();
  const [meta, setMeta] = useState<Meta | null>(seed?.id === id ? seed : null);
  // Seeded from the dwell prefetch the spotlight already ran for this card, so
  // the page opens with its cast, ratings and tagline on it rather than filling
  // them in once the duplicate request comes back. A miss is null, which is
  // exactly what this used to start as.
  const [detail, setDetail] = useState<TmdbDetail | null>(() => peekBpEnrich(id));
  const [collection, setCollection] = useState<{ name: string; parts: Meta[] } | null>(null);
  const [providers, setProviders] = useState<WatchProvider[]>(NO_PROVIDERS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setDetail(peekBpEnrich(id));
    setCollection(null);
    setProviders(NO_PROVIDERS);

    const base = readBpMeta();
    const start: Meta = base?.id === id ? base : { id, type, name: "" };
    if (base?.id === id) setMeta(base);

    (async () => {
      const fullP = resolveMeta(authKey, type, id).catch(() => null);
      const richP = tmdbDetails(settings.tmdbKey, start).catch(() => null);
      void fullP.then((m) => {
        if (alive && m) setMeta((prev) => ({ ...(prev ?? start), ...m }));
      });
      void richP.then((d) => {
        if (alive && d) setDetail(d);
      });
      const [full, rich] = await Promise.all([fullP, richP]);
      if (!alive) return;
      setLoading(false);

      // Availability needs the TMDB numeric id, so it cannot join the pair
      // above. It is never awaited either: art beats text on arrival and a
      // provider list must not sit in front of the episode backfill.
      if (rich) {
        void tmdbWatchProviders(settings.tmdbKey, rich.kind, rich.id, settings.region)
          .then((list) => {
            if (alive && list.length > 0) setProviders(list);
          })
          .catch(() => {});
      }

      const needsEpisodes = type === "series" && (full?.videos?.length ?? 0) === 0;
      const imdbId = rich?.imdbId;
      if (needsEpisodes && imdbId && imdbId !== id) {
        const viaImdb = await resolveMeta(authKey, type, imdbId).catch(() => null);
        if (!alive) return;
        if (viaImdb?.videos?.length) {
          setMeta((prev) => ({ ...(prev ?? start), videos: viaImdb.videos }));
        }
      }

      const collectionId = rich?.collection?.id;
      if (!collectionId) return;
      const franchise = await tmdbCollection(settings.tmdbKey, collectionId).catch(() => null);
      if (!alive || !franchise || franchise.parts.length < 2) return;
      setCollection({ name: franchise.name, parts: franchise.parts });
    })();

    return () => {
      alive = false;
    };
  }, [metaId, authKey, settings.tmdbKey, settings.region]);

  return { meta, detail, collection, providers, loading };
}
