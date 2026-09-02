import { ArrowLeft, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { pushOverlayPin } from "@/lib/overlay-pin";
import { useT } from "@/lib/i18n";
import { UnderwaterScene } from "../play/underwater";
import { TOPICS } from "./learn-data";
import { loadStars, type LearnTopic } from "./learn-types";
import { TopicView } from "./topic-view";

export function KidsLearnZone({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [topic, setTopic] = useState<LearnTopic | null>(null);
  const [stars, setStars] = useState<Record<string, number>>(() => loadStars());

  useEffect(() => pushOverlayPin(), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      setTopic((cur) => {
        if (cur != null) {
          setStars(loadStars());
          return null;
        }
        onClose();
        return cur;
      });
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const backToHub = () => {
    setStars(loadStars());
    setTopic(null);
  };

  return createPortal(
    <div className="fixed inset-0 z-[150] flex flex-col overflow-hidden animate-in fade-in duration-200">
      <UnderwaterScene />
      <header
        data-tauri-drag-region
        className="relative z-10 flex shrink-0 items-center gap-4 px-8 pt-7"
      >
        <button
          type="button"
          onClick={() => (topic != null ? backToHub() : onClose())}
          className="flex h-14 items-center gap-2.5 rounded-full border-4 border-white/40 bg-white/90 px-6 text-[17px] font-bold text-[#123a52] shadow-[0_12px_28px_-10px_rgba(0,20,40,0.6)] transition-transform duration-150 hover:scale-[1.04] active:scale-95"
        >
          <ArrowLeft size={20} strokeWidth={2.6} className="dir-icon" />
          {t("Back")}
        </button>
        <div className="flex min-w-0 flex-col">
          <h1 className="font-display text-[34px] font-medium leading-tight text-white drop-shadow-[0_2px_14px_rgba(0,20,40,0.5)]">
            {topic ? `${topic.emoji} ${topic.title}` : t("Learn Lagoon")}
          </h1>
          {!topic && (
            <p className="text-[15px] font-semibold text-white/75">
              {t("Explore, discover and earn stars")}
            </p>
          )}
        </div>
        <img
          src="/kids/doodles/lilpurpocto.png"
          alt=""
          draggable={false}
          className="ms-auto h-16 w-auto"
          style={{ animation: "curfew-sail 4.5s ease-in-out infinite" }}
        />
      </header>
      <div className="relative z-10 min-h-0 flex-1 pb-8 pt-5">
        {topic ? (
          <TopicView key={topic.id} topic={topic} onDone={backToHub} />
        ) : (
          <div className="kids-big-scroll h-full overflow-y-auto px-8 pb-6">
            <div className="mx-auto grid w-full max-w-[980px] grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {TOPICS.map((topicDef, i) => {
                const earned = stars[topicDef.id] ?? 0;
                return (
                  <button
                    key={topicDef.id}
                    type="button"
                    onClick={() => setTopic(topicDef)}
                    className="kids-card group flex flex-col items-center gap-3 rounded-[26px] border-4 border-white/35 bg-white/92 px-6 py-7 text-center shadow-[0_20px_50px_-18px_rgba(0,20,40,0.6)] transition-transform duration-200 hover:scale-[1.04] active:scale-[0.98]"
                    style={{ animationDelay: `${Math.min(i, 10) * 70}ms` }}
                  >
                    <span
                      className="flex h-20 w-20 items-center justify-center rounded-full text-[44px] transition-transform duration-300 group-hover:scale-110"
                      style={{ background: `${topicDef.color}26` }}
                    >
                      {topicDef.emoji}
                    </span>
                    <span className="font-display text-[22px] font-medium leading-tight text-[#123a52]">
                      {topicDef.title}
                    </span>
                    <span className="flex items-center gap-1">
                      {[0, 1, 2].map((s) => (
                        <Star
                          key={s}
                          size={20}
                          strokeWidth={1.8}
                          className={s < earned ? "text-[#ffb703]" : "text-[#c8dbe6]"}
                          fill={s < earned ? "#ffd166" : "#eef6fa"}
                        />
                      ))}
                    </span>
                    <span className="text-[13px] font-semibold text-[#3c6a84]">
                      {t("{count} cards + quiz", { count: topicDef.cards.length })}
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
