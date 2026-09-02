import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, KeyRound, LayoutGrid, List, Trophy } from "lucide-react";
import { AwardLogo, laurelColorFor } from "@/components/icons/award-logo";
import { Laurel } from "@/components/icons/laurel";
import { Poster, usePosterChain } from "@/components/poster";
import { AWARD_CATALOG } from "@/lib/awards-catalog";
import { loadAwardFilms } from "@/lib/awards/award-page";
import type { Meta } from "@/lib/cinemeta";
import type { AwardType } from "@/lib/providers/wikidata";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";

const MOBILE_AWARDS: AwardType[] = [
  "oscar",
  "golden_globe",
  "bafta",
  "sag",
  "emmy",
  "critics_choice",
  "cannes",
  "venice",
];

const INITIAL = 48;
const STEP = 24;
const MODE_KEY = "harbor.award.mobile.mode";
type Mode = "grid" | "list";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const AWARDS_CSS = `
@keyframes ma-in { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
@keyframes ma-out { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(14px); } }
.ma-in { animation: ma-in 320ms var(--ease-out) both; }
.ma-out { animation: ma-out 220ms var(--ease-out) both; }
@media (prefers-reduced-motion: reduce) { .ma-in, .ma-out { animation: none; } }
`;

function readMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

export function MobileAwards({
  onClose,
  onOpenDetail,
}: {
  onClose: () => void;
  onOpenDetail: (m: Meta) => void;
}) {
  const t = useT();
  const { settings } = useSettings();
  const key = settings.tmdbKey;
  const hasKey = !!key;

  const scrollRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef(INITIAL);
  const [reduced] = useState(prefersReducedMotion);
  const [closing, setClosing] = useState(false);
  const [awardType, setAwardType] = useState<AwardType>("oscar");
  const [mode, setMode] = useState<Mode>(readMode);
  const [films, setFilms] = useState<Meta[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [done, setDone] = useState(false);

  const meta = AWARD_CATALOG[awardType];
  const tint = laurelColorFor(awardType);

  const close = useCallback(() => {
    if (reduced) onClose();
    else setClosing(true);
  }, [reduced, onClose]);

  const selectMode = useCallback((m: Mode) => {
    setMode(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!hasKey) {
      setFilms([]);
      setLoading(false);
      setDone(true);
      return;
    }
    let cancelled = false;
    setFilms([]);
    setLoading(true);
    setDone(false);
    setLoadingMore(false);
    targetRef.current = INITIAL;
    loadAwardFilms(key, awardType, INITIAL)
      .then((res) => {
        if (cancelled) return;
        setFilms(res.films);
        setDone(res.done);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [awardType, key, hasKey]);

  const loadMore = useCallback(() => {
    if (loadingMore || loading || done || !key) return;
    setLoadingMore(true);
    targetRef.current += STEP;
    loadAwardFilms(key, awardType, targetRef.current)
      .then((res) => {
        setFilms(res.films);
        setDone(res.done);
        setLoadingMore(false);
      })
      .catch(() => setLoadingMore(false));
  }, [awardType, key, loading, loadingMore, done]);

  const node = (
    <div
      ref={scrollRef}
      role="dialog"
      aria-modal="true"
      aria-label={t("Awards")}
      onAnimationEnd={(e) => {
        if (closing && e.target === e.currentTarget) onClose();
      }}
      className={`fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-canvas ${
        closing ? "ma-out" : "ma-in"
      }`}
    >
      <style>{AWARDS_CSS}</style>

      <div
        className="flex flex-col gap-6"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 14px)" }}
      >
        <div className="flex items-center gap-3 px-5">
          <button
            type="button"
            onClick={close}
            aria-label={t("Back")}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface text-ink ring-1 ring-edge-soft transition-transform active:scale-95 motion-reduce:transition-none"
          >
            <ChevronLeft size={22} strokeWidth={2.4} />
          </button>
          <span className="font-display text-[17px] font-medium tracking-tight text-ink">
            {t("Awards")}
          </span>
        </div>

        <div className="flex items-center gap-4 px-5">
          <span className="shrink-0" style={{ color: tint }}>
            <Laurel size={62}>
              <AwardLogo type={awardType} size={25} />
            </Laurel>
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="font-display text-[25px] font-medium leading-[1.05] tracking-tight text-ink">
              {meta.title}
            </h1>
            <p className="line-clamp-1 text-[11.5px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
              {meta.founded > 0
                ? t("{name} · since {year}", { name: meta.shorthand, year: meta.founded })
                : meta.shorthand}
            </p>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto px-5 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {MOBILE_AWARDS.map((type) => (
            <AwardPill
              key={type}
              type={type}
              active={type === awardType}
              onSelect={() => setAwardType(type)}
            />
          ))}
        </div>

        <div className="flex items-center justify-between px-5">
          <span className="text-[13px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
            {t("Winners")}
          </span>
          <ModeToggle mode={mode} onSelect={selectMode} tint={tint} />
        </div>

        <div
          className="px-5"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 40px)" }}
        >
          {!hasKey ? (
            <Empty
              Icon={KeyRound}
              text={t("Add a TMDB key in Settings to unlock award winners.")}
            />
          ) : loading && films.length === 0 ? (
            mode === "grid" ? (
              <GridSkeleton />
            ) : (
              <ListSkeleton />
            )
          ) : films.length === 0 ? (
            <Empty Icon={Trophy} text={t("No winners are catalogued for this award yet.")} />
          ) : mode === "grid" ? (
            <>
              <WinnerGrid films={films} onOpen={onOpenDetail} />
              {loadingMore && (
                <div className="mt-4">
                  <GridSkeleton rows={1} />
                </div>
              )}
            </>
          ) : (
            <>
              <WinnerList films={films} awardType={awardType} tint={tint} onOpen={onOpenDetail} />
              {loadingMore && (
                <div className="mt-2">
                  <ListSkeleton rows={2} />
                </div>
              )}
            </>
          )}

          {hasKey && films.length > 0 && !done && (
            <LoadMoreSentinel onLoadMore={loadMore} scrollRoot={scrollRef} />
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(node, document.body) : node;
}

function AwardPill({
  type,
  active,
  onSelect,
}: {
  type: AwardType;
  active: boolean;
  onSelect: () => void;
}) {
  const tint = laurelColorFor(type);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors motion-reduce:transition-none ${
        active ? "text-ink" : "border-edge-soft bg-surface text-ink-muted"
      }`}
      style={active ? { borderColor: tint, backgroundColor: `${tint}22` } : undefined}
    >
      <AwardLogo type={type} size={17} />
      {AWARD_CATALOG[type].shorthand}
    </button>
  );
}

function ModeToggle({
  mode,
  onSelect,
  tint,
}: {
  mode: Mode;
  onSelect: (m: Mode) => void;
  tint: string;
}) {
  const t = useT();
  return (
    <div className="flex items-center gap-1 rounded-full border border-edge-soft bg-surface p-1">
      <ModeButton
        active={mode === "grid"}
        onClick={() => onSelect("grid")}
        label={t("Grid view")}
        tint={tint}
      >
        <LayoutGrid size={16} strokeWidth={2.2} />
      </ModeButton>
      <ModeButton
        active={mode === "list"}
        onClick={() => onSelect("list")}
        label={t("List view")}
        tint={tint}
      >
        <List size={16} strokeWidth={2.2} />
      </ModeButton>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  label,
  tint,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  tint: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`grid h-9 w-9 place-items-center rounded-full transition-colors motion-reduce:transition-none ${
        active ? "text-canvas" : "text-ink-muted"
      }`}
      style={active ? { backgroundColor: tint } : undefined}
    >
      {children}
    </button>
  );
}

function WinnerGrid({ films, onOpen }: { films: Meta[]; onOpen: (m: Meta) => void }) {
  return (
    <div className="grid grid-cols-3 gap-x-3 gap-y-4">
      {films.map((m) => (
        <GridTile key={m.id} meta={m} onOpen={onOpen} />
      ))}
    </div>
  );
}

function GridTile({ meta, onOpen }: { meta: Meta; onOpen: (m: Meta) => void }) {
  const t = useT();
  const { settings } = useSettings();
  const { src, onError } = usePosterChain(
    settings.rpdbKey,
    meta.id,
    meta.poster,
    meta.type === "series" ? "series" : "movie",
  );
  return (
    <button
      type="button"
      onClick={() => onOpen(meta)}
      aria-label={t("View {title}", { title: meta.name })}
      className="text-start transition-transform duration-150 active:scale-[0.96] motion-reduce:transition-none"
    >
      <Poster
        src={src}
        onError={onError}
        seed={meta.id}
        ratio="portrait"
        lazy
        className="rounded-[12px]"
      />
      <p className="mt-1.5 line-clamp-2 text-[12px] font-medium leading-snug text-ink-muted">
        {meta.name}
      </p>
    </button>
  );
}

function WinnerList({
  films,
  awardType,
  tint,
  onOpen,
}: {
  films: Meta[];
  awardType: AwardType;
  tint: string;
  onOpen: (m: Meta) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {films.map((m) => (
        <ListRow key={m.id} meta={m} awardType={awardType} tint={tint} onOpen={onOpen} />
      ))}
    </div>
  );
}

function ListRow({
  meta,
  awardType,
  tint,
  onOpen,
}: {
  meta: Meta;
  awardType: AwardType;
  tint: string;
  onOpen: (m: Meta) => void;
}) {
  const t = useT();
  const { settings } = useSettings();
  const { src, onError } = usePosterChain(
    settings.rpdbKey,
    meta.id,
    meta.poster,
    meta.type === "series" ? "series" : "movie",
  );
  const year = meta.releaseInfo?.slice(0, 4);
  return (
    <button
      type="button"
      onClick={() => onOpen(meta)}
      aria-label={t("View {title}", { title: meta.name })}
      className="flex items-center gap-3.5 rounded-2xl p-2 text-start transition-colors active:bg-elevated/50 motion-reduce:transition-none"
    >
      <div className="w-[46px] shrink-0">
        <Poster
          src={src}
          onError={onError}
          seed={meta.id}
          ratio="portrait"
          lazy
          className="rounded-[8px]"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="line-clamp-1 text-[15px] font-medium leading-snug text-ink">
          {meta.name}
        </span>
        <span className="text-[12.5px] tabular-nums text-ink-subtle">
          {year ? `${year} · ` : ""}
          {meta.type === "series" ? t("Series") : t("Film")}
        </span>
      </div>
      <span
        aria-hidden
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface"
        style={{ boxShadow: `inset 0 0 0 1px ${tint}33` }}
      >
        <AwardLogo type={awardType} size={16} />
      </span>
    </button>
  );
}

function GridSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="grid grid-cols-3 gap-x-3 gap-y-4">
      {Array.from({ length: rows * 3 }).map((_, i) => (
        <div key={i} className="aspect-[2/3] animate-pulse rounded-[12px] bg-elevated/40" />
      ))}
    </div>
  );
}

function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3.5 p-2">
          <div className="h-[69px] w-[46px] shrink-0 animate-pulse rounded-[8px] bg-elevated/40" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-3.5 w-2/3 animate-pulse rounded bg-elevated/40" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-elevated/40" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Empty({ Icon, text }: { Icon: typeof Trophy; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 pt-24 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-surface text-ink-subtle ring-1 ring-edge-soft">
        <Icon size={24} strokeWidth={1.9} />
      </span>
      <p className="max-w-[260px] text-[14px] leading-relaxed text-ink-muted">{text}</p>
    </div>
  );
}

function LoadMoreSentinel({
  onLoadMore,
  scrollRoot,
}: {
  onLoadMore: () => void;
  scrollRoot: React.RefObject<HTMLElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onLoadMore);
  cb.current = onLoadMore;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) cb.current();
      },
      { root: scrollRoot.current ?? null, rootMargin: "800px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [scrollRoot]);
  return <div ref={ref} aria-hidden className="h-1 w-full" />;
}
