import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { PickCard } from "@/components/pick-card";
import { Row, usePosterRow } from "@/components/row";
import type { Meta } from "@/lib/cinemeta";
import { type Topic } from "@/lib/feed/genre-topics";
import { useT } from "@/lib/i18n";
import { useDedupOnSeenIds } from "@/lib/feed/seen-ids";
import { tmdbDiscover, tmdbResolveKeywordIds } from "@/lib/providers/tmdb";
import { useSettings } from "@/lib/settings";
import { MAX_PAGES, MIN_INITIAL_FILL, SpotlightGateContext } from "./spotlight-gate";

export function TopicSection({
  topic,
  mediaType,
}: {
  topic: Topic;
  mediaType: "movie" | "tv";
}) {
  const t = useT();
  const posterRow = usePosterRow();
  const { settings } = useSettings();
  const dedup = useDedupOnSeenIds(`topic:${mediaType}:${topic.id}`);
  const gate = useContext(SpotlightGateContext);
  const [items, setItems] = useState<Meta[] | null>(null);
  const [page, setPage] = useState(1);
  const [exhausted, setExhausted] = useState(false);
  const [keywordIds, setKeywordIds] = useState<number[] | null>(null);
  const loadingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setKeywordIds(null);
    if (!settings.tmdbKey) return;
    tmdbResolveKeywordIds(settings.tmdbKey, topic.keywords)
      .then((ids) => {
        if (cancelled) return;
        setKeywordIds(ids);
      })
      .catch(() => {
        if (cancelled) return;
        setKeywordIds([]);
      });
    return () => {
      cancelled = true;
    };
  }, [settings.tmdbKey, topic.keywords]);

  const baseParams = useMemo(() => {
    const p: Record<string, string> = {
      sort_by: "vote_average.desc",
      "vote_count.gte": String(topic.voteCount ?? 5),
    };
    if (topic.genreIds && topic.genreIds.length > 0) {
      p.with_genres = topic.genreIds.join(",");
    }
    if (keywordIds && keywordIds.length > 0) {
      p.with_keywords = keywordIds.join("|");
    }
    return p;
  }, [topic.genreIds, topic.voteCount, keywordIds]);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setPage(1);
    setExhausted(false);
    if (!settings.tmdbKey) {
      setItems([]);
      return;
    }
    if (!gate.ready) return;
    if (keywordIds === null) return;
    if (keywordIds.length === 0) {
      setItems([]);
      return;
    }
    (async () => {
      loadingRef.current = true;
      let collected: Meta[] = [];
      let p = 1;
      let stoppedEarly = false;
      while (!cancelled && collected.length < MIN_INITIAL_FILL && p <= MAX_PAGES) {
        try {
          const res = await tmdbDiscover(settings.tmdbKey, mediaType, {
            ...baseParams,
            page: String(p),
          });
          if (cancelled) return;
          const fresh = dedup(res.filter((m) => m.poster));
          collected = [...collected, ...fresh];
          if (res.length < 20) {
            stoppedEarly = true;
            break;
          }
          p += 1;
        } catch {
          break;
        }
      }
      if (cancelled) return;
      setItems(collected);
      setPage(p);
      if (stoppedEarly) setExhausted(true);
      loadingRef.current = false;
    })();
    return () => {
      cancelled = true;
    };
  }, [settings.tmdbKey, mediaType, baseParams, dedup, gate.ready, keywordIds]);

  const onEndReached = () => {
    if (loadingRef.current || exhausted || !settings.tmdbKey) return;
    if (page >= MAX_PAGES) return;
    if (!keywordIds || keywordIds.length === 0) return;
    const next = page + 1;
    loadingRef.current = true;
    tmdbDiscover(settings.tmdbKey, mediaType, { ...baseParams, page: String(next) })
      .then((res) => {
        const fresh = dedup(res.filter((m) => m.poster));
        setItems((prev) => [...(prev ?? []), ...fresh]);
        setPage(next);
        if (res.length < 20) setExhausted(true);
      })
      .catch(() => {})
      .finally(() => {
        loadingRef.current = false;
      });
  };

  if (items && items.length === 0) return null;

  const title = (
    <span className="flex flex-col">
      <span className="text-[20px] font-medium tracking-tight text-ink">{t(topic.title)}</span>
      <span className="text-[12px] font-medium uppercase tracking-[0.18em] text-ink-subtle">
        {t(topic.kicker)}
      </span>
    </span>
  );

  return (
    <Row {...posterRow} title={title} onEndReached={onEndReached}>
      {items
        ? items.map((m) => (
            <PickCard key={m.id} meta={m} />
          ))
        : Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`${posterRow.shape === "landscape" ? "aspect-[16/9]" : "aspect-[2/3]"} animate-pulse rounded-xl bg-elevated/40`} />
          ))}
    </Row>
  );
}
