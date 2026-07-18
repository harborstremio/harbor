import { Film, Globe2, Loader2, Plus, Search, Sparkles, Trash2, Tv2, User, X } from "lucide-react";
import { useEffect, useState } from "react";
import { MOVIE_GENRES, TV_GENRES } from "@/lib/feed/tags";
import { searchAll, type SearchPerson } from "@/lib/search";
import { useT } from "@/lib/i18n";
import traktLogo from "@/assets/trakt.svg";
import { COUNTRIES, WATCH_PROVIDERS, type CustomCalendar } from "./constants";
import { ChipMultiselect, PillToggle, Section, ToggleRow } from "./controls";

export function CustomManager({
  tmdbKey,
  traktConnected,
  value,
  onAddPerson,
  onRemovePerson,
  onToggleSource,
  onToggleMediaType,
  onToggleGenre,
  onToggleProvider,
  onToggleCountry,
  onClearAll,
  onClose,
}: {
  tmdbKey: string;
  traktConnected: boolean;
  value: CustomCalendar;
  onAddPerson: (p: SearchPerson) => void;
  onRemovePerson: (id: number) => void;
  onToggleSource: (k: "includeTraktWatchlist" | "includeTraktAnticipated") => void;
  onToggleMediaType: (kind: "movie" | "tv" | "anime") => void;
  onToggleGenre: (g: { id: number; name: string; mediaType: "movie" | "tv" }) => void;
  onToggleProvider: (p: { id: number; name: string }) => void;
  onToggleCountry: (code: string) => void;
  onClearAll: () => void;
  onClose: () => void;
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

  const activeCount =
    value.genres.length +
    value.watchProviders.length +
    value.originCountries.length +
    value.trackedPeople.length +
    (value.includeTraktAnticipated ? 1 : 0) +
    (value.includeTraktWatchlist ? 1 : 0);

  const genreItems = [
    ...Object.entries(MOVIE_GENRES).map(([name, id]) => ({
      key: `movie:${id}`,
      label: t(name),
      selected: value.genres.some((g) => g.id === id && g.mediaType === "movie"),
      onToggle: () => onToggleGenre({ id, name, mediaType: "movie" as const }),
    })),
    ...Object.entries(TV_GENRES)
      .filter(([name]) => !(name in MOVIE_GENRES))
      .map(([name, id]) => ({
        key: `tv:${id}`,
        label: t("{name} (TV)", { name: t(name) }),
        selected: value.genres.some((g) => g.id === id && g.mediaType === "tv"),
        onToggle: () => onToggleGenre({ id, name, mediaType: "tv" as const }),
      })),
  ];

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-canvas/85 p-6 backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[86vh] w-full max-w-[1040px] flex-col overflow-hidden rounded-3xl border border-edge-soft bg-elevated shadow-[0_40px_100px_-24px_rgba(0,0,0,0.75)]">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-edge-soft px-8 py-6">
          <div className="flex flex-col gap-1.5">
            <h2 className="font-display text-[24px] font-medium leading-none tracking-tight text-ink">
              {t("Custom calendar")}
            </h2>
            <p className="max-w-[620px] text-[13.5px] leading-relaxed text-ink-muted">
              {t(
                "Pick what you want in your calendar. Mix and match: tracked people, genres, streamers, countries, Trakt lists.",
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Close")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-canvas/70 hover:text-ink"
          >
            <X size={17} strokeWidth={2.2} />
          </button>
        </header>

        <div className="flex flex-col gap-8 overflow-y-auto px-8 py-7">
          <Section title={t("What to include")}>
            <div className="flex flex-wrap gap-2.5">
              <PillToggle
                on={value.mediaTypes.movie}
                onClick={() => onToggleMediaType("movie")}
                icon={<Film size={16} strokeWidth={2.1} />}
                label={t("Movies")}
              />
              <PillToggle
                on={value.mediaTypes.tv}
                onClick={() => onToggleMediaType("tv")}
                icon={<Tv2 size={16} strokeWidth={2.1} />}
                label={t("Series")}
              />
              <PillToggle
                on={value.mediaTypes.anime}
                onClick={() => onToggleMediaType("anime")}
                icon={<Sparkles size={16} strokeWidth={2.1} />}
                label={t("Anime")}
              />
            </div>
          </Section>

          <div className="grid grid-cols-1 gap-x-12 gap-y-8 md:grid-cols-2 md:items-start">
            <div className="flex flex-col gap-8">
              <Section title={t("Genres")} count={value.genres.length}>
                <ChipMultiselect items={genreItems} />
              </Section>

              <Section title={t("Where to watch")} count={value.watchProviders.length}>
                <ChipMultiselect
                  items={WATCH_PROVIDERS.map((p) => ({
                    key: `prov:${p.id}`,
                    label: p.name,
                    selected: value.watchProviders.some((x) => x.id === p.id),
                    onToggle: () => onToggleProvider(p),
                  }))}
                />
              </Section>
            </div>

            <div className="flex flex-col gap-8">
              <Section
                title={t("Origin country")}
                icon={<Globe2 size={12} strokeWidth={2.2} />}
                count={value.originCountries.length}
              >
                <ChipMultiselect
                  items={COUNTRIES.map((c) => ({
                    key: `cn:${c.code}`,
                    label: t(c.name),
                    selected: value.originCountries.includes(c.code),
                    onToggle: () => onToggleCountry(c.code),
                    leading: (
                      <img
                        src={`https://flagcdn.com/w40/${c.code.toLowerCase()}.png`}
                        alt=""
                        loading="lazy"
                        className="h-3.5 w-[21px] shrink-0 rounded-[2px] object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ),
                  }))}
                />
              </Section>

              <Section title={t("Trakt sources")}>
                <div className="flex flex-col gap-2.5">
                  <ToggleRow
                    label={t("Trakt anticipated")}
                    sub={t("Most-anticipated upcoming releases on Trakt")}
                    on={value.includeTraktAnticipated}
                    onToggle={() => onToggleSource("includeTraktAnticipated")}
                    icon={<img src={traktLogo} alt="" className="h-4 w-4" />}
                  />
                  <ToggleRow
                    label={t("My Trakt watchlist")}
                    sub={
                      traktConnected
                        ? t("Upcoming items from your watchlist")
                        : t("Connect Trakt in settings first")
                    }
                    on={value.includeTraktWatchlist}
                    onToggle={() => traktConnected && onToggleSource("includeTraktWatchlist")}
                    disabled={!traktConnected}
                    icon={<img src={traktLogo} alt="" className="h-4 w-4" />}
                  />
                </div>
              </Section>
            </div>
          </div>

          <Section title={t("Track people")} count={value.trackedPeople.length}>
            <div className="flex h-12 items-center gap-2.5 rounded-xl border border-edge bg-canvas px-4">
              <Search size={15} className="text-ink-subtle" strokeWidth={2} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  tmdbKey ? t("Search actors, directors…") : t("Add a TMDB key in settings first")
                }
                disabled={!tmdbKey}
                className="h-full flex-1 bg-transparent text-[14px] text-ink placeholder:text-ink-subtle outline-none"
              />
              {busy && <Loader2 size={15} className="animate-spin text-ink-subtle" />}
            </div>
            {results.length > 0 && (
              <div className="grid grid-cols-1 gap-1 rounded-xl border border-edge-soft bg-canvas/60 p-1 sm:grid-cols-2">
                {results.map((p) => {
                  const tracked = value.trackedPeople.some((x) => x.id === p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={tracked}
                      onClick={() => {
                        onAddPerson(p);
                        setQuery("");
                        setResults([]);
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start text-[13px] hover:bg-elevated disabled:opacity-50"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-elevated text-ink-subtle">
                        {p.profile ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w92${p.profile}`}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <User size={15} strokeWidth={1.8} />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-ink">{p.name}</span>
                        <span className="block truncate text-[11.5px] text-ink-subtle">
                          {p.knownFor}
                        </span>
                      </span>
                      {tracked ? (
                        <span className="text-[10.5px] uppercase tracking-[0.14em] text-ink-subtle">
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
            {value.trackedPeople.length > 0 && (
              <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {value.trackedPeople.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 rounded-lg bg-canvas/40 px-3 py-2"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-elevated text-ink-subtle">
                      {p.profile ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w92${p.profile}`}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <User size={14} strokeWidth={1.8} />
                      )}
                    </span>
                    <span className="flex-1 truncate text-[13.5px] text-ink">{p.name}</span>
                    <button
                      type="button"
                      onClick={() => onRemovePerson(p.id)}
                      aria-label={t("Remove {name}", { name: p.name })}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-danger/15 hover:text-danger"
                    >
                      <Trash2 size={14} strokeWidth={1.9} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-edge-soft px-8 py-4">
          <button
            type="button"
            onClick={onClearAll}
            disabled={activeCount === 0}
            className="rounded-full px-3 py-2 text-[13px] font-medium text-ink-subtle transition-colors hover:text-ink disabled:pointer-events-none disabled:opacity-40"
          >
            {t("Clear all")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 items-center rounded-full bg-ink px-8 text-[14px] font-semibold text-canvas transition-colors hover:bg-ink/90"
          >
            {t("Done")}
          </button>
        </footer>
      </div>
    </div>
  );
}
