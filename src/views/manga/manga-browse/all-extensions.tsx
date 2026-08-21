import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useT } from "@/lib/i18n";
import { Row } from "@/components/row";
import { activeMangaSource } from "@/lib/manga/sources";
import {
  sourceLatest,
  sourcePopular,
  type ServerConfig,
  type SuwayomiSource,
} from "@/lib/manga/sources/suwayomi/provider";
import { subscribeSuwayomiSourcesChanged } from "@/lib/manga/sources/suwayomi/source-events";
import { useMangaFavorites } from "@/lib/manga-favorites";
import type { MangaSummary } from "@/lib/manga/types";
import {
  cachedSuwayomiSources,
  invalidateSuwayomiSources,
  langFilterMatches,
  loadMangaLangFilter,
  subscribeMangaLangFilter,
} from "./langs";
import { MangaCard } from "./manga-card";

function sourceDisplayName(source: SuwayomiSource): string {
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
      {state === "ready" && items.length > 0 && (
        <Row min={140}>
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
}: {
  config: ServerConfig;
  source: SuwayomiSource;
  onOpen: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const name = sourceDisplayName(source);

  return (
    <section className="flex flex-col gap-4">
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
      <div className={open ? "flex flex-col gap-8" : "hidden"}>
        <FeedRail config={config} sourceId={source.id} mode="popular" onOpen={onOpen} />
        <FeedRail config={config} sourceId={source.id} mode="latest" onOpen={onOpen} />
      </div>
    </section>
  );
}

export function AllExtensionsView({ onOpen }: { onOpen: (id: string) => void }) {
  const t = useT();
  const { items: favs } = useMangaFavorites();
  const [sources, setSources] = useState<SuwayomiSource[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [langFilter, setLangFilter] = useState<string[]>(() => loadMangaLangFilter());

  useEffect(
    () =>
      subscribeMangaLangFilter(() => {
        setLangFilter(loadMangaLangFilter());
      }),
    [],
  );

  // The parent remounts this view via `key` when the active source changes.
  const config = useMemo<ServerConfig>(() => ({ baseUrl: activeMangaSource()?.baseUrl ?? "" }), []);

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

  const ordered = useMemo(() => {
    if (!sources) return [];
    return [...sources]
      .filter((s) => langFilterMatches(langFilter, s.lang))
      .sort((a, b) => sourceDisplayName(a).localeCompare(sourceDisplayName(b)));
  }, [sources, langFilter]);

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
        <ExtensionSection key={s.id} config={config} source={s} onOpen={onOpen} />
      ))}
    </div>
  );
}
