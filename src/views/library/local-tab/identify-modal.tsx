import { useT } from "@/lib/i18n";
import type { LocalEntry } from "@/lib/local-library";
import { get, IMG } from "@/lib/providers/tmdb/tmdb-client";
import { useSettings } from "@/lib/settings";
import { Loader2, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type Candidate = {
  tmdbId: number;
  title: string;
  year: string | null;
  posterPath: string | null;
  poster: string | null;
  overview: string;
};

export type IdentifyResolution = {
  tmdbId: number;
  imdbId: string | null;
  poster: string | null;
  title: string;
  year: number | null;
  type: "movie" | "show";
};

async function searchTmdb(key: string, kind: "movie" | "tv", query: string): Promise<Candidate[]> {
  const data = await get<{ results?: any[] }>(key, `search/${kind}`, {
    query,
    include_adult: "false",
  });
  return (data?.results ?? []).slice(0, 20).map((r) => {
    const date: string | undefined = r.release_date ?? r.first_air_date;
    return {
      tmdbId: r.id as number,
      title: (r.title ?? r.name ?? "") as string,
      year: date ? date.slice(0, 4) : null,
      posterPath: (r.poster_path ?? null) as string | null,
      poster: r.poster_path ? `${IMG}/w185${r.poster_path}` : null,
      overview: (r.overview ?? "") as string,
    };
  });
}

async function resolveImdb(key: string, kind: "movie" | "tv", id: number): Promise<string | null> {
  try {
    const ext = await get<{ imdb_id?: string }>(key, `${kind}/${id}/external_ids`);
    return ext?.imdb_id && ext.imdb_id.startsWith("tt") ? ext.imdb_id : null;
  } catch {
    return null;
  }
}

function seedQuery(title: string): string {
  return (
    title
      .replace(/\bs\d{1,2}[\s._-]*e\d{1,3}.*$/i, "")
      .replace(/\b\d{1,2}x\d{1,3}.*$/i, "")
      .replace(/\bseason[\s._-]*\d.*$/i, "")
      .trim() || title
  );
}

export function IdentifyModal({
  target,
  onClose,
  onResolved,
}: {
  target: LocalEntry[] | null;
  onClose: () => void;
  onResolved: (ids: string[], res: IdentifyResolution) => void;
}) {
  const t = useT();
  const { settings } = useSettings();
  const key = settings.tmdbKey?.trim() || "";
  const head = target && target.length ? target[0] : null;
  const [kind, setKind] = useState<"movie" | "tv">("movie");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [picking, setPicking] = useState<number | null>(null);

  useEffect(() => {
    if (!head) return;
    setKind(head.type === "show" ? "tv" : "movie");
    setQuery(seedQuery(head.title ?? ""));
    setResults([]);
  }, [head?.id]);

  useEffect(() => {
    if (!head) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [head, onClose]);

  useEffect(() => {
    if (!head || !key) return;
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    let alive = true;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void searchTmdb(key, kind, q)
        .then((r) => {
          if (alive) setResults(r);
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, 300);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [head?.id, key, kind, query]);

  const noKey = useMemo(() => !key, [key]);

  if (!head || !target) return null;

  const pick = async (c: Candidate) => {
    setPicking(c.tmdbId);
    const imdbId = await resolveImdb(key, kind, c.tmdbId);
    onResolved(
      target.map((e) => e.id),
      {
        tmdbId: c.tmdbId,
        imdbId,
        poster: c.posterPath ? `${IMG}/w342${c.posterPath}` : null,
        title: c.title || head.title,
        year: c.year ? parseInt(c.year, 10) : head.year,
        type: kind === "tv" ? "show" : "movie",
      },
    );
    setPicking(null);
    onClose();
  };

  return createPortal(
    <div
      className="pointer-events-auto fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/72 py-[8vh] backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-[560px] flex-col gap-5 rounded-[24px] border border-edge-soft bg-elevated/95 px-7 py-7 shadow-[0_30px_80px_-25px_rgba(0,0,0,0.85)] animate-in zoom-in-95 fade-in duration-200">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="text-[18px] font-medium tracking-tight text-ink">{t("What is this title?")}</h2>
            <p className="truncate text-[12px] text-ink-subtle" title={head.filename}>
              {target.length > 1
                ? t("{n} episodes · {file}", { n: target.length, file: head.filename })
                : head.filename}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas/40 text-ink-subtle transition-colors hover:bg-canvas/60 hover:text-ink"
            aria-label={t("Cancel")}
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {(["movie", "tv"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
                kind === k ? "bg-ink text-canvas" : "bg-canvas/50 text-ink-muted ring-1 ring-edge-soft hover:text-ink"
              }`}
            >
              {k === "movie" ? t("Movie") : t("Series")}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2.5 rounded-2xl border border-edge-soft bg-canvas/50 px-3.5">
          <Search size={16} className="shrink-0 text-ink-subtle" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Search TMDB…")}
            className="h-11 w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-subtle"
          />
          {loading && <Loader2 size={15} className="shrink-0 animate-spin text-ink-subtle" />}
        </div>

        {noKey ? (
          <p className="rounded-xl bg-danger/15 px-3 py-2 text-[12px] text-danger ring-1 ring-danger/30">
            {t("Add a TMDB key in Settings → Library to search.")}
          </p>
        ) : (
          <div className="flex max-h-[42vh] flex-col gap-1 overflow-y-auto">
            {results.length === 0 && !loading && query.trim() && (
              <p className="px-1 py-6 text-center text-[13px] text-ink-muted">
                {t("No matches. Try a different search.")}
              </p>
            )}
            {results.map((c) => (
              <button
                key={c.tmdbId}
                type="button"
                disabled={picking != null}
                onClick={() => void pick(c)}
                className="group flex items-center gap-3.5 rounded-2xl px-2 py-2 text-start transition-colors hover:bg-canvas/60 disabled:opacity-60"
              >
                <div className="h-[72px] w-[48px] shrink-0 overflow-hidden rounded-lg bg-canvas ring-1 ring-edge-soft">
                  {c.poster ? (
                    <img src={c.poster} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : null}
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
                    <span className="truncate">{c.title}</span>
                    {c.year && <span className="shrink-0 text-[12px] font-normal text-ink-subtle">{c.year}</span>}
                    {picking === c.tmdbId && <Loader2 size={13} className="shrink-0 animate-spin text-ink-subtle" />}
                  </span>
                  {c.overview && (
                    <span className="line-clamp-2 text-[11.5px] leading-snug text-ink-muted">{c.overview}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
