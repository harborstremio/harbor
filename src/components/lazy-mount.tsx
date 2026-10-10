import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { observeWithin } from "@/lib/visibility";

const CULL_PAD_Y = 24;

const CULL_STYLE: CSSProperties = {
  contentVisibility: "auto",
  paddingLeft: "48px",
  paddingRight: "48px",
  marginLeft: "-48px",
  marginRight: "-48px",
  paddingTop: `${CULL_PAD_Y}px`,
  paddingBottom: `${CULL_PAD_Y}px`,
  marginTop: `-${CULL_PAD_Y}px`,
  marginBottom: `-${CULL_PAD_Y}px`,
};

type Probe = () => boolean;
const probes = new Set<Probe>();
let probeTimer = 0;

function runProbes(): void {
  // Probe callbacks can change subscriptions; process only this sweep's snapshot.
  // oxlint-disable-next-line unicorn/no-useless-spread
  for (const p of [...probes]) if (p()) probes.delete(p);
  if (probes.size === 0) {
    window.clearInterval(probeTimer);
    probeTimer = 0;
  }
}

function addProbe(p: Probe): () => void {
  probes.add(p);
  if (!probeTimer) probeTimer = window.setInterval(runProbes, 1300);
  return () => {
    probes.delete(p);
    if (probes.size === 0 && probeTimer) {
      window.clearInterval(probeTimer);
      probeTimer = 0;
    }
  };
}

export function LazyMount({
  children,
  fallback,
  rootMargin = "1200px",
  minHeight = 240,
}: {
  children: ReactNode;
  fallback?: ReactNode;
  rootMargin?: string;
  minHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (shown) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const inViewport = (r: DOMRect) => {
      const vh = window.innerHeight || 800;
      return r.bottom > -vh * 0.5 && r.top < vh * 1.5;
    };
    const reveal = () => {
      stopIo();
      stopNear();
      setShown(true);
    };
    const stopIo = observeWithin(el, rootMargin, (e) => {
      if (!e.isIntersecting) return;
      if (inViewport(e.boundingClientRect)) {
        reveal();
        return;
      }
      startTransition(() => setShown(true));
    });
    const stopNear = observeWithin(el, "0px", (e) => {
      if (e.isIntersecting) reveal();
    });
    let tries = 0;
    const stopProbe = addProbe(() => {
      if (el.offsetParent === null) return false;
      if (typeof el.checkVisibility === "function" && !el.checkVisibility()) return false;
      const vh = window.innerHeight || 800;
      const r = el.getBoundingClientRect();
      if (r.top > vh * 3 || r.bottom < -vh * 3) return false;
      if (++tries > 60) return true;
      if (inViewport(r)) reveal();
      else startTransition(() => setShown(true));
      return true;
    });
    return () => {
      stopIo();
      stopNear();
      stopProbe();
    };
  }, [shown, rootMargin]);

  return (
    <div
      ref={ref}
      className="harbor-lazy-cull"
      style={
        {
          ...CULL_STYLE,
          "--harbor-cull-min": `${minHeight}px`,
          ...(shown ? null : { minHeight: minHeight + CULL_PAD_Y * 2 }),
        } as CSSProperties
      }
      aria-hidden={shown ? undefined : true}
    >
      {shown ? children : fallback}
    </div>
  );
}
