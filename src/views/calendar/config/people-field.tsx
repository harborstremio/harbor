import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, User } from "lucide-react";
import { Search } from "@/components/icons/search-icon";
import { searchAll, type SearchPerson } from "@/lib/search";
import { useT } from "@/lib/i18n";
import type { CustomCalendar } from "./constants";

type TrackedPerson = CustomCalendar["trackedPeople"][number];

function PersonAvatar({ profile, size }: { profile?: string | null; size: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-elevated text-ink-subtle"
      style={{ height: size, width: size }}
    >
      {profile ? (
        <img src={`https://image.tmdb.org/t/p/w92${profile}`} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <User size={Math.round(size * 0.42)} strokeWidth={1.8} />
      )}
    </span>
  );
}

export function PeopleField({
  tmdbKey,
  tracked,
  onAdd,
  onRemove,
}: {
  tmdbKey: string;
  tracked: TrackedPerson[];
  onAdd: (p: SearchPerson) => void;
  onRemove: (id: number) => void;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchPerson[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q || !tmdbKey) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setBusy(true);
    const handle = window.setTimeout(async () => {
      try {
        const r = await searchAll(tmdbKey, q);
        if (!cancelled) setResults(r.people.slice(0, 8));
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query, tmdbKey]);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex h-12 items-center gap-2.5 rounded-xl bg-canvas px-3.5 ring-1 ring-edge-soft focus-within:ring-accent">
        <Search size={15} className="text-ink-subtle" strokeWidth={2} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tmdbKey ? t("Search actors, directors…") : t("Add a TMDB key in settings first")}
          disabled={!tmdbKey}
          className="h-full flex-1 bg-transparent text-[14px] text-ink placeholder:text-ink-subtle outline-none"
        />
        {busy && <Loader2 size={15} className="animate-spin text-ink-subtle" />}
      </div>
      {results.length > 0 && (
        <div className="flex flex-col gap-0.5 rounded-xl bg-canvas/60 p-1 ring-1 ring-edge-soft">
          {results.map((p) => {
            const isTracked = tracked.some((x) => x.id === p.id);
            return (
              <button
                key={p.id}
                type="button"
                disabled={isTracked}
                onClick={() => {
                  onAdd(p);
                  setQuery("");
                  setResults([]);
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start text-[13px] transition-colors hover:bg-elevated disabled:opacity-50"
              >
                <PersonAvatar profile={p.profile} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-ink">{p.name}</span>
                  <span className="block truncate text-[11.5px] text-ink-subtle">{p.knownFor}</span>
                </span>
                {isTracked ? (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-accent">
                    {t("added")}
                  </span>
                ) : (
                  <Plus size={15} className="text-ink-subtle" />
                )}
              </button>
            );
          })}
        </div>
      )}
      {tracked.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {tracked.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-lg bg-surface px-3 py-2 ring-1 ring-edge-soft/60">
              <PersonAvatar profile={p.profile} size={36} />
              <span className="flex-1 truncate text-[13.5px] text-ink">{p.name}</span>
              <button
                type="button"
                onClick={() => onRemove(p.id)}
                aria-label={t("Remove {name}", { name: p.name })}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-danger/15 hover:text-danger"
              >
                <Trash2 size={16} strokeWidth={1.9} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {tmdbKey && query.trim() && !busy && results.length === 0 && (
        <p className="text-[12.5px] text-ink-subtle">{t("No people found")}</p>
      )}
    </div>
  );
}
