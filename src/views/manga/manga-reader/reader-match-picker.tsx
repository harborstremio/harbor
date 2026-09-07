import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, RefreshCw, Search, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { CoverImg } from "@/components/cover-img";
import { type MangaCandidate, type MangaTracker } from "@/lib/manga/sync";
import { normalizeTitle, setMangaMatch, setMangaMatchDismissed } from "@/lib/manga-match";
import { searchAnilistMangaEntries } from "@/lib/manga/tracking-anilist";
import { searchMalMangaEntries } from "@/lib/manga/tracking-mal";

const TRACKER_LABEL: Record<MangaTracker, string> = {
  anilist: "AniList",
  mal: "MyAnimeList",
};

function searchCandidates(tracker: MangaTracker, title: string): Promise<MangaCandidate[]> {
  return tracker === "anilist"
    ? searchAnilistMangaEntries(title)
    : searchMalMangaEntries(title);
}

export function ReaderMatchPicker({
  title,
  pid,
  trackers,
  shortcut,
  onClose,
}: {
  title: string;
  pid: string;
  trackers: MangaTracker[];
  shortcut: string;
  onClose: () => void;
}) {
  const t = useT();
  const [active, setActive] = useState<MangaTracker>(trackers[0]);
  const searchTracker: MangaTracker = active;
  const [query, setQuery] = useState(title);
  const [debounced, setDebounced] = useState(title);
  const [hits, setHits] = useState<MangaCandidate[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const confirmedRef = useRef(false);
  const activeRef = useRef(active);
  activeRef.current = active;
  const doneRef = useRef<Set<MangaTracker>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Start fresh (title query, loading state, unconfirmed) every time the tab switches.
  const switchTracker = useCallback(
    (next: MangaTracker) => {
      setActive(next);
      setQuery(title);
      setDebounced(title);
      setHits(null);
      setLinkingId(null);
      confirmedRef.current = false;
    },
    [title],
  );

  const markDone = (tracker: MangaTracker) => {
    doneRef.current.add(tracker);
    const remaining = trackers.filter((tr) => !doneRef.current.has(tr));
    if (remaining.length > 0) switchTracker(remaining[0]);
    else onClose();
  };

  const dismiss = () => {
    if (!confirmedRef.current) {
      setMangaMatchDismissed(pid, active, normalizeTitle(title));
    }
    markDone(active);
  };

  const load = useCallback(
    async (q: string) => {
      const tracker = activeRef.current;
      setBusy(true);
      try {
        const res = await searchCandidates(tracker, q);
        if (activeRef.current === tracker) setHits(res);
      } catch {
        if (activeRef.current === tracker) setHits([]);
      } finally {
        if (activeRef.current === tracker) setBusy(false);
      }
    },
    [],
  );

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query.trim() || title), 350);
    return () => window.clearTimeout(id);
  }, [query, title]);

  useEffect(() => {
    void load(debounced);
  }, [debounced, load, searchTracker]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const confirm = async (chosen: MangaCandidate) => {
    setLinkingId(chosen.id);
    const titleKey = normalizeTitle(title);
    confirmedRef.current = true;
    setMangaMatch(pid, active, titleKey, String(chosen.id), chosen.title);
    markDone(active);
  };

  return (
    <>
      <div aria-hidden onClick={dismiss} className="animate-fade-in fixed inset-0 z-[97] bg-black/45 backdrop-blur-[2px]" />
      <div className="animate-fade-in fixed inset-0 z-[98] grid place-items-center px-4">
        <div className="pointer-events-auto flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-edge-soft bg-raised/95 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.75)] backdrop-blur-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-edge-soft px-4 py-3">
            <div className="min-w-0">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
                {t("Match manga")}
              </span>
              <span className="block truncate text-[14px] font-semibold text-ink">{title}</span>
              <span className="mt-0.5 block text-[11.5px] leading-relaxed text-ink-muted">
                {t("Choose a match, or select None to skip")}
              </span>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label={t("Close")}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ink-subtle transition hover:bg-elevated hover:text-ink"
            >
              <X size={16} />
            </button>
          </div>

          {trackers.length > 1 && (
            <div className="border-b border-edge-soft px-3 py-2.5">
              <div className="flex items-center gap-1 rounded-xl bg-surface/70 p-1 ring-1 ring-edge-soft">
                {trackers.map((tr) => {
                  const done = doneRef.current.has(tr);
                  const isActive = tr === active;
                  return (
                    <button
                      key={tr}
                      type="button"
                      onClick={() => switchTracker(tr)}
                      className={
                        isActive
                          ? "flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-elevated px-3 py-1.5 text-[12px] font-semibold text-ink shadow-sm"
                          : "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-ink-subtle transition hover:text-ink"
                      }
                    >
                      {done && <Check size={13} className="text-accent" />}
                      {TRACKER_LABEL[tr]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 border-b border-edge-soft px-3 py-2.5">
            <Search size={15} className="shrink-0 text-ink-subtle" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !busy) void load(query);
              }}
              placeholder={t("Search title on {tracker}", { tracker: TRACKER_LABEL[searchTracker] })}
              className="h-8 min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-subtle"
            />
            {busy ? (
              <Loader2 size={14} className="shrink-0 animate-spin text-ink-subtle" />
            ) : (
              <button
                type="button"
                onClick={() => void load(query)}
                aria-label={t("Search")}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ink-subtle transition hover:bg-elevated hover:text-ink"
              >
                <RefreshCw size={14} />
              </button>
            )}
          </div>

          <div className="harbor-scroll min-h-0 flex-1 overflow-y-auto p-2">
            <button
              type="button"
              disabled={linkingId != null}
              onClick={dismiss}
              className="mb-1 flex w-full items-center gap-3 rounded-xl border border-dashed border-edge-soft p-2 text-start transition hover:bg-elevated/60 disabled:opacity-60"
            >
              <span className="flex h-14 w-10 shrink-0 items-center justify-center rounded-lg bg-canvas ring-1 ring-edge-soft">
                <X size={15} className="text-ink-subtle" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold text-ink">{t("None")}</span>
                <span className="mt-0.5 block truncate text-[11.5px] leading-relaxed text-ink-subtle">
                  {t("Select this if you don't want to sync to {tracker}", { tracker: TRACKER_LABEL[active] })}
                </span>
              </span>
            </button>
            {hits === null ? (
              <div className="flex flex-col items-center gap-2 px-3 py-10 text-center text-[13px] text-ink-muted">
                <Loader2 size={18} className="animate-spin text-ink-subtle" />
                {t("Searching…")}
              </div>
            ) : hits.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 px-3 py-10 text-center text-[13px] leading-relaxed text-ink-muted">
                <Search size={18} className="text-ink-subtle" />
                {t("No matches. Check the search box or try a different title.")}
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {hits.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    disabled={linkingId != null}
                    onClick={() => void confirm(h)}
                    className="flex min-w-0 items-center gap-3 rounded-xl p-2 text-start transition hover:bg-elevated/60 disabled:opacity-60"
                  >
                    <span className="flex h-14 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-canvas ring-1 ring-edge-soft">
                      {h.cover ? (
                        <CoverImg src={h.cover} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-[10px] text-ink-subtle">—</span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-ink">{h.title}</span>
                      <span className="mt-0.5 block truncate text-[11.5px] text-ink-subtle">
                        {[h.type, h.score != null ? t("★ {n}", { n: h.score }) : null, h.chapters ? t("Ch. {n}", { n: h.chapters }) : null, h.releaseDate].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    {linkingId === h.id && <Loader2 size={14} className="shrink-0 animate-spin text-accent" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-center gap-1.5 border-t border-edge-soft px-4 py-2">
            <span className="text-[11px] text-ink-subtle">{t("Tip: press")}</span>
            <kbd className="rounded-md bg-elevated px-1.5 py-0.5 text-[10px] font-semibold leading-none text-ink ring-1 ring-edge-soft">
              {shortcut}
            </kbd>
            <span className="text-[11px] text-ink-subtle">{t("to reopen this anytime")}</span>
          </div>
        </div>
      </div>
    </>
  );
}
