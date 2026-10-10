import { useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Search } from "@/components/icons/search-icon";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { searchAll } from "@/lib/search";
import { mediaTag } from "@/lib/social/bbcode";
import { Poster } from "@/components/poster";


type Hit = { id: string; title: string; poster?: string; kind: string; sub?: string };

const GROUPS: Array<{ key: "movies" | "series" | "anime" | "manga"; kind: string; label: string }> = [
  { key: "movies", kind: "movie", label: "Movies" },
  { key: "series", kind: "series", label: "Shows" },
  { key: "anime", kind: "anime", label: "Anime" },
  { key: "manga", kind: "manga", label: "Manga" },
];

export function MediaPicker({
  onInsert,
  onClose,
}: {
  onInsert: (bbcode: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const { settings } = useSettings();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => {
      setBusy(true);
      void searchAll(settings.tmdbKey ?? "", term)
        .then((r) => {
          if (ctrl.signal.aborted) return;
          const out: Hit[] = [];
          for (const m of (r.movies ?? []).slice(0, 6)) out.push({ id: m.id, title: m.name, poster: m.poster, kind: 'movie', sub: m.releaseInfo });
          for (const m of (r.series ?? []).slice(0, 6)) out.push({ id: m.id, title: m.name, poster: m.poster, kind: 'series', sub: m.releaseInfo });
          for (const a of (r.anime ?? []).slice(0, 6)) out.push({ id: a.kitsuId ? 'kitsu:' + a.kitsuId : 'mal:' + a.malId, title: a.name, poster: a.poster ?? undefined, kind: 'anime', sub: a.year ?? undefined });
          for (const g of (r.manga ?? []).slice(0, 6)) out.push({ id: g.id, title: g.title, poster: g.cover, kind: 'manga', sub: g.year ? String(g.year) : undefined });
          setHits(out);
        })
        .catch(() => {})
        .finally(() => {
          if (!ctrl.signal.aborted) setBusy(false);
        });
    }, 280);
    return () => {
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, [q, settings.tmdbKey]);

  return (
    <div className="flex flex-col gap-2.5 rounded-[12px] bg-canvas/50 p-3 ring-1 ring-edge-soft">
      <div className="flex items-center gap-2">
        <Search size={15} className="shrink-0 text-ink-subtle" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            }
          }}
          placeholder={t("Search movies, shows, anime, manga")}
          className="h-9 min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-subtle"
        />
        {busy && <Loader2 size={14} className="shrink-0 animate-spin text-ink-subtle" />}
        <button
          type="button"
          onClick={onClose}
          aria-label={t("Cancel")}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-sm text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
        >
          <X size={14} strokeWidth={2.2} />
        </button>
      </div>

      {hits.length > 0 && (
        <div className="harbor-scroll flex max-h-[240px] flex-col gap-0.5 overflow-y-auto pe-0.5">
          {hits.map((h) => (
            <button
              key={`${h.kind}:${h.id}`}
              type="button"
              onClick={() => {
                onInsert(mediaTag(h.id, h.kind, h.title, h.poster));
                onClose();
              }}
              className="flex min-h-11 items-center gap-2.5 rounded-[8px] p-1.5 text-start transition-colors hover:bg-elevated"
            >
              <Poster
                src={h.poster}
                seed={h.title}
                ratio="portrait"
                className="h-[42px] w-[28px] shrink-0 rounded-[5px]"
                lazy
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">{h.title}</span>
                <span className="block truncate text-[11.5px] text-ink-subtle">
                  {t(GROUPS.find((g) => g.kind === h.kind)?.label ?? "Title")}
                  {h.sub ? ` · ${h.sub}` : ""}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {!busy && q.trim().length >= 2 && hits.length === 0 && (
        <p className="px-1 text-[12px] text-ink-subtle">
          {settings.tmdbKey ? t("Nothing found.") : t("Add your TMDB key in Settings to search.")}
        </p>
      )}
    </div>
  );
}
