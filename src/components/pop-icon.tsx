import { useEffect, useRef, useState, type ReactNode } from "react";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function PopIcon({
  active,
  activeIcon,
  inactiveIcon,
}: {
  active: boolean;
  activeIcon: ReactNode;
  inactiveIcon: ReactNode;
}) {
  const mounted = useRef(false);
  const [pop, setPop] = useState(0);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (active && !prefersReducedMotion()) setPop((n) => n + 1);
  }, [active]);
  return (
    <span
      key={active ? `on-${pop}` : "off"}
      className={active && pop > 0 ? "harbor-pop inline-flex" : "inline-flex"}
    >
      {active ? activeIcon : inactiveIcon}
    </span>
  );
}
