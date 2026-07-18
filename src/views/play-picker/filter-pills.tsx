import { Languages, Zap } from "lucide-react";
import { abbreviateLanguages, normalizeLangCode } from "./picker-utils";

export function CachedFilterPill({
  on,
  hiddenCount,
  onToggle,
}: {
  on: boolean;
  hiddenCount: number;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.18em] transition-colors ${
        on
          ? "bg-accent/15 text-accent hover:bg-accent/22"
          : "text-ink-subtle/80 hover:bg-canvas/60 hover:text-ink-muted"
      }`}
      aria-pressed={on}
    >
      <Zap size={11} fill={on ? "currentColor" : "none"} strokeWidth={2.2} />
      {on ? `Cached only · +${hiddenCount}` : `Show all sources`}
    </button>
  );
}

export function LanguageFilterPill({
  languages,
  on,
  hiddenCount,
  onToggle,
  isAnime,
}: {
  languages: string[];
  on: boolean;
  hiddenCount: number;
  onToggle: () => void;
  isAnime: boolean;
}) {
  const display = isAnime ? languages : languages.filter((l) => normalizeLangCode(l) !== "ja");
  const label = abbreviateLanguages(display);
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.18em] transition-colors ${
        on
          ? "bg-ink/8 text-ink-muted hover:bg-ink/14 hover:text-ink"
          : "text-ink-subtle/80 hover:bg-canvas/60 hover:text-ink-muted"
      }`}
      aria-pressed={on}
    >
      <Languages size={11} strokeWidth={2.2} />
      {on ? `${label} only · +${hiddenCount}` : `Show ${label} only`}
    </button>
  );
}
