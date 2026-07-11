import { useT } from "@/lib/i18n";
import type { EpgProgram, IptvChannel } from "@/lib/iptv/types";
import { Play, Tv } from "lucide-react";
import { useState } from "react";

export function OverlayChannelRow({
  channel,
  current,
  onPlay,
  isCurrent,
  now,
}: {
  channel: IptvChannel;
  current: EpgProgram | null;
  isCurrent: boolean;
  onPlay: (ch: IptvChannel) => void;
  now: number;
}) {
  const t = useT();
  const [errored, setErrored] = useState(false);
  const showLogo = channel.logo && !errored;
  const progress =
    current && now && current.endMs > current.startMs
      ? Math.max(0, Math.min(1, (now - current.startMs) / (current.endMs - current.startMs)))
      : null;
  return (
    <button
      onClick={() => onPlay(channel)}
      className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-start transition-colors duration-150 ${
        isCurrent
          ? "border-danger/50 bg-danger/10"
          : "border-edge-soft/55 bg-elevated/55 hover:border-edge hover:bg-raised"
      }`}
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-canvas">
        {showLogo ? (
          <img
            src={channel.logo!}
            alt=""
            draggable={false}
            loading="lazy"
            onError={() => setErrored(true)}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <Tv size={20} strokeWidth={1.7} className="text-ink-subtle" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          {isCurrent && (
            <span className="flex h-4 items-center gap-1 rounded-full bg-danger px-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-canvas">
              <span className="h-1 w-1 rounded-full bg-canvas" />
              {t("On now")}
            </span>
          )}
          <span className="truncate text-[14.5px] font-semibold text-ink">{channel.name}</span>
        </div>
        {current ? (
          <>
            <span className="truncate text-[12.5px] text-ink-muted">{current.title}</span>
            {progress != null && (
              <div className="mt-0.5 h-[2px] w-full overflow-hidden rounded-full bg-canvas/55">
                <div className="h-full rounded-full bg-danger" style={{ width: `${progress * 100}%` }} />
              </div>
            )}
          </>
        ) : channel.group ? (
          <span className="truncate text-[12px] text-ink-subtle">{channel.group}</span>
        ) : null}
      </div>
      <div className="shrink-0 self-stretch flex items-center opacity-0 transition-opacity group-hover:opacity-100">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-canvas">
          <Play size={14} fill="currentColor" />
        </div>
      </div>
    </button>
  );
}
