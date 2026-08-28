import { useContext, useEffect, useRef, useState } from "react";
import { PickCard } from "@/components/pick-card";
import { Row } from "@/components/row";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { useClaimSeenIds, useDedupOnSeenIds } from "@/lib/feed/seen-ids";
import { tmdbDiscover } from "@/lib/providers/tmdb";
import { useSettings } from "@/lib/settings";
import type { MetaFilter } from "@/lib/view";
import type { StandardRail } from "./rails-config";
import { MAX_PAGES, MIN_INITIAL_FILL, SpotlightGateContext } from "./spotlight-gate";

export function RailSection({ filter, rail }: { filter: MetaFilter; rail: StandardRail }) {
  const t = useT();
  const { settings } = useSettings();
  const gate = useContext(SpotlightGateContext);
  const noDedup = rail.noDedup === true;
  const mediaType = rail.mediaType ?? filter.mediaType;
  const owner = `rail:${mediaType}:${rail.id}`;
  const dedup = useDedupOnSeenIds(owner);
  const claim = useClaimSeenIds(owner);
  const [items, setItems] = useState<Meta[] | null>(null);
  const [page, setPage] = useState(1);
  const [exhausted, setExhausted] = useState(false);
  const loadingRef = useRef(false);

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
    (async () => {
      loadingRef.current = true;
      let collected: Meta[] = [];
      let p = 1;
      let stoppedEarly = false;
      while (!cancelled && collected.length < MIN_INITIAL_FILL && p <= MAX_PAGES) {
        try {
          const res = await tmdbDiscover(settings.tmdbKey, mediaType, {
            ...rail.params,
            page: String(p),
          });
          if (cancelled) return;
          const filtered = res.filter((m) => m.poster);
          let fresh: typeof filtered;
          if (noDedup) {
            claim(filtered);
            fresh = filtered;
          } else {
            fresh = dedup(filtered);
          }
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
  }, [settings.tmdbKey, mediaType, rail.params, dedup, claim, noDedup, gate.ready]);

  const onEndReached = () => {
    if (loadingRef.current || exhausted || !settings.tmdbKey) return;
    if (page >= MAX_PAGES) return;
    const next = page + 1;
    loadingRef.current = true;
    tmdbDiscover(settings.tmdbKey, mediaType, { ...rail.params, page: String(next) })
      .then((res) => {
        const filtered = res.filter((m) => m.poster);
        let fresh: typeof filtered;
        if (noDedup) {
          claim(filtered);
          fresh = filtered;
        } else {
          fresh = dedup(filtered);
        }
        setItems((prev) => [...(prev ?? []), ...fresh]);
        setPage(next);
        if (res.length < 20) setExhausted(true);
      })
      .catch(() => {})
      .finally(() => {
        loadingRef.current = false;
      });
  };

  const visible = items ? uniqueById(items) : null;
  if (visible && visible.length === 0) return null;

  const title = (
    <span className="flex flex-col">
      <span className="text-[20px] font-medium tracking-tight text-ink">{t(rail.title)}</span>
      <span className="text-[12px] font-medium uppercase tracking-[0.18em] text-ink-subtle">
        {t(rail.kicker)}
      </span>
    </span>
  );

  return (
    <Row title={title} onEndReached={onEndReached}>
      {visible
        ? visible.map((m) => <PickCard key={m.id} meta={m} />)
        : Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] w-full animate-pulse rounded-xl bg-elevated/40" />
          ))}
    </Row>
  );
}

function uniqueById(metas: Meta[]): Meta[] {
  const seen = new Set<string>();
  const out: Meta[] = [];
  for (const m of metas) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out;
}
