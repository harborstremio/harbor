import { useEffect, useRef, useState } from "react";
import { BackToTop } from "@/components/back-to-top";

/** Use the real page scroller; Games may be nested inside a desktop shell. */
export function ModBackToTop() {
  const anchor = useRef<HTMLSpanElement>(null), [scroller, setScroller] = useState<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    for (let node = anchor.current?.parentElement; node; node = node.parentElement) {
      if (/(auto|scroll)/.test(getComputedStyle(node).overflowY)) { setScroller(node); return; }
    }
    setScroller(document.scrollingElement as HTMLElement);
  }, []);
  scrollRef.current = scroller;
  return <><span ref={anchor} hidden/>{scroller && <BackToTop scrollRef={scrollRef}/>}</>;
}
