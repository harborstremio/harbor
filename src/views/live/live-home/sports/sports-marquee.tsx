import { useT, useUiLanguage } from "@/lib/i18n";
import { liveCount, getLeagueLabel, type LeagueDef, type SportsGame } from "@/lib/sports/espn";
import { Settings2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { SportsCard } from "./sports-card";
import { SportsCustomizeModal } from "./sports-customize-modal";

export function SportsMarquee({
  games,
  leagues,
  selected,
  selectedLeagues,
  onLeague,
  onLeaguesChange,
  onSelect,
}: {
  games: SportsGame[];
  leagues: LeagueDef[];
  selected: string;
  selectedLeagues: string[];
  onLeague: (key: string) => void;
  onLeaguesChange: (keys: string[]) => void;
  onSelect: (g: SportsGame) => void;
}) {
  const t = useT();
  useUiLanguage();
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const live = liveCount(games);
  const [showCustomize, setShowCustomize] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || games.length <= 3) return;
    const id = window.setInterval(() => {
      const el = trackRef.current;
      if (!el || pausedRef.current) return;
      const max = el.scrollWidth - el.clientWidth;
      if (el.scrollLeft >= max - 4) el.scrollTo({ left: 0, behavior: "smooth" });
      else el.scrollBy({ left: 276, behavior: "smooth" });
    }, 6000);
    return () => window.clearInterval(id);
  }, [games.length]);

  return (
    <>
      <div className="flex flex-col gap-2.5 ps-[9px]">
        <div className="flex items-center justify-between pe-[9px]">
          <div className="flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
            {t("Live & Upcoming")}
            {live > 0 && (
              <span className="flex h-[18px] items-center gap-1 rounded bg-danger px-1.5 text-[10px] font-bold tracking-[0.06em] text-white">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                {t("{n} LIVE", { n: live })}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowCustomize(true)}
            title={t("sports.customize")}
            className="flex items-center gap-1.5 rounded-full border border-edge-soft/50 bg-elevated px-2.5 py-1 text-[11.5px] font-medium text-ink-muted transition-all hover:border-edge hover:bg-elevated hover:text-ink"
          >
            <Settings2 size={13} />
            <span>{t("sports.customize")}</span>
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <LeagueChip active={selected === "all"} onClick={() => onLeague("all")} label={t("All")} />
          {leagues
            .filter((l) => selectedLeagues.includes(l.key))
            .map((l) => (
              <LeagueChip
                key={l.key}
                active={selected === l.key}
                onClick={() => onLeague(l.key)}
                label={getLeagueLabel(l)}
                logo={l.logo}
              />
            ))}
        </div>
        {games.length > 0 ? (
          <div
            ref={trackRef}
            onMouseEnter={() => {
              pausedRef.current = true;
            }}
            onMouseLeave={() => {
              pausedRef.current = false;
            }}
            className="flex gap-4 overflow-x-auto pb-1 [scroll-snap-type:x_mandatory] [&>*]:[scroll-snap-align:start] [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
          >
            {games.map((g) => (
              <SportsCard key={g.id} game={g} onSelect={onSelect} />
            ))}
          </div>
        ) : (
          <div className="flex h-[60px] items-center rounded-xl border border-edge-soft/45 bg-elevated/40 px-5 text-[13px] text-ink-subtle">
            {t("No live or upcoming games right now.")}
          </div>
        )}
      </div>
      {showCustomize && (
        <SportsCustomizeModal
          selected={selectedLeagues}
          onSave={onLeaguesChange}
          onClose={() => setShowCustomize(false)}
        />
      )}
    </>
  );
}

function LeagueChip({
  active,
  onClick,
  label,
  logo,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  logo?: string;
}) {
  const [err, setErr] = useState(false);
  return (
    <button
      onClick={onClick}
      className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full border ps-1.5 pe-3.5 text-[12.5px] font-medium transition-colors ${
        active
          ? "border-transparent bg-ink text-canvas"
          : "border-edge-soft/60 bg-elevated text-ink-muted hover:border-edge hover:text-ink"
      }`}
    >
      {logo && !err ? (
        <img
          src={logo}
          alt=""
          draggable={false}
          onError={() => setErr(true)}
          className="h-6 w-6 shrink-0 object-contain"
        />
      ) : (
        <span className="w-1.5" />
      )}
      <span className="truncate">{label}</span>
    </button>
  );
}
