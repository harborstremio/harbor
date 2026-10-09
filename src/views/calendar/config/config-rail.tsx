import { useEffect, useState, type ReactNode } from "react";
import { ChevronRight, Globe2, Tag, Tv, Users } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useMediaQuery } from "@/lib/use-media-query";
import type { SearchPerson } from "@/lib/search";
import traktLogo from "@/assets/trakt.svg";
import { COUNTRIES, WATCH_PROVIDERS, type CustomCalendar } from "./constants";
import {
  buildActiveCount,
  buildGenreOptions,
  buildGroupSummaries,
  buildSummary,
  type ChipItem,
} from "./rail-sources";
import { CountryFlag } from "./source-chip";
import { SourceChipField } from "./chip-field";
import { ConfigGroup } from "./config-group";
import { MediaTypeGate } from "./media-type-gate";
import { TraktSourceRow } from "./trakt-source-row";
import { PeopleField } from "./people-field";
import { ResultPill } from "./result-pill";
import { RailHandle } from "./rail-handle";

export function CalendarConfigRail({
  open,
  onOpenChange,
  tmdbKey,
  traktConnected,
  value,
  onChange,
  resultCount,
  onConnectTrakt,
  overlay,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tmdbKey: string;
  traktConnected: boolean;
  value: CustomCalendar;
  onChange: (next: CustomCalendar) => void;
  resultCount: number;
  onConnectTrakt: () => void;
  overlay?: boolean;
}) {
  const t = useT();
  const mq = useMediaQuery("(max-width: 1180px)");
  const narrow = overlay ?? mq;
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(["genres"]));
  const isOpen = (id: string) => openGroups.has(id);
  const toggleGroup = (id: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const addPerson = (p: SearchPerson) => {
    if (value.trackedPeople.some((x) => x.id === p.id)) return;
    onChange({
      ...value,
      trackedPeople: [...value.trackedPeople, { id: p.id, name: p.name, profile: p.profile, role: "any" }],
    });
  };
  const removePerson = (id: number) =>
    onChange({ ...value, trackedPeople: value.trackedPeople.filter((p) => p.id !== id) });
  const toggleSource = (k: "includeTraktWatchlist" | "includeTraktAnticipated") =>
    onChange({ ...value, [k]: !value[k] });
  const toggleMediaType = (kind: "movie" | "tv" | "anime") =>
    onChange({ ...value, mediaTypes: { ...value.mediaTypes, [kind]: !value.mediaTypes[kind] } });
  const toggleGenre = (genre: { id: number; name: string; mediaType: "movie" | "tv" }) => {
    const exists = value.genres.some((g) => g.id === genre.id && g.mediaType === genre.mediaType);
    onChange({
      ...value,
      genres: exists
        ? value.genres.filter((g) => !(g.id === genre.id && g.mediaType === genre.mediaType))
        : [...value.genres, genre],
    });
  };
  const toggleProvider = (provider: { id: number; name: string }) => {
    const exists = value.watchProviders.some((p) => p.id === provider.id);
    onChange({
      ...value,
      watchProviders: exists
        ? value.watchProviders.filter((p) => p.id !== provider.id)
        : [...value.watchProviders, provider],
    });
  };
  const toggleCountry = (code: string) => {
    const exists = value.originCountries.includes(code);
    onChange({
      ...value,
      originCountries: exists
        ? value.originCountries.filter((c) => c !== code)
        : [...value.originCountries, code],
    });
  };
  const clearAll = () =>
    onChange({
      ...value,
      genres: [],
      watchProviders: [],
      originCountries: [],
      trackedPeople: [],
      includeTraktAnticipated: false,
      includeTraktWatchlist: false,
    });
  const clearGroup = (key: "genres" | "watchProviders" | "originCountries" | "trackedPeople") =>
    onChange({ ...value, [key]: [] });

  const summary = buildSummary(value, t);
  const activeCount = buildActiveCount(value);
  const groupSummaries = buildGroupSummaries(value, t);
  const genreItems = buildGenreOptions(value, t, toggleGenre);
  const providerItems: ChipItem[] = WATCH_PROVIDERS.map((p) => ({
    key: `prov:${p.id}`,
    label: p.name,
    selected: value.watchProviders.some((x) => x.id === p.id),
    onToggle: () => toggleProvider(p),
  }));
  const countryItems: ChipItem[] = COUNTRIES.map((c) => ({
    key: `cn:${c.code}`,
    label: t(c.name),
    selected: value.originCountries.includes(c.code),
    onToggle: () => toggleCountry(c.code),
    leading: <CountryFlag code={c.code} />,
  }));

  useEffect(() => {
    if (!(narrow && open)) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [narrow, open, onOpenChange]);

  const body = (
    <>
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-edge-soft px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="text-[14px] font-semibold text-ink">{t("Filters")}</span>
          <span className="h-3.5 w-px bg-edge-soft" />
          <ResultPill count={resultCount} />
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label={t("Collapse filters")}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
        >
          <ChevronRight size={17} strokeWidth={2.2} className="dir-icon" />
        </button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-2">
          <SectionLabel>{t("Show")}</SectionLabel>
          <MediaTypeGate value={value.mediaTypes} onToggle={toggleMediaType} />
        </div>
        <div className="divide-y divide-edge-soft">
          <ConfigGroup
            title={t("Genres")}
            icon={<Tag size={15} strokeWidth={2} />}
            count={value.genres.length}
            summary={groupSummaries.genres}
            open={isOpen("genres")}
            onToggle={() => toggleGroup("genres")}
            onClear={() => clearGroup("genres")}
          >
            <SourceChipField items={genreItems} searchable placeholder={t("Filter genres")} />
          </ConfigGroup>
          <ConfigGroup
            title={t("Where to watch")}
            icon={<Tv size={15} strokeWidth={2} />}
            count={value.watchProviders.length}
            summary={groupSummaries.watchProviders}
            open={isOpen("providers")}
            onToggle={() => toggleGroup("providers")}
            onClear={() => clearGroup("watchProviders")}
          >
            <SourceChipField items={providerItems} />
          </ConfigGroup>
          <ConfigGroup
            title={t("Origin country")}
            icon={<Globe2 size={15} strokeWidth={2} />}
            count={value.originCountries.length}
            summary={groupSummaries.originCountries}
            open={isOpen("countries")}
            onToggle={() => toggleGroup("countries")}
            onClear={() => clearGroup("originCountries")}
          >
            <SourceChipField items={countryItems} searchable placeholder={t("Filter countries")} />
          </ConfigGroup>
          <ConfigGroup
            title={t("Track people")}
            icon={<Users size={15} strokeWidth={2} />}
            count={value.trackedPeople.length}
            summary={groupSummaries.trackedPeople}
            open={isOpen("people")}
            onToggle={() => toggleGroup("people")}
            onClear={() => clearGroup("trackedPeople")}
          >
            <PeopleField tmdbKey={tmdbKey} tracked={value.trackedPeople} onAdd={addPerson} onRemove={removePerson} />
          </ConfigGroup>
        </div>
        <div className="flex flex-col gap-2.5">
          <SectionLabel>{t("Trakt sources")}</SectionLabel>
          <TraktSourceRow
            label={t("Trakt anticipated")}
            sub={t("Most-anticipated upcoming releases on Trakt")}
            on={value.includeTraktAnticipated}
            onToggle={() => toggleSource("includeTraktAnticipated")}
            icon={<img src={traktLogo} alt="" className="h-4 w-4" />}
          />
          <TraktSourceRow
            label={t("My Trakt watchlist")}
            sub={traktConnected ? t("Upcoming items from your watchlist") : t("Connect Trakt in settings first")}
            on={value.includeTraktWatchlist}
            onToggle={() => toggleSource("includeTraktWatchlist")}
            disabled={!traktConnected}
            onConnect={onConnectTrakt}
            icon={<img src={traktLogo} alt="" className="h-4 w-4" />}
          />
        </div>
      </div>
      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-edge-soft px-4 py-3">
        <span className="text-[12.5px] text-ink-muted">
          {activeCount > 0 ? (
            <>
              <span className="font-semibold tabular-nums text-ink">{activeCount}</span> {t("active")}
            </>
          ) : (
            t("No filters")
          )}
        </span>
        <button
          type="button"
          onClick={clearAll}
          disabled={activeCount === 0}
          className="rounded-full px-3 py-1.5 text-[12.5px] font-medium text-ink-subtle transition-colors hover:text-ink disabled:pointer-events-none disabled:opacity-40"
        >
          {t("Clear all")}
        </button>
      </footer>
    </>
  );

  if (narrow) {
    return (
      <>
        <div
          className={`absolute inset-0 z-[60] bg-canvas/30 transition-opacity duration-200 motion-reduce:transition-none ${
            open ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={() => onOpenChange(false)}
        />
        <aside
          className={`absolute inset-y-0 end-0 z-[61] flex w-[360px] max-w-[86%] flex-col overflow-hidden rounded-s-[20px] bg-surface shadow-[0_24px_60px_-24px_rgba(0,0,0,0.55)] transition-transform duration-300 ease-out motion-reduce:transition-none ${
            open ? "translate-x-0" : "translate-x-full rtl:-translate-x-full"
          }`}
        >
          {body}
        </aside>
      </>
    );
  }

  if (!open) {
    return <RailHandle summary={summary} activeCount={activeCount} onExpand={() => onOpenChange(true)} />;
  }

  return (
    <aside className="relative flex w-[356px] shrink-0 flex-col self-stretch overflow-hidden bg-surface before:absolute before:inset-y-0 before:start-0 before:w-px before:bg-edge-soft">
      {body}
    </aside>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="px-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-subtle">{children}</span>
  );
}
