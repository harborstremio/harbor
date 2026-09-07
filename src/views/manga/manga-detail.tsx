import { NavGlyph } from "@/components/icons/nav-glyph";
import { UiIcon } from "@/components/ui-icon";
import { PopIcon } from "@/components/pop-icon";
import { useEffect, useMemo, useRef, useState } from "react";
import { CoverImg } from "@/components/cover-img";
import { Award, BookOpen, ChevronLeft, Flame, RotateCcw, Sparkles, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const COLLECTION_ICON: Record<string, LucideIcon> = {
  popular: Flame,
  acclaimed: Star,
  "anime-expo": Sparkles,
  eisner: Award,
};
import { useT } from "@/lib/i18n";
import { Poster } from "@/components/poster";
import { mangaBackdrop } from "@/lib/manga/backdrop";
import { collectionsForTitle } from "@/lib/manga/collections";
import { useIsMangaFavorite, useMangaFavorites } from "@/lib/manga-favorites";
import { useMangaProgressEntry, type MangaProgressEntry } from "@/lib/manga-progress";
import { setMangaDetails } from "@/lib/manga-downloads";
import {
  chapterLanguages,
  mangaDetail,
  streamChapters,
  type MangaChapter,
  type MangaSummary,
} from "@/lib/manga/api";
import { ChapterList } from "./manga-detail/chapter-list";
import { MangaAddToListButton } from "./manga-detail/add-to-list-button";
import { RateButton } from "@/components/ratings/rate-button";
import { ratingTarget } from "@/lib/ratings/types";
import { coverageOf } from "./anime-coverage";
import { badgeArtFor, CollectionBadges } from "./collection-badge";
import { MangaAdaptationCard, MangaRecommendedRail } from "./manga-extras";
import {
  enrichManga,
  MangaUpdatesRank,
  MangaUpdatesSection,
  useMangaUpdates,
} from "./mangaupdates-info";
import { TopMangaModal } from "./top-manga-modal";
import { decodeMangaId } from "@/lib/manga/sources/suwayomi/model";
import { suwayomiBaseForSource } from "@/lib/manga/sources/suwayomi/auth-registry";
import { cachedSuwayomiSources } from "./manga-browse/langs";
import { sourceDisplayName } from "./manga-browse/all-extensions";
import { pushActivityHint } from "@/lib/discord/activity-hint";

const GRADIENT_SIDE =
  "bg-gradient-to-r from-[var(--color-canvas)] from-0% via-[color-mix(in_oklch,var(--color-canvas),transparent_45%)] via-55% to-[color-mix(in_oklch,var(--color-canvas),transparent_88%)] to-100%";
const GRADIENT_BOTTOM =
  "linear-gradient(to top, var(--color-canvas), color-mix(in oklch, var(--color-canvas), transparent 55%) 45%, transparent)";

function BackButton({ onBack }: { onBack: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-1.5 rounded-full border border-edge-soft bg-canvas/40 px-4 py-2 text-[14px] text-ink-muted backdrop-blur-sm transition-colors hover:bg-elevated hover:text-ink"
    >
      <ChevronLeft size={18} />
      {t("Back")}
    </button>
  );
}

function MangaDetailSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col gap-10 pb-4">
      <div className="relative -mx-12 -mt-24 min-h-[360px] overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-elevated/45 via-surface/30 to-canvas" />
          <div aria-hidden className={`absolute inset-0 ${GRADIENT_SIDE}`} />
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-[70%]"
            style={{ background: GRADIENT_BOTTOM }}
          />
        </div>
        <div className="relative z-10 px-12 pt-24 pb-8">
          <BackButton onBack={onBack} />
          <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-end">
            <div className="aspect-[2/3] w-52 shrink-0 animate-pulse rounded-2xl bg-raised" />
            <div className="flex flex-1 flex-col gap-4">
              <div className="h-11 w-2/3 max-w-md animate-pulse rounded-lg bg-raised" />
              <div className="h-4 w-40 animate-pulse rounded bg-raised" />
              <div className="flex gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-7 w-20 animate-pulse rounded-full bg-raised" />
                ))}
              </div>
              <div className="flex gap-3">
                <div className="h-12 w-40 animate-pulse rounded-full bg-raised" />
                <div className="h-12 w-48 animate-pulse rounded-full bg-raised" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-6">
        <div className="h-7 w-40 animate-pulse rounded bg-raised" />
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
        >
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-raised" />
          ))}
        </div>
      </div>
    </div>
  );
}

function MangaDetailError({ onBack, onRetry }: { onBack: () => void; onRetry: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-8 pb-4">
      <div className="pt-2">
        <BackButton onBack={onBack} />
      </div>
      <div className="mx-auto flex min-h-[54vh] max-w-md flex-col items-center justify-center gap-6 text-center">
        <img
          src="/manga-paper-boat.png"
          alt=""
          draggable={false}
          className="w-60 max-w-full object-contain drop-shadow-[0_16px_36px_rgba(0,0,0,0.4)]"
        />
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-[26px] font-medium tracking-tight text-ink">
            {t("This title would not open")}
          </h1>
          <p className="text-[14.5px] leading-relaxed text-ink-muted">
            {t(
              "The source returned a bad response for this manga. It may be temporary, or the title may have moved. Try another source, or head back and pick something else.",
            )}
          </p>
        </div>
        <div className="mt-1 flex items-center gap-2.5">
          <button
            type="button"
            onClick={onRetry}
            className="flex h-11 items-center gap-2 rounded-xl bg-ink px-6 text-[14px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97] motion-reduce:transition-none motion-reduce:hover:scale-100"
          >
            <RotateCcw size={16} strokeWidth={2.2} />
            {t("Try again")}
          </button>
          <button
            type="button"
            onClick={onBack}
            className="flex h-11 items-center gap-2 rounded-xl border border-edge-soft bg-elevated/40 px-5 text-[14px] font-medium text-ink-muted transition-colors hover:bg-elevated/70 hover:text-ink"
          >
            <ChevronLeft size={18} />
            {t("Back to browse")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MangaDetail({
  mangaId,
  onRead,
  onResume,
  onBack,
  onOpenManga,
  onOpenDownloads,
}: {
  mangaId: string;
  onRead: (
    chapters: MangaChapter[],
    index: number,
    manga?: { id: string; title: string; cover?: string },
  ) => void;
  onResume?: (entry: MangaProgressEntry) => void;
  onBack: () => void;
  onOpenManga: (id: string) => void;
  onOpenDownloads?: () => void;
}) {
  const t = useT();
  const [detail, setDetail] = useState<MangaSummary | null>(null);
  const [chapters, setChapters] = useState<MangaChapter[]>([]);
  const [detailPending, setDetailPending] = useState(true);
  const [chaptersPending, setChaptersPending] = useState(true);
  const [retryTick, setRetryTick] = useState(0);
  const langInitRef = useRef(false);
  const [selectedLang, setSelectedLang] = useState("en");
  const [backdrop, setBackdrop] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [topMangaOpen, setTopMangaOpen] = useState(false);
  const [extInfo, setExtInfo] = useState<{ name: string; icon?: string } | null>(null);

  const favorites = useMangaFavorites();
  const isFavorite = useIsMangaFavorite(mangaId);
  const progress = useMangaProgressEntry(mangaId, detail?.title);

  useEffect(() => {
    let alive = true;
    setExtInfo(null);
    const parsed = decodeMangaId(mangaId);
    if (!parsed) return;
    const base = suwayomiBaseForSource(parsed.sourceId);
    if (!base) return;
    cachedSuwayomiSources({ baseUrl: base })
      .then((list) => {
        if (!alive) return;
        const source = list.find((s) => s.id === parsed.sourceId);
        if (source) setExtInfo({ name: sourceDisplayName(source), icon: source.iconUrl });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [mangaId]);

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setChapters([]);
    setDetailPending(true);
    setChaptersPending(true);
    setBackdrop(null);
    setExpanded(false);
    langInitRef.current = false;

    mangaDetail(mangaId)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setDetailPending(false);
      });

    streamChapters(mangaId, (chunk) => {
      if (cancelled || chunk.length === 0) return;
      setChapters((prev) => [...prev, ...chunk]);
      if (!langInitRef.current) {
        langInitRef.current = true;
        const ls = chapterLanguages(chunk);
        setSelectedLang(ls.find((l) => l.code === "en")?.code ?? ls[0]?.code ?? "en");
      }
    })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setChaptersPending(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mangaId, retryTick]);

  useEffect(() => {
    if (!detail?.title) return;
    let cancelled = false;
    mangaBackdrop(detail.title).then((url) => {
      if (!cancelled) setBackdrop(url);
    });
    return () => {
      cancelled = true;
    };
  }, [detail?.title]);

  useEffect(() => {
    if (!detail?.title) return;
    return pushActivityHint({
      details: `Browsing ${detail.title}`,
      state: "Manga",
      largeImage: detail.cover,
      largeText: detail.title,
    });
  }, [detail?.title, detail?.cover]);

  useEffect(() => {
    if (!detail?.title) return;
    void setMangaDetails(mangaId, detail.title, detail.cover);
  }, [mangaId, detail?.title, detail?.cover]);

  const langs = useMemo(() => chapterLanguages(chapters), [chapters]);
  const langFiltered = useMemo(
    () => chapters.filter((c) => c.language === selectedLang),
    [chapters, selectedLang],
  );
  const muInfo = useMangaUpdates(detail?.title);
  const coverage = useMemo(
    () => (muInfo ? coverageOf(muInfo, langFiltered) : null),
    [muInfo, langFiltered],
  );

  const retry = () => setRetryTick((n) => n + 1);
  const noContent = !detail && chapters.length === 0;
  if (noContent && (detailPending || chaptersPending))
    return <MangaDetailSkeleton onBack={onBack} />;
  if (noContent) return <MangaDetailError onBack={onBack} onRetry={retry} />;

  const enriched = enrichManga(detail, muInfo);
  const collections = collectionsForTitle(detail?.title);
  const chipCollections = collections.filter((c) => !badgeArtFor(c.id));
  const awardArtCount = collections.length - chipCollections.length;
  const descMaxWidth = awardArtCount
    ? `min(48rem, calc(100% - ${awardArtCount * 84 + (awardArtCount - 1) * 8 + 24}px))`
    : "48rem";
  const mangaMeta = { id: mangaId, title: detail?.title ?? "", cover: detail?.cover };
  const resumeLabel = progress
    ? (progress.chapterNumber
        ? t("Resume Ch. {n}", { n: progress.chapterNumber })
        : t("Resume reading")) + (progress.page > 1 ? ` · p${progress.page}` : "")
    : "";
  const bannerSrc = backdrop || detail?.cover;
  const canRead = langFiltered.length > 0;
  const longDesc = (enriched.description?.length ?? 0) > 280;

  const pills: string[] = [];
  if (enriched.year) pills.push(enriched.year);
  if (enriched.statusLabel) pills.push(enriched.statusLabel);
  pills.push(
    chapters.length === 1
      ? t("{n} chapter", { n: chapters.length })
      : t("{n} chapters", { n: chapters.length }),
  );

  return (
    <div className="flex flex-col gap-10 pb-4">
      <div className="relative -mx-12 -mt-24 min-h-[360px] overflow-hidden">
        <div className="absolute inset-0 z-0">
          {bannerSrc && (
            <CoverImg
              src={bannerSrc}
              alt=""
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
              style={
                backdrop
                  ? { objectPosition: "50% 22%" }
                  : { filter: "blur(28px)", transform: "scale(1.18)", objectPosition: "50% 25%" }
              }
            />
          )}
          <div aria-hidden className={`absolute inset-0 ${GRADIENT_SIDE}`} />
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-[70%]"
            style={{ background: GRADIENT_BOTTOM }}
          />
        </div>

        <div className="absolute bottom-6 end-12 z-20">
          <CollectionBadges title={detail?.title} size={84} />
        </div>

        <div className="relative z-10 px-12 pt-24 pb-8">
          <BackButton onBack={onBack} />
          <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-end">
            <div className="w-52 shrink-0">
              <Poster
                src={detail?.cover}
                seed={mangaId}
                className="rounded-2xl shadow-xl ring-1 ring-edge"
              />
            </div>
            <div className="flex flex-1 flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <h1
                  className="text-[40px] font-medium leading-[1.05] tracking-tight text-ink drop-shadow-[0_2px_18px_rgba(0,0,0,0.5)]"
                  style={{ fontFamily: '"QR Ames Beta", var(--font-display), serif' }}
                >
                  {detail?.title ?? t("Untitled")}
                </h1>
                {detail?.altTitle && (
                  <p className="text-[16px] text-ink-muted">{detail.altTitle}</p>
                )}
                {muInfo && enriched.author && (
                  <p className="text-[14px] text-ink-muted">
                    {t("by {author}", { author: enriched.author })}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {extInfo && (
                  <span
                    title={t("Source extension")}
                    className="inline-flex items-center gap-1.5 rounded-full bg-elevated/60 px-3 py-1 text-[13px] font-medium text-ink ring-1 ring-edge-soft backdrop-blur-sm"
                  >
                    {extInfo.icon && (
                      <img
                        src={extInfo.icon}
                        alt=""
                        className="h-3.5 w-3.5 rounded-[3px] object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    )}
                    {extInfo.name}
                  </span>
                )}
                {pills.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1.5 rounded-full bg-elevated/60 px-3 py-1 text-[13px] text-ink-muted ring-1 ring-edge-soft backdrop-blur-sm"
                  >
                    {p === enriched.statusLabel && (
                      <span
                        aria-hidden
                        className={`h-2 w-2 rounded-full ${
                          /ongoing/i.test(p) ? "bg-success" : "bg-ink-subtle/60"
                        }`}
                      />
                    )}
                    {p}
                  </span>
                ))}
                {muInfo?.rankYear != null && (
                  <MangaUpdatesRank rank={muInfo.rankYear} onClick={() => setTopMangaOpen(true)} />
                )}
              </div>

              {chipCollections.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {chipCollections.map((c) => {
                    const Icon = COLLECTION_ICON[c.id] ?? Award;
                    return (
                      <span
                        key={c.id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-elevated/60 py-1 pl-2 pr-2.5 text-[12px] font-medium text-accent ring-1 ring-edge-soft backdrop-blur-sm"
                      >
                        <Icon size={12.5} strokeWidth={2.4} />
                        {t(c.badge)}
                      </span>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={!canRead}
                  onClick={() =>
                    canRead && onRead(langFiltered, langFiltered.length - 1, mangaMeta)
                  }
                  className="inline-flex h-12 items-center gap-2.5 rounded-full bg-ink px-7 text-[15px] font-semibold text-canvas transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
                >
                  <BookOpen size={19} />
                  {t("Read latest")}
                </button>
                {progress && onResume ? (
                  <button
                    type="button"
                    onClick={() => onResume(progress)}
                    className="inline-flex h-12 items-center gap-2 rounded-full bg-white/[0.06] px-6 text-[15px] font-semibold text-ink ring-1 ring-inset ring-edge-soft transition-colors duration-150 hover:bg-white/[0.10] active:scale-[0.98]"
                  >
                    <RotateCcw size={17} strokeWidth={2.2} />
                    {resumeLabel}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!canRead}
                    onClick={() => canRead && onRead(langFiltered, 0, mangaMeta)}
                    className="inline-flex h-12 items-center rounded-full bg-white/[0.06] px-6 text-[15px] font-semibold text-ink ring-1 ring-inset ring-edge-soft transition-colors duration-150 hover:bg-white/[0.10] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
                  >
                    {t("Start from beginning")}
                  </button>
                )}
                <button
                  type="button"
                  aria-pressed={isFavorite}
                  aria-label={isFavorite ? t("Remove favorite") : t("Add favorite")}
                  onClick={() =>
                    detail &&
                    favorites.toggle({ id: mangaId, title: detail.title, cover: detail.cover })
                  }
                  className={`group flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-[transform,background-color] duration-200 active:scale-[0.94] ${
                    isFavorite
                      ? "bg-accent/20 text-accent hover:bg-accent/22"
                      : "bg-white/[0.06] text-ink hover:bg-white/[0.10]"
                  }`}
                >
                  <PopIcon
                    active={isFavorite}
                    activeIcon={<UiIcon name="unfavorite" className="h-5 w-5" />}
                    inactiveIcon={<UiIcon name="favorite" className="h-5 w-5" />}
                  />
                </button>
                {detail && (
                  <RateButton
                    tone="lift"
                    target={ratingTarget(
                      { id: mangaId, name: detail.title, poster: detail.cover },
                      "manga",
                    )}
                  />
                )}
                <MangaAddToListButton
                  mangaId={mangaId}
                  title={detail?.title ?? ""}
                  cover={detail?.cover}
                />
                {onOpenDownloads && (
                  <button
                    type="button"
                    aria-label={t("Downloads")}
                    title={t("Downloads")}
                    onClick={onOpenDownloads}
                    className="group flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-ink transition-[transform,background-color] duration-200 hover:bg-white/[0.10] active:scale-[0.94]"
                  >
                    <NavGlyph name="download" className="h-5 w-5" />
                  </button>
                )}
              </div>

              {enriched.description && (
                <div style={{ maxWidth: descMaxWidth }}>
                  <p
                    className={`whitespace-pre-line text-[15px] leading-relaxed text-ink-muted ${
                      expanded ? "" : "line-clamp-4"
                    }`}
                  >
                    {enriched.description}
                  </p>
                  {longDesc && (
                    <button
                      type="button"
                      onClick={() => setExpanded((v) => !v)}
                      className="mt-1.5 text-[14px] font-medium text-accent transition-colors hover:text-ink"
                    >
                      {expanded ? t("Show less") : t("Show more")}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {detail?.title && (
        <MangaAdaptationCard
          title={detail.title}
          info={muInfo}
          chapters={langFiltered}
          onReadChapter={(index) => onRead(langFiltered, index, mangaMeta)}
          heroBg={backdrop}
        />
      )}

      {muInfo && (
        <MangaUpdatesSection
          info={muInfo}
          title={detail?.title}
          altTitle={detail?.altTitle}
          onOpenManga={onOpenManga}
        />
      )}

      <ChapterList
        chapters={langFiltered}
        langs={langs}
        selectedLang={selectedLang}
        onSelectLang={setSelectedLang}
        onRead={(chs, i) => onRead(chs, i, mangaMeta)}
        mangaId={mangaId}
        mangaTitle={detail?.title}
        mangaCover={detail?.cover}
        animeEndChapter={coverage?.endChapter}
        pending={chaptersPending}
      />

      {detail?.title && <MangaRecommendedRail title={detail.title} onOpen={onOpenManga} />}

      <TopMangaModal
        open={topMangaOpen}
        onClose={() => setTopMangaOpen(false)}
        onOpenManga={(id) => {
          setTopMangaOpen(false);
          onOpenManga(id);
        }}
      />
    </div>
  );
}
