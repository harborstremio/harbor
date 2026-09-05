import { useEffect, useRef } from "react";

const RING =
  "m256.003,0C114.845,0-.002,114.84-.002,256.002s114.847,255.998,256.005,255.998,255.999-114.84,255.999-255.998S397.162,0,256.003,0Zm0,473.552c-119.963,0-217.551-97.592-217.551-217.551S136.041,38.448,256.003,38.448s217.544,97.595,217.544,217.554-97.588,217.551-217.544,217.551Z";
const NEEDLE =
  "m350.297,137.382l-128.191,42.729c-9.771,3.305-18.732,8.849-25.927,16.034-7.286,7.293-12.862,16.307-16.108,26.063l-42.705,128.1c-2.303,6.906-.509,14.523,4.641,19.67,3.664,3.667,8.577,5.632,13.595,5.632,2.038,0,4.089-.321,6.079-.988l128.107-42.701c9.764-3.252,18.78-8.829,26.06-16.118,7.188-7.192,12.737-16.16,16.059-26.004l42.705-128.104c2.303-6.906.509-14.523-4.641-19.67-5.15-5.157-12.792-6.948-19.674-4.645Zm-72.666,158.068l-91.627,30.54,30.54-91.628c1.375-4.128,3.734-7.939,6.818-11.023.002-.002.004-.004.007-.006l65.292,65.292s-.002.002-.003.003c-3.084,3.085-6.902,5.444-11.027,6.822Z";

export function DiscoverIcon({ active = false }: { active?: boolean }) {
  const needleRef = useRef<SVGGElement>(null);
  const rotationRef = useRef(0);

  useEffect(() => {
    const el = needleRef.current;
    if (!el) return;

    let rafId = 0;
    let lastT = performance.now();
    const apply = (deg: number) => {
      el.setAttribute("transform", `rotate(${deg} 256 256)`);
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
    <svg
      viewBox="0 0 512 512"
      className="h-[26px] w-[26px] overflow-visible p-[2px]"
      fill="currentColor"
      aria-hidden
    >
      <path d={RING} />
      <g ref={needleRef}>
        <path
          d={NEEDLE}
          fill={active ? "var(--color-accent)" : "currentColor"}
          style={{ transition: "fill 280ms ease" }}
        />
      </g>
    </svg>
  );
}
