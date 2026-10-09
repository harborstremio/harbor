import { useEffect, useRef } from "react";
import { currentAuthor, subscribeAuthor } from "@/lib/theme-auth";
import { fetchMyRatings, upsertRating } from "./ratings-api";
import { mergeServerRatings } from "@/lib/ratings/store";
import type { MyRating } from "@/lib/ratings/types";

const PUSH_BUDGET = 45;
const PUSH_GAP_MS = 1100;

const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

async function pushLocalOnly(list: MyRating[], stopped: () => boolean): Promise<void> {
  const queue = list.slice(0, PUSH_BUDGET);
  for (const r of queue) {
    if (stopped()) return;
    try {
      await upsertRating({
        itemKey: r.itemKey,
        mediaType: r.mediaType,
        title: r.title,
        poster: r.poster,
        score: r.score,
        review: r.review,
        spoiler: r.spoiler,
      });
    } catch (e) {
      if ((e as { status?: number })?.status === 429) return;
    }
    await sleep(PUSH_GAP_MS);
  }
}

export function useRatingsSync(): void {
  const busy = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const handle = currentAuthor()?.handle;
      if (!handle || busy.current) return;
      busy.current = true;
      try {
        const server = await fetchMyRatings();
        if (cancelled) return;
        const { localOnly } = mergeServerRatings(server);
        await pushLocalOnly(localOnly, () => cancelled);
      } catch {
        /* ignore */
      } finally {
        busy.current = false;
      }
    };
    void load();
    const off = subscribeAuthor(() => void load());
    return () => {
      cancelled = true;
      off();
    };
  }, []);
}
