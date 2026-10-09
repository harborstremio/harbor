import { useEffect, useRef, useState } from "react";
import { bpBootElapsedMs } from "./bp-boot-splash";

const MIN_VISIBLE_MS = 5000;
const MAX_VISIBLE_MS = 8000;
const FADE_MS = 620;

// The cap still has to leave room after this hook mounts even when the boot
// splash already burned the whole budget. Giving up early is not free: what is
// behind the splash is a home screen whose posters have not arrived, which is
// uglier than the splash it replaced. On a television the first rows land
// within a second or two of the shell mounting, so wait for them.
const MIN_AFTER_MOUNT_MS = 3500;

export type BpIntroPhase = "showing" | "leaving" | "done";

export function useBpIntro(active: boolean, contentReady: boolean): BpIntroPhase {
  const [phase, setPhase] = useState<BpIntroPhase>(active ? "showing" : "done");
  // contentReady flips mid-session and reruns this effect. Without a latch the
  // rerun would put the splash back up over a screen the user is already using.
  const leftRef = useRef(false);

  // The fade-out timer lives in its own effect, keyed on the phase, because the
  // effect below reruns when contentReady flips. On a slow device the 8s cap
  // fires first, rows arrive during the 620ms fade, that rerun's cleanup cleared
  // the timer, and the guarded rerun never re-armed it: the splash stayed mounted
  // at opacity 0 forever with 8 infinite transform animations and 144 posters
  // running behind every screen. Measured on a Fire TV Stick 4K Max, 8 minutes in.
  useEffect(() => {
    if (phase !== "leaving") return;
    const t = window.setTimeout(() => setPhase("done"), FADE_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (!active) {
      leftRef.current = false;
      setPhase("done");
      return;
    }
    if (leftRef.current) return;
    setPhase("showing");

    // Counted from when the viewer first saw a splash, not from this mount.
    // index-tv.html puts the boot splash up at about 1.7s and the bundle does
    // not finish booting until about 10s, so a floor measured from mount added
    // a further five seconds to a wait that had already been served twice over.
    let pendingKey = "";
    const openedAt = Date.now() - bpBootElapsedMs();
    let leaveTimer = 0;

    const stopSkip = () => {
      window.removeEventListener("keydown", skip, true);
      window.removeEventListener("pointerdown", skip, true);
    };

    const beginLeave = () => {
      if (leftRef.current) return;
      leftRef.current = true;
      stopSkip();
      setPhase("leaving");
      if (!pendingKey) return;
      const key = pendingKey;
      pendingKey = "";
      // After the fade, so the shell has re-enabled navigation and the ring has
      // somewhere to land.
      window.setTimeout(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
      }, FADE_MS + 40);
    };

    const capIn = Math.max(MIN_AFTER_MOUNT_MS, MAX_VISIBLE_MS - (Date.now() - openedAt));
    const cap = window.setTimeout(beginLeave, capIn);

    // Navigation is dead while the splash is up. Without a skip the first
    // several seconds of arrow presses vanish and the remote reads as broken.
    // The direction is remembered, not just swallowed. useBpFocusRoot is
    // disabled while the splash is up (bp-shell passes navigationEnabled &&
    // !introUp), so the press that dismissed the intro used to move nothing:
    // the viewer's first input of the session visibly did half of what they
    // asked for. It is replayed once the fade is over.
    function skip(e: Event) {
      const key = e instanceof KeyboardEvent ? e.key : "";
      if (/^Arrow/.test(key)) pendingKey = key;
      window.clearTimeout(cap);
      window.clearTimeout(leaveTimer);
      beginLeave();
    }
    window.addEventListener("keydown", skip, true);
    window.addEventListener("pointerdown", skip, true);

    const tick = () => {
      if (!contentReady) return;
      const waited = Date.now() - openedAt;
      const remaining = Math.max(0, MIN_VISIBLE_MS - waited);
      window.clearTimeout(cap);
      leaveTimer = window.setTimeout(beginLeave, remaining);
    };
    tick();

    return () => {
      stopSkip();
      window.clearTimeout(cap);
      window.clearTimeout(leaveTimer);
    };
  }, [active, contentReady]);

  return phase;
}
