import { useEffect, useMemo, useRef, useState } from "react";
import { PartyPopper, RotateCcw } from "lucide-react";
import { useT } from "@/lib/i18n";

const PAIRS = [
  "lilbluewhale",
  "lilwhale1",
  "liloctored",
  "lilpurpocto",
  "lilorangestar2",
  "lilpurplestar",
];

type Card = { key: number; art: string };

function buildDeck(): Card[] {
  const deck = [...PAIRS, ...PAIRS].map((art, key) => ({ key, art }));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function MemoryMatch() {
  const t = useT();
  const [deck, setDeck] = useState<Card[]>(() => buildDeck());
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [moves, setMoves] = useState(0);
  const lockRef = useRef(false);
  const won = matched.size === deck.length;

  const reset = () => {
    setDeck(buildDeck());
    setFlipped([]);
    setMatched(new Set());
    setMoves(0);
    lockRef.current = false;
  };

  const tap = (key: number) => {
    if (lockRef.current || matched.has(key) || flipped.includes(key)) return;
    const next = [...flipped, key];
    setFlipped(next);
    if (next.length < 2) return;
    setMoves((m) => m + 1);
    const [a, b] = next;
    const cardA = deck.find((c) => c.key === a);
    const cardB = deck.find((c) => c.key === b);
    if (cardA && cardB && cardA.art === cardB.art) {
      setMatched((prev) => new Set([...prev, a, b]));
      setFlipped([]);
      return;
    }
    lockRef.current = true;
    window.setTimeout(() => {
      lockRef.current = false;
      setFlipped([]);
    }, 850);
  };

  const confetti = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        left: (i * 41) % 100,
        delay: (i * 0.17) % 1.4,
        art: PAIRS[i % PAIRS.length],
      })),
    [],
  );

  useEffect(() => {
    if (!won) return;
    lockRef.current = true;
    return () => {
      lockRef.current = false;
    };
  }, [won]);

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-6 px-6">
      <div className="flex items-center gap-4">
        <span className="rounded-full bg-white/20 px-5 py-2 text-[16px] font-bold text-white">
          {t("Moves: {moves}", { moves })}
        </span>
        <button
          type="button"
          onClick={reset}
          className="flex h-11 items-center gap-2 rounded-full bg-white/90 px-5 text-[15px] font-bold text-[#123a52] transition-transform duration-150 hover:scale-[1.04] active:scale-95"
        >
          <RotateCcw size={16} strokeWidth={2.6} />
          {t("Shuffle")}
        </button>
      </div>
      <div className="grid w-[min(100%,520px,calc(100vh-290px))] grid-cols-4 gap-3">
        {deck.map((card) => {
          const isUp = matched.has(card.key) || flipped.includes(card.key);
          const isMatched = matched.has(card.key);
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => tap(card.key)}
              aria-label={isUp ? t("Card") : t("Hidden card")}
              className="aspect-[3/4] [perspective:600px]"
            >
              <span
                className="relative block h-full w-full transition-transform duration-300 [transform-style:preserve-3d]"
                style={{ transform: isUp ? "rotateY(180deg)" : "rotateY(0deg)" }}
              >
                <span className="absolute inset-0 flex items-center justify-center rounded-2xl border-4 border-white/30 bg-gradient-to-br from-[#1d84a8] to-[#0d5379] text-[28px] font-bold text-white/80 shadow-[0_10px_24px_-8px_rgba(0,20,40,0.55)] [backface-visibility:hidden]">
                  ?
                </span>
                <span
                  className={`absolute inset-0 flex items-center justify-center rounded-2xl border-4 bg-white/95 p-2 shadow-[0_10px_24px_-8px_rgba(0,20,40,0.55)] [backface-visibility:hidden] [transform:rotateY(180deg)] ${
                    isMatched ? "border-[#ffd166]" : "border-white/70"
                  }`}
                >
                  <img
                    src={`/kids/doodles/${card.art}.png`}
                    alt=""
                    draggable={false}
                    className="max-h-full w-auto max-w-full"
                  />
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {won && (
        <div className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-[#0a2a3f]/75 animate-in fade-in duration-200">
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
          <div className="kids-card flex flex-col items-center gap-4 rounded-2xl border-4 border-[#ffd166] bg-white/95 px-12 py-10 text-center">
            <PartyPopper size={44} className="text-[#e08900]" strokeWidth={2} />
            <p className="font-display text-[30px] font-medium text-[#123a52]">
              {t("You found them all!")}
            </p>
            <p className="text-[16px] font-semibold text-[#3c6a84]">
              {t("{moves} moves. Amazing memory!", { moves })}
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-1 flex h-14 items-center gap-2 rounded-full bg-[#ffd166] px-8 text-[18px] font-bold text-[#4a3200] transition-transform duration-150 hover:scale-[1.04] active:scale-95"
            >
              <RotateCcw size={18} strokeWidth={2.6} />
              {t("Play again")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
