import { useEffect, useState } from "react";

const BAND_ANGLE: Record<string, string> = {
  queue: "120deg",
  awards: "140deg",
  genres: "200deg",
  collections: "160deg",
  people: "220deg",
};

const BASE =
  "radial-gradient(128% 84% at 6% -12%, color-mix(in oklab, var(--bp-panel-2) 58%, transparent) 0%, transparent 56%), linear-gradient(180deg, var(--bp-page) 0%, var(--bp-void) 52%, var(--bp-void) 100%)";

const LAYER =
  "pointer-events-none absolute inset-0 transition-opacity duration-[var(--bp-dur-slow)] ease-[var(--bp-ease)] motion-reduce:transition-none";

type Wash = { colour: string; angle: string };

function washOf({ colour, angle }: Wash): string {
  return `radial-gradient(120% 78% at 12% 0%, color-mix(in oklab, ${colour} 17%, transparent) 0%, transparent 58%), linear-gradient(${angle}, color-mix(in oklab, ${colour} 9%, transparent) 0%, transparent 46%)`;
}

function washColour(tint: string | null): string {
  if (!tint) return "var(--bp-touch)";
  return /^\d/.test(tint) ? `rgb(${tint})` : tint;
}

// Each band reads as its own portal while the page stays one surface: the wash
// is the only thing that changes, and its colour comes from the focused cell.
// Two layers, never one: a gradient whose stops and angle both change is not
// interpolable, so the swap has to be an opacity crossfade between them.
export function BpDiscoverWash({ tint, bandId }: { tint: string | null; bandId: string }) {
  const angle = BAND_ANGLE[bandId] ?? "180deg";
  const colour = washColour(tint);
  const [pair, setPair] = useState<{ a: Wash; b: Wash; front: "a" | "b" }>(() => ({
    a: { colour, angle },
    b: { colour, angle },
    front: "a",
  }));

  useEffect(() => {
    setPair((prev) => {
      const live = prev[prev.front];
      if (live.colour === colour && live.angle === angle) return prev;
      return prev.front === "a"
        ? { a: prev.a, b: { colour, angle }, front: "b" }
        : { a: { colour, angle }, b: prev.b, front: "a" };
    });
  }, [colour, angle]);

  return (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: BASE }}
      />
      <span
        aria-hidden
        className={LAYER}
        style={{ background: washOf(pair.a), opacity: pair.front === "a" ? 1 : 0 }}
      />
      <span
        aria-hidden
        className={LAYER}
        style={{ background: washOf(pair.b), opacity: pair.front === "b" ? 1 : 0 }}
      />
    </>
  );
}
