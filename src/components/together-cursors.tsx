import { useEffect, useRef, useState } from "react";
import { useSettings } from "@/lib/settings";
import { useTogether, type RemoteCursor } from "@/lib/together/provider";
import { useView } from "@/lib/view";

const SEND_INTERVAL_MS = 60;
const HIDDEN_AFTER_IDLE_MS = 1500;

function isScrollable(el: HTMLElement): boolean {
  if (el.scrollHeight - el.clientHeight < 4) return false;
  const style = window.getComputedStyle(el);
  const oy = style.overflowY;
  return oy === "auto" || oy === "scroll" || oy === "overlay";
}

function findActiveMain(): HTMLElement | null {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>("main"));
  let best: HTMLElement | null = null;
  let bestArea = 0;
  for (const m of candidates) {
    const r = m.getBoundingClientRect();
    const area = r.width * r.height;
    if (area > bestArea) {
      best = m;
      bestArea = area;
    }
  }
  if (!best) return null;
  if (isScrollable(best)) return best;
  // Main itself doesn't scroll — look for a scrolling descendant (addons page pattern)
  const descendants = best.querySelectorAll<HTMLElement>("*");
  let scrollBest: HTMLElement | null = null;
  let scrollBestArea = 0;
  for (const el of descendants) {
    if (!isScrollable(el)) continue;
    const r = el.getBoundingClientRect();
    const area = r.width * r.height;
    if (area > scrollBestArea) {
      scrollBest = el;
      scrollBestArea = area;
    }
  }
  return scrollBest ?? best;
}

function normFromClient(cx: number, cy: number): { x: number; y: number } | null {
  const main = findActiveMain();
  if (!main) return { x: cx / window.innerWidth, y: cy / window.innerHeight };
  const r = main.getBoundingClientRect();
  const localX = cx - r.left;
  const localY = cy - r.top;
  if (localX < 0 || localX > r.width || localY < 0 || localY > r.height) return null;
  const contentH = Math.max(main.scrollHeight, r.height);
  return { x: localX / r.width, y: (localY + main.scrollTop) / contentH };
}

export function TogetherCursors() {
  const { snapshot, sendCursor, remoteCursors, clientId } = useTogether();
  const { chromeHidden, topPath } = useView();
  const { settings } = useSettings();

  const lastSentRef = useRef(0);
  const lastMoveRef = useRef(0);
  const idleSentRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });
  const lastClientRef = useRef<{ cx: number; cy: number } | null>(null);
  const pathRef = useRef(topPath);
  pathRef.current = topPath;

  const live = snapshot.state === "joined" && settings.togetherShareCursors && !chromeHidden;

  useEffect(() => {
    if (!live) return;

    const onMove = (e: MouseEvent) => {
      const now = performance.now();
      lastClientRef.current = { cx: e.clientX, cy: e.clientY };
      const norm = normFromClient(e.clientX, e.clientY);
      if (!norm) return;
      lastPosRef.current = { x: norm.x, y: norm.y, visible: true };
      lastMoveRef.current = now;
      idleSentRef.current = false;
      if (now - lastSentRef.current < SEND_INTERVAL_MS) return;
      lastSentRef.current = now;
      sendCursor(norm.x, norm.y, true, pathRef.current);
    };

    const hideCursor = () => {
      if (!lastPosRef.current.visible && idleSentRef.current) return;
      lastPosRef.current = { ...lastPosRef.current, visible: false };
      idleSentRef.current = true;
      sendCursor(lastPosRef.current.x, lastPosRef.current.y, false, pathRef.current);
    };

    const onLeave = () => hideCursor();

    const onMouseOut = (e: MouseEvent) => {
      if (
        e.relatedTarget == null &&
        (e as MouseEvent & { toElement?: Element | null }).toElement == null
      ) {
        hideCursor();
      }
    };

    const onBlur = () => hideCursor();

    const onVisibility = () => {
      if (document.visibilityState !== "visible") hideCursor();
    };

    const onEnter = () => {
      lastMoveRef.current = performance.now();
      idleSentRef.current = false;
    };

    window.addEventListener("mousemove", onMove);
    document.documentElement.addEventListener("mouseleave", onLeave);
    document.documentElement.addEventListener("pointerleave", onLeave);
    document.addEventListener("mouseleave", onLeave);
    document.addEventListener("mouseout", onMouseOut);
    document.addEventListener("mouseenter", onEnter);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);

    const idleTick = window.setInterval(() => {
      if (idleSentRef.current) return;
      if (performance.now() - lastMoveRef.current > HIDDEN_AFTER_IDLE_MS) {
        idleSentRef.current = true;
        sendCursor(lastPosRef.current.x, lastPosRef.current.y, false, pathRef.current);
      }
    }, 800);

    return () => {
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("mouseout", onMouseOut);
      document.removeEventListener("mouseenter", onEnter);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(idleTick);
      sendCursor(0, 0, false, pathRef.current);
    };
  }, [live, sendCursor]);

  useEffect(() => {
    if (!live) return;
    sendCursor(lastPosRef.current.x, lastPosRef.current.y, false, pathRef.current);
  }, [live, topPath, sendCursor]);

  const [scrollTick, setScrollTick] = useState(0);
  useEffect(() => {
    const main = findActiveMain();
    if (!main) return;
    const onScroll = () => {
      setScrollTick((t) => t + 1);
      if (!live) return;
      const last = lastClientRef.current;
      if (!last) return;
      const norm = normFromClient(last.cx, last.cy);
      if (!norm) return;
      const now = performance.now();
      lastPosRef.current = { x: norm.x, y: norm.y, visible: true };
      if (now - lastSentRef.current < SEND_INTERVAL_MS) return;
      lastSentRef.current = now;
      sendCursor(norm.x, norm.y, true, pathRef.current);
    };
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => main.removeEventListener("scroll", onScroll);
  }, [topPath, live, sendCursor]);

  if (snapshot.state !== "joined") return null;
  if (!settings.togetherShareCursors) return null;
  if (chromeHidden) return null;

  const visibleCursors = remoteCursors.filter(
    (c) => c.visible && c.from !== clientId && c.path === topPath,
  );
  if (visibleCursors.length === 0) return null;

  void scrollTick;
  const main = findActiveMain();
  return (
    <div className="pointer-events-none fixed inset-0 z-[150]">
      {visibleCursors.map((c) => {
        const peer = snapshot.participants.find((p) => p.id === c.from);
        return (
          <RemotePointer key={c.from} cursor={c} main={main} peerColor={peer?.color ?? null} />
        );
      })}
    </div>
  );
}

function RemotePointer({
  cursor,
  main,
  peerColor,
}: {
  cursor: RemoteCursor;
  main: HTMLElement | null;
  peerColor: string | null;
}) {
  const color = peerColor ?? `oklch(0.78 0.13 ${nameHue(cursor.name)})`;
  let left: number;
  let top: number;
  if (main) {
    const r = main.getBoundingClientRect();
    const contentH = Math.max(main.scrollHeight, r.height);
    const localX = Math.max(0, Math.min(1, cursor.x)) * r.width;
    const localY = Math.max(0, Math.min(1, cursor.y)) * contentH - main.scrollTop;
    if (localY < -28 || localY > r.height + 28) return null;
    left = r.left + localX;
    top = r.top + localY;
  } else {
    left = Math.max(0, Math.min(1, cursor.x)) * window.innerWidth;
    top = Math.max(0, Math.min(1, cursor.y)) * window.innerHeight;
  }

  return (
    <div
      className="absolute will-change-transform"
      style={{
        left: 0,
        top: 0,
        transform: `translate3d(${left}px, ${top}px, 0)`,
        transition: "transform 80ms linear",
      }}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)]"
      >
        <path
          d="M5.5 4.2 L18.6 10.4 Q19.6 10.9 18.6 11.5 L13 13.4 Q12.4 13.6 12.2 14.2 L10.4 19.8 Q9.9 21 9.2 19.8 L4.6 5.6 Q4.1 4 5.5 4.2 Z"
          fill={color}
          stroke="white"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className="absolute left-[18px] top-[18px] inline-flex max-w-[140px] items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold text-white shadow-[0_2px_8px_rgba(0,0,0,0.35)] whitespace-nowrap"
        style={{ backgroundColor: color }}
      >
        {cursor.name}
      </span>
    </div>
  );
}

function nameHue(name: string): number {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}
