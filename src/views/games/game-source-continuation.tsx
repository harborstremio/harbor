import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";

/** Continue near the scroll edge without moving focus or retrying a failed provider. */
export function GameSourceContinuation({ count, cursor, more, busy = false, failed = false, load, manual }: {
  count: number; cursor: number | null; more: boolean; busy?: boolean; failed?: boolean;
  load: () => unknown; manual: (button: HTMLButtonElement) => void;
}) {
  const t = useT(), root = useRef<HTMLDivElement>(null), request = useRef(load);
  const progress = useRef({ count: -1, emptyPages: 0 });
  const focusAnchor = useRef<{ count: number; browse: Element } | null>(null);
  const [fallback, setFallback] = useState(false), [focused, setFocused] = useState(false);
  request.current = load;
  useLayoutEffect(() => {
    const anchor = focusAnchor.current;
    if (!anchor) return;
    // A fetch may already be in flight when Tab reaches this control.
    const target = failed ? anchor.browse.querySelector<HTMLElement>('.games-source-website-error button')
      : count > anchor.count ? anchor.browse.querySelectorAll<HTMLElement>('.games-source-release>summary')[anchor.count] : null;
    if (target) { focusAnchor.current = null; setFocused(false); target.focus({ preventScroll: true }); }
  }, [count, failed]);
  useEffect(() => {
    const node = root.current;
    if (!node || !more || busy || failed || focused) return;
    if (typeof IntersectionObserver === "undefined") { setFallback(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      // Tabbing to the continuation is an explicit action; do not consume its focus.
      if (node.contains(document.activeElement)) return;
      // A site returning only duplicates/empty pages must not silently crawl its entire history.
      const held = progress.current;
      if (held.count === count) held.emptyPages++;
      else { held.count = count; held.emptyPages = 0; }
      if (held.emptyPages >= 3) { setFallback(true); return; }
      setFallback(false);
      request.current();
    }, { root: node.closest(".games-sources-scroll"), rootMargin: "0px 0px 280px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [count, cursor, more, busy, failed, focused]);
  if (!more || failed) return null;
  return <div ref={root} className="games-source-continuation">
    {busy && <span role="status">{t("games.sources.website.loading")}</span>}
    <button aria-disabled={busy || undefined} className={`games-button${fallback ? "" : " games-source-auto-more"}`} onFocus={event => { const browse = event.currentTarget.closest('.games-source-browse'); focusAnchor.current = browse ? { count, browse } : null; setFocused(true); }} onBlur={() => { focusAnchor.current = null; setFocused(false); }} onClick={event => { if (busy) return; progress.current = { count: -1, emptyPages: 0 }; setFallback(false); manual(event.currentTarget); }}>{t("games.sources.website.more")}</button>
  </div>;
}
