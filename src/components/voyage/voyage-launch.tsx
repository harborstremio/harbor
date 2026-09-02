import lottie, { type AnimationItem } from "lottie-web";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import boatData from "@/assets/lottie/voyage-boat.json";
import { useT } from "@/lib/i18n";

export type LaunchThumb = { src: string; rect: DOMRect };

const RECT_W = 134.938;
const RECT_H = 211.844;
const SAIL_FRAMES = [80, 110, 140];
const FLIGHT_MS = 820;
const SETTLE_MS = 140;
const CROSSFADE_MS = 240;

function reduced(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

type ContentBox = { minX: number; maxX: number; cx: number; cy: number; span: number };

function measureContent(svg: SVGSVGElement, anim: AnimationItem): ContentBox | null {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const frame of SAIL_FRAMES) {
    anim.goToAndStop(frame, true);
    let box: DOMRect | null = null;
    try {
      box = svg.getBBox() as DOMRect;
    } catch {
      box = null;
    }
    if (!box || box.width <= 0) continue;
    minX = Math.min(minX, box.x);
    maxX = Math.max(maxX, box.x + box.width);
    minY = Math.min(minY, box.y);
    maxY = Math.max(maxY, box.y + box.height);
  }
  if (!Number.isFinite(minX) || maxX <= minX) return null;
  return { minX, maxX, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, span: maxX - minX };
}

function frameStage(svg: SVGSVGElement, stage: HTMLElement, content: ContentBox): void {
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  if (width <= 0 || height <= 0) return;
  const vbW = content.span;
  const vbH = vbW * (height / width);
  svg.setAttribute("viewBox", `${content.cx - vbW / 2} ${content.cy - vbH / 2} ${vbW} ${vbH}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
}

function paintPosters(svg: SVGSVGElement, sources: string[]): void {
  let defs = svg.querySelector("defs");
  if (!defs) {
    defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    svg.insertBefore(defs, svg.firstChild);
  }
  const rules: string[] = [];
  sources.forEach((src, i) => {
    const id = `vy-poster-fill-${i}`;
    const pattern = document.createElementNS("http://www.w3.org/2000/svg", "pattern");
    pattern.setAttribute("id", id);
    pattern.setAttribute("patternUnits", "userSpaceOnUse");
    pattern.setAttribute("x", String(-RECT_W / 2));
    pattern.setAttribute("y", String(-RECT_H / 2));
    pattern.setAttribute("width", String(RECT_W));
    pattern.setAttribute("height", String(RECT_H));
    const image = document.createElementNS("http://www.w3.org/2000/svg", "image");
    image.setAttribute("href", src);
    image.setAttribute("width", String(RECT_W));
    image.setAttribute("height", String(RECT_H));
    image.setAttribute("preserveAspectRatio", "xMidYMid slice");
    pattern.appendChild(image);
    defs.appendChild(pattern);
    rules.push(`.vy-poster-${i} path { fill: url(#${id}); }`);
  });
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = rules.join(" ");
  svg.insertBefore(style, svg.firstChild);
}

export function VoyageLaunch({
  thumbs,
  onDone,
}: {
  thumbs: LaunchThumb[];
  onDone: () => void;
}) {
  const t = useT();
  const stageRef = useRef<HTMLDivElement>(null);
  const cloneRefs = useRef<(HTMLDivElement | null)[]>([]);
  const animRef = useRef<AnimationItem | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const [targets, setTargets] = useState<DOMRect[] | null>(null);
  const [sailing, setSailing] = useState(false);
  const startedRef = useRef(false);
  const contentRef = useRef<{ svg: SVGSVGElement; content: ContentBox } | null>(null);

  const castRef = useRef<LaunchThumb[]>([]);
  if (castRef.current.length === 0) castRef.current = thumbs.slice(0, 3);
  const cast = castRef.current;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let cancelled = false;

    const anim = lottie.loadAnimation({
      container: stage,
      renderer: "svg",
      loop: false,
      autoplay: false,
      animationData: structuredClone(boatData),
      rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
    });
    animRef.current = anim;

    const onReady = () => {
      if (cancelled) return;
      const svg = stage.querySelector("svg");
      if (!svg) return;
      paintPosters(svg, cast.map((c) => c.src));
      const content = measureContent(svg, anim);
      if (content) {
        contentRef.current = { svg, content };
        frameStage(svg, stage, content);
      }
      anim.goToAndStop(0, true);
      const found = cast.map((_, i) => {
        const slots = svg.querySelectorAll<SVGGElement>(`.vy-poster-${i}`);
        for (const slot of slots) {
          const box = slot.getBoundingClientRect();
          if (box.width > 1 && box.height > 1) return box;
        }
        return null;
      });
      if (found.some((r) => !r)) {
        console.warn("[voyage] could not measure the boat poster slots; skipping the launch");
        doneRef.current();
        return;
      }
      setTargets(found as DOMRect[]);
    };

    anim.addEventListener("DOMLoaded", onReady);
    anim.addEventListener("complete", () => doneRef.current());

    const bail = window.setTimeout(() => {
      if (!cancelled && !startedRef.current) doneRef.current();
    }, 4000);

    return () => {
      cancelled = true;
      window.clearTimeout(bail);
      anim.destroy();
      animRef.current = null;
    };
  }, [cast]);

  useEffect(() => {
    if (!targets) return;
    const anim = animRef.current;
    if (!anim) return;

    if (reduced()) {
      startedRef.current = true;
      setSailing(true);
      anim.play();
      return;
    }

    const flights = cloneRefs.current.slice(0, targets.length).map((el, i) => {
      const to = targets[i];
      const from = cast[i].rect;
      if (!el) return null;
      const dx = from.left - to.left;
      const dy = from.top - to.top;
      const sx = from.width / to.width;
      const sy = from.height / to.height;
      return el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
          {
            transform: `translate(${dx * 0.12}px, ${dy * 0.12 - 14}px) scale(${sx + (1 - sx) * 1.06}, ${sy + (1 - sy) * 1.06})`,
            offset: 0.62,
          },
          {
            transform: `translate(${dx * -0.015}px, ${dy * -0.015 + 4}px) scale(${1.012}, ${0.99})`,
            offset: 0.83,
          },
          { transform: "translate(0px, 0px) scale(1, 1)" },
        ],
        { duration: FLIGHT_MS, delay: i * 70, easing: "ease-in-out", fill: "both" },
      );
    });

    const last = flights.filter(Boolean).pop();
    let timer = 0;
    const handoff = () => {
      timer = window.setTimeout(() => {
        startedRef.current = true;
        setSailing(true);
        anim.play();
      }, SETTLE_MS);
    };
    if (last) last.addEventListener("finish", handoff);
    else handoff();

    return () => window.clearTimeout(timer);
  }, [targets]);

  useEffect(() => {
    const onResize = () => {
      const stage = stageRef.current;
      const held = contentRef.current;
      if (stage && held) frameStage(held.svg, stage, held.content);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const skip = () => doneRef.current();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return createPortal(
    <div
      className="animate-voyage-launch-in fixed inset-0 z-[1200] cursor-pointer bg-canvas"
      onClick={skip}
      role="button"
      tabIndex={0}
      aria-label={t("Skip the launch")}
    >
      <div
        ref={stageRef}
        aria-hidden
        className="absolute inset-0 transition-opacity ease-in-out"
        style={{ opacity: sailing ? 1 : 0, transitionDuration: `${CROSSFADE_MS}ms` }}
      />

      {targets &&
        cast.map((thumb, i) => (
          <div
            key={i}
            ref={(el) => {
              cloneRefs.current[i] = el;
            }}
            aria-hidden
            className="pointer-events-none absolute overflow-hidden transition-opacity ease-in-out"
            style={{
              left: targets[i].left,
              top: targets[i].top,
              width: targets[i].width,
              height: targets[i].height,
              transformOrigin: "top left",
              borderRadius: Math.max(4, targets[i].width * 0.06),
              opacity: sailing ? 0 : 1,
              transitionDuration: `${CROSSFADE_MS}ms`,
            }}
          >
            <img src={thumb.src} alt="" draggable={false} className="h-full w-full object-cover" />
          </div>
        ))}

      <span className="pointer-events-none absolute inset-x-0 bottom-8 text-center text-[12px] font-medium text-ink-subtle">
        {t("Click anywhere to skip")}
      </span>
    </div>,
    document.body,
  );
}
