import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { effectiveBinding, eventToBinding } from "@/lib/hotkeys";
import { setPlayerInteractionLocked } from "@/lib/player/interaction-lock";
import { useSettings } from "@/lib/settings";

const UNLOCK_CONTROL = "[data-player-unlock-control]";
const LOCK_CONTROL_IDLE_MS = 2_200;

function isUnlockControlTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(UNLOCK_CONTROL) != null;
}

function stopInteraction(event: Event): void {
  if (event.cancelable) event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

export function usePlayerInteractionBlocker({
  enabled = true,
  locked,
  binding,
  onToggle,
  onLockedActivity,
}: {
  enabled?: boolean;
  locked: boolean;
  binding: string;
  onToggle: () => void;
  onLockedActivity?: () => void;
}): void {
  useEffect(() => {
    if (!enabled) return;

    const onKeyboard = (event: KeyboardEvent) => {
      const isToggle = event.type === "keydown" && eventToBinding(event) === binding;
      if (isToggle) {
        stopInteraction(event);
        if (!event.repeat) onToggle();
        return;
      }
      if (!locked) return;
      const activatesUnlock =
        isUnlockControlTarget(event.target) && (event.key === "Enter" || event.key === " ");
      if (activatesUnlock) return;
      onLockedActivity?.();
      stopInteraction(event);
    };
    const onPointer = (event: Event) => {
      if (!locked) return;
      onLockedActivity?.();
      if (isUnlockControlTarget(event.target)) return;
      stopInteraction(event);
    };
    const keyboardOptions: AddEventListenerOptions = { capture: true };
    const pointerOptions: AddEventListenerOptions = { capture: true };
    const activePointerOptions: AddEventListenerOptions = { capture: true, passive: false };
    window.addEventListener("keydown", onKeyboard, keyboardOptions);
    window.addEventListener("keyup", onKeyboard, keyboardOptions);
    window.addEventListener("pointerdown", onPointer, pointerOptions);
    window.addEventListener("pointerup", onPointer, pointerOptions);
    window.addEventListener("pointermove", onPointer, pointerOptions);
    window.addEventListener("click", onPointer, pointerOptions);
    window.addEventListener("dblclick", onPointer, pointerOptions);
    window.addEventListener("contextmenu", onPointer, pointerOptions);
    window.addEventListener("wheel", onPointer, activePointerOptions);
    window.addEventListener("touchstart", onPointer, activePointerOptions);
    window.addEventListener("touchmove", onPointer, activePointerOptions);
    window.addEventListener("touchend", onPointer, activePointerOptions);
    return () => {
      window.removeEventListener("keydown", onKeyboard, keyboardOptions);
      window.removeEventListener("keyup", onKeyboard, keyboardOptions);
      window.removeEventListener("pointerdown", onPointer, pointerOptions);
      window.removeEventListener("pointerup", onPointer, pointerOptions);
      window.removeEventListener("pointermove", onPointer, pointerOptions);
      window.removeEventListener("click", onPointer, pointerOptions);
      window.removeEventListener("dblclick", onPointer, pointerOptions);
      window.removeEventListener("contextmenu", onPointer, pointerOptions);
      window.removeEventListener("wheel", onPointer, activePointerOptions);
      window.removeEventListener("touchstart", onPointer, activePointerOptions);
      window.removeEventListener("touchmove", onPointer, activePointerOptions);
      window.removeEventListener("touchend", onPointer, activePointerOptions);
    };
  }, [binding, enabled, locked, onLockedActivity, onToggle]);
}

export function usePlayerInteractionLock() {
  const { settings } = useSettings();
  const enabled = settings.playerScreenLockEnabled;
  const [locked, setLocked] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const idleTimerRef = useRef<number | null>(null);
  const binding = useMemo(
    () => effectiveBinding("playerScreenLock", settings.hotkeys ?? {}),
    [settings.hotkeys],
  );
  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current === null) return;
    window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = null;
  }, []);
  const wakeControls = useCallback(() => {
    clearIdleTimer();
    setControlsVisible(true);
    idleTimerRef.current = window.setTimeout(() => {
      idleTimerRef.current = null;
      setControlsVisible(false);
    }, LOCK_CONTROL_IDLE_MS);
  }, [clearIdleTimer]);
  const lock = useCallback(() => {
    if (!enabled) return;
    setLocked(true);
    wakeControls();
  }, [enabled, wakeControls]);
  const unlock = useCallback(() => {
    clearIdleTimer();
    setControlsVisible(false);
    setLocked(false);
  }, [clearIdleTimer]);
  const toggle = useCallback(() => {
    if (locked) unlock();
    else lock();
  }, [lock, locked, unlock]);

  usePlayerInteractionBlocker({
    enabled,
    locked,
    binding,
    onToggle: toggle,
    onLockedActivity: wakeControls,
  });

  useEffect(() => {
    if (!enabled && locked) unlock();
  }, [enabled, locked, unlock]);

  useEffect(() => {
    setPlayerInteractionLocked(enabled && locked);
  }, [enabled, locked]);
  useEffect(
    () => () => {
      clearIdleTimer();
      setPlayerInteractionLocked(false);
    },
    [clearIdleTimer],
  );

  return { enabled, locked, controlsVisible, binding, lock, unlock, wakeControls };
}
