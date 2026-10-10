import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { BookOpen, List } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { GuideHeading } from "@/lib/games/guide-outline";
import "./guide-contents.css";

export function useGuidePosition(root: RefObject<HTMLElement | null>, entries: GuideHeading[], active: boolean, reduced: boolean) {
  const [current, setCurrent] = useState("");
  const pending = useRef(0), release = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const refresh = useRef<() => void>(() => {});
  useLayoutEffect(() => {
    const reader = root.current, container = reader?.closest<HTMLElement>(".games-view"), prose = reader?.querySelector<HTMLElement>(".games-guide-prose");
    if (!active || !container || !prose || !entries.length) return;
    const nodes = entries.flatMap(entry => {
      const node = reader?.querySelector<HTMLElement>(`#${entry.id}`);
      return node ? [{ id: entry.id, node, top: 0 }] : [];
    });
    let frame = 0, dirty = true, inset = 0;
    const update = () => {
      frame = 0;
      if (dirty) {
        const origin = container.getBoundingClientRect().top - container.scrollTop;
        for (const heading of nodes) heading.top = heading.node.getBoundingClientRect().top - origin;
        inset = parseFloat(getComputedStyle(nodes[0].node).scrollMarginTop) || 24;
        dirty = false;
      }
      if (performance.now() < pending.current) return;
      const line = container.scrollTop + inset + 2;
      let index = 0;
      while (index + 1 < nodes.length && nodes[index + 1].top <= line) index++;
      if (container.scrollTop > 0 && container.scrollTop + container.clientHeight >= container.scrollHeight - 2) index = nodes.length - 1;
      setCurrent(nodes[index]?.id ?? "");
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const measure = () => { dirty = true; schedule(); };
    const interrupt = () => { pending.current = 0; clearTimeout(release.current); schedule(); };
    const observer = new ResizeObserver(measure);
    observer.observe(prose); observer.observe(container);
    container.addEventListener("scroll", schedule, { passive: true });
    for (const event of ["wheel", "touchstart", "pointerdown", "keydown"]) container.addEventListener(event, interrupt, { passive: true, capture: true });
    prose.addEventListener("load", measure, true);
    reader?.addEventListener("animationend", measure);
    refresh.current = schedule; update();
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame); clearTimeout(release.current); pending.current = 0;
      container.removeEventListener("scroll", schedule);
      for (const event of ["wheel", "touchstart", "pointerdown", "keydown"]) container.removeEventListener(event, interrupt, true);
      prose.removeEventListener("load", measure, true); refresh.current = () => {};
      reader?.removeEventListener("animationend", measure);
    };
  }, [root, entries, active]);
  const jump = (id: string) => {
    const heading = root.current?.querySelector<HTMLElement>(`#${id}`), container = root.current?.closest<HTMLElement>(".games-view");
    if (!heading || !container) return;
    const inset = parseFloat(getComputedStyle(heading).scrollMarginTop) || 24;
    const top = heading.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - inset;
    // Hold the requested destination during smooth travel, avoiding flashes on
    // every intermediate heading. Direct input immediately resumes scroll tracking.
    clearTimeout(release.current); pending.current = performance.now() + (reduced ? 0 : 900);
    setCurrent(id); heading.focus({ preventScroll: true });
    container.scrollTo({ top, behavior: reduced ? "instant" : "smooth" });
    release.current = setTimeout(() => { pending.current = 0; refresh.current(); }, reduced ? 0 : 900);
  };
  return { current, jump };
}

export function GuideContents({ headings, current, jump, iconForSection }: {
  headings: GuideHeading[]; current: string; jump: (id: string) => void;
  iconForSection?: (title: string) => typeof BookOpen;
}) {
  const t = useT(), nav = useRef<HTMLElement>(null), aside = useRef<HTMLElement>(null);
  const [marker, setMarker] = useState({ top: 0, height: 0 });
  useLayoutEffect(() => {
    const node = nav.current, container = aside.current;
    if (!node || !container) return;
    const measure = () => {
      const selected = node.querySelector<HTMLElement>('[aria-current="location"]');
      if (!selected) { setMarker({ top: 0, height: 0 }); return; }
      const box = selected.getBoundingClientRect(), origin = node.getBoundingClientRect();
      setMarker(previous => previous.top === box.top - origin.top && previous.height === box.height ? previous : { top: box.top - origin.top, height: box.height });
      // Scroll only this contents pane, never the article or a focused control.
      if (getComputedStyle(container).position === "sticky" && !container.contains(document.activeElement)) {
        const bounds = container.getBoundingClientRect();
        if (box.top < bounds.top + 45) container.scrollTop += box.top - bounds.top - 45;
        else if (box.bottom > bounds.bottom - 10) container.scrollTop += box.bottom - bounds.bottom + 10;
      }
    };
    measure(); const observer = new ResizeObserver(measure); observer.observe(node);
    return () => observer.disconnect();
  }, [current, headings]);
  const rows = (items: GuideHeading[]) => <ol>{items.map(heading => {
    const Icon = iconForSection?.(heading.title) ?? BookOpen;
    return <li key={heading.id}>
      <button type="button" aria-current={current === heading.id ? "location" : undefined} onClick={() => jump(heading.id)} style={{ "--guide-depth": Math.min(heading.depth, 4) } as CSSProperties}>
        {heading.depth === 0 ? <Icon size={17} aria-hidden/> : <span className="games-guide-subheading-mark" aria-hidden/>}
        <span>{heading.title}</span>
      </button>
      {heading.children.length > 0 && rows(heading.children)}
    </li>;
  })}</ol>;
  return <aside ref={aside} className="games-guide-contents"><h2><List size={17} aria-hidden/>{t("games.guides.contents")}</h2>
    <nav ref={nav} aria-label={t("games.guides.contents")} style={{ "--guide-marker-top": `${marker.top}px`, "--guide-marker-height": `${marker.height}px` } as CSSProperties}>
      <i className="games-guide-position-marker" aria-hidden/>{rows(headings)}
    </nav>
  </aside>;
}
