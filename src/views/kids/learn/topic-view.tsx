import { ArrowLeft, ArrowRight, Lightbulb, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import type { LearnTopic } from "./learn-types";
import { QuizView } from "./quiz-view";

export function TopicView({ topic, onDone }: { topic: LearnTopic; onDone: () => void }) {
  const t = useT();
  const [idx, setIdx] = useState(0);
  const [quiz, setQuiz] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const card = topic.cards[idx];
  const last = idx === topic.cards.length - 1;

  useEffect(() => {
    setImgFailed(false);
    const next = topic.cards[idx + 1];
    if (next?.img) {
      const pre = new Image();
      pre.src = next.img;
    }
  }, [idx, topic]);

  if (quiz) return <QuizView topic={topic} onDone={onDone} />;

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-5 px-6">
      <div
        key={idx}
        className="kids-card flex w-full max-w-[680px] flex-col overflow-hidden rounded-[32px] border-4 border-white/25 bg-white/95 shadow-[0_30px_80px_-20px_rgba(0,20,40,0.6)]"
      >
        {card.img && !imgFailed ? (
          <div className="relative h-[260px] w-full shrink-0 bg-[#dceef5]">
            <img
              src={card.img}
              alt=""
              draggable={false}
              onError={() => setImgFailed(true)}
              className="h-full w-full object-cover"
            />
            <span className="absolute bottom-2 end-3 rounded-full bg-black/45 px-2.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-white/85">
              Wikimedia Commons
            </span>
          </div>
        ) : (
          <div
            className="flex h-[180px] items-center justify-center text-[84px]"
            style={{ background: `${topic.color}22` }}
          >
            {topic.emoji}
          </div>
        )}
        <div className="flex flex-col gap-3 px-9 py-7 text-center">
          <h3 className="font-display text-[30px] font-medium leading-tight text-[#123a52]">
            {card.title}
          </h3>
          <p className="text-[18px] font-semibold leading-relaxed text-[#2d5a75]">{card.text}</p>
          <div className="mx-auto flex items-start gap-2.5 rounded-2xl bg-[#fff3d6] px-5 py-3 text-start">
            <Lightbulb size={19} strokeWidth={2.4} className="mt-0.5 shrink-0 text-[#e08900]" />
            <span className="text-[14.5px] font-semibold leading-snug text-[#7a5200]">
              {card.funFact}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setIdx((v) => Math.max(0, v - 1))}
          disabled={idx === 0}
          aria-label={t("Previous card")}
          className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-white/40 bg-white/90 text-[#123a52] transition-transform duration-150 hover:scale-[1.06] active:scale-95 disabled:opacity-35"
        >
          <ArrowLeft size={20} strokeWidth={2.6} className="dir-icon" />
        </button>
        <div className="flex items-center gap-1.5">
          {topic.cards.map((_, i) => (
            <span
              key={i}
              className={`rounded-full transition-all duration-200 ${
                i === idx ? "h-3.5 w-7 bg-[#ffd166]" : "h-3 w-3 bg-white/45"
              }`}
            />
          ))}
        </div>
        {last ? (
          <button
            type="button"
            onClick={() => setQuiz(true)}
            className="flex h-14 items-center gap-2.5 rounded-full bg-[#ffd166] px-8 text-[18px] font-bold text-[#4a3200] transition-transform duration-150 hover:scale-[1.05] active:scale-95"
          >
            <Sparkles size={20} strokeWidth={2.4} />
            {t("Quiz time!")}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIdx((v) => Math.min(topic.cards.length - 1, v + 1))}
            aria-label={t("Next card")}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ffd166] text-[#4a3200] transition-transform duration-150 hover:scale-[1.08] active:scale-95"
          >
            <ArrowRight size={20} strokeWidth={2.6} className="dir-icon" />
          </button>
        )}
      </div>
    </div>
  );
}
