import { Children, useLayoutEffect, useRef, type ReactNode } from "react";
import "./game-detail-flow.css";

/** Keep one mounted content tree while sections flow beside, then below, the facts rail. */
export function GameDetailFlow({ intro, rail, children, continuation }: { intro: ReactNode; rail: ReactNode; children: ReactNode; continuation?: ReactNode }) {
  const layout = useRef<HTMLDivElement>(null), facts = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = facts.current, root = layout.current;
    if (!node || !root) return;
    const measure = () => root.style.setProperty("--detail-rail-height", `${Math.ceil(node.getBoundingClientRect().height)}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <div className="games-inset games-detail-flow"><div className="games-detail-flow-layout" ref={layout}>
    {/* The measured exclusion reserves only the rail's real height, preserving main-first DOM/focus order. */}
    <div className="games-detail-flow-exclusion" aria-hidden="true" />
    <div className="games-detail-main games-detail-flow-intro">{intro}</div>
    {children}
    <div className="games-detail-body games-detail-flow-rail" ref={facts}>{rail}</div>
    {continuation}
  </div></div>;
}

export function GameDetailFlowSections({ children }: { children: ReactNode }) {
  return Children.map(children, section => section && <div className="games-detail-flow-block">{section}</div>);
}
