import lottie, { type AnimationItem } from "lottie-web";
import { useCallback, useEffect, useRef, useState } from "react";
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

export function VoyageLaunch({ thumbs, onDone }: { thumbs: LaunchThumb[]; onDone: () => void }) {
  const t = useT();
  const stageRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const cloneRefs = useRef<(HTMLDivElement | null)[]>([]);
  const animRef = useRef<AnimationItem | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const completed = useRef(false);
  const [targets, setTargets] = useState<DOMRect[] | null>(null);
  const [phase, setPhase] = useState<"gathering" | "boarding" | "sailing">("gathering");
  const contentRef = useRef<{ svg: SVGSVGElement; content: ContentBox } | null>(null);
  const cast = useRef(thumbs).current;
  const three = useRef(thumbs.slice(0, 3)).current;
  const finish = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    doneRef.current();
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (reduced()) { finish(); return; }
    let cancelled = false;
    // Let the app's pointer-down cleanup finish before moving focus into the launch.
    const focusFrame = requestAnimationFrame(() => skipRef.current?.focus({ preventScroll: true }));
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
      if (cancelled || completed.current) return;
      const svg = stage.querySelector("svg");
      if (!svg) { finish(); return; }
      paintPosters(svg, three.map(c => c.src));
      const content = measureContent(svg, anim);
      if (content) {
        contentRef.current = { svg, content };
        frameStage(svg, stage, content);
      }
      anim.goToAndStop(0, true);
      const found = three.map((_, i) => {
        for (const slot of svg.querySelectorAll<SVGGElement>(`.vy-poster-${i}`)) {
          const box = slot.getBoundingClientRect();
          if (box.width > 1 && box.height > 1) return box;
        }
        return null;
      });
      if (found.some(r => !r)) { finish(); return; }
      setTargets(found as DOMRect[]);
    };
    anim.addEventListener("DOMLoaded", onReady);
    anim.addEventListener("complete", finish);
    anim.addEventListener("data_failed", finish);
    // A failed renderer must never strand the user on the launch screen.
    const bail = window.setTimeout(finish, 12000);
    return () => {
      cancelled = true;
      cancelAnimationFrame(focusFrame);
      window.clearTimeout(bail);
      anim.destroy();
      animRef.current = null;
    };
  }, [three, finish]);

  useEffect(() => {
    if (!targets || !animRef.current) return;
    const anim = animRef.current;
    let cancelled = false;
    let settle = 0;
    const animations: Animation[] = [];
    const width = Math.min(128, window.innerWidth * .16);
    const height = width * RECT_H / RECT_W;
    const gap = Math.min(18, window.innerWidth * .02);
    const startX = (window.innerWidth - three.length * width - (three.length - 1) * gap) / 2;
    const gathered = three.map((_, i) => new DOMRect(startX + i * (width + gap), (window.innerHeight - height) / 2, width, height));
    const transformTo = (from: DOMRect, to: DOMRect) =>
      `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width}, ${to.height / from.height})`;
    const run = async () => {
      // Every visible confirmation poster participates; only the visual cast reduces to three.
      const collecting = cast.map((thumb, i) => {
        const el = cloneRefs.current[i];
        if (!el) return Promise.resolve();
        const to = gathered[i % gathered.length];
        const frames: Keyframe[] = i < three.length
          ? [{ transform: "none" }, { transform: transformTo(thumb.rect, to) }]
          : [{ transform: "none", opacity: 1 }, { opacity: .65, offset: .45 }, { transform: transformTo(thumb.rect, to), opacity: 0 }];
        const animation = el.animate(frames, { duration: 520, delay: i * 18, easing: "ease-in-out", fill: "forwards" });
        animations.push(animation);
        return animation.finished;
      });
      await Promise.allSettled(collecting);
      if (cancelled || completed.current) return;
      setPhase("boarding");
      const flights = three.map((thumb, i) => {
        const el = cloneRefs.current[i];
        if (!el) return Promise.resolve();
        const from = gathered[i];
        const to = targets[i];
        const near = new DOMRect(to.left + (from.left - to.left) * .08, to.top - 10, to.width * 1.025, to.height * 1.015);
        const animation = el.animate([
          { transform: transformTo(thumb.rect, from) },
          { transform: transformTo(thumb.rect, near), offset: .72 },
          { transform: transformTo(thumb.rect, to) },
        ], { duration: FLIGHT_MS, delay: i * 70, easing: "ease-in-out", fill: "forwards" });
        animations.push(animation);
        return animation.finished;
      });
      await Promise.allSettled(flights);
      if (cancelled || completed.current) return;
      settle = window.setTimeout(() => {
        if (cancelled || completed.current) return;
        setPhase("sailing");
        anim.play();
      }, SETTLE_MS);
    };
    void run();
    return () => {
      cancelled = true;
      window.clearTimeout(settle);
      animations.forEach(animation => animation.cancel());
    };
  }, [targets, cast, three]);

  useEffect(() => {
    const onResize = () => {
      const stage = stageRef.current;
      const held = contentRef.current;
      if (stage && held) frameStage(held.svg, stage, held.content);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return createPortal(
    <div className="animate-voyage-launch-in fixed inset-0 z-[1200] bg-canvas" data-voyage-launch data-phase={phase} data-tv-focus-scope>
      <div ref={stageRef} aria-hidden data-voyage-boat className="pointer-events-none absolute inset-0 transition-opacity ease-in-out" style={{ opacity: phase === "sailing" ? 1 : 0, transitionDuration: `${CROSSFADE_MS}ms` }} />
      {cast.map((thumb, i) => (
        <div key={i} ref={el => { cloneRefs.current[i] = el; }} aria-hidden data-voyage-flying-poster
          className="pointer-events-none absolute overflow-hidden transition-opacity ease-in-out"
          style={{ left: thumb.rect.left, top: thumb.rect.top, width: thumb.rect.width, height: thumb.rect.height,
            transformOrigin: "top left", borderRadius: Math.max(4, thumb.rect.width * .06),
            opacity: phase === "sailing" ? 0 : 1, transitionDuration: `${CROSSFADE_MS}ms`, zIndex: i < 3 ? 2 : 1 }}>
          <img src={thumb.src} alt="" draggable={false} className="h-full w-full object-cover" />
        </div>
      ))}
      <button ref={skipRef} type="button" data-tv-modal-close onClick={finish} aria-label={t("Skip the launch")}
        onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finish(); } }}
        className="absolute inset-0 z-10 cursor-pointer focus-visible:outline-none">
        <span className="absolute inset-x-0 bottom-8 text-center text-[12px] font-medium text-ink-subtle">{t("Click anywhere to skip")}</span>
      </button>
    </div>, document.body,
  );
}
