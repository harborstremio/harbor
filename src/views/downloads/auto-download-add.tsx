import { Plus, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Poster, usePosterChain } from "@/components/poster";
import type { Meta } from "@/lib/cinemeta";
import { searchAll, searchCinemeta } from "@/lib/search";
import { useSettings } from "@/lib/settings";
import { addAutoDownload, isAutoDownloaded } from "@/lib/auto-download";

export function AutoDownloadAdd() {
  const { settings } = useSettings();
  const [query, setQuery] = useState("");
  const [rawResults, setRawResults] = useState<Meta[]>([]);
  const [rawLoading, setRawLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const reqRef = useRef(0);

  const trimmed = query.trim();
  const active = trimmed.length >= 2;
  const results = active ? rawResults : [];
  const loading = active && rawLoading;

  useEffect(() => {
    if (!active) {
      reqRef.current++;
      return;
    }
    const id = ++reqRef.current;
    const timer = window.setTimeout(() => {
      setRawLoading(true);
      void (async () => {
        const [tmdb, cine] = await Promise.all([
          settings.tmdbKey
            ? searchAll(settings.tmdbKey, trimmed)
                .then((r) => r.series)
                .catch(() => [])
            : Promise.resolve<Meta[]>([]),
          searchCinemeta(trimmed)
            .then((r) => r.series)
            .catch(() => []),
        ]);
        if (id !== reqRef.current) return;
        const seen = new Set<string>();
        const merged: Meta[] = [];
        for (const m of [...tmdb, ...cine]) {
          if (seen.has(m.id)) continue;
          seen.add(m.id);
          merged.push(m);
        }
        setRawResults(merged.slice(0, 8));
        setRawLoading(false);
      })();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [active, trimmed, settings.tmdbKey]);

  const pick = (m: Meta) => {
    addAutoDownload(m);
    setQuery("");
    setRawResults([]);
    inputRef.current?.blur();
  };

  const showPanel = focused && query.trim().length >= 2;

  return (
    <div className="relative mb-4">
      <div className="flex h-11 items-center gap-2.5 rounded-xl border border-edge bg-elevated/40 px-3.5 focus-within:border-ink-subtle">
        <Search size={16} className="shrink-0 text-ink-subtle" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 140)}
          placeholder="Add a series to auto-download"
          className="h-full w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-subtle"
        />
      </div>
      {showPanel && (
        <div className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-edge bg-elevated shadow-[0_20px_50px_-15px_rgba(0,0,0,0.7)]">
          {loading && results.length === 0 ? (
            <p className="px-4 py-3 text-[13px] text-ink-subtle">Searching...</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-[13px] text-ink-subtle">No series found</p>
          ) : (
            <ul className="max-h-[320px] overflow-y-auto py-1">
              {results.map((m) => (
                <AddResult key={m.id} meta={m} rpdbKey={settings.rpdbKey} onPick={pick} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function AddResult({
  meta,
  rpdbKey,
  onPick,
}: {
  meta: Meta;
  rpdbKey: string;
  onPick: (m: Meta) => void;
}) {
  const poster = usePosterChain(rpdbKey, meta.id, meta.poster ?? undefined, "series");
  const already = isAutoDownloaded(meta.id);
  return (
    <li>
      <button
        type="button"
        disabled={already}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onPick(meta)}
        className="flex w-full items-center gap-3 px-3 py-2 text-start transition-colors hover:bg-raised disabled:cursor-not-allowed disabled:opacity-55"
      >
        <div className="h-[42px] w-[29px] shrink-0 overflow-hidden rounded-md">
          <Poster src={poster.src} onError={poster.onError} seed={meta.id} ratio="portrait" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[13.5px] font-medium text-ink">{meta.name}</span>
          {meta.releaseInfo && (
            <span className="text-[11.5px] text-ink-subtle">{meta.releaseInfo}</span>
          )}
        </div>
        {already ? (
          <span className="shrink-0 text-[11.5px] font-medium text-accent">Added</span>
        ) : (
          <Plus size={16} className="shrink-0 text-ink-subtle" strokeWidth={2} />
        )}
      </button>
    </li>
  );
}
