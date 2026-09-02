import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatHandoffCode, handoffUrl } from "./handoff-code";
import { startHandoffHost, type HandoffHost } from "./handoff-host";
import { buildHandoffQr, type HandoffQr } from "./handoff-qr";
import {
  LAN_RECHECK_MS,
  LAN_RETRY_MS,
  SERVE_FAST_POLL_MS,
  SERVE_GRACE_MS,
  SERVE_POLL_MS,
  readLanHost,
  readServeRunning,
} from "./handoff-reach";
import {
  HANDOFF_STALL_MS,
  type HandoffOffer,
  type HandoffPayload,
  type HandoffStepId,
} from "./handoff-protocol";

/**
 * One phase per thing the TV has to say. No user-facing strings live in this
 * layer: the surface maps a phase to copy through useBpT.
 */
export type TvHandoffPhase =
  | "off"
  | "starting"
  | "noAddress"
  | "servingOff"
  | "serveFailed"
  | "waiting"
  | "stalled"
  | "claimed"
  | "complete";

export type TvHandoff = {
  phase: TvHandoffPhase;
  /** The address to encode. Null in every phase before `waiting`. */
  url: string | null;
  code: string | null;
  /** Grouped for reading at ten feet. */
  codeDisplay: string | null;
  /** Built synchronously so the panel never paints an empty QR frame first. */
  qr: HandoffQr | null;
  pending: HandoffStepId[];
  done: HandoffStepId[];
  expiresAt: number | null;
  restart: () => void;
};

export type UseTvHandoffOptions = {
  active: boolean;
  /** `settings.serveWebUi || settings.remoteControlEnabled`. */
  servingEnabled: boolean;
  steps: readonly HandoffStepId[];
  onPayload: (payload: HandoffPayload) => void | Promise<void>;
  ttlMs?: number;
};

const EMPTY: HandoffStepId[] = [];

type PhaseInput = {
  active: boolean;
  lanResolved: boolean;
  lanHost: string | null;
  servingEnabled: boolean;
  serveRunning: boolean;
  serveGraceOver: boolean;
  offer: HandoffOffer | null;
  stalled: boolean;
};

function derivePhase(i: PhaseInput): TvHandoffPhase {
  if (!i.active) return "off";
  if (!i.lanResolved) return "starting";
  if (!i.lanHost) return "noAddress";
  if (!i.servingEnabled) return "servingOff";
  if (!i.serveRunning) return i.serveGraceOver ? "serveFailed" : "starting";
  if (!i.offer) return "starting";
  if (i.offer.state === "complete") return "complete";
  if (i.offer.state === "claimed") return "claimed";
  return i.stalled ? "stalled" : "waiting";
}

export function useTvHandoff(opts: UseTvHandoffOptions): TvHandoff {
  const { active, servingEnabled, ttlMs } = opts;
  const stepKey = opts.steps.join(",");

  const [lanHost, setLanHost] = useState<string | null>(null);
  const [lanResolved, setLanResolved] = useState(false);
  const [serveRunning, setServeRunning] = useState(false);
  const [serveGraceOver, setServeGraceOver] = useState(false);
  const [offer, setOffer] = useState<HandoffOffer | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [stalled, setStalled] = useState(false);

  const payloadRef = useRef(opts.onPayload);
  payloadRef.current = opts.onPayload;
  const hostRef = useRef<HandoffHost | null>(null);

  // Kept polling after it resolves. The TV can move from Ethernet to Wi-Fi or
  // take a new DHCP lease mid-setup, and a QR that still encodes the first
  // address renders perfectly and goes nowhere, with the stall copy blaming the
  // phone's network for it.
  useEffect(() => {
    if (!active) return;
    let alive = true;
    let timer = 0;
    const tick = () => {
      void readLanHost().then((ip) => {
        if (!alive) return;
        setLanHost((prev) => (prev === ip ? prev : ip));
        setLanResolved(true);
        timer = window.setTimeout(tick, ip ? LAN_RECHECK_MS : LAN_RETRY_MS);
      });
    };
    tick();
    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [active]);

  // Fast polling only while a bind is genuinely being waited on. Serving off is
  // the default state of this screen, and 2.5 IPC round trips a second for as
  // long as someone reads it is the worst cost on the weakest hardware.
  const wantFastServePoll = active && servingEnabled && !serveRunning;
  useEffect(() => {
    if (!active) return;
    let alive = true;
    let id = 0;
    const tick = () => {
      void readServeRunning().then((on) => {
        if (!alive) return;
        setServeRunning(on);
        id = window.setTimeout(tick, wantFastServePoll ? SERVE_FAST_POLL_MS : SERVE_POLL_MS);
      });
    };
    tick();
    return () => {
      alive = false;
      if (id) window.clearTimeout(id);
    };
  }, [active, wantFastServePoll]);

  useEffect(() => {
    if (!active || !servingEnabled || serveRunning) {
      setServeGraceOver(false);
      return;
    }
    const id = window.setTimeout(() => setServeGraceOver(true), SERVE_GRACE_MS);
    return () => window.clearTimeout(id);
  }, [active, servingEnabled, serveRunning]);

  const ready = active && servingEnabled && serveRunning && !!lanHost;

  useEffect(() => {
    if (!ready) {
      setOffer(null);
      setToken(null);
      return;
    }
    const host = startHandoffHost({
      steps: stepKey ? (stepKey.split(",") as HandoffStepId[]) : [],
      ttlMs,
      onPayload: (p) => payloadRef.current(p),
      onChange: (next, tok) => {
        setOffer(next);
        setToken(tok);
      },
    });
    hostRef.current = host;
    return () => {
      host.stop();
      if (hostRef.current === host) hostRef.current = null;
    };
  }, [ready, stepKey, ttlMs]);

  const offerId = offer?.offerId ?? null;
  const claimed = offer?.state === "claimed";

  useEffect(() => {
    setStalled(false);
    if (!offerId || claimed) return;
    const id = window.setTimeout(() => setStalled(true), HANDOFF_STALL_MS);
    return () => window.clearTimeout(id);
  }, [offerId, claimed]);

  const restart = useCallback(() => {
    setStalled(false);
    hostRef.current?.restart();
  }, []);

  const url = lanHost && token ? handoffUrl(lanHost, token) : null;
  const qr = useMemo(() => (url ? buildHandoffQr(url) : null), [url]);

  return useMemo<TvHandoff>(() => {
    const phase = derivePhase({
      active,
      lanResolved,
      lanHost,
      servingEnabled,
      serveRunning,
      serveGraceOver,
      offer,
      stalled,
    });
    const live = phase === "waiting" || phase === "stalled" || phase === "claimed";
    return {
      phase,
      url: live ? url : null,
      code: live ? token : null,
      codeDisplay: live && token ? formatHandoffCode(token) : null,
      qr: live ? qr : null,
      pending: offer?.pending ?? EMPTY,
      done: offer?.done ?? EMPTY,
      expiresAt: offer?.expiresAt ?? null,
      restart,
    };
  }, [
    active,
    lanResolved,
    lanHost,
    servingEnabled,
    serveRunning,
    serveGraceOver,
    offer,
    token,
    stalled,
    url,
    qr,
    restart,
  ]);
}
