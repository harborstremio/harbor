import { useEffect, useRef, useState } from "react";
import type { GpButton } from "@/lib/gamepad/protocol";

type Buttons = Partial<Record<GpButton, boolean>>;

export function useLatchedButtons(live: Buttons, floorMs: number): Buttons {
  const [shown, setShown] = useState<Buttons>(live);
  const pressedAt = useRef<Partial<Record<GpButton, number>>>({});
  const timers = useRef<Partial<Record<GpButton, number>>>({});

  useEffect(() => {
    const keys = new Set([...Object.keys(shown), ...Object.keys(live)]) as Set<GpButton>;
    const next: Buttons = { ...shown };
    let changed = false;

    for (const k of keys) {
      const now = !!live[k];
      const was = !!next[k];
      if (now === was) continue;

      if (now) {
        const pending = timers.current[k];
        if (pending !== undefined) {
          window.clearTimeout(pending);
          delete timers.current[k];
        }
        pressedAt.current[k] = performance.now();
        next[k] = true;
        changed = true;
        continue;
      }

      if (timers.current[k] !== undefined) continue;
      const wait = floorMs - (performance.now() - (pressedAt.current[k] ?? 0));
      if (wait <= 0) {
        next[k] = false;
        changed = true;
        continue;
      }
      timers.current[k] = window.setTimeout(() => {
        delete timers.current[k];
        setShown((prev) => ({ ...prev, [k]: false }));
      }, wait);
    }

    if (changed) setShown(next);
  }, [live, floorMs, shown]);

  useEffect(
    () => () => {
      for (const id of Object.values(timers.current)) {
        if (id !== undefined) window.clearTimeout(id);
      }
    },
    [],
  );

  return shown;
}
