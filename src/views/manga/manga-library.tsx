import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { List, Star, type LucideIcon } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useMangaFavorites } from "@/lib/manga-favorites";
import { mangaLists } from "@/lib/manga-lists";
import { searchManga } from "@/lib/manga/api";
import { hasAnyMangaSource, setActiveMangaSource } from "@/lib/manga/sources";
import { useView } from "@/lib/view";
import type { MangaSummary } from "@/lib/manga/types";
import { MyListsTab } from "../library/my-lists-tab";
import { VirtualGrid } from "@/components/virtual-grid";
import { useMangaContext } from "@/lib/use-manga-context";
import { observeWithin } from "@/lib/visibility";
import { useProxiedImageSrc } from "@/lib/remote-image-proxy";

function useOpenTitle() {
  const { openManga } = useView();
  const busyRef = useRef<Set<string>>(new Set());
  return async (id: string, title: string, sourceId?: string) => {
    if (id.includes("::") || sourceId) {
      if (sourceId && !id.includes("::")) setActiveMangaSource(sourceId);
      openManga(id);
      return;
    }
    if (busyRef.current.has(id)) return;
    const name = title.trim();
    if (!name || !hasAnyMangaSource()) {
      openManga(id);
      return;
    }
    busyRef.current.add(id);
    try {
      const norm = (s: string) => s.trim().toLowerCase();
      const results = await searchManga(name);
      const match =
        results.find(
          (r) =>
            norm(r.title) === norm(name) || (r.altTitle != null && norm(r.altTitle) === norm(name)),
        ) ?? results[0];
      openManga(match ? match.id : id);
    } catch {
      openManga(id);
    } finally {
      busyRef.current.delete(id);
    }
  };
}

type LibrarySection = "favorites" | "lists";

// Lightweight favorites cell: manga covers are direct full-size URLs, so the
// shared Poster (TMDB localize, RPDB resolve, anime mapping, proxy, resize
// bucketing, retry timers, explicit decode) is pure overhead here. This gates
// the <img> behind a shared viewport observer and lets the browser decode
// lazily instead of hammering el.decode() for every mounted cell.
function FavCell({
  m,
  onOpen,
}: {
  m: MangaSummary & { sourceId?: string };
  onOpen: (item: MangaSummary) => void;
}) {
  const context = useMangaContext(
    { ...m, sourceId: m.sourceId ?? (m.id.includes("::") ? undefined : "") },
    { open: () => onOpen(m) },
  );
  const ref = useRef<HTMLDivElement | null>(null);
  const [near, setNear] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const src = useProxiedImageSrc(m.cover, { forceProxy: true });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return observeWithin(el, "600px", (e) => {
      if (e.isIntersecting) setNear(true);
    });
  }, []);
  return (
    <button
      ref={context.ref}
      type="button"
      onClick={() => onOpen(m)}
      className="group flex w-full flex-col gap-2 text-start"
    >
      <div
        ref={ref}
        className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-elevated/60"
      >
        {!loaded && <span aria-hidden className="harbor-shimmer absolute inset-0" />}
        {near && src && (
          <img
            src={src}
            alt=""
            draggable={false}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            className="absolute inset-0 h-full w-full object-cover"
            style={loaded ? { opacity: 1 } : { opacity: 0 }}
          />
        )}
      </div>
      <p className="line-clamp-2 text-[13px] font-medium leading-snug text-ink">{m.title}</p>
    </button>
  );
}

export function MangaLibrary({ scrollRef }: { scrollRef: React.RefObject<HTMLElement | null> }) {
  const t = useT();
  const openTitle = useOpenTitle();
  const openRef = useRef(openTitle);
  openRef.current = openTitle;
  const openRailTitle = useCallback(
    (m: MangaSummary & { sourceId?: string }) => void openRef.current(m.id, m.title, m.sourceId),
    [],
  );
  const { items } = useMangaFavorites();
  const favs = useMemo(
    (): MangaSummary[] => [...items.values()].sort((a, b) => b.addedAt - a.addedAt),
    [items],
  );
  const [active, setActive] = useState<LibrarySection>("favorites");
  const swapRef = useRef<HTMLDivElement | null>(null);

  const jumpTo = (section: LibrarySection) => {
    setActive(section);
    const wrap = swapRef.current;
    if (wrap) {
      wrap.classList.remove("animate-media-swap");
      void wrap.offsetWidth;
      wrap.classList.add("animate-media-swap");
    }
    const root = scrollRef.current;
    const el = root?.querySelector<HTMLElement>(`#manga-${section}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "auto", block: "start" });
    el.classList.remove("hset-jumped");
    void el.offsetWidth;
    el.classList.add("hset-jumped");
    window.setTimeout(() => el.classList.remove("hset-jumped"), 1400);
  };

  useEffect(() => {
    let raf = 0;
    const scrollerOf = (el: HTMLElement): HTMLElement | null => {
      if (scrollRef.current) return scrollRef.current;
      let node: HTMLElement | null = el.parentElement;
      while (node) {
        if (node.scrollHeight > node.clientHeight + 8) return node;
        node = node.parentElement;
      }
      return null;
    };
    const update = () => {
      raf = 0;
      const lists = document.getElementById("manga-lists");
      if (!lists) return;
      const rect = lists.getBoundingClientRect();
      if (rect.top <= 160) {
        setActive("lists");
        return;
      }
      const scroller = scrollerOf(lists);
      const maxed =
        scroller != null && scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <= 8;
      if (maxed && rect.bottom > 160) {
        setActive("lists");
        return;
      }
      setActive("favorites");
    };
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll, { capture: true });
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  const pill = (section: LibrarySection, Icon: LucideIcon, label: string) => (
    <button
      type="button"
      onClick={() => jumpTo(section)}
      title={label}
      aria-label={label}
      aria-current={active === section ? "true" : undefined}
      className={`relative z-10 grid h-10 w-10 place-items-center rounded-full transition-colors motion-reduce:transition-none ${
        active === section ? "text-canvas" : "text-ink-muted hover:text-ink"
      }`}
    >
      <Icon size={17} strokeWidth={2.2} />
    </button>
  );

  return (
    <div className="flex flex-col gap-8">
      <div ref={swapRef} className="animate-media-swap flex flex-col gap-8">
        <section id="manga-favorites" className="flex flex-col gap-4 -mx-4 px-4 pb-4 -mb-4">
          <h2 className="text-[22px] font-medium tracking-tight text-ink">{t("Favorites")}</h2>
          {favs.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-edge-soft bg-surface/40 px-6 py-10 text-center text-[14px] text-ink-muted">
              {t("Star any manga and it takes over this screen.")}
            </p>
          ) : (
            <VirtualGrid
              items={favs}
              scrollRef={scrollRef}
              minColumnWidth={150}
              gapX={16}
              gapY={28}
              estimateRowHeight={270}
              getKey={(m) => m.id}
              renderItem={(fav) => <FavCell m={fav} onOpen={openRailTitle} />}
            />
          )}
        </section>

        <section id="manga-lists" className="flex flex-col gap-4 -mx-4 px-4 pb-4 -mb-4">
          <h2 className="text-[22px] font-medium tracking-tight text-ink">{t("Lists")}</h2>
          <MyListsTab
            store={mangaLists}
            showSearch={false}
            emptyCopy={{
              title: t("Create your first manga list"),
              body: t("Group the manga you love. Reading now, backlog, all-time favorites."),
              action: t("New list"),
            }}
          />
        </section>
      </div>

      <div className="fixed end-6 top-1/2 z-40 -translate-y-1/2">
        <div className="relative flex flex-col gap-2">
          <span
            aria-hidden
            className={`absolute left-0 top-0 h-10 w-10 rounded-full bg-accent transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none ${
              active === "lists" ? "translate-y-[48px] opacity-100" : "translate-y-0 opacity-100"
            }`}
          />
          {pill("favorites", Star, t("Favorites"))}
          {pill("lists", List, t("Lists"))}
        </div>
      </div>
    </div>
  );
}
