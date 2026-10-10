import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHandoffClient } from "@/lib/tv-handoff/use-handoff-client";
import type { HandoffClientReject } from "@/lib/tv-handoff/handoff-client";
import type { HandoffOffer } from "@/lib/tv-handoff/handoff-protocol";
import type { SetupPayload, SetupStepId } from "./setup-wire";

export type LinkStatus = "connecting" | "connected" | "unreachable";
export type DeliveryState =
  | "idle"
  | "sending"
  | "confirmed"
  | "rejected"
  | "timeout"
  | "offline";

/**
 * A live socket whose TV never broadcasts an offer used to spin forever while
 * the header claimed it was connected. After this the phone says so and offers
 * the retry, because the TV having left the setup screen is the ordinary case.
 */
const IDLE_HOST_GRACE_MS = 20_000;

export type SetupLink = {
  status: LinkStatus;
  offer: HandoffOffer | null;
  expired: boolean;
  /** True once the TV has broadcast an offer we can work against. */
  armed: boolean;
  /** A connected TV that has not offered anything for long enough to say so. */
  idleHost: boolean;
  deliveryOf: (step: SetupStepId) => DeliveryState;
  rejectOf: (step: SetupStepId) => HandoffClientReject | null;
  deliver: (payload: SetupPayload) => void;
  resetDelivery: (step: SetupStepId) => void;
  reconnect: () => void;
  abandon: () => void;
};

type Marks = Partial<Record<SetupStepId, DeliveryState>>;
type Reasons = Partial<Record<SetupStepId, HandoffClientReject | null>>;

function stateFor(reason: HandoffClientReject): DeliveryState {
  if (reason === "timeout") return "timeout";
  if (reason === "offline") return "offline";
  return "rejected";
}

export function useSetupLink(token: string): SetupLink {
  const hc = useHandoffClient(token);
  const [delivery, setDelivery] = useState<Marks>({});
  const [reasons, setReasons] = useState<Reasons>({});
  const [idleHost, setIdleHost] = useState(false);

  const phase = hc.phase;
  const offer = hc.offer;
  const armed = offer !== null;

  const deliverRef = useRef(hc.deliver);
  deliverRef.current = hc.deliver;

  useEffect(() => {
    if (armed || phase !== "idleHost") {
      setIdleHost(false);
      return;
    }
    const id = window.setTimeout(() => setIdleHost(true), IDLE_HOST_GRACE_MS);
    return () => window.clearTimeout(id);
  }, [armed, phase]);

  // The ack is the real confirmation, but a lost ack on a committed step would
  // otherwise strand the phone, so a step appearing in `done` also counts.
  const doneKey = hc.done.join(",");
  useEffect(() => {
    if (!doneKey) return;
    const done = doneKey.split(",") as SetupStepId[];
    setDelivery((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const step of done) {
        if (next[step] !== "confirmed") {
          next[step] = "confirmed";
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [doneKey]);

  const deliver = useCallback((payload: SetupPayload) => {
    const step = payload.step;
    setDelivery((prev) => ({ ...prev, [step]: "sending" }));
    setReasons((prev) => ({ ...prev, [step]: null }));
    void deliverRef.current(payload).then((r) => {
      if (r.ok) {
        setDelivery((prev) => ({ ...prev, [step]: "confirmed" }));
        return;
      }
      // stepDone means the TV already has it. That is a success the user cannot
      // be told is a failure, or they retry a step that is finished.
      if (r.reason === "stepDone") {
        setDelivery((prev) => ({ ...prev, [step]: "confirmed" }));
        return;
      }
      setReasons((prev) => ({ ...prev, [step]: r.reason }));
      setDelivery((prev) => ({ ...prev, [step]: stateFor(r.reason) }));
    });
  }, []);

  const resetDelivery = useCallback((step: SetupStepId) => {
    setDelivery((prev) => (prev[step] && prev[step] !== "confirmed" ? { ...prev, [step]: "idle" } : prev));
    setReasons((prev) => (prev[step] ? { ...prev, [step]: null } : prev));
  }, []);

  const deliveryOf = useCallback(
    (step: SetupStepId): DeliveryState => delivery[step] ?? "idle",
    [delivery],
  );
  const rejectOf = useCallback(
    (step: SetupStepId): HandoffClientReject | null => reasons[step] ?? null,
    [reasons],
  );

  const status: LinkStatus =
    phase === "offline" ? "unreachable" : phase === "connecting" ? "connecting" : "connected";

  const { abandon, retry } = hc;

  return useMemo<SetupLink>(
    () => ({
      status,
      offer,
      expired: phase === "expired",
      armed,
      idleHost,
      deliveryOf,
      rejectOf,
      deliver,
      resetDelivery,
      reconnect: retry,
      abandon,
    }),
    [
      status,
      offer,
      phase,
      armed,
      idleHost,
      deliveryOf,
      rejectOf,
      deliver,
      resetDelivery,
      retry,
      abandon,
    ],
  );
}
