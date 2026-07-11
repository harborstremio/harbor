import type { SlotChannel } from "@/lib/multiview/store";
import { AlertTriangle, Loader2, Plus, RefreshCw, Repeat2, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { MultiPlayer } from "./multi-player";

export type SlotStatus = "loading" | "playing" | "retrying" | "offline";

const MAX_AUTO_RETRIES = 2;
const BACKOFF_MS = [2500, 6000];

export function Cell({
  channel,
  focused,
  onPick,
  onClose,
  onFocus,
  onMute,
}: {
  slot: number;
  channel: SlotChannel | null;
  focused: boolean;
  status?: SlotStatus;
  onPick: () => void;
  onClose: () => void;
  onFocus: () => void;
  onMute: () => void;
}) {
  const [status, setStatus] = useState<SlotStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  const retryTimer = useRef<number | null>(null);
  const attemptsUsed = useRef(0);

  useEffect(() => {
    attemptsUsed.current = 0;
    setAttempt(0);
    setStatus("loading");
    if (retryTimer.current != null) {
      window.clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
  }, [channel?.url]);

  useEffect(() => {
    return () => {
      if (retryTimer.current != null) window.clearTimeout(retryTimer.current);
    };
  }, []);

  if (!channel) {
    return (
      <button
        onClick={onPick}
        className="group flex h-full w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-edge-soft bg-elevated/20 transition-colors hover:border-edge hover:bg-elevated/40"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-elevated text-ink-muted transition-colors group-hover:text-ink">
          <Plus size={22} strokeWidth={2.2} />
        </span>
        <span className="text-[13px] font-medium text-ink-muted">Add a channel</span>
      </button>
    );
  }

  const playerKey = `${channel.url}-${attempt}`;
  const exhausted = status === "offline" && attemptsUsed.current >= MAX_AUTO_RETRIES;

  const onPlayerError = () => {
    if (retryTimer.current != null) return;
    if (attemptsUsed.current >= MAX_AUTO_RETRIES) {
      setStatus("offline");
      return;
    }
    const delay = BACKOFF_MS[Math.min(attemptsUsed.current, BACKOFF_MS.length - 1)];
    setStatus("retrying");
    retryTimer.current = window.setTimeout(() => {
      retryTimer.current = null;
      attemptsUsed.current += 1;
      setAttempt((n) => n + 1);
      setStatus("loading");
    }, delay);
  };

  const onPlayerPlaying = () => {
    if (retryTimer.current != null) {
      window.clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
    attemptsUsed.current = 0;
    setStatus("playing");
  };

  const manualRetry = () => {
    if (retryTimer.current != null) {
      window.clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
    attemptsUsed.current = 0;
    setStatus("loading");
    setAttempt((n) => n + 1);
  };

  return (
    <div
      onClick={onFocus}
      className={`flex h-full w-full flex-col overflow-hidden rounded-2xl ring-1 transition-[box-shadow] ${
        focused ? "ring-2 ring-accent" : "ring-edge-soft hover:ring-edge"
      }`}
      style={{ background: "oklch(0.13 0.004 260)" }}
    >
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-edge-soft/60 px-3">
        <span className="truncate text-[12px] font-medium text-ink">{channel.name}</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPick();
            }}
            aria-label="Change channel"
            title="Change channel"
            className="flex h-6 w-6 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
          >
            <Repeat2 size={13} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (focused) onMute();
              else onFocus();
            }}
            aria-label={focused ? "Mute" : "Unmute this cell"}
            title={focused ? "Mute" : "Unmute this cell"}
            className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
              focused ? "bg-accent text-black" : "text-ink-subtle hover:bg-elevated hover:text-ink"
            }`}
          >
            {focused ? <Volume2 size={13} /> : <VolumeX size={13} />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Close cell"
            className="flex h-6 w-6 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-danger/20 hover:text-danger"
          >
            <X size={13} />
          </button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        {!exhausted && (
          <MultiPlayer
            key={playerKey}
            url={channel.url}
            muted={!focused}
            onPlaying={onPlayerPlaying}
            onError={onPlayerError}
          />
        )}
        {status !== "playing" && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/30 text-ink-subtle">
            {status === "offline" ? (
              <>
                <AlertTriangle size={22} className="text-danger" />
                <span className="text-[12px] font-medium text-ink-muted">Stream offline</span>
                {exhausted && (
                  <p className="max-w-[260px] text-center text-[11px] leading-snug text-ink-subtle">
                    If multiple streams are running, your IPTV provider may limit concurrent connections.
                  </p>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    manualRetry();
                  }}
                  className="pointer-events-auto mt-1 flex h-7 items-center gap-1.5 rounded-full border border-edge-soft px-3 text-[11.5px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink"
                >
                  <RefreshCw size={11} strokeWidth={2.4} />
                  Retry
                </button>
              </>
            ) : (
              <>
                <Loader2 size={20} className="animate-spin" />
                {status === "retrying" && <span className="text-[11px] font-medium text-ink-muted">Reconnecting…</span>}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
