import { ArrowLeft, Fish, Gamepad2, Hash, Puzzle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { pushOverlayPin } from "@/lib/overlay-pin";
import { useT } from "@/lib/i18n";
import { BubblePop } from "./bubble-pop";
import { GameArcade } from "./games";
import { MemoryMatch } from "./memory-match";
import { OceanFacts } from "./ocean-facts";
import { UnderwaterScene } from "./underwater";

type Activity = "games" | "memory" | "bubbles" | "facts";

const ACTIVITIES: Array<{
  id: Activity;
  name: string;
  blurb: string;
  art: string;
  icon: typeof Gamepad2;
  chip: string;
}> = [
  {
    id: "games",
    name: "Games",
    blurb: "Hand-picked mini games",
    art: "lilbluewhale",
    icon: Gamepad2,
    chip: "#f472b6",
  },
  {
    id: "memory",
    name: "Match the Pals",
    blurb: "Find the matching pairs",
    art: "lilpurpocto",
    icon: Puzzle,
    chip: "#a78bfa",
  },
  {
    id: "bubbles",
    name: "Bubble Numbers",
    blurb: "Pop the bubbles in order",
    art: "liloctored",
    icon: Hash,
    chip: "#38bdf8",
  },
  {
    id: "facts",
    name: "Ocean Wonders",
    blurb: "Amazing true sea facts",
    art: "lilwhale1",
    icon: Fish,
    chip: "#4ade80",
  },
];

export function KidsPlayZone({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [gameOpen, setGameOpen] = useState(false);
  const [gameExitSignal, setGameExitSignal] = useState(0);
  const gameOpenRef = useRef(false);
  gameOpenRef.current = gameOpen;

  useEffect(() => pushOverlayPin(), []);

  const goBack = () => {
    if (gameOpenRef.current) {
      setGameExitSignal((n) => n + 1);
      return;
    }
    setActivity((cur) => {
      if (cur != null) return null;
      onClose();
      return cur;
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      goBack();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  const active = ACTIVITIES.find((a) => a.id === activity) ?? null;

  return createPortal(
    <div className="fixed inset-0 z-[150] flex flex-col overflow-hidden animate-in fade-in duration-200">
      <UnderwaterScene />
      <header
        data-tauri-drag-region
        className="relative z-10 flex shrink-0 items-center gap-4 px-8 pt-7"
      >
        <button
          type="button"
          onClick={goBack}
          className="flex h-14 items-center gap-2.5 rounded-full border-4 border-white/40 bg-white/90 px-6 text-[17px] font-bold text-[#123a52] shadow-[0_12px_28px_-10px_rgba(0,20,40,0.6)] transition-transform duration-150 hover:scale-[1.04] active:scale-95"
        >
          <ArrowLeft size={20} strokeWidth={2.6} className="dir-icon" />
          {t("Back")}
        </button>
        <div className="flex min-w-0 flex-col">
          <h1 className="font-display text-[34px] font-medium leading-tight text-white drop-shadow-[0_2px_14px_rgba(0,20,40,0.5)]">
            {active ? t(active.name) : t("Play Zone")}
          </h1>
          {!active && (
            <p className="text-[15px] font-semibold text-white/75">
              {t("Games, coloring and ocean wonders")}
            </p>
          )}
        </div>
        <img
          src="/kids/doodles/lilbluewhale.png"
          alt=""
          draggable={false}
          className="ms-auto h-16 w-auto"
          style={{ animation: "curfew-sail 4.5s ease-in-out infinite" }}
        />
      </header>
      <div className="relative z-10 min-h-0 flex-1 pb-8 pt-5">
        {activity === "games" && (
          <GameArcade exitSignal={gameExitSignal} onPlayingChange={setGameOpen} />
        )}
        {activity === "memory" && <MemoryMatch />}
        {activity === "bubbles" && <BubblePop />}
        {activity === "facts" && <OceanFacts />}
        {activity == null && (
          <div className="flex h-full items-center justify-center px-8">
            <div className="grid w-full max-w-[880px] grid-cols-1 gap-5 sm:grid-cols-2">
              {ACTIVITIES.map((a, i) => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setActivity(a.id)}
                    className="kids-card group flex items-center gap-5 rounded-2xl border-4 border-white/35 bg-white/90 px-7 py-6 text-start shadow-[0_24px_60px_-20px_rgba(0,20,40,0.6)] transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98]"
                    style={{ animationDelay: `${i * 90}ms` }}
                  >
                    <img
                      src={`/kids/doodles/${a.art}.png`}
                      alt=""
                      draggable={false}
                      className="h-20 w-20 shrink-0 object-contain transition-transform duration-300 group-hover:scale-110"
                    />
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="flex items-center gap-2.5">
                        <span
                          className="flex h-8 w-8 items-center justify-center rounded-full text-white"
                          style={{ background: a.chip }}
                        >
                          <Icon size={16} strokeWidth={2.6} />
                        </span>
                        <span className="font-display text-[24px] font-medium leading-tight text-[#123a52]">
                          {t(a.name)}
                        </span>
                      </span>
                      <span className="text-[15px] font-semibold text-[#3c6a84]">{t(a.blurb)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
