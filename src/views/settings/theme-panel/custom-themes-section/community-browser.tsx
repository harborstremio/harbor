import { useEffect, useState } from "react";
import { AlertCircle, Check, Download, Loader2, Star, Upload } from "lucide-react";
import { Search } from "@/components/icons/search-icon";
import { browseThemes, downloadTheme, rateTheme, type StoreTheme } from "@/lib/theme-store";
import { useT } from "@/lib/i18n";
import { CommunityDetail } from "./community-detail";
import { ThemeAuthorButton } from "./theme-author-button";
import { ThemeUploadFlow } from "./theme-upload-flow";

const SORTS = [
  { id: "top", label: "Top rated" },
  { id: "new", label: "Newest" },
  { id: "downloads", label: "Most downloaded" },
];

export function CommunityPane() {
  const t = useT();
  const [sort, setSort] = useState("top");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [themes, setThemes] = useState<StoreTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<StoreTheme | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
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
            className={`h-11 rounded-full border px-4 text-[15.5px] font-semibold transition-colors ${
              sort === s.id
                ? "border-ink bg-ink text-canvas"
                : "border-edge-soft bg-elevated text-ink-muted hover:border-edge hover:text-ink"
            }`}
          >
            {t(s.label)}
          </button>
        ))}
        <button
          onClick={() => setUploadOpen(true)}
          className="ms-auto flex h-11 items-center gap-2 rounded-full bg-ink px-4 text-[15.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
        >
          <Upload size={18} strokeWidth={2.2} /> {t("Share a theme")}
        </button>
        <div className="flex h-11 items-center gap-2 rounded-full bg-elevated px-4">
          <Search size={18} className="text-ink-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Search themes")}
            aria-label={t("Search themes")}
            className="h-11 w-44 min-w-0 bg-transparent text-[15.5px] text-ink placeholder:text-ink-subtle focus:outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-ink-subtle">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-[10px] border border-danger/40 bg-elevated px-4 py-8 text-center text-[15.5px] leading-[22px] text-danger">
          {error}
        </div>
      ) : themes.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-edge px-4 py-12 text-center text-[15.5px] leading-[22px] text-ink-subtle">
          {debounced
            ? t("No themes match your search.")
            : t("No community themes yet. Be the first to share one.")}
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
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
  const tr = useT();
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
    <div className="group relative flex cursor-pointer flex-col overflow-hidden rounded-[10px] bg-surface text-start transition hover:bg-elevated hover:harbor-float">
      <button
        type="button"
        onClick={onOpen}
        aria-label={tr("Open {name}", { name: t.name })}
        className="absolute inset-0 z-0 rounded-md focus-visible:ring-2 focus-visible:ring-accent"
      />
      <div className="pointer-events-none relative z-10 h-36 w-full overflow-hidden bg-elevated">
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
        <div className="absolute bottom-2 end-2 inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-[6px] bg-canvas px-2 text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px] text-ink transition-opacity group-hover:opacity-0">
          <Star size={14} className="fill-accent text-accent" /> {t.ratingAvg || "-"}
        </div>
        <div className="absolute inset-0 flex flex-col justify-end gap-2 bg-gradient-to-t from-canvas via-canvas/70 to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <div
            className="pointer-events-auto flex items-center justify-center gap-0.5"
            role="group"
            aria-label={tr("Rate this theme")}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={(e) => rate(e, n)}
                aria-label={tr("Rate {count} stars", { count: n })}
                className="grid h-11 w-11 place-items-center"
              >
                <Star
                  size={20}
                  className={n <= shownRating ? "fill-accent text-accent" : "text-ink-subtle"}
                />
              </button>
            ))}
          </div>
          <button
            onClick={download}
            disabled={state === "loading"}
            className={`pointer-events-auto flex h-11 items-center justify-center gap-2 rounded-[8px] text-[15.5px] font-semibold transition-colors disabled:opacity-80 ${
              state === "done"
                ? "bg-success text-canvas"
                : state === "error"
                  ? "bg-danger text-canvas"
                  : "bg-ink text-canvas hover:opacity-90"
            }`}
          >
            {state === "loading" ? (
              <Loader2 size={18} className="animate-spin" />
            ) : state === "done" ? (
              <Check key="done" size={18} className="harbor-pop" />
            ) : state === "error" ? (
              <AlertCircle size={18} />
            ) : (
              <Download size={18} />
            )}
            {state === "done"
              ? tr("Added to library")
              : state === "error"
                ? tr("Failed")
                : state === "loading"
                  ? tr("Downloading")
                  : tr("Download")}
          </button>
        </div>
        <div className="absolute inset-x-0 bottom-0 flex h-1.5">
          {t.swatch.map((c, i) => (
            <span key={i} className="flex-1" style={{ background: c }} />
          ))}
        </div>
      </div>
      <div className="pointer-events-none relative z-10 flex min-w-0 flex-col px-4 py-3">
        <span className="text-[16.5px] font-semibold leading-[24px] text-ink">{t.name}</span>
        <span className="text-[15.5px] leading-[22px] text-ink-subtle">
          {t.authorHandle ? (
            <ThemeAuthorButton handle={t.authorHandle} name={t.author || tr("Anonymous")} />
          ) : (
            t.author || tr("Anonymous")
          )}{" "}
          · {t.downloads === 1 ? tr("1 download") : tr("{count} downloads", { count: t.downloads })}
        </span>
      </div>
    </div>
  );
}
