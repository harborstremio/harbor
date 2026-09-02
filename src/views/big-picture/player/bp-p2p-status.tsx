import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isBundledEngineUrl, isLocalEngineUrl } from "@/lib/stremio-server";
import { parseEngineStats, readinessScore, type EngineStats } from "@/lib/torrent/engine-stats";
import { torrentEngineStats } from "@/lib/torrent/local-engine";
import { useBpT } from "../bp-i18n";

export type BpP2pPhase = "searching" | "connected" | "slow" | "no-peers";

export type BpP2pStatus = {
  torrent: boolean;
  live: boolean;
  phase: BpP2pPhase;
  peers: number;
  speed: number;
  downloaded: number;
  total: number | null;
  readiness: number;
  elapsedMs: number;
  attempt: number;
  retry: () => void;
};

const POLL_MS = 1000;

// These two windows decide when a torrent is declared dead, and the windowed
// player judges the same torrent from src/views/player/use-p2p-preparing-status.ts.
// Change one without the other and the two screens disagree about the same file.
const NO_PEERS_MS = 75_000;
const SLOW_MS = 90_000;

type Sample = {
  phase: BpP2pPhase;
  peers: number;
  speed: number;
  downloaded: number;
  total: number | null;
  readiness: number;
  elapsedMs: number;
};

const IDLE: Sample = {
  phase: "searching",
  peers: 0,
  speed: 0,
  downloaded: 0,
  total: null,
  readiness: 0,
  elapsedMs: 0,
};

export function formatBpBytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${Math.round(n / 1024 ** 2)} MB`;
  return `${Math.round(n / 1024)} KB`;
}

export function useBpP2pStatus(params: {
  url: string;
  infoHash: string | null | undefined;
  fileIdx: number | null | undefined;
  active: boolean;
  stats?: EngineStats | null;
  streamBytes?: number | null;
}): BpP2pStatus {
  const { url, infoHash, fileIdx, active, stats = null, streamBytes = null } = params;
  const torrent = (isBundledEngineUrl(url) || isLocalEngineUrl(url)) && !url.includes("/hlsv2/");
  const live = active && !!infoHash && isLocalEngineUrl(url);
  const [attempt, setAttempt] = useState(0);
  const [sample, setSample] = useState<Sample>(IDLE);
  const failedRef = useRef(false);
  const sawDataRef = useRef(false);

  useEffect(() => {
    failedRef.current = false;
    sawDataRef.current = false;
    setSample(IDLE);
    if (!live || !infoHash) return;

    const idx = typeof fileIdx === "number" && fileIdx >= 0 ? fileIdx : null;
    const startAt = Date.now();
    let cancelled = false;
    let prev: EngineStats | null = null;
    let poll = 0;

    const tick = async () => {
      const raw = await torrentEngineStats(infoHash, idx);
      if (cancelled) return;
      const s = parseEngineStats(raw, prev);
      prev = s;
      const peers = s.unchoked > 0 ? s.unchoked : s.peers;
      const elapsedMs = Date.now() - startAt;
      // Local latch, deliberately NOT s.sawData. The shared parser latches that
      // flag on peers > 0 as well, which would make `quiet` false the instant a
      // single choked peer appeared and put both slow and no-peers permanently
      // out of reach. Bytes moving is the only thing that proves the torrent is
      // alive, and it stays sticky so one byte is enough forever.
      if (s.downloadSpeed > 0 || s.streamProgress > 0 || s.downloaded > 0) {
        sawDataRef.current = true;
      }
      const quiet = !sawDataRef.current;
      if (quiet && peers === 0 && elapsedMs >= NO_PEERS_MS) failedRef.current = true;
      const phase: BpP2pPhase = failedRef.current
        ? "no-peers"
        : quiet && peers > 0 && elapsedMs >= SLOW_MS
          ? "slow"
          : peers > 0
            ? "connected"
            : "searching";
      setSample({
        phase,
        peers,
        speed: s.downloadSpeed,
        downloaded: s.downloaded,
        total: s.streamLen,
        readiness: readinessScore(s, true),
        elapsedMs,
      });
      if (failedRef.current && poll) {
        window.clearInterval(poll);
        poll = 0;
      }
    };

    void tick();
    poll = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      if (poll) window.clearInterval(poll);
    };
  }, [live, url, infoHash, fileIdx, attempt]);

  // The bundled Stremio server has no local engine to poll, so its numbers come
  // from whatever the caller already fetched. It has no terminal failure state,
  // but it still needs a clock: the "still looking" note is gated on elapsed
  // time and would otherwise never appear on this path.
  const relayStartRef = useRef(0);
  if (relayStartRef.current === 0) relayStartRef.current = Date.now();
  const relayed = useMemo<Sample>(() => {
    if (!torrent || !stats) return IDLE;
    const peers = stats.unchoked > 0 ? stats.unchoked : stats.peers;
    return {
      phase: peers > 0 ? "connected" : "searching",
      peers,
      speed: stats.downloadSpeed,
      downloaded: stats.downloaded,
      total: stats.streamLen,
      readiness: readinessScore(stats, true),
      elapsedMs: Date.now() - relayStartRef.current,
    };
  }, [torrent, stats]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  const current = live ? sample : relayed;

  return {
    torrent,
    live,
    ...current,
    total: streamBytes ?? current.total,
    attempt,
    retry,
  };
}

// Preparing and buffering are not the same thing and the screen must not blur
// them: preparing is Harbor still filling the head of the file, buffering is the
// player already holding the stream and waiting on the next piece.
export function bpStageLabel(
  status: BpP2pStatus,
  buffering: boolean,
  local: boolean,
  t: (key: string) => string,
): string {
  if (status.torrent && status.phase === "no-peers") return t("No peers found");
  if (buffering) return t("Buffering");
  if (!status.torrent) return local ? t("Loading") : t("Connecting");
  if (status.phase === "slow") return t("Found peers, no data yet");
  if (status.peers === 0) return t("Looking for peers…");
  return t("Preparing stream");
}

function useMonotonicPct(ready: number, done: boolean): number {
  const [pct, setPct] = useState(0);
  // A readiness score that drops mid-load reads as broken, so the bar only ever
  // climbs and the finish snaps it to full.
  useEffect(() => {
    setPct((cur) => (done ? 100 : Math.max(cur, ready)));
  }, [ready, done]);
  return pct;
}

function BpReadinessMeter({
  pct,
  done,
  reduce,
}: {
  pct: number;
  done: boolean;
  reduce: boolean;
}) {
  const indeterminate = pct < 1 && !done;
  return (
    <div className="h-[clamp(5px,0.7vh,9px)] w-full overflow-hidden rounded-full bg-[var(--bp-glass)]">
      {indeterminate ? (
        <div
          className="h-full w-2/5 rounded-full bg-ink/60"
          style={reduce ? { width: "20%" } : { animation: "stremio-progress 1.5s ease-in-out infinite" }}
        />
      ) : (
        <div
          className="h-full rounded-full bg-ink"
          style={{ width: `${pct}%`, transition: `width ${done ? 340 : 1900}ms linear` }}
        />
      )}
    </div>
  );
}

function speedText(bps: number, t: (key: string) => string): string {
  if (bps >= 1024 ** 2) return `${(bps / 1024 ** 2).toFixed(1)} MB/s`;
  if (bps >= 1024) return `${(bps / 1024).toFixed(0)} KB/s`;
  return t("Warming up");
}

function telemetryParts(status: BpP2pStatus, t: (key: string) => string): string[] {
  if (!status.torrent) return [];
  const parts: string[] = [];
  if (status.peers > 0) {
    parts.push(`${status.peers} ${status.peers === 1 ? t("peer") : t("peers")}`);
    parts.push(speedText(status.speed, t));
  }
  if (status.downloaded > 0) {
    parts.push(
      status.total && status.total > 0
        ? `${formatBpBytes(status.downloaded)} / ${formatBpBytes(status.total)}`
        : formatBpBytes(status.downloaded),
    );
  }
  return parts;
}

export function BpP2pReadout({
  status,
  label,
  note,
  done = false,
  reduce = false,
}: {
  status: BpP2pStatus;
  label: string;
  note?: string | null;
  done?: boolean;
  reduce?: boolean;
}) {
  const t = useBpT();
  const pct = useMonotonicPct(status.torrent ? status.readiness : 0, done);
  const parts = telemetryParts(status, t);
  const searching = status.torrent && status.peers === 0 && !done;
  const showPct = status.torrent && pct >= 1;

  return (
    <div className="flex w-full flex-col gap-[clamp(9px,1.15vh,17px)]">
      <BpReadinessMeter pct={pct} done={done} reduce={reduce} />

      <div className="flex items-baseline gap-[clamp(9px,0.9vw,17px)]">
        {searching && (
          <span
            aria-hidden
            className={`h-[clamp(7px,0.9vh,11px)] w-[clamp(7px,0.9vh,11px)] shrink-0 self-center rounded-full bg-ink/45 ${
              reduce ? "" : "animate-pulse"
            }`}
          />
        )}
        <span
          role="status"
          className="min-w-0 flex-1 text-[clamp(12.5px,1.65vh,19px)] font-bold uppercase tracking-[0.17em] text-ink"
        >
          {label}
        </span>
        {showPct && (
          <span className="shrink-0 text-[clamp(14px,1.95vh,23px)] font-semibold tabular-nums text-ink-subtle">
            {Math.round(pct)}%
          </span>
        )}
      </div>

      {parts.length > 0 && (
        <p className="text-[clamp(14px,1.95vh,23px)] font-medium tabular-nums text-ink-subtle">
          {parts.join(" · ")}
        </p>
      )}

      {note && (
        <p className="max-w-[46ch] text-[clamp(13px,1.75vh,20px)] font-medium leading-snug text-ink-subtle opacity-80">
          {note}
        </p>
      )}
    </div>
  );
}
