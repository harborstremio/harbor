import { useEffect, useMemo, useState } from "react";
import { harborImdbTitle, harborImdbTitleCached } from "@/lib/providers/harbor-imdb";
import { creditToMeta, tmdbImdbCached, tmdbImdbId, type PersonCredit } from "@/lib/providers/tmdb";
import { createRequestScheduler } from "@/lib/request-scheduler";
import { useSettings } from "@/lib/settings";

const scheduler = createRequestScheduler({ concurrency: 4 });

function seedFromCache(ids: string[]): Map<string, string> {
  const seed = new Map<string, string>();
  for (const id of ids) {
    const tt = tmdbImdbCached(id);
    if (!tt) continue;
    const cached = harborImdbTitleCached(tt);
    if (cached != null) seed.set(id, cached.toFixed(1));
  }
  return seed;
}

export function useCreditImdbRatings(credits: PersonCredit[]): Map<string, string> {
  const { settings } = useSettings();
  const idKey = credits.map((c) => creditToMeta(c).id).join("|");
  const ids = useMemo(() => (idKey ? idKey.split("|") : []), [idKey]);
  const [ratings, setRatings] = useState<Map<string, string>>(() => seedFromCache(ids));

  useEffect(() => {
    setRatings(seedFromCache(ids));
    const key = settings.tmdbKey;
    if (!key || ids.length === 0) return;
    let cancelled = false;
    for (const id of ids) {
      void scheduler
        .schedule(`person-imdb:${id}`, async () => {
          const tt = await tmdbImdbId(key, id);
          return tt ? await harborImdbTitle(tt) : null;
        })
        .then((value) => {
          if (cancelled || value == null) return;
          setRatings((prev) => {
            const next = new Map(prev);
            next.set(id, value.toFixed(1));
            return next;
          });
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [ids, settings.tmdbKey]);

  return ratings;
}
