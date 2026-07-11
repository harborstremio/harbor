import { browseThemes, downloadTheme, rateTheme, type StoreTheme } from "@/lib/theme-store";
import { AlertCircle, Check, Download, Loader2, Search, Star, Upload } from "lucide-react";
import { useEffect, useState } from "react";

import { CommunityDetail } from "./community-detail";
import { ThemeUploadFlow } from "./theme-upload-flow";

const SORTS = [
  { id: "top", label: "Top rated" },
  { id: "new", label: "Newest" },
  { id: "downloads", label: "Most downloaded" },
];

export function CommunityPane() {
  const [sort, setSort] = useState("top");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [themes, setThemes] = useState<StoreTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<StoreTheme | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    browseThemes(sort, debounced)
      .then((list) => !cancelled && setThemes(list))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [sort, debounced]);

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {SORTS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSort(s.id)}
            className={`h-8 rounded-full border px-3.5 text-[12px] font-semibold transition-colors ${
              sort === s.id
                ? "border-ink bg-ink text-canvas"
                : "border-edge-soft bg-elevated/40 text-ink-muted hover:border-edge hover:text-ink"
            }`}
          >
            {s.label}
          </button>
        ))}
        <button
          onClick={() => setUploadOpen(true)}
          className="ms-auto flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
        >
          <Upload size={14} strokeWidth={2.2} /> Share a theme
        </button>
        <div className="flex h-9 items-center gap-2 rounded-full border border-edge-soft bg-elevated/40 px-3.5">
          <Search size={15} className="text-ink-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search themes"
            className="w-44 bg-transparent text-[13px] text-ink placeholder:text-ink-subtle focus:outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-ink-subtle">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-8 text-center text-[13px] text-danger">
          {error}
        </div>
      ) : themes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-edge px-4 py-12 text-center text-[13px] text-ink-subtle">
          {debounced ? "No themes match your search." : "No community themes yet. Be the first to share one."}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {themes.map((t) => (
            <CommunityCard key={t.id} theme={t} onOpen={() => setSelected(t)} />
          ))}
        </div>
      )}

      {selected && <CommunityDetail theme={selected} onClose={() => setSelected(null)} />}

      {uploadOpen && <ThemeUploadFlow onClose={() => setUploadOpen(false)} />}
    </section>
  );
}

function CommunityCard({ theme, onOpen }: { theme: StoreTheme; onOpen: () => void }) {
  const [t, setT] = useState(theme);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [myRating, setMyRating] = useState(0);

  useEffect(() => setT(theme), [theme]);

  const download = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (state === "loading" || state === "done") return;
    setState("loading");
    try {
      await downloadTheme(t.id, t.cover ?? t.screenshots[0] ?? null);
      setState("done");
    } catch {
      setState("error");
      window.setTimeout(() => setState("idle"), 2200);
    }
  };

  const rate = async (e: React.MouseEvent, v: number) => {
    e.stopPropagation();
    setMyRating(v);
    try {
      setT(await rateTheme(t.id, v));
    } catch {
      /* ignore */
    }
  };

  const shownRating = myRating || Math.round(t.ratingAvg);

  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-edge-soft bg-surface text-start transition-all hover:border-edge hover:shadow-[0_18px_36px_-22px_rgba(0,0,0,0.3)]"
    >
      <div className="relative h-36 w-full overflow-hidden bg-elevated">
        {t.cover ? (
          <img
            src={t.cover}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full">
            {t.swatch.map((c, i) => (
              <div key={i} className="flex-1" style={{ background: c }} />
            ))}
          </div>
        )}
        <div className="absolute bottom-2 end-2 flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[10.5px] font-semibold text-white backdrop-blur-sm transition-opacity group-hover:opacity-0">
          <Star size={10} className="fill-amber-300 text-amber-300" /> {t.ratingAvg || "-"}
        </div>
        <div className="absolute inset-0 flex flex-col justify-end gap-2 bg-gradient-to-t from-black/85 via-black/35 to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <div className="flex items-center justify-center gap-0.5" role="group" aria-label="Rate this theme">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={(e) => rate(e, n)} aria-label={`Rate ${n} stars`} className="p-0.5">
                <Star size={15} className={n <= shownRating ? "fill-amber-300 text-amber-300" : "text-white/60"} />
              </button>
            ))}
          </div>
          <button
            onClick={download}
            disabled={state === "loading"}
            className={`flex h-9 items-center justify-center gap-1.5 rounded-lg text-[12.5px] font-semibold transition-colors disabled:opacity-80 ${
              state === "done"
                ? "bg-emerald-400 text-black"
                : state === "error"
                  ? "bg-danger text-white"
                  : "bg-white text-black hover:opacity-90"
            }`}
          >
            {state === "loading" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : state === "done" ? (
              <Check key="done" size={14} className="harbor-pop" />
            ) : state === "error" ? (
              <AlertCircle size={14} />
            ) : (
              <Download size={14} />
            )}
            {state === "done"
              ? "Added to library"
              : state === "error"
                ? "Failed"
                : state === "loading"
                  ? "Downloading"
                  : "Download"}
          </button>
        </div>
        <div className="absolute bottom-0 left-0 right-0 flex h-1.5">
          {t.swatch.map((c, i) => (
            <span key={i} className="flex-1" style={{ background: c }} />
          ))}
        </div>
      </div>
      <div className="flex min-w-0 flex-col px-4 py-3">
        <span className="truncate text-[14.5px] font-semibold text-ink">{t.name}</span>
        <span className="truncate text-[11.5px] text-ink-subtle">
          {t.author} · {t.downloads} downloads
        </span>
      </div>
    </div>
  );
}
