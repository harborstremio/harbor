import { startTransition, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

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
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (!e?.isIntersecting) return;
        io.disconnect();
        if (inViewport(e.boundingClientRect)) setShown(true);
        else startTransition(() => setShown(true));
      },
      { rootMargin },
    );
    io.observe(el);
    let safety = 0;
    let tries = 0;
    const arm = (delay: number) => {
      if (++tries > 60) return;
      safety = window.setTimeout(() => {
        if (el.offsetParent === null) return arm(1500);
        if (typeof el.checkVisibility === "function" && !el.checkVisibility()) return arm(1500);
        const vh = window.innerHeight || 800;
        const r = el.getBoundingClientRect();
        if (r.top > vh * 3 || r.bottom < -vh * 3) return arm(1200);
        if (inViewport(r)) setShown(true);
        else startTransition(() => setShown(true));
      }, delay);
    };
    arm(800);
    return () => {
      io.disconnect();
      window.clearTimeout(safety);
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
