import { UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { SearchPerson } from "@/lib/search";
import { useT } from "@/lib/i18n";
import type { CustomCalendar } from "./custom-bar/constants";
import { CustomManager } from "./custom-bar/custom-manager";

export function CustomCalendarBar({
  tmdbKey,
  traktConnected,
  value,
  onChange,
}: {
  tmdbKey: string;
  traktConnected: boolean;
  value: CustomCalendar;
  onChange: (next: CustomCalendar) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const addPerson = (p: SearchPerson) => {
    if (value.trackedPeople.some((x) => x.id === p.id)) return;
    onChange({
      ...value,
      trackedPeople: [
        ...value.trackedPeople,
        { id: p.id, name: p.name, profile: p.profile, role: "any" },
      ],
    });
  };
  const removePerson = (id: number) => {
    onChange({ ...value, trackedPeople: value.trackedPeople.filter((p) => p.id !== id) });
  };
  const toggleSource = (k: "includeTraktWatchlist" | "includeTraktAnticipated") => {
    onChange({ ...value, [k]: !value[k] });
  };
  const toggleMediaType = (kind: "movie" | "tv" | "anime") => {
    onChange({ ...value, mediaTypes: { ...value.mediaTypes, [kind]: !value.mediaTypes[kind] } });
  };
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
  const clearAll = () => {
    onChange({
      ...value,
      genres: [],
      watchProviders: [],
      originCountries: [],
      trackedPeople: [],
      includeTraktAnticipated: false,
      includeTraktWatchlist: false,
    });
  };

  const summary = (() => {
    const bits: string[] = [];
    if (value.trackedPeople.length) bits.push(t("{n} people", { n: value.trackedPeople.length }));
    if (value.genres.length)
      bits.push(
        value.genres.length === 1
          ? t("{n} genre", { n: value.genres.length })
          : t("{n} genres", { n: value.genres.length }),
      );
    if (value.watchProviders.length)
      bits.push(
        value.watchProviders.length === 1
          ? t("{n} provider", { n: value.watchProviders.length })
          : t("{n} providers", { n: value.watchProviders.length }),
      );
    if (value.originCountries.length)
      bits.push(
        value.originCountries.length === 1
          ? t("{n} country", { n: value.originCountries.length })
          : t("{n} countries", { n: value.originCountries.length }),
      );
    if (value.includeTraktAnticipated) bits.push(t("Anticipated"));
    if (value.includeTraktWatchlist) bits.push(t("Watchlist"));
    if (bits.length === 0) return t("Empty — click to add filters");
    return bits.join(" · ");
  })();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full border border-edge-soft bg-elevated/40 px-4 py-1.5 text-[12.5px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink"
      >
        <UserPlus size={13} strokeWidth={2.2} />
        <span className="text-ink">{t("Manage")}</span>
        <span className="text-ink-subtle">·</span>
        <span className="truncate max-w-[260px]">{summary}</span>
      </button>
      {open &&
        createPortal(
          <CustomManager
            tmdbKey={tmdbKey}
            traktConnected={traktConnected}
            value={value}
            onAddPerson={addPerson}
            onRemovePerson={removePerson}
            onToggleSource={toggleSource}
            onToggleMediaType={toggleMediaType}
            onToggleGenre={toggleGenre}
            onToggleProvider={toggleProvider}
            onToggleCountry={toggleCountry}
            onClearAll={clearAll}
            onClose={() => setOpen(false)}
          />,
          document.body,
        )}
    </>
  );
}
