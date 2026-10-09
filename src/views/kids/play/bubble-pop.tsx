import { useMemo, useState } from "react";
import { PartyPopper } from "lucide-react";

const LEVELS = [3, 4, 5, 6, 7, 8, 9, 10];

type Bubble = { n: number; left: number; top: number; size: number; bob: number };

function layoutBubbles(count: number, salt: number): Bubble[] {
  const cols = Math.min(count, 5);
  return Array.from({ length: count }, (_, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const jitterX = ((i * 37 + salt * 13) % 12) - 6;
    const jitterY = ((i * 53 + salt * 7) % 14) - 7;
    return {
      n: i + 1,
      left: 10 + col * (80 / Math.max(1, cols - 1 || 1)) + jitterX,
      top: 18 + row * 34 + jitterY,
      size: 84 + ((i * 29 + salt * 11) % 22),
      bob: 2.6 + ((i * 17) % 14) / 10,
    };
  });
}

export function BubblePop() {
  const [levelIdx, setLevelIdx] = useState(0);
  const [salt, setSalt] = useState(1);
  const [nextUp, setNextUp] = useState(1);
  const [wrongKey, setWrongKey] = useState<number | null>(null);
  const count = LEVELS[levelIdx];
  const bubbles = useMemo(() => {
    const shuffledPos = layoutBubbles(count, salt);
    return shuffledPos;
  }, [count, salt]);
  const done = nextUp > count;

  const startLevel = (idx: number) => {
    setLevelIdx(idx);
    setSalt((s) => s + 1);
    setNextUp(1);
    setWrongKey(null);
  };

  const pop = (n: number) => {
    if (done) return;
    if (n !== nextUp) {
      setWrongKey(n);
      window.setTimeout(() => setWrongKey(null), 450);
      return;
    }
    setNextUp((v) => v + 1);
  };

  return (
    <div className="relative flex h-full flex-col items-center gap-4 px-6 pt-2">
      <p className="rounded-full bg-white/20 px-6 py-2 text-[17px] font-bold text-white">
        Pop the bubbles in order! Find number {done ? "..." : nextUp}
      </p>
      <div className="relative w-full max-w-[720px] flex-1">
        {bubbles.map((b) => {
          const popped = b.n < nextUp;
          return (
            <button
              key={`${salt}-${b.n}`}
              type="button"
              onClick={() => pop(b.n)}
              disabled={popped}
              aria-label={`Bubble ${b.n}`}
              className="absolute flex items-center justify-center rounded-full border-4 border-white/50 bg-white/15 font-display text-[30px] font-semibold text-white shadow-[inset_-6px_-8px_18px_rgba(255,255,255,0.18),0_10px_24px_-10px_rgba(0,20,40,0.5)] transition-[transform,opacity] duration-300"
              style={{
                left: `${b.left}%`,
                top: `${b.top}%`,
                width: `${b.size}px`,
                height: `${b.size}px`,
                opacity: popped ? 0 : 1,
                transform: popped ? "scale(1.5)" : "scale(1)",
                pointerEvents: popped ? "none" : undefined,
                animation:
                  wrongKey === b.n
                    ? "curfew-shake 0.4s ease-in-out"
                    : `curfew-bob ${b.bob}s ease-in-out infinite`,
              }}
            >
              {b.n}
            </button>
          );
        })}
        {done && (
          <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#0a2a3f]/60 animate-in fade-in duration-200">
            <div className="kids-card flex flex-col items-center gap-4 rounded-2xl border-4 border-[#ffd166] bg-white/95 px-12 py-10 text-center">
              <PartyPopper size={44} className="text-[#e08900]" strokeWidth={2} />
              <p className="font-display text-[30px] font-medium text-[#123a52]">
                You counted to {count}!
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => startLevel(levelIdx)}
                  className="flex h-14 items-center rounded-full border-4 border-[#bcdcea] bg-white px-7 text-[17px] font-bold text-[#123a52] transition-transform duration-150 hover:scale-[1.04] active:scale-95"
                >
                  Again
                </button>
                {levelIdx < LEVELS.length - 1 && (
                  <button
                    type="button"
                    onClick={() => startLevel(levelIdx + 1)}
                    className="flex h-14 items-center rounded-full bg-[#ffd166] px-8 text-[18px] font-bold text-[#4a3200] transition-transform duration-150 hover:scale-[1.04] active:scale-95"
                  >
                    Bigger numbers!
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
