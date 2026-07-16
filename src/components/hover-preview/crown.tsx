import { useEffect, useRef, useState } from "react";
import type { PreviewArt, PreviewData } from "@/lib/hover-preview/preview-data";
import { formatRemaining, type PreviewResume } from "@/lib/hover-preview/resume-index";
import { BAR_MIN_FRACTION, EASE_OUT, LATE_ART_FADE_MS } from "@/lib/hover-preview/timing";
import { posterPlate } from "../poster";

function sameArt(a: PreviewArt, b: PreviewArt): boolean {
  return a.mode === b.mode && a.src === b.src;
}

function ArtImage({ art, seed }: { art: PreviewArt; seed: string }) {
  if (art.mode === "plate") {
    return <div className="absolute inset-0" style={{ background: posterPlate(seed) }} />;
  }
  return (
    <img
      src={art.src}
      alt=""
      draggable={false}
      className="absolute inset-0 h-full w-full object-cover brightness-95"
      style={art.mode === "poster" ? { objectPosition: "50% 25%" } : undefined}
    />
  );
}

function CrownArt({ art, seed }: { art: PreviewArt; seed: string }) {
  const [stack, setStack] = useState([{ key: 0, art }]);
  const nextKey = useRef(1);
  const lastArt = useRef(art);
  const incomingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sameArt(lastArt.current, art)) return;
    lastArt.current = art;
    const key = nextKey.current++;
    setStack((s) => [...s.slice(-1), { key, art }]);
  }, [art]);

  useEffect(() => {
    if (stack.length < 2) return;
    const el = incomingRef.current;
    if (!el) return;
    const anim = el.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: LATE_ART_FADE_MS,
      easing: EASE_OUT,
      fill: "backwards",
    });
    anim.onfinish = () => setStack((s) => s.slice(-1));
    return () => anim.cancel();
  }, [stack]);

  return (
    <div data-stagger="0" className="absolute inset-0">
      {stack.map((item, i) => (
        <div
          key={item.key}
          ref={i === stack.length - 1 && i > 0 ? incomingRef : undefined}
          className="absolute inset-0"
        >
          <ArtImage art={item.art} seed={seed} />
        </div>
      ))}
    </div>
  );
}

function StateLine({ resume }: { resume: PreviewResume }) {
  const epLabel =
    resume.season != null && resume.episode != null ? `S${resume.season} E${resume.episode}` : null;
  const status = resume.upNext
    ? "Up Next"
    : resume.external || resume.remainingMs == null
      ? "In progress"
      : formatRemaining(resume.remainingMs);
  return (
    <div
      data-stagger="1"
      className="flex items-baseline pb-3 text-[13px] font-semibold leading-[1.3] tabular-nums"
    >
      {epLabel && <span className="text-ink">{epLabel}</span>}
      {epLabel && <span className="text-ink-subtle">{" · "}</span>}
      <span className="text-accent">{status}</span>
    </div>
  );
}

export function PreviewCrown({ data, height }: { data: PreviewData; height: number }) {
  const { resume } = data;
  const showBar = !!resume && !resume.external && resume.fraction != null;
  return (
    <div className="relative w-full overflow-hidden" style={{ height }}>
      <CrownArt art={data.art} seed={data.meta.id} />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[52%]"
        style={{
          background:
            "linear-gradient(to top, color-mix(in oklab, var(--color-canvas) 92%, transparent) 0%, color-mix(in oklab, var(--color-canvas) 40%, transparent) 50%, transparent 100%)",
        }}
      />
      {data.chip && (
        <span
          data-stagger="0"
          className="absolute start-3 top-3 rounded-md border border-edge-soft bg-canvas/85 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink backdrop-blur-sm"
        >
          {data.chip}
        </span>
      )}
      <div className="absolute inset-x-5 bottom-0 flex flex-col">
        <h3
          data-stagger="0"
          className={`-ms-px line-clamp-2 font-display text-[20px] font-semibold leading-[1.18] tracking-[-0.01em] text-ink ${
            resume ? "pb-[6px]" : "pb-[14px]"
          }`}
        >
          {data.meta.name}
        </h3>
        {resume && <StateLine resume={resume} />}
      </div>
      {showBar && (
        <div data-stagger="1" className="absolute inset-x-0 bottom-0 h-[3px] bg-canvas/40">
          <div
            className="h-full bg-accent"
            style={{ width: `${Math.max(BAR_MIN_FRACTION, resume.fraction ?? 0) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
