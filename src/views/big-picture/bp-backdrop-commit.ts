import { useEffect, useRef, useState } from "react";

export const BP_META_SETTLE_MS = 200;
export const BP_COPY_CEILING_MS = 900;
export const BP_COPY_OUT_MS = 180;
export const BP_COPY_IN_MS = 300;
export const BP_COPY_IN_DELAY_MS = 140;

// translate, not transform: Tailwind v4 compiles translate-y-* to the CSS
// translate property, so a transition list naming transform never animated the
// rise and the copy jumped 10px while only the opacity crossfaded.
// Reduced motion means the travel is replaced by a cross-fade, not that the
// cross-fade is removed: the fade itself is held at 320ms by [data-bp-xfade].
export const BP_COPY_OUT =
  "translate-y-[10px] opacity-0 transition-[opacity,translate] duration-[180ms] ease-[var(--bp-ease-in)] motion-reduce:translate-y-0";
export const BP_COPY_IN =
  "translate-y-0 opacity-100 transition-[opacity,translate] duration-[300ms] delay-[140ms] ease-[var(--bp-ease)]";

// The last backdrop to finish committing. The copy gate below no longer waits
// on it, which is the whole point of that change, but subscribers still exist
// and a late joiner needs to be able to ask.
let committed = "";
const subs = new Set<(key: string) => void>();

export function bpBackdropCommitted(): string {
  return committed;
}

export function publishBpBackdropCommit(key: string): void {
  committed = key;
  for (const fn of subs) fn(key);
}

export function useBpCopyGate<T>(value: T, key: string): { shown: T | null; on: boolean } {
  const [shown, setShown] = useState<T | null>(null);
  const [on, setOn] = useState(false);
  const shownKey = useRef("");
  const live = useRef(value);
  live.current = value;

  // An enrichment that fills in a logo or an overview must land in place. Only a
  // new key is a new subject, and only a new subject is worth a fade.
  useEffect(() => {
    if (shownKey.current === key) setShown(value);
  }, [value, key]);

  useEffect(() => {
    // An empty key means the surface has no subject right now. Parking it with
    // on=false is correct, but it must not be reached through the early return
    // below, or a key that empties mid-fade leaves the block invisible for good
    // with both of its timers already cleared.
    if (!key) {
      setOn(false);
      return;
    }
    if (shownKey.current === key) return;

    let done = false;
    let outTimer = 0;
    let ceilingTimer = 0;

    const promote = () => {
      if (done) return;
      done = true;
      window.clearTimeout(outTimer);
      window.clearTimeout(ceilingTimer);
      shownKey.current = key;
      setShown(live.current);
      setOn(true);
    };

    if (shownKey.current === "") {
      promote();
      return;
    }

    // The copy no longer waits for the backdrop to commit. It used to: promote
    // needed both the out-fade AND `committed === key`, so the title, logo,
    // score and synopsis were held until a backdrop had fetched, decoded and
    // cross-faded. On a stick the hero backdrop is a 7.9MB decode, so that was
    // most of a second in which the hero either described the previous card or,
    // once the stale copy was cleared, described nothing at all. Both read as
    // slower than the app is.
    //
    // Now the copy leaves on the out-fade and arrives immediately after it, and
    // the backdrop catches up behind it. Nothing else changes: bp-ambient keeps
    // its own settle, so scrubbing a row still does not fire a fetch per card,
    // and the commit subscription stays because the ambient still uses it.
    setOn(false);
    outTimer = window.setTimeout(promote, BP_COPY_OUT_MS);
    ceilingTimer = window.setTimeout(promote, BP_COPY_CEILING_MS);

    return () => {
      window.clearTimeout(outTimer);
      window.clearTimeout(ceilingTimer);
    };
  }, [key]);

  return { shown, on };
}
