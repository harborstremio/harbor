import { ArrowDownToLine, BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BackToTop } from "@/components/back-to-top";
import { useMangaDownloadsCount } from "@/lib/manga-downloads";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import {
  activeMangaSourceId,
  hasAnyMangaSource,
  initMangaSource,
  mangaSourcesState,
  retryMangaSources,
  setActiveMangaSource,
  subscribeMangaSources,
} from "@/lib/manga/sources";
import {
  resumeChapters,
  popularManga,
  searchManga,
  type MangaChapter,
  type MangaSummary,
} from "@/lib/manga/api";
import { listMangaProgress, type MangaProgressEntry } from "@/lib/manga-progress";
import { useProfiles } from "@/lib/profiles";
import { takeMangaReadIntent } from "@/lib/manga/read-intent";
import { MangaHero } from "./manga/manga-hero";
import { MangaBootstrap, MangaBootstrapError } from "./manga/manga-boot";
import { MangaBrowse } from "./manga/manga-browse";
import { MangaCollections } from "./manga/manga-collections";
import { MangaContinue } from "./manga/manga-continue";
import { MangaDetail } from "./manga/manga-detail";
import { MangaDownloadsView } from "./manga/manga-downloads";
import { MangaRail } from "./manga/manga-rail";
import { MangaReader } from "./manga/manga-reader";
import { MangaSourcesView } from "./manga/manga-sources-panel";
import { MangaUniverses, UniversesCta } from "./manga/manga-universes";
import { AnilistMangaRows } from "./manga/anilist-manga-rows";
import { MangaHiddenRows } from "./manga/manga-row-visibility";
import { BecauseYouWatched } from "./manga/because-you-watched";

type MangaMeta = { id: string; title: string; cover?: string };

type Mode =
  | { screen: "browse" }
  | { screen: "collections" }
  | { screen: "universes" }
  | { screen: "sources" }
  | { screen: "downloads"; from?: string }
  | { screen: "detail"; mangaId: string }
  | {
      screen: "reader";
      mangaId: string;
      manga: MangaMeta;
      chapters: MangaChapter[];
      index: number;
      startPage?: number;
      startScroll?: number;
    };

export function MangaView() {
  const t = useT();
  const { settings, update } = useSettings();
  const { activeId } = useProfiles();
  const { mangaId, setChromeHidden, topKind } = useView();
  const [mode, setMode] = useState<Mode>(
    mangaId ? { screen: "detail", mangaId } : { screen: "browse" },
  );
  const [featured, setFeatured] = useState<MangaSummary[]>([]);
  const [sourceTick, setSourceTick] = useState(0);
  const downloadsCount = useMangaDownloadsCount();

  const modeRef = useRef(mode);
  modeRef.current = mode;
  const topKindRef = useRef(topKind);
  topKindRef.current = topKind;
  const detailScrollRef = useRef<HTMLElement>(null);
  const browseScrollRef = useRef<HTMLElement>(null);
  const resumeRef = useRef<(entry: MangaProgressEntry) => void>(() => {});

  const openMangaItem = (item: MangaSummary) => {
    setMode({ screen: "detail", mangaId: item.id });
  };

  const openMangaByTitle = (item: MangaSummary) => {
    const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
    const key = norm(item.title);
    const openId = (id: string) => setMode({ screen: "detail", mangaId: id });
    const pick = (hits: MangaSummary[]) =>
      hits.find((h) => norm(h.title) === key || (h.altTitle != null && norm(h.altTitle) === key)) ??
      hits[0] ??
      null;
    void (async () => {
      try {
        const hit = pick(await searchManga(item.title, 0));
        if (hit) return openId(hit.id);
        const alt = item.title.replace(/[^\p{L}\p{N}]+/gu, " ").trim();
        if (alt && alt !== item.title) {
          const hit2 = pick(await searchManga(alt, 0));
          if (hit2) return openId(hit2.id);
        }
      } catch {
        /* fall through to reading progress */
      }
      const entry = listMangaProgress(activeId ?? "default").find((e) => norm(e.title) === key);
      if (entry) openId(entry.id);
    })();
  };

  useEffect(() => {
    initMangaSource();
  }, []);

  useEffect(() => subscribeMangaSources(() => setSourceTick((n) => n + 1)), []);

  useEffect(() => {
    const onLocalBack = (e: Event) => {
      if (topKindRef.current !== "manga") return;
      const m = modeRef.current;
      if (m.screen === "browse") return;
      e.preventDefault();
      if (m.screen === "reader") setMode({ screen: "detail", mangaId: m.mangaId });
      else if (m.screen === "downloads" && m.from) setMode({ screen: "detail", mangaId: m.from });
      else setMode({ screen: "browse" });
    };
    window.addEventListener("harbor:local-back", onLocalBack);
    return () => window.removeEventListener("harbor:local-back", onLocalBack);
  }, []);

  useEffect(() => {
    if (!mangaId) return;
    const intent = takeMangaReadIntent(mangaId);
    if (intent) resumeRef.current(intent);
    else setMode({ screen: "detail", mangaId });
  }, [mangaId]);

  useEffect(() => {
    if (!settings.mangaEnabled) return;
    let cancelled = false;
    popularManga(0)
      .then((list) => {
        if (!cancelled) setFeatured(list.filter((m) => m.cover).slice(0, 6));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [settings.mangaEnabled, sourceTick]);

  useEffect(() => {
    if (mode.screen !== "reader") return;
    setChromeHidden(true);
    return () => setChromeHidden(false);
  }, [mode.screen, setChromeHidden]);

  if (!settings.mangaEnabled) {
    return <EnableGate onEnable={() => update({ mangaEnabled: true })} />;
  }

  if (mode.screen === "sources") {
    return (
      <main className="flex-1 overflow-y-auto overflow-x-hidden px-12 pb-16 pt-24">
        <MangaSourcesView
          onBack={() => setMode({ screen: "browse" })}
          onOpenManga={(id) => setMode({ screen: "detail", mangaId: id })}
        />
      </main>
    );
  }

  if (mode.screen === "downloads") {
    const from = mode.from;
    return (
      <main className="flex-1 overflow-y-auto overflow-x-hidden px-12 pb-16 pt-24">
        <MangaDownloadsView
          onBack={() => setMode(from ? { screen: "detail", mangaId: from } : { screen: "browse" })}
          onOpenManga={(id) => setMode({ screen: "detail", mangaId: id })}
          onRead={(chapters, index, manga) =>
            setMode({ screen: "reader", mangaId: manga.id, manga, chapters, index })
          }
        />
      </main>
    );
  }

  if (!hasAnyMangaSource()) {
    const bootState = mangaSourcesState();
    if (bootState === "loading") return <MangaBootstrap />;
    if (bootState === "error") {
      return (
        <MangaBootstrapError
          onRetry={() => void retryMangaSources()}
          onManageSources={() => setMode({ screen: "sources" })}
        />
      );
    }
    return (
      <main className="animate-fade-in mx-auto flex min-h-[86vh] max-w-2xl flex-col items-center justify-center gap-6 px-12 pt-[9vh] text-center">
        <img
          src="/manga/manga-no-sources.webp"
          alt=""
          width={760}
          height={570}
          decoding="async"
          className="aspect-[4/3] w-full max-w-[380px] object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.5)]"
        />
        <div className="flex flex-col gap-3">
          <h1 className="font-display text-[32px] font-medium leading-tight text-ink">
            {t("Add a manga source")}
          </h1>
          <p className="mx-auto max-w-md text-balance text-[14px] leading-relaxed text-ink-muted">
            {t(
              "Harbor does not host any manga or any sources. Connect a self-hosted server you run, install a source plugin from a repository you trust, or open a folder you already have.",
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMode({ screen: "sources" })}
          className="mt-1 flex h-11 items-center gap-2 rounded-xl bg-ink px-6 text-[14px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97]"
        >
          {t("Set up a source")}
        </button>
      </main>
    );
  }

  const resume = async (entry: MangaProgressEntry) => {
    const target = entry.sourceId || activeMangaSourceId();
    if (target && activeMangaSourceId() !== target) setActiveMangaSource(target);
    try {
      const chs = await resumeChapters(entry.id);
      const i = chs.findIndex(
        (c) =>
          c.id === entry.chapterId ||
          (entry.chapterNumber != null && c.chapter != null && c.chapter === entry.chapterNumber),
      );
      if (i >= 0) {
        setMode({
          screen: "reader",
          mangaId: entry.id,
          manga: { id: entry.id, title: entry.title, cover: entry.cover },
          chapters: chs,
          index: i,
          startPage: Math.max(0, entry.page - 1),
          startScroll: entry.scroll,
        });
        return;
      }
    } catch {
      /* noop */
    }
    setMode({ screen: "detail", mangaId: entry.id });
  };
  resumeRef.current = resume;

  if (mode.screen === "reader") {
    return (
      <MangaReader
        chapters={mode.chapters}
        index={mode.index}
        manga={mode.manga}
        startPage={mode.startPage}
        startScroll={mode.startScroll}
        onExit={() => setMode({ screen: "detail", mangaId: mode.mangaId })}
        onChangeIndex={(i) => setMode({ ...mode, index: i })}
      />
    );
  }

  if (mode.screen === "detail") {
    return (
      <main
        ref={detailScrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-12 pb-16 pt-24"
      >
        <MangaDetail
          mangaId={mode.mangaId}
          onBack={() => setMode({ screen: "browse" })}
          onResume={resume}
          onOpenDownloads={() => setMode({ screen: "downloads", from: mode.mangaId })}
          onOpenManga={(id) => setMode({ screen: "detail", mangaId: id })}
          onRead={(chapters, index, manga) =>
            setMode({
              screen: "reader",
              mangaId: mode.mangaId,
              manga: manga ?? { id: mode.mangaId, title: "" },
              chapters,
              index,
            })
          }
        />
        <BackToTop scrollRef={detailScrollRef} />
      </main>
    );
  }

  if (mode.screen === "collections") {
    return (
      <main className="flex-1 overflow-y-auto overflow-x-hidden px-12 pb-16 pt-24">
        <button
          type="button"
          onClick={() => setMode({ screen: "browse" })}
          className="mb-7 inline-flex items-center gap-1.5 rounded-full border border-edge-soft bg-canvas/40 px-4 py-2 text-[14px] text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
        >
          <ChevronLeft size={18} className="dir-icon" />
          Back
        </button>
        <h1 className="mb-8 font-display text-[32px] font-medium tracking-tight text-ink">
          Collections
        </h1>
        <MangaCollections onOpen={openMangaItem} />
      </main>
    );
  }

  if (mode.screen === "universes") {
    return (
      <main className="flex-1 overflow-y-auto overflow-x-hidden px-12 pb-16 pt-24">
        <MangaUniverses
          onOpen={(id) => setMode({ screen: "detail", mangaId: id })}
          onBack={() => setMode({ screen: "browse" })}
        />
      </main>
    );
  }

  return (
    <main
      ref={browseScrollRef}
      className="flex-1 overflow-y-auto overflow-x-hidden px-12 pb-16 pt-28"
    >
      <MangaHero featured={featured} onOpen={(id) => setMode({ screen: "detail", mangaId: id })} />
      <div className="mt-8">
        <MangaContinue onResume={resume} />
      </div>
      <MangaHiddenRows />
      <div className="mt-8">
        <MangaRail
          title="Popular Manga"
          subtitle="Most read right now"
          collapsibleKey="harbor.manga.popularRowOpen"
          hideKey="popular"
          load={() => popularManga(0)}
          onOpen={openMangaItem}
        />
      </div>
      <AnilistMangaRows onOpen={openMangaByTitle} />
      <BecauseYouWatched onOpen={openMangaItem} />
      <div className="mb-9 mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setMode({ screen: "collections" })}
          className="group flex h-full min-h-[84px] items-center gap-4 rounded-2xl border border-edge-soft bg-elevated/40 px-6 py-4 text-start transition-all duration-300 hover:bg-elevated/70 active:scale-[0.99]"
        >
          <span className="relative grid h-12 w-16 shrink-0 place-items-center">
            <span className="absolute h-10 w-7 -translate-x-2.5 -rotate-[18deg] overflow-hidden rounded-[5px] bg-elevated shadow-[0_4px_10px_-4px_rgba(0,0,0,0.6)] ring-1 ring-edge-soft transition-transform duration-300 ease-out group-hover:-translate-x-4 group-hover:-rotate-[28deg]">
              {featured[1]?.cover && (
                <img src={featured[1].cover} alt="" className="h-full w-full object-cover" />
              )}
            </span>
            <span className="absolute h-10 w-7 translate-x-2.5 rotate-[18deg] overflow-hidden rounded-[5px] bg-raised shadow-[0_4px_10px_-4px_rgba(0,0,0,0.6)] ring-1 ring-edge-soft transition-transform duration-300 ease-out group-hover:translate-x-4 group-hover:rotate-[28deg]">
              {featured[2]?.cover && (
                <img src={featured[2].cover} alt="" className="h-full w-full object-cover" />
              )}
            </span>
            <span className="absolute h-10 w-7 overflow-hidden rounded-[5px] bg-gradient-to-br from-accent to-accent/60 shadow-[0_6px_14px_-4px_rgba(0,0,0,0.7)] ring-1 ring-white/10 transition-transform duration-300 ease-out group-hover:-translate-y-1">
              {featured[0]?.cover && (
                <img src={featured[0].cover} alt="" className="h-full w-full object-cover" />
              )}
            </span>
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[15.5px] font-semibold text-ink">Collections</span>
            <span className="truncate text-[13px] text-ink-muted">
              Most popular, critically acclaimed, award winners and more
            </span>
          </div>
          <ChevronRight
            size={22}
            className="dir-icon shrink-0 text-ink-subtle transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1"
          />
        </button>
        <UniversesCta onClick={() => setMode({ screen: "universes" })} />
      </div>
      <div className="mb-6 mt-3 flex items-center justify-between gap-4">
        <h2 className="text-[22px] font-medium tracking-tight text-ink">{t("Browse manga")}</h2>
        <button
          type="button"
          onClick={() => setMode({ screen: "downloads" })}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-edge-soft bg-surface/60 px-4 text-[13.5px] font-medium text-ink-muted transition-colors hover:border-edge hover:bg-elevated/60 hover:text-ink"
        >
          <ArrowDownToLine size={16} strokeWidth={2} />
          Downloads
          {downloadsCount > 0 && (
            <span className="rounded-full bg-elevated px-2 py-0.5 text-[11.5px] font-semibold tabular-nums text-ink ring-1 ring-edge-soft">
              {downloadsCount}
            </span>
          )}
        </button>
      </div>
      <MangaBrowse
        scrollRef={browseScrollRef}
        onOpen={(id) => setMode({ screen: "detail", mangaId: id })}
        onManageSources={() => setMode({ screen: "sources" })}
      />
      <BackToTop scrollRef={browseScrollRef} />
    </main>
  );
}

function EnableGate({ onEnable }: { onEnable: () => void }) {
  const t = useT();
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center gap-5 px-12 pb-20 pt-28 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-elevated/50 text-ink ring-1 ring-edge-soft">
        <BookOpen size={28} strokeWidth={1.8} />
      </span>
      <h1 className="font-display text-[34px] font-medium leading-tight text-ink">
        {t("Read manga in Harbor")}
      </h1>
      <p className="max-w-md text-[14px] leading-relaxed text-ink-muted">
        {t(
          "Harbor does not host any manga. Add a source plugin from a repository you trust, connect your own server, or open a local folder. You can turn this off anytime in Settings.",
        )}
      </p>
      <button
        type="button"
        onClick={onEnable}
        className="mt-1 flex h-11 items-center gap-2 rounded-xl bg-ink px-6 text-[14px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97]"
      >
        {t("Enable manga sources")}
      </button>
    </main>
  );
}
