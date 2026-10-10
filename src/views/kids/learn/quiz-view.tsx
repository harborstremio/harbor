import { PartyPopper, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import type { LearnTopic } from "./learn-types";
import { saveStars } from "./learn-types";

const CONFETTI_ART = [
  "lilbluewhale",
  "liloctored",
  "lilpurpocto",
  "lilorangestar2",
  "lilpurplestar",
  "lilwhale1",
];

export function QuizView({ topic, onDone }: { topic: LearnTopic; onDone: () => void }) {
  const t = useT();
  const [qIdx, setQIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [wrongPick, setWrongPick] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const q = topic.quiz[qIdx];

  const confetti = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        left: (i * 43 + 7) % 100,
        delay: (i * 0.19) % 1.5,
        art: CONFETTI_ART[i % CONFETTI_ART.length],
      })),
    [],
  );

  const answer = (i: number) => {
    if (picked != null) return;
    if (i === q.answerIndex) {
      setPicked(i);
      const nextScore = wrongPick == null ? score + 1 : score;
      setScore(nextScore);
      window.setTimeout(() => {
        setPicked(null);
        setWrongPick(null);
        if (qIdx + 1 >= topic.quiz.length) {
          const stars = nextScore >= topic.quiz.length - 1 ? 3 : nextScore >= 3 ? 2 : 1;
          saveStars(topic.id, stars);
          setFinished(true);
        } else {
          setQIdx((v) => v + 1);
        }
      }, 700);
    } else {
      setWrongPick(i);
      window.setTimeout(() => setWrongPick(null), 500);
    }
  };

  if (finished) {
    const stars = score >= topic.quiz.length - 1 ? 3 : score >= 3 ? 2 : 1;
    return (
      <div className="relative flex h-full flex-col items-center justify-center gap-6 px-6">
        {confetti.map((c, i) => (
          <img
            key={i}
            src={`/kids/doodles/${c.art}.png`}
            alt=""
            draggable={false}
            className="pointer-events-none absolute top-[-40px] w-9"
            style={{
              left: `${c.left}%`,
              animation: `kid-confetti-fall 2.6s ease-in ${c.delay}s infinite`,
            }}
          />
        ))}
        <div className="kids-card flex flex-col items-center gap-4 rounded-[32px] border-4 border-[#ffd166] bg-white/95 px-14 py-12 text-center">
          <PartyPopper size={46} className="text-[#e08900]" strokeWidth={2} />
          <p className="font-display text-[32px] font-medium text-[#123a52]">
            {stars === 3 ? t("Superstar!") : stars === 2 ? t("Great job!") : t("Nice try!")}
          </p>
          <div className="flex items-center gap-2">
            {[0, 1, 2].map((i) => (
              <Star
                key={i}
                size={40}
                strokeWidth={1.6}
                className={i < stars ? "text-[#ffb703]" : "text-[#c8dbe6]"}
                fill={i < stars ? "#ffd166" : "#e8f2f7"}
              />
            ))}
          </div>
          <p className="text-[16px] font-semibold text-[#3c6a84]">
            {t("You got {score} of {total} right!", { score, total: topic.quiz.length })}
          </p>
          <button
            type="button"
            onClick={onDone}
            className="mt-1 flex h-14 items-center rounded-full bg-[#ffd166] px-9 text-[18px] font-bold text-[#4a3200] transition-transform duration-150 hover:scale-[1.04] active:scale-95"
          >
            {t("All topics")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-7 px-6">
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-white/20 px-5 py-2 text-[15px] font-bold text-white">
          {t("Question {current} of {total}", { current: qIdx + 1, total: topic.quiz.length })}
        </span>
        <span className="rounded-full bg-white/20 px-5 py-2 text-[15px] font-bold text-white">
          {topic.emoji} {t("{score} right", { score })}
        </span>
      </div>
      <p className="max-w-[700px] text-center font-display text-[30px] font-medium leading-snug text-white drop-shadow-[0_2px_12px_rgba(0,20,40,0.5)]">
        {q.q}
      </p>
      <div className="grid w-full max-w-[720px] grid-cols-1 gap-3 sm:grid-cols-2">
        {q.options.map((opt, i) => {
          const isRight = picked != null && i === q.answerIndex;
          const isWrong = wrongPick === i;
          return (
            <button
              key={`${qIdx}-${i}`}
              type="button"
              onClick={() => answer(i)}
              className={`min-h-[64px] rounded-xl border-4 px-6 py-4 text-[17px] font-bold transition-all duration-150 active:scale-[0.97] ${
                isRight
                  ? "border-[#4ade80] bg-[#4ade80] text-[#0c3a1e] scale-[1.03]"
                  : isWrong
                    ? "border-[#f87171] bg-[#f87171]/90 text-white"
                    : "border-white/35 bg-white/90 text-[#123a52] hover:scale-[1.02]"
              }`}
              style={isWrong ? { animation: "curfew-shake 0.4s ease-in-out" } : undefined}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
