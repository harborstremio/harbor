import { useCallback, useEffect, useState } from "react";

const PASSIVE_ACTIVITY_EVENTS = ["pointermove", "pointerdown", "wheel", "touchstart"] as const;
const POLL_INTERVAL_MS = 1_000;

interface ActivityEventLike {
  preventDefault(): void;
  stopImmediatePropagation(): void;
}

interface EventTargetLike {
  addEventListener(
    type: string,
    listener: (event: ActivityEventLike) => void,
    options?: AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: (event: ActivityEventLike) => void,
    options?: EventListenerOptions,
  ): void;
}

interface StartIdleScreensaverOptions {
  enabled: boolean;
  suppressed: boolean;
  delayMs: number;
  windowTarget: EventTargetLike;
  documentTarget: EventTargetLike;
  now: () => number;
  isVisible: () => boolean;
  setInterval: (callback: () => void, delayMs: number) => number;
  clearInterval: (id: number) => void;
  onActiveChange: (active: boolean) => void;
}

export function startIdleScreensaver({
  enabled,
  suppressed,
  delayMs,
  windowTarget,
  documentTarget,
  now,
  isVisible,
  setInterval,
  clearInterval,
  onActiveChange,
}: StartIdleScreensaverOptions) {
  if (!enabled || suppressed) {
    onActiveChange(false);
    return () => undefined;
  }

  let active = false;
  let lastActivityAt = now();

  const publish = (next: boolean) => {
    if (active === next) return;
    active = next;
    onActiveChange(next);
  };
  const reset = () => {
    lastActivityAt = now();
    publish(false);
  };
  const onKeyDown = (event: ActivityEventLike) => {
    const shouldConsume = active;
    reset();
    if (!shouldConsume) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const onFocus = () => {
    if (isVisible()) reset();
  };
  const onVisibilityChange = () => {
    if (isVisible()) reset();
    else publish(false);
  };
  const poll = () => {
    if (isVisible() && now() - lastActivityAt >= Math.max(0, delayMs)) publish(true);
  };

  for (const eventType of PASSIVE_ACTIVITY_EVENTS) {
    windowTarget.addEventListener(eventType, reset, { passive: true });
  }
  windowTarget.addEventListener("keydown", onKeyDown, { capture: true });
  windowTarget.addEventListener("focus", onFocus);
  documentTarget.addEventListener("visibilitychange", onVisibilityChange);
  const timerId = setInterval(poll, Math.min(POLL_INTERVAL_MS, Math.max(1, delayMs)));

  return () => {
    clearInterval(timerId);
    for (const eventType of PASSIVE_ACTIVITY_EVENTS) {
      windowTarget.removeEventListener(eventType, reset);
    }
    windowTarget.removeEventListener("keydown", onKeyDown, { capture: true });
    windowTarget.removeEventListener("focus", onFocus);
    documentTarget.removeEventListener("visibilitychange", onVisibilityChange);
  };
}

export function useIdleScreensaver(enabled: boolean, delayMs: number, suppressed: boolean) {
  const [active, setActive] = useState(false);

  useEffect(
    () =>
      startIdleScreensaver({
        enabled,
        suppressed,
        delayMs,
        windowTarget: window,
        documentTarget: document,
        now: () => performance.now(),
        isVisible: () => document.visibilityState === "visible",
        setInterval: (callback, intervalMs) => window.setInterval(callback, intervalMs),
        clearInterval: (id) => window.clearInterval(id),
        onActiveChange: setActive,
      }),
    [delayMs, enabled, suppressed],
  );

  const dismiss = useCallback(() => setActive(false), []);
  return { active, dismiss };
}
