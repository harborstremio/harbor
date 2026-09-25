import { useLayoutEffect, useRef, useState } from "react";
import { contextMenuPresentation } from "./menu-presentation";

/** Local callers retain only their visual exit; each invocation owns its callbacks. */
export function useLocalMenuPresence(open: boolean, identity: unknown, onClose: () => void) {
  const enabled = contextMenuPresentation === "popout";
  const [state, setState] = useState({
    identity,
    open,
    present: open,
    closing: false,
    notify: false,
    session: 0,
  });
  let current = state;
  if (enabled && (state.identity !== identity || (open && !state.open))) {
    current = {
      identity,
      open,
      present: open,
      closing: false,
      notify: false,
      session: state.session + 1,
    };
    setState(current);
  } else if (enabled && !open && state.open) {
    current = { ...state, open: false, closing: true, notify: false };
    setState(current);
  }
  const live = useRef(current);
  live.current = current;
  const callback = useRef(onClose);
  callback.current = onClose;
  const alive = useRef(true);
  useLayoutEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const session = current.session;
  const isOpen = () =>
    !enabled ||
    (alive.current &&
      live.current.session === session &&
      live.current.present &&
      !live.current.closing);
  return {
    enabled,
    present: enabled ? current.present : open,
    session: enabled ? session : undefined,
    phase: enabled ? ((current.closing ? "closing" : "open") as "closing" | "open") : undefined,
    isOpen,
    close: () => {
      if (!enabled) {
        onClose();
        return true;
      }
      if (!isOpen()) return false;
      const next = { ...live.current, closing: true, notify: true };
      live.current = next;
      setState(next);
      return true;
    },
    completeClose: enabled
      ? () => {
          const state = live.current;
          if (!alive.current || state.session !== session || !state.closing || !state.present)
            return;
          const next = { ...state, present: false, notify: false };
          live.current = next;
          setState(next);
          if (state.notify) callback.current();
        }
      : undefined,
  };
}
