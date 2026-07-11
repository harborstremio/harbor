import { useEffect, useRef } from "react";

export function DiscoverIcon({ active = false }: { active?: boolean }) {
  const needleRef = useRef<SVGGElement>(null);
  const rotationRef = useRef(0);

  useEffect(() => {
    const el = needleRef.current;
    if (!el) return;

    let rafId = 0;
    let lastT = performance.now();

    const apply = (deg: number) => {
      el.setAttribute("transform", `rotate(${deg} 12 12)`);
    };

    if (active) {
      const degPerMs = 0.3;
      const tick = (t: number) => {
        const dt = t - lastT;
        lastT = t;
        rotationRef.current = (rotationRef.current + dt * degPerMs) % 360;
        apply(rotationRef.current);
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    } else if (rotationRef.current !== 0) {
      const start = rotationRef.current;
      const target = start > 180 ? 360 : 0;
      const startTime = performance.now();
      const duration = 460;
      const tick = (t: number) => {
        const progress = Math.min(1, (t - startTime) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        const cur = start + (target - start) * eased;
        apply(cur);
        if (progress < 1) {
          rotationRef.current = cur;
          rafId = requestAnimationFrame(tick);
        } else {
          rotationRef.current = 0;
          apply(0);
        }
      };
      rafId = requestAnimationFrame(tick);
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [active]);

  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.65" fill="none" />
      <g ref={needleRef}>
        <path
          d="M 12 4 L 15.2 16.5 L 12 13.8 L 8.8 16.5 Z"
          fill={active ? "var(--color-accent)" : "currentColor"}
          stroke={active ? "var(--color-accent)" : "currentColor"}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{ transition: "fill 280ms ease, stroke 280ms ease" }}
        />
      </g>
    </svg>
  );
}
