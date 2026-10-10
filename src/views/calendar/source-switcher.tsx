import { Library, Globe, Sparkles, Star } from "lucide-react";
import type { ReactNode } from "react";
import traktLogo from "@/assets/trakt.svg";
import simklLogo from "@/assets/simkl.png";
import type { Settings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { GamesIcon } from "@/components/icons/games-icon";

type Source = Settings["calendarSource"];

type Option = {
  id: Source;
  label: string;
  icon: () => ReactNode;
  hint: string;
};

const TraktGlyph = () => (
  <img src={traktLogo} alt="" className="h-3.5 w-3.5 object-contain" />
);

const SimklGlyph = () => (
  <img src={simklLogo} alt="" className="h-3.5 w-3.5 object-contain" />
);

const OPTIONS: Option[] = [
  {
    id: "library",
    label: "My library",
    icon: () => <Library size={13} strokeWidth={2.2} />,
    hint: "Upcoming episodes and movies from your saved shows",
  },
  { id: "games", label: "games.calendar.source", icon: () => <GamesIcon size={17}/>, hint: "games.calendar.hint" },
  {
    id: "all",
    label: "All upcoming",
    icon: () => <Globe size={13} strokeWidth={2.2} />,
    hint: "Everything releasing this month from TMDB",
  },
  {
    id: "trakt",
    label: "My Trakt",
    icon: TraktGlyph,
    hint: "Upcoming episodes and movies from your Trakt watchlist",
  },
  {
    id: "anticipated",
    label: "Trakt anticipated",
    icon: TraktGlyph,
    hint: "The most anticipated upcoming releases on Trakt",
  },
  {
    id: "simkl",
    label: "My Simkl",
    icon: SimklGlyph,
    hint: "Upcoming episodes and movies from your Simkl watching and plan-to-watch lists",
  },
  {
    id: "simkl-anticipated",
    label: "Simkl premieres",
    icon: SimklGlyph,
    hint: "New shows and anime premiering this month, from Simkl",
  },
  {
    id: "anime",
    label: "Anime",
    icon: () => <Sparkles size={13} strokeWidth={2.2} />,
    hint: "Anime episodes airing this month, sub or dub",
  },
  {
    id: "custom",
    label: "Custom",
    icon: () => <Star size={13} strokeWidth={2.2} />,
    hint: "Build your own feed from actors, directors, and Trakt lists",
  },
];

export function SourceSwitcher({
  value,
  onChange,
  traktConnected,
  simklConnected,
  gamesAllowed = true,
}: {
  value: Source;
  onChange: (s: Source) => void;
  traktConnected: boolean;
  simklConnected: boolean;
  gamesAllowed?: boolean;
}) {
  const t = useT();
  const visible = OPTIONS.filter(
    (o) =>
      (o.id !== "games" || gamesAllowed) &&
      (o.id !== "trakt" || traktConnected) &&
      (o.id !== "simkl" || simklConnected) &&
      (o.id !== "simkl-anticipated" || simklConnected),
  );
  return (
    <div className="flex items-center gap-1 rounded-full border border-edge-soft bg-elevated/30 p-1">
      {visible.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            aria-pressed={active}
            title={t(opt.hint)}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
              active
                ? "bg-ink text-canvas"
                : "text-ink-muted hover:bg-raised/60 hover:text-ink"
            }`}
          >
            {opt.icon()}
            {t(opt.label)}
          </button>
        );
      })}
    </div>
  );
}
