import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createHandoffClient,
  type HandoffClient,
  type HandoffClientReject,
  type HandoffClientResult,
  type HandoffClientState,
} from "./handoff-client";
import type { HandoffOffer, HandoffPayload, HandoffStepId } from "./handoff-protocol";

/**
 * One phase per thing the phone has to say. No user-facing strings here: the
 * setup page owns the copy.
 */
export type HandoffClientPhase =
  | "noCode"
  | "connecting"
  | "offline"
  | "idleHost"
  | "expired"
  | "rejected"
  | "ready"
  | "complete";

export type UseHandoffClient = {
  phase: HandoffClientPhase;
  offer: HandoffOffer | null;
  pending: HandoffStepId[];
  done: HandoffStepId[];
  reject: HandoffClientReject | null;
  deliver: (payload: HandoffPayload) => Promise<HandoffClientResult>;
  abandon: () => void;
  retry: () => void;
};

const EMPTY: HandoffStepId[] = [];

const INITIAL: HandoffClientState = {
  connection: "connecting",
  offer: null,
  bound: false,
  lastReject: null,
};

function derivePhase(code: string | null, s: HandoffClientState): HandoffClientPhase {
  if (!code) return "noCode";
  if (s.lastReject === "expired" || s.lastReject === "lockedOut") return "expired";
  if (s.connection === "closed") return "offline";
  if (s.connection === "connecting") return "connecting";
  if (!s.offer) return "idleHost";
  if (s.offer.state === "expired") return "expired";
  if (s.offer.state === "complete") return "complete";
  if (s.bound) return "ready";
  return s.lastReject ? "rejected" : "connecting";
}

export function useHandoffClient(code: string | null): UseHandoffClient {
  const [state, setState] = useState<HandoffClientState>(INITIAL);
  const clientRef = useRef<HandoffClient | null>(null);

  useEffect(() => {
    if (!code) {
      setState(INITIAL);
      return;
    }
    const client = createHandoffClient(code);
    clientRef.current = client;
    setState(client.state());
    const unsub = client.subscribe(() => setState(client.state()));

    const onVisibility = () => {
      if (document.visibilityState === "hidden") client.park();
      else client.unpark();
    };
    const onHide = () => client.park();
    const onShow = () => client.unpark();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("pageshow", onShow);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("pageshow", onShow);
      unsub();
      client.close();
      if (clientRef.current === client) clientRef.current = null;
    };
  }, [code]);

  const deliver = useCallback(async (payload: HandoffPayload): Promise<HandoffClientResult> => {
    const client = clientRef.current;
    if (!client) return { ok: false, reason: "offline" };
    return client.deliver(payload);
  }, []);

  const abandon = useCallback(() => clientRef.current?.abandon(), []);
  const retry = useCallback(() => clientRef.current?.unpark(), []);

  return useMemo<UseHandoffClient>(
    () => ({
      phase: derivePhase(code, state),
      offer: state.offer,
      pending: state.offer?.pending ?? EMPTY,
      done: state.offer?.done ?? EMPTY,
      reject: state.lastReject,
      deliver,
      abandon,
      retry,
    }),
    [code, state, deliver, abandon, retry],
  );
}
