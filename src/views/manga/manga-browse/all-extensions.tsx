import { useEffect, useMemo, useRef, useState, type HTMLAttributes } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronsUp,
  ExternalLink,
  GripVertical,
  ListOrdered,
  RotateCcw,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { Row } from "@/components/row";
import { moveItem } from "@/lib/addons-store/reorder";
import { activeMangaSource } from "@/lib/manga/sources";
import {
  sourceLatest,
  sourcePopular,
  type ServerConfig,
  type SuwayomiSource,
} from "@/lib/manga/sources/suwayomi/provider";
import { subscribeSuwayomiSourcesChanged } from "@/lib/manga/sources/suwayomi/source-events";
import { applySuwayomiSourceOrder } from "@/lib/manga/sources/suwayomi/source-order";
import { useMangaFavorites } from "@/lib/manga-favorites";
import type { MangaSummary } from "@/lib/manga/types";
import { useDragList } from "@/views/addons/organize/use-drag-list";
import {
  cachedSuwayomiSources,
  invalidateSuwayomiSources,
  isAgnosticLang,
  langFilterMatches,
  loadMangaLangFilter,
  subscribeMangaLangFilter,
} from "./langs";
import { TRIGGER, useOutsideClose } from "./filters";
import { MangaCard } from "./manga-card";

export function sourceDisplayName(source: SuwayomiSource): string {
  if (isAgnosticLang(source.lang)) return `${source.name} · All languages`;
  return source.lang && source.lang !== "en"
    ? `${source.name} (${source.lang.toUpperCase()})`
    : source.name;
}

type FeedMode = "popular" | "latest";
type FeedState = "idle" | "loading" | "ready" | "error";

const SKELETONS = Array.from({ length: 8 }, (_, i) => i);

function CollapseChevron({ open }: { open: boolean }) {
  return (
    <ChevronDown
      size={14}
      strokeWidth={2.2}
      className={`shrink-0 text-ink-subtle transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
    />
  );
}

function FeedRail({
  config,
  sourceId,
  mode,
  onOpen,
}: {
  config: ServerConfig;
  sourceId: string;
  mode: FeedMode;
  onOpen: (id: string) => void;
}) {
  const t = useT();
  const [state, setState] = useState<FeedState>("idle");
  const [items, setItems] = useState<MangaSummary[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state !== "idle") return;
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        io.disconnect();
        setState("loading");
        const run = mode === "latest" ? sourceLatest : sourcePopular;
        run(config, sourceId, 1)
          .then((page) => {
            setItems(page.manga);
            setState("ready");
          })
          .catch(() => {
            console.warn(`[manga] suwayomi ${sourceId} ${mode} feed failed`);
            setState("error");
          });
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [config, sourceId, mode, state]);

  const label = t(mode === "latest" ? "Latest" : "Popular");

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-medium tracking-tight text-ink">{label}</h3>
      {state === "idle" && <div ref={rootRef} className="h-1" />}
      {state === "loading" && (
        <Row min={140}>
          {SKELETONS.map((i) => (
            <div key={i} className="aspect-[2/3] w-full rounded-xl bg-elevated/40" />
          ))}
        </Row>
      )}
      {state === "ready" &&
        items.length > 0 && (
          // Each feed is a single page, so eager-render every card: the Row would
          // otherwise virtualize items past EAGER_COUNT into blank skeletons that
          // look like missing manga until scrolled into view.
          <Row min={140} alwaysActive>
            {items.map((m) => (
              <MangaCard key={m.id} manga={m} onOpen={onOpen} />
            ))}
          </Row>
        )}
    </div>
  );
}

function ExtensionSection({
  config,
  source,
  onOpen,
  onBrowseExtension,
}: {
  config: ServerConfig;
  source: SuwayomiSource;
  onOpen: (id: string) => void;
  onBrowseExtension: (source: SuwayomiSource) => void;
}) {
  const [open, setOpen] = useState(true);
  const name = sourceDisplayName(source);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="group flex w-fit items-center gap-1.5"
        >
          <CollapseChevron open={open} />
          <h3 className="font-medium tracking-tight text-ink transition-colors group-hover:text-ink-muted">
            {name}
          </h3>
        </button>
        <button
          type="button"
          onClick={() => onBrowseExtension(source)}
          title="Open extension"
          aria-label="Open extension"
          className="flex h-7 w-7 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-elevated/70 hover:text-ink"
        >
          <ExternalLink size={14} strokeWidth={2.2} />
        </button>
      </div>
      <div className={open ? "flex flex-col gap-8" : "hidden"}>
        <FeedRail config={config} sourceId={source.id} mode="popular" onOpen={onOpen} />
        <FeedRail config={config} sourceId={source.id} mode="latest" onOpen={onOpen} />
      </div>
    </section>
  );
}

export function ReorderMenu({
  sources,
  order,
  onOrder,
  onReset,
}: {
  sources: SuwayomiSource[];
  order: string[];
  onOrder: (ids: string[]) => void;
  onReset: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));

  const custom = order.length > 0;

  const ordered = useMemo(() => applySuwayomiSourceOrder(sources, order), [sources, order]);

  const move = (from: number, to: number) => {
    const clamped = Math.max(0, Math.min(ordered.length - 1, to));
    if (clamped === from) return;
    onOrder(moveItem(ordered, from, clamped).map((s) => s.id));
  };

  const drag = useDragList(ordered.length, move);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={TRIGGER}
      >
        <ListOrdered size={15} className="text-ink-subtle" />
        <span className="font-medium">{t("Reorder")}</span>
        <ChevronDown size={14} className="text-ink-subtle" />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1.5 w-[300px] overflow-hidden rounded-lg border border-edge-soft bg-raised shadow-[0_16px_40px_-12px_rgba(0,0,0,0.6)]">
          <div className="flex items-center justify-between gap-3 border-b border-edge-soft/60 px-3.5 py-2.5">
            <span className="text-[12.5px] font-medium text-ink">{t("Reorder extensions")}</span>
            {custom && (
              <button
                type="button"
                onClick={() => {
                  onReset();
                  setOpen(false);
                }}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-semibold text-ink-muted transition-colors hover:bg-elevated/60 hover:text-ink"
              >
                <RotateCcw size={12} strokeWidth={2.4} />
                {t("Reset order")}
              </button>
            )}
          </div>
          <div
            className={`max-h-80 overflow-y-auto p-1.5 ${drag.dragIndex != null ? "select-none" : ""}`}
          >
            {ordered.map((source, i) => (
              <ReorderRow
                key={source.id}
                name={sourceDisplayName(source)}
                rowRef={drag.rowRef(i)}
                handleProps={drag.handleProps(i)}
                dragging={drag.dragIndex === i}
                indicator={
                  drag.dragIndex != null &&
                  drag.overIndex === i &&
                  drag.overIndex !== drag.dragIndex
                    ? drag.overIndex < drag.dragIndex
                      ? "above"
                      : "below"
                    : null
                }
                canUp={i > 0}
                canDown={i < ordered.length - 1}
                onUp={() => move(i, i - 1)}
                onDown={() => move(i, i + 1)}
                onTop={() => move(i, 0)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReorderRow({
  name,
  rowRef,
  handleProps,
  dragging,
  indicator,
  canUp,
  canDown,
  onUp,
  onDown,
  onTop,
}: {
  name: string;
  rowRef: (el: HTMLDivElement | null) => void;
  handleProps: HTMLAttributes<HTMLElement>;
  dragging: boolean;
  indicator: "above" | "below" | null;
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
  onTop: () => void;
}) {
  const t = useT();
  const btn =
    "flex h-8 w-8 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-elevated/70 hover:text-ink disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-ink-subtle";

  return (
    <div
      ref={rowRef}
      className={`relative flex items-center gap-1 rounded-lg px-0.5 py-1 ${dragging ? "opacity-50 ring-1 ring-accent/40" : ""}`}
    >
      {indicator && (
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-x-1 h-[3px] rounded-full bg-accent ${
            indicator === "above" ? "-top-[3px]" : "-bottom-[3px]"
          }`}
        />
      )}
      <span
        {...handleProps}
        title={t("Drag to reorder")}
        className="flex h-8 w-7 shrink-0 cursor-grab touch-none items-center justify-center text-ink-subtle transition-colors hover:text-ink active:cursor-grabbing"
      >
        <GripVertical size={15} strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{name}</span>
      <button
        type="button"
        onClick={onTop}
        disabled={!canUp}
        aria-label={t("Move to top")}
        className={btn}
      >
        <ChevronsUp size={14} strokeWidth={2.3} />
      </button>
      <button
        type="button"
        onClick={onUp}
        disabled={!canUp}
        aria-label={t("Move up")}
        className={btn}
      >
        <ArrowUp size={14} strokeWidth={2.3} />
      </button>
      <button
        type="button"
        onClick={onDown}
        disabled={!canDown}
        aria-label={t("Move down")}
        className={btn}
      >
        <ArrowDown size={14} strokeWidth={2.3} />
      </button>
    </div>
  );
}

export function AllExtensionsView({
  onOpen,
  onBrowseExtension,
  orderedIds,
  onSources,
}: {
  onOpen: (id: string) => void;
  onBrowseExtension: (source: SuwayomiSource) => void;
  orderedIds: string[];
  onSources: (sources: SuwayomiSource[]) => void;
}) {
  const t = useT();
  const { items: favs } = useMangaFavorites();
  const config = useMemo<ServerConfig>(() => ({ baseUrl: activeMangaSource()?.baseUrl ?? "" }), []);
  const [sources, setSources] = useState<SuwayomiSource[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [langFilter, setLangFilter] = useState<string[]>(() => loadMangaLangFilter(config.baseUrl));

  useEffect(
    () =>
      subscribeMangaLangFilter(() => {
        setLangFilter(loadMangaLangFilter(config.baseUrl));
      }),
    [config.baseUrl],
  );

  useEffect(() => {
    let alive = true;
    setFailed(false);
    setSources(null);
    cachedSuwayomiSources(config)
      .then((list) => {
        if (alive) setSources(list);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    const unsub = subscribeSuwayomiSourcesChanged(() => {
      invalidateSuwayomiSources(config.baseUrl);
      cachedSuwayomiSources(config)
        .then((list) => {
          if (alive) setSources(list);
        })
        .catch(() => {
          if (alive) setFailed(true);
        });
    });
    return () => {
      alive = false;
      unsub();
    };
  }, [config]);

  const favList = useMemo(
    () =>
      [...favs.values()]
        .sort((a, b) => b.addedAt - a.addedAt)
        .map((e) => ({ id: e.id, title: e.title, cover: e.cover })),
    [favs],
  );

  const alphaSorted = useMemo(() => {
    if (!sources) return [];
    return [...sources]
      .filter((s) => langFilterMatches(langFilter, s.lang))
      .sort((a, b) => sourceDisplayName(a).localeCompare(sourceDisplayName(b)));
  }, [sources, langFilter]);

  const ordered = useMemo(
    () => applySuwayomiSourceOrder(alphaSorted, orderedIds),
    [alphaSorted, orderedIds],
  );

  useEffect(() => {
    onSources(ordered);
  }, [ordered, onSources]);

  if (failed) {
    return (
      <p className="py-16 text-center text-[13px] text-ink-subtle">
        {t("Could not reach the extension list. Check your server connection and try again.")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-9">
      {favList.length > 0 && (
        <Row title={t("Favorites")} min={140}>
          {favList.map((m) => (
            <MangaCard key={m.id} manga={m} onOpen={onOpen} />
          ))}
        </Row>
      )}
      {ordered.map((s) => (
        <ExtensionSection
          key={s.id}
          config={config}
          source={s}
          onOpen={onOpen}
          onBrowseExtension={onBrowseExtension}
        />
      ))}
    </div>
  );
}
