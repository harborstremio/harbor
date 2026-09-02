import { Award } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { MangaSummary } from "@/lib/manga/types";
import { CollapsibleSection } from "./collapsible-section";
import { MangaPosterRow } from "./manga-poster-row";

export function MangaRail({
  title,
  subtitle,
  art,
  award = false,
  collapsibleKey,
  hideKey,
  scrollKey,
  items: preloaded,
  load,
  loadStream,
  onOpen,
}: {
  title: string;
  subtitle?: string;
  art?: string | null;
  award?: boolean;
  collapsibleKey?: string;
  scrollKey?: string;
  hideKey?: string;
  items?: MangaSummary[];
  load?: () => Promise<MangaSummary[]>;
  loadStream?: (onChunk: (items: MangaSummary[]) => void) => Promise<void>;
  onOpen: (item: MangaSummary) => void;
}) {
  const [loaded, setLoaded] = useState<MangaSummary[] | null>(null);
  const items = preloaded ?? loaded;
  const [seen, setSeen] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || seen) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setSeen(true);
      },
      { rootMargin: "300px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [seen]);

  useEffect(() => {
    if (!seen || preloaded) return;
    let cancelled = false;
    if (loadStream) {
      loadStream((chunk) => {
        if (cancelled || chunk.length === 0) return;
        setLoaded((prev) => {
          const base = prev ?? [];
          const ids = new Set(base.map((m) => m.id));
          const fresh = chunk.filter((m) => !ids.has(m.id));
          return fresh.length ? [...base, ...fresh] : base;
        });
      })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoaded((prev) => prev ?? []);
        });
    } else if (load) {
      load()
        .then((list) => {
          if (!cancelled) setLoaded(list);
        })
        .catch(() => {
          if (!cancelled) setLoaded([]);
        });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen]);

  if (items && items.length === 0) return null;

  const leading = art ? (
    <img
      src={art}
      alt=""
      draggable={false}
      width={36}
      height={36}
      className="h-9 w-9 shrink-0 object-contain drop-shadow-[0_3px_10px_rgba(0,0,0,0.5)]"
    />
  ) : award ? (
    <Award size={17} className="shrink-0 text-accent" strokeWidth={2.2} />
  ) : undefined;

  const row = (
    <MangaPosterRow
      items={items}
      onOpen={onOpen}
      award={award}
      art={art}
      scrollKey={scrollKey ?? `manga:${title}`}
    />
  );

  if (collapsibleKey) {
    return (
      <CollapsibleSection
        storageKey={collapsibleKey}
        rootRef={sectionRef}
        hideKey={hideKey}
        title={title}
        leading={leading}
        trailing={
          subtitle ? <span className="text-[13px] text-ink-subtle">{subtitle}</span> : undefined
        }
      >
        {row}
      </CollapsibleSection>
    );
  }

  return (
    <section ref={sectionRef} className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        {leading}
        <div className="flex items-baseline gap-2.5">
          <h2 className="text-[18px] font-semibold tracking-tight text-ink">{title}</h2>
          {subtitle && <span className="text-[13px] text-ink-subtle">{subtitle}</span>}
        </div>
      </div>
      {row}
    </section>
  );
}
