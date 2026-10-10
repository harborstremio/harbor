import { ArrowUp, ExternalLink, X } from "lucide-react";
import { Search } from "@/components/icons/search-icon";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import tmdbLogo from "@/assets/addon-logos/tmdb.png";
import { ImdbIcon } from "@/components/icons/imdb-icon";
import { Poster, usePosterChain } from "@/components/poster";
import { useRankings, type KnownForEntry, type PersonEntry } from "@/lib/rankings";
import { useSettings } from "@/lib/settings";
import { useTopRankModal, type TopRankDept } from "@/lib/top-rank-modal";
import { useView } from "@/lib/view";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { pushActivityHint } from "@/lib/discord/activity-hint";
import type { Meta } from "@/lib/cinemeta";

const DEPT_LABELS: Record<TopRankDept, { title: string; subtitle: string }> = {
  Acting: { title: "Top 100 Actors", subtitle: "Most popular performers right now" },
  Directing: { title: "Top 100 Directors", subtitle: "Filmmakers leading the conversation" },
  Production: { title: "Top 100 Producers", subtitle: "Names behind the biggest productions" },
  Writing: { title: "Top 100 Writers", subtitle: "Pens currently in demand" },
};

export function TopRankModal() {
  const { openDept, close } = useTopRankModal();
  const { topList } = useRankings();
  const { settings } = useSettings();
  const { openPerson, openMeta } = useView();
  const t = useT();
  const [query, setQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    if (!openDept) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openDept, close]);

  useEffect(() => {
    if (!openDept) return;
    setQuery("");
    setShowTop(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [openDept]);

  useEffect(() => {
    if (!openDept) return;
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setShowTop(el.scrollTop > 500);
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [openDept]);

  useEffect(() => {
    if (!openDept) return;
    const meta = DEPT_LABELS[openDept];
    return pushActivityHint({ details: `Browsing ${meta.title}`, state: meta.subtitle });
  }, [openDept]);

  const list = useMemo<PersonEntry[]>(() => (openDept ? topList(openDept) : []), [openDept, topList]);
  const filtered = useMemo(() => {
    if (!query.trim()) return list;
    const q = query.trim().toLowerCase();
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.knownFor.some((k) => k.title.toLowerCase().includes(q)),
    );
  }, [list, query]);

  if (!openDept) return null;
  const meta = DEPT_LABELS[openDept];

  return createPortal(
    <div
      className="animate-scrim-in fixed inset-0 z-[175] flex items-stretch justify-center bg-canvas/80 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={t(meta.title)}
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-dialog-in relative m-6 flex max-h-[calc(100vh-3rem)] w-full max-w-[1240px] flex-col overflow-hidden rounded-lg bg-elevated ring-1 ring-edge-soft shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]"
      >
        <header className="flex items-center justify-between gap-4 border-b border-edge-soft/45 px-7 py-5">
          <div>
            <h2 className="font-display text-[21px] font-medium leading-tight tracking-tight text-ink">
              {t(meta.title)}
            </h2>
            <p className="flex items-center gap-1.5 text-[12.5px] text-ink-muted">
              {t("{subtitle} · ranked by current popularity", { subtitle: t(meta.subtitle) })}
              <span className="ms-1 inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-canvas ring-1 ring-edge-soft">
                <img src={tmdbLogo} alt="" className="h-3.5 w-3.5 object-contain" />
              </span>
              TMDB
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 items-center gap-2 rounded-lg bg-canvas px-3 ring-1 ring-inset ring-edge-soft transition-[box-shadow] duration-150 focus-within:ring-edge">
              <Search size={14} className="text-ink-subtle" strokeWidth={2} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("Filter by name or title")}
                spellCheck={false}
                className="h-full w-56 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-subtle/60"
              />
            </div>
            <button
              onClick={close}
              aria-label={t("Close")}
              className="flex h-9 w-9 items-center justify-center rounded-md bg-white/[0.06] text-ink-subtle transition-colors duration-150 hover:bg-white/[0.10] hover:text-ink active:scale-[0.97]"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-7 py-6">
          {filtered.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-[13.5px] text-ink-muted">
              {list.length === 0 ? t("Loading…") : t("No matches.")}
            </div>
          ) : (
            <ul className="grid auto-rows-[200px] grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((p) => (
                <li key={p.id} className="h-full">
                  <PersonRow
                    person={p}
                    tmdbKey={settings.tmdbKey}
                    onOpenPerson={(id) => {
                      close();
                      openPerson(id);
                    }}
                    onOpenMedia={(media) => {
                      close();
                      openMeta(media);
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label={t("Back to top")}
          className={`absolute bottom-5 end-5 z-10 flex h-8 w-8 items-center justify-center rounded-md bg-raised text-ink-muted ring-1 ring-edge-soft transition-[transform,opacity,background-color,color] duration-200 ease-in-out hover:text-ink ${
            showTop ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
          }`}
        >
          <ArrowUp size={14} strokeWidth={2.2} />
        </button>
      </div>
    </div>,
    document.body,
  );
}

function PersonRow({
  person,
  tmdbKey,
  onOpenPerson,
  onOpenMedia,
}: {
  person: PersonEntry;
  tmdbKey: string;
  onOpenPerson: (id: number) => void;
  onOpenMedia: (m: Meta) => void;
}) {
  const t = useT();
  const photo = person.profilePath ? `https://image.tmdb.org/t/p/w185${person.profilePath}` : undefined;
  const bestKnown = person.knownFor.slice(0, 3);
  const handleImdb = useImdbOpener(person.id, tmdbKey);

  return (
    <div className="group flex h-full gap-4 rounded-lg bg-canvas/55 p-4 ring-1 ring-inset ring-edge-soft transition-colors duration-150 hover:bg-canvas">
      <button
        onClick={() => onOpenPerson(person.id)}
        className="relative h-full w-[120px] shrink-0 overflow-hidden rounded-md bg-canvas ring-1 ring-inset ring-edge-soft"
        aria-label={t("Open {name}", { name: person.name })}
      >
        {photo ? (
          <img src={photo} alt={person.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <Poster src={undefined} seed={String(person.id)} ratio="portrait" className="absolute inset-0" />
        )}
        <span className="absolute start-1.5 top-1.5 flex items-center gap-0.5 rounded-md bg-canvas/95 px-1.5 py-0.5 text-[10px] font-bold">
          <span className="text-[8.5px] uppercase tracking-[0.18em] text-ink-subtle">#</span>
          <span className="text-ink">{person.rank}</span>
        </span>
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-2 overflow-hidden">
        <button
          onClick={() => onOpenPerson(person.id)}
          className="truncate text-start text-[15px] font-semibold leading-tight text-ink transition-opacity duration-150 hover:opacity-80"
        >
          {person.name}
        </button>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-ink-subtle">{t("Best known for")}</p>
        <div className="flex max-h-[68px] flex-wrap gap-1.5 overflow-hidden">
          {bestKnown.map((k) => (
            <KnownChip key={`${k.mediaType}:${k.id}`} entry={k} onClick={() => onOpenMedia(toMeta(k))} />
          ))}
          {bestKnown.length === 0 && <span className="text-[12px] text-ink-subtle">{t("No credits available")}</span>}
        </div>
        <div className="mt-auto flex items-center gap-2 pt-1">
          <button
            onClick={() => onOpenPerson(person.id)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-ink px-3 text-[12px] font-semibold text-canvas transition-opacity duration-150 hover:opacity-90 active:scale-[0.98] motion-reduce:active:scale-100"
          >
            {t("View profile")}
            <ExternalLink size={11} strokeWidth={2.4} />
          </button>
          <button
            onClick={handleImdb.open}
            disabled={handleImdb.loading}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white/[0.06] px-3 text-[12px] text-ink-muted transition-colors duration-150 hover:bg-white/[0.10] hover:text-ink active:scale-[0.98] disabled:opacity-60 motion-reduce:active:scale-100"
            aria-label={t("Open on IMDb")}
          >
            <ImdbIcon className="h-[12px] w-auto rounded-[2px]" />
            IMDb
          </button>
        </div>
      </div>
    </div>
  );
}

function KnownChip({ entry, onClick }: { entry: KnownForEntry; onClick: () => void }) {
  const { settings } = useSettings();
  const rawPoster = entry.posterPath ? `https://image.tmdb.org/t/p/w92${entry.posterPath}` : undefined;
  const poster = usePosterChain(
    settings.rpdbKey,
    `tmdb:${entry.mediaType}:${entry.id}`,
    rawPoster,
    entry.mediaType === "tv" ? "series" : "movie",
  );
  return (
    <button
      onClick={onClick}
      className="group/chip inline-flex max-w-[170px] items-center gap-1.5 rounded-full bg-white/[0.06] py-0.5 ps-0.5 pe-2.5 transition-colors duration-150 hover:bg-white/[0.10]"
      title={entry.title}
    >
      <span className="h-7 w-5 shrink-0 overflow-hidden rounded-[3px] bg-canvas">
        {poster.src ? (
          <img src={poster.src} alt="" loading="lazy" onError={poster.onError} className="h-full w-full object-cover" />
        ) : (
          <span className="block h-full w-full bg-canvas" />
        )}
      </span>
      <span className="truncate text-[11.5px] font-medium text-ink-muted transition-colors duration-150 group-hover/chip:text-ink">
        {entry.title}
      </span>
      {entry.releaseInfo && (
        <span className="font-mono text-[10px] text-ink-subtle">{entry.releaseInfo}</span>
      )}
    </button>
  );
}

function toMeta(k: KnownForEntry): Meta {
  return {
    id: `tmdb:${k.mediaType}:${k.id}`,
    type: k.mediaType === "tv" ? "series" : "movie",
    name: k.title,
    poster: k.posterPath ? `https://image.tmdb.org/t/p/w500${k.posterPath}` : undefined,
    releaseInfo: k.releaseInfo ?? undefined,
  };
}

function useImdbOpener(personId: number, tmdbKey: string) {
  const [loading, setLoading] = useState(false);
  const cache = useRef<string | null | undefined>(undefined);

  const fallback = () => openUrl(`https://www.themoviedb.org/person/${personId}`);

  const open = async () => {
    if (cache.current === null) return fallback();
    if (cache.current) return openUrl(`https://www.imdb.com/name/${cache.current}`);
    if (!tmdbKey) return fallback();
    setLoading(true);
    try {
      const r = await fetch(
        `https://api.themoviedb.org/3/person/${personId}/external_ids?api_key=${encodeURIComponent(tmdbKey)}`,
      );
      if (r.ok) {
        const data = await r.json();
        const id = typeof data?.imdb_id === "string" && data.imdb_id.startsWith("nm") ? data.imdb_id : null;
        cache.current = id;
        if (id) openUrl(`https://www.imdb.com/name/${id}`);
        else fallback();
      } else {
        cache.current = null;
        fallback();
      }
    } catch {
      cache.current = null;
      fallback();
    } finally {
      setLoading(false);
    }
  };

  return { open, loading };
}
