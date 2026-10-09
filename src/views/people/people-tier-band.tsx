import { useEffect, useState, type RefObject } from "react";
import { useT } from "@/lib/i18n";

export type Band = { id: string; label: string; lo: number; hi: number };

export const BANDS: Band[] = [
  { id: "top-10", label: "Top 10", lo: 1, hi: 10 },
  { id: "11-25", label: "11-25", lo: 11, hi: 25 },
  { id: "26-50", label: "26-50", lo: 26, hi: 50 },
  { id: "51-100", label: "51-100", lo: 51, hi: 100 },
  { id: "101-plus", label: "101+", lo: 101, hi: Number.POSITIVE_INFINITY },
];

export function bandFor(rank: number): Band {
  return BANDS.find((b) => rank >= b.lo && rank <= b.hi) ?? BANDS[BANDS.length - 1];
}

export function presentBands(ranks: number[]): Band[] {
  const ids = new Set(ranks.map((r) => bandFor(r).id));
  return BANDS.filter((b) => ids.has(b.id));
}

function bandDomId(id: string): string {
  return `people-band-${id}`;
}

export function PeopleTierBand({ band }: { band: Band }) {
  const t = useT();
  return (
    <li id={bandDomId(band.id)} className="flex scroll-mt-40 items-center gap-4 pt-2 first:pt-0">
      <span aria-hidden className="h-px flex-1 bg-edge-soft" />
      <span className="text-[11px] uppercase tracking-[0.16em] text-ink-subtle tabular-nums">
        {t(band.label)}
      </span>
      <span aria-hidden className="h-px flex-1 bg-edge-soft" />
    </li>
  );
}

export function PeopleJumpIndex({
  bands,
  scrollRef,
}: {
  bands: Band[];
  scrollRef: RefObject<HTMLElement | null>;
}) {
  const t = useT();
  const [active, setActive] = useState<string | null>(bands[0]?.id ?? null);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || bands.length === 0) return;
    const els = bands
      .map((b) => document.getElementById(bandDomId(b.id)))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id.replace("people-band-", ""));
        }
      },
      { root, rootMargin: "-18% 0px -74% 0px", threshold: 0 },
    );
    for (const el of els) obs.observe(el);
    return () => obs.disconnect();
  }, [bands, scrollRef]);

  if (bands.length < 2) return null;

  return (
    <div className="hidden items-center gap-1 md:flex">
      {bands.map((b) => (
        <button
          key={b.id}
          type="button"
          onClick={() =>
            document.getElementById(bandDomId(b.id))?.scrollIntoView({ block: "start", behavior: "smooth" })
          }
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium tabular-nums transition-colors motion-reduce:transition-none ${
            active === b.id
              ? "bg-elevated/60 text-ink ring-1 ring-edge-soft"
              : "text-ink-subtle hover:text-ink"
          }`}
        >
          {t(b.label)}
        </button>
      ))}
    </div>
  );
}
