import { ArrowLeft, Pencil, Rows3 } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { posterPlate } from "@/components/poster";
import { ResultPoster } from "@/components/search/result-poster";
import { BackToTop } from "@/components/back-to-top";
import { useView } from "@/lib/view";
import { useCollection, type CollectionItem, type CollectionItemType } from "@/lib/collections";
import type { MetaType } from "@/lib/cinemeta";
import { CommunityShareButton } from "./community-share-button";
import { AddToPageMenu } from "./add-to-page-menu";
import { Avatar } from "@/components/together-modal/avatar";
import { useSelfAvatar } from "@/views/profile/use-self-avatar";
import { currentAuthor } from "@/lib/theme-auth";
import { UserHoverCard } from "@/views/profile/user-hover-card";
import { requestOpenProfile } from "@/lib/social/open-profile";

const TYPE_DOT: Record<CollectionItemType, string> = {
  movie: "bg-sky-400",
  series: "bg-emerald-400",
  manga: "bg-violet-400",
};

function firstPoster(items: CollectionItem[]): string | undefined {
  return items.find((it) => it.poster)?.poster;
}

export function CommunityCollectionPage({
  id,
  onBack,
  onEdit,
}: {
  id: string;
  onBack: () => void;
  onEdit: (id: string) => void;
}) {
  const t = useT();
  const collection = useCollection(id);
  const { openMeta, openManga } = useView();
  const self = useSelfAvatar();
  const scrollRef = useRef<HTMLElement>(null);
  const pageBtnRef = useRef<HTMLButtonElement>(null);
  const [pageMenu, setPageMenu] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"all" | CollectionItemType>("all");
  const items = collection?.items ?? [];
  const typeCounts = useMemo(() => {
    const c = { movie: 0, series: 0, manga: 0 };
    for (const it of items) c[it.type]++;
    return c;
  }, [items]);
  const filteredItems = useMemo(
    () => (typeFilter === "all" ? items : items.filter((it) => it.type === typeFilter)),
    [items, typeFilter],
  );
  const [gridHeight, setGridHeight] = useState<number>();
  const gridObs = useRef<ResizeObserver | null>(null);
  const gridMeasureRef = useCallback((el: HTMLDivElement | null) => {
    gridObs.current?.disconnect();
    if (!el) return;
    const ro = new ResizeObserver(() => setGridHeight(el.offsetHeight));
    ro.observe(el);
    gridObs.current = ro;
    setGridHeight(el.offsetHeight);
  }, []);

  if (!collection) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-[15px] text-ink-muted">{t("This collection is no longer here.")}</p>
        <button
          type="button"
          onClick={onBack}
          className="h-11 rounded-full border border-edge px-6 text-[14px] font-semibold text-ink transition-colors hover:border-ink-subtle"
        >
          {t("Back to collections")}
        </button>
      </main>
    );
  }

  const seed = collection.id + collection.name;
  const poster = firstPoster(collection.items);
  const backdrop = collection.bgImage || poster;
  const backdropSharp = !!collection.bgImage;
  const count = collection.items.length;
  const numbered = !!collection.numbered;
  const authorHandle = self.handle;
  const authorName = currentAuthor()?.username ?? authorHandle ?? "";
  const typeLabel = (ty: CollectionItemType) =>
    ty === "movie" ? t("Movie") : ty === "series" ? t("Series") : t("Manga");
  const typeFilters: { id: "all" | CollectionItemType; label: string; count: number }[] = [
    { id: "all", label: t("All"), count },
    { id: "movie", label: t("Movies"), count: typeCounts.movie },
    { id: "series", label: t("Series"), count: typeCounts.series },
    { id: "manga", label: t("Manga"), count: typeCounts.manga },
  ];
  const distinctTypes = [typeCounts.movie, typeCounts.series, typeCounts.manga].filter(
    (n) => n > 0,
  ).length;

  const open = (item: CollectionItem) => {
    if (item.type === "manga") {
      openManga(item.id);
      return;
    }
    const type: MetaType = item.type === "series" ? "series" : "movie";
    openMeta({ id: item.id, type, name: item.name, poster: item.poster });
  };

  return (
    <main ref={scrollRef} className="relative flex-1 overflow-y-auto">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[62vh]">
        {backdrop ? (
          <img
            src={backdrop}
            alt=""
            draggable={false}
            className={`h-full w-full object-cover ${backdropSharp ? "" : "scale-110 blur-2xl"}`}
          />
        ) : (
          <div className="h-full w-full" style={{ background: posterPlate(seed) }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-canvas/50 via-canvas/85 to-canvas" />
      </div>

      <div className="relative mx-auto flex w-full max-w-[1400px] flex-col gap-9 px-5 pb-24 pt-24 sm:px-8 lg:px-12 lg:pt-28">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-edge-soft bg-elevated/60 ps-3.5 pe-5 text-[14px] font-semibold text-ink backdrop-blur-md transition-colors hover:bg-raised"
          >
            <ArrowLeft size={17} strokeWidth={2.2} className="dir-icon" />
            {t("Collections")}
          </button>
          <div className="flex items-center gap-2">
            <button
              ref={pageBtnRef}
              type="button"
              onClick={() => setPageMenu((v) => !v)}
              aria-label={t("Add to a page")}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-edge bg-canvas/80 px-5 text-[14px] font-semibold text-ink backdrop-blur-md transition-colors hover:border-ink-subtle hover:bg-canvas/95"
            >
              <Rows3 size={15} strokeWidth={2} />
              <span className="hidden sm:inline">{t("Add to a page")}</span>
            </button>
            <button
              type="button"
              onClick={() => onEdit(id)}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-edge bg-canvas/80 px-5 text-[14px] font-semibold text-ink backdrop-blur-md transition-colors hover:border-ink-subtle hover:bg-canvas/95"
            >
              <Pencil size={15} strokeWidth={2} />
              {t("Edit")}
            </button>
            <CommunityShareButton collectionId={id} variant="pill" />
          </div>
          <AddToPageMenu
            collectionId={id}
            anchorRef={pageBtnRef}
            open={pageMenu}
            onClose={() => setPageMenu(false)}
          />
        </div>

        <header className="flex min-w-0 max-w-4xl flex-col gap-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-ink-subtle">
            {t("Collection")}
          </span>
          <h1 className="font-display text-[clamp(2.6rem,6vw,4.25rem)] font-medium leading-[1.02] tracking-tight text-ink">
            {collection.name}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {authorHandle && (
              <UserHoverCard handle={authorHandle}>
                <button
                  type="button"
                  onClick={() => requestOpenProfile(authorHandle)}
                  aria-label={t("Open {alias} profile", { alias: authorName })}
                  className="inline-flex items-center gap-2 rounded-full border border-edge-soft bg-elevated/60 py-1 ps-1 pe-3 backdrop-blur-md transition-colors hover:bg-raised"
                >
                  <Avatar name={authorName} src={self.avatar} size={24} />
                  <span className="text-[13px] font-semibold text-ink">@{authorHandle}</span>
                </button>
              </UserHoverCard>
            )}
            <span className="text-[13px] tabular-nums text-ink-subtle">
              {count === 1 ? t("{n} title", { n: count }) : t("{n} titles", { n: count })}
            </span>
          </div>
          {collection.description && (
            <p className="max-w-2xl text-[15px] leading-relaxed text-ink-muted">
              {collection.description}
            </p>
          )}
        </header>

        {count === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-edge-soft bg-canvas/40 px-8 py-16 text-center">
            <p className="font-display text-[19px] font-medium text-ink">{t("Nothing here yet")}</p>
            <p className="max-w-sm text-[13.5px] leading-relaxed text-ink-muted">
              {t("Open the editor to add the movies, shows, and manga that belong in this collection.")}
            </p>
            <button
              type="button"
              onClick={() => onEdit(id)}
              className="mt-1 inline-flex h-11 items-center gap-2 rounded-full bg-accent px-6 text-[14px] font-semibold text-white transition-transform hover:scale-[1.03]"
            >
              <Pencil size={15} strokeWidth={2.2} />
              {t("Add titles")}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {distinctTypes > 1 && (
              <div className="flex flex-wrap items-center gap-2">
                {typeFilters.map((f) => {
                  if (f.id !== "all" && f.count === 0) return null;
                  const on = typeFilter === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setTypeFilter(f.id)}
                      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors ${
                        on
                          ? "border-transparent bg-ink text-canvas"
                          : "border-edge-soft bg-canvas/40 text-ink-muted hover:border-edge hover:text-ink"
                      }`}
                    >
                      {f.id !== "all" && (
                        <span className={`h-1.5 w-1.5 rounded-full ${TYPE_DOT[f.id]}`} />
                      )}
                      {f.label}
                      <span className={`tabular-nums ${on ? "text-canvas/70" : "text-ink-subtle"}`}>
                        {f.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <div
              className="overflow-hidden transition-[height] duration-300 ease-out"
              style={gridHeight ? { height: gridHeight } : undefined}
            >
              <div ref={gridMeasureRef}>
                <div
                  key={typeFilter}
                  className="grid animate-fade-in gap-4"
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(128px, 1fr))" }}
                >
                  {filteredItems.map((item, i) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => open(item)}
                      title={`${item.name}  ·  ${typeLabel(item.type)}`}
                      className="group/poster flex flex-col gap-2 text-start"
                    >
                      <div className="relative transition-transform duration-200 ease-out group-hover/poster:-translate-y-0.5">
                        <ResultPoster
                          id={item.id}
                          poster={item.poster}
                          className="ring-1 ring-transparent transition-all duration-200 group-hover/poster:ring-edge"
                        />
                        {numbered && (
                          <span className="pointer-events-none absolute start-1.5 top-1.5 flex min-w-[1.55rem] items-center justify-center rounded-full bg-black/70 px-1.5 py-0.5 text-[12.5px] font-bold tabular-nums text-white shadow-sm backdrop-blur-md">
                            {i + 1}
                          </span>
                        )}
                        <span
                          className={`pointer-events-none absolute top-1.5 inline-flex items-center gap-1 rounded-full bg-black/55 py-0.5 ps-1.5 pe-2 text-[10px] font-semibold text-white/90 backdrop-blur-md ${
                            numbered ? "end-1.5" : "start-1.5"
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${TYPE_DOT[item.type]}`} />
                          {typeLabel(item.type)}
                        </span>
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-[var(--poster-radius,12px)] bg-gradient-to-t from-black/85 via-black/35 to-transparent p-2 pt-7 opacity-0 transition-opacity duration-200 group-hover/poster:opacity-100">
                          <p className="line-clamp-3 text-[11px] font-medium leading-tight text-white">
                            {item.name}
                          </p>
                        </div>
                      </div>
                      <span className="line-clamp-2 text-[12.5px] leading-tight text-ink-muted">
                        {item.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <BackToTop scrollRef={scrollRef} />
    </main>
  );
}
