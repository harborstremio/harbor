import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Settings2, Trophy } from "lucide-react";
import { useT, useUiLanguage } from "@/lib/i18n";
import { liveCount, getLeagueLabel, type LeagueDef, type SportsGame } from "@/lib/sports/espn";
import { SportsCard } from "./sports-card";
import { SportsCustomizeModal } from "./sports-customize-modal";
import { TennisTournamentsModal } from "../../tennis-tournaments-modal";

const TENNIS_KEYS = ["TENNIS", "TENNIS_WTA"];

function useRail() {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const measure = () => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdges({ left: el.scrollLeft > 4, right: max > 4 && el.scrollLeft < max - 4 });
  };
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, []);
  const nudge = (direction: 1 | -1) =>
    ref.current?.scrollBy({ left: direction * Math.max(240, ref.current.clientWidth * 0.8), behavior: "smooth" });
  return { ref, edges, nudge, measure };
}

function RailArrow({ side, onClick, label }: { side: "start" | "end"; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`absolute top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-raised/95 text-ink shadow-[0_6px_18px_-8px_rgba(0,0,0,0.8)] ring-1 ring-edge-soft transition-opacity duration-200 ease-out hover:bg-elevated ${
        side === "start" ? "start-0" : "end-0"
      }`}
    >
      {side === "start" ? <ChevronLeft size={17} className="dir-icon" /> : <ChevronRight size={17} className="dir-icon" />}
    </button>
  );
}

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
  const cards = useRail();
  const chips = useRail();
  const trackRef = cards.ref;
  const pausedRef = useRef(false);
  const live = liveCount(games);
  const [showCustomize, setShowCustomize] = useState(false);
  const [showTournaments, setShowTournaments] = useState(false);
  const showTennis =
    TENNIS_KEYS.includes(selected) ||
    (selected === "all" && selectedLeagues.some((k) => TENNIS_KEYS.includes(k)));

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
          <div className="flex items-center gap-2">
            {showTennis && (
              <button
                onClick={() => setShowTournaments(true)}
                title={t("Tournaments")}
                className="flex items-center gap-1.5 rounded-full border border-edge-soft/50 bg-elevated px-2.5 py-1 text-[11.5px] font-medium text-ink-muted transition-all hover:border-edge hover:text-ink"
              >
                <Trophy size={13} />
                <span>{t("Tournaments")}</span>
              </button>
            )}
            <button
              onClick={() => setShowCustomize(true)}
              title={t("sports.customize")}
              className="flex items-center gap-1.5 rounded-full border border-edge-soft/50 bg-elevated px-2.5 py-1 text-[11.5px] font-medium text-ink-muted transition-all hover:border-edge hover:bg-elevated hover:text-ink"
            >
              <Settings2 size={13} />
              <span>{t("sports.customize")}</span>
            </button>
          </div>
        </div>
        <div className="relative min-w-0">
          <div
            ref={chips.ref}
            className="flex gap-2 overflow-x-auto overflow-y-hidden pb-1 pe-[9px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <LeagueChip active={selected === "all"} onClick={() => onLeague("all")} label={t("All")} />
            {leagues.filter((l) => selectedLeagues.includes(l.key)).map((l) => (
              <LeagueChip
                key={l.key}
                active={selected === l.key}
                onClick={() => onLeague(l.key)}
                label={getLeagueLabel(l)}
                logo={l.logo}
              />
            ))}
          </div>
          {chips.edges.left && <RailArrow side="start" label={t("Scroll left")} onClick={() => chips.nudge(-1)} />}
          {chips.edges.right && <RailArrow side="end" label={t("Scroll right")} onClick={() => chips.nudge(1)} />}
        </div>
        {games.length > 0 ? (
          <div className="relative min-w-0">
            <div
              ref={trackRef}
              onMouseEnter={() => { pausedRef.current = true; }}
              onMouseLeave={() => { pausedRef.current = false; }}
              className="flex gap-4 overflow-x-auto overflow-y-hidden pb-1 pe-[9px] [scroll-snap-type:x_mandatory] [&>*]:[scroll-snap-align:start] [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
            >
              {games.map((g) => (
                <SportsCard key={g.id} game={g} onSelect={onSelect} />
              ))}
            </div>
            {cards.edges.left && <RailArrow side="start" label={t("Scroll left")} onClick={() => cards.nudge(-1)} />}
            {cards.edges.right && <RailArrow side="end" label={t("Scroll right")} onClick={() => cards.nudge(1)} />}
          </div>
        ) : (
          <div className="flex h-[60px] items-center rounded-xl border border-edge-soft/45 bg-elevated/40 px-5 text-[13px] text-ink-subtle">
            {t("No live or upcoming games right now.")}
          </div>
        )}
      </div>
      {showTournaments && <TennisTournamentsModal onClose={() => setShowTournaments(false)} />}
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
