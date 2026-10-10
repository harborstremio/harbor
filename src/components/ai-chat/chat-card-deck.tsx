import { useEffect, useState, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  LayoutList,
  Layers,
  Play,
  Info,
  Star,
} from "lucide-react";
import type { ResolvedRecommendation } from "@/lib/ai-chat-catalog";
import { ResultPoster } from "@/components/search/result-poster";
import { useView } from "@/lib/view";
import { smartPlayEpisode } from "@/lib/smart-play";
import { useUiLanguage, isRtl, useT } from "@/lib/i18n";
import { ChatMediaCard } from "./chat-media-card";

export function ChatCardDeck({
  items,
  className = "",
}: {
  items: ResolvedRecommendation[];
  className?: string;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"deck" | "list">("deck");
  // A new answer replaces the item list; reset so the index never points past the end.
  useEffect(() => {
    setCurrentIndex(0);
  }, [items]);
  const { openMeta, openPicker } = useView();
  const t = useT();
  const lang = useUiLanguage();
  const rtl = isRtl(lang);

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
  }, [items.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
  }, [items.length]);

  // In RTL, reading order is Right-to-Left:
  // - Physical Left (←) advances forward to NEXT card (handleNext)
  // - Physical Right (→) goes backward to PREV card (handlePrev)
  const onLeftClick = rtl ? handleNext : handlePrev;
  const onRightClick = rtl ? handlePrev : handleNext;
  const leftLabel = rtl ? t("Next") : t("Previous");
  const rightLabel = rtl ? t("Previous") : t("Next");

  if (items.length === 0) return null;

  if (items.length === 1) {
    return (
      <div className={`my-2 w-full max-w-[360px] mx-auto ${className}`}>
        <ChatMediaCard item={items[0]} />
      </div>
    );
  }

  const safeIndex = Math.min(currentIndex, items.length - 1);
  const currentItem = items[safeIndex];

  return (
    <div className={`my-2 flex flex-col items-center w-full max-w-[370px] mx-auto ${className}`}>
      {/* Top Deck Control & Navigation Bar */}
      <div className="flex w-full items-center justify-between px-1 mb-2 text-xs text-ink/85">
        <div className="flex items-center gap-1.5 font-semibold text-accent">
          <Sparkles size={13} />
          <span>
            {viewMode === "deck"
              ? `${safeIndex + 1} / ${items.length}`
              : t("{count} titles", { count: items.length })}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle (Cards vs List) */}
          {items.length > 2 && (
            <button
              type="button"
              onClick={() => setViewMode((m) => (m === "deck" ? "list" : "deck"))}
              title={viewMode === "deck" ? t("Show as list") : t("Show as cards")}
              className="flex items-center gap-1 rounded-lg border border-edge-soft bg-canvas/80 px-2 py-1 text-[11px] font-medium text-ink transition-colors hover:bg-canvas hover:text-accent active:scale-95"
            >
              {viewMode === "deck" ? (
                <>
                  <LayoutList size={12} />
                  <span>{t("List")}</span>
                </>
              ) : (
                <>
                  <Layers size={12} />
                  <span>{t("Cards")}</span>
                </>
              )}
            </button>
          )}

          {/* Previous / Next buttons */}
          {viewMode === "deck" && (
            <div className="flex items-center gap-1" dir="ltr">
              <button
                type="button"
                onClick={onLeftClick}
                aria-label={leftLabel}
                title={leftLabel}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-edge-soft bg-canvas/85 text-ink transition-colors hover:bg-canvas hover:text-accent active:scale-95"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                type="button"
                onClick={onRightClick}
                aria-label={rightLabel}
                title={rightLabel}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-edge-soft bg-canvas/85 text-ink transition-colors hover:bg-canvas hover:text-accent active:scale-95"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content: Either Deck Carousel or Scrollable List */}
      {viewMode === "deck" ? (
        <>
          {/* Main Centered Card with side overlay arrows */}
          <div className="relative w-full transition-all duration-300">
            <ChatMediaCard key={currentItem.meta.id} item={currentItem} />

            {/* Left side overlay arrow (physical left) */}
            <button
              type="button"
              onClick={onLeftClick}
              aria-label={leftLabel}
              title={leftLabel}
              className="absolute -left-3 top-1/2 -translate-y-1/2 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-edge-soft bg-canvas/95 text-ink shadow-md backdrop-blur-md transition-all hover:scale-110 hover:border-accent hover:text-accent active:scale-95"
            >
              <ChevronLeft size={14} />
            </button>

            {/* Right side overlay arrow (physical right) */}
            <button
              type="button"
              onClick={onRightClick}
              aria-label={rightLabel}
              title={rightLabel}
              className="absolute -right-3 top-1/2 -translate-y-1/2 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-edge-soft bg-canvas/95 text-ink shadow-md backdrop-blur-md transition-all hover:scale-110 hover:border-accent hover:text-accent active:scale-95"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Pagination indicator */}
          {items.length <= 15 ? (
            <div className="mt-2.5 flex items-center justify-center gap-1.5 flex-wrap max-w-full px-2">
              {items.map((item, idx) => (
                <button
                  key={item.meta.id}
                  type="button"
                  aria-label={t("Jump to title {number}", { number: idx + 1 })}
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === safeIndex
                      ? "w-5 bg-accent"
                      : "w-1.5 bg-ink-subtle/40 hover:bg-ink-subtle"
                  }`}
                />
              ))}
            </div>
          ) : (
            <div className="mt-2.5 text-[11px] text-ink/80">
              {t("Use the arrows to browse {count} titles", { count: items.length })}
            </div>
          )}
        </>
      ) : (
        /* Scrollable List View (ideal for long franchises with up to 40+ movies) */
        <div className="w-full max-h-[420px] overflow-y-auto space-y-2 pe-1 scroll-smooth">
          {items.map((it, idx) => (
            <div
              key={it.meta.id}
              className="flex items-center gap-3 rounded-xl border border-edge-soft bg-canvas/90 p-2 text-start transition-colors hover:border-accent/40 hover:bg-canvas"
            >
              <span className="w-5 text-center text-xs font-bold text-ink/85 shrink-0">
                {idx + 1}
              </span>

              {/* Mini Poster */}
              <button
                type="button"
                aria-label={t("Details")}
                onClick={() => openMeta(it.meta)}
                className="h-16 w-11 shrink-0 cursor-pointer overflow-hidden rounded-lg shadow ring-1 ring-edge-soft"
              >
                <ResultPoster
                  id={it.meta.id}
                  poster={it.meta.poster}
                  className="h-full w-full object-cover"
                />
              </button>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => openMeta(it.meta)}
                  className="text-start text-xs font-bold text-ink hover:text-accent transition-colors truncate"
                  title={it.meta.name}
                >
                  {it.meta.name}
                </button>

                <div className="flex items-center gap-2 text-[11px] text-ink/85 mt-0.5">
                  {it.meta.releaseInfo && <span>{it.meta.releaseInfo}</span>}
                  {it.meta.imdbRating && (
                    <span className="flex items-center gap-0.5 text-amber-400 font-semibold">
                      <Star size={10} className="fill-current" />
                      {it.meta.imdbRating}
                    </span>
                  )}
                  {it.runtimeMinutes && (
                    <span>{t("{count} min", { count: Math.round(it.runtimeMinutes) })}</span>
                  )}
                </div>

                {it.reason && (
                  <p className="text-[10.5px] text-ink/80 truncate mt-0.5">{it.reason}</p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                {it.isReleased === true ? (
                  <button
                    type="button"
                    onClick={() =>
                      openPicker(it.meta, smartPlayEpisode(it.meta), { autoPlay: true })
                    }
                    title={t("Play")}
                    aria-label={t("Play")}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-canvas shadow transition-transform hover:scale-105 active:scale-95"
                  >
                    <Play size={11} className="fill-current" />
                  </button>
                ) : (
                  <span
                    title={
                      it.releaseDate
                        ? t("Release date: {date}", { date: it.releaseDate })
                        : t("Release status unconfirmed")
                    }
                    className="inline-flex items-center justify-center px-2 py-1 text-[10px] font-semibold text-amber-400 bg-amber-500/10 rounded-lg ring-1 ring-amber-500/20"
                  >
                    {it.isReleased === false ? t("Upcoming") : t("Release status unconfirmed")}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => openMeta(it.meta)}
                  title={t("Details")}
                  aria-label={t("Details")}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-edge-soft text-ink hover:bg-elevated"
                >
                  <Info size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
