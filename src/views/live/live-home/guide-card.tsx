import { useState } from "react";
import { Tv } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { IptvChannel } from "@/lib/iptv/types";
import { channelNumber, fmtClock } from "./now-format";
import type { NowItem } from "./use-live-home";

export function GuideCard({ item, onPlay }: { item: NowItem; onPlay: (ch: IptvChannel) => void }) {
  const t = useT();
  const { channel, current, next, progress } = item;
  const [err, setErr] = useState(false);
  const logo = channel.logo && !err ? channel.logo : null;
  const chno = channelNumber(channel.attrs);
  return (
    <button
      type="button"
      data-art={current?.iconUrl || channel.logo || ""}
      onClick={() => onPlay(channel)}
      title={channel.name}
      className="group/g flex h-[132px] w-full flex-col justify-between rounded-lg border border-edge-soft/55 bg-elevated p-3.5 text-start transition-colors duration-150 hover:border-edge hover:bg-raised"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-12 shrink-0 items-center justify-center overflow-hidden rounded bg-canvas/60">
          {logo ? (
            <img
              src={logo}
              alt=""
              draggable={false}
              loading="lazy"
              onError={() => setErr(true)}
              className="max-h-5 max-w-full object-contain"
            />
          ) : (
            <Tv size={14} strokeWidth={1.9} className="text-ink-subtle" />
          )}
        </span>
        <span className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-danger">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />
          {t("Live")}
        </span>
        <span className="ms-auto flex items-center gap-1 truncate text-[11.5px] text-ink-subtle">
          {chno && <span className="tabular-nums">{chno}</span>}
          <span className="truncate">{channel.name}</span>
        </span>
      </div>
      <div>
        <div dir="auto" className="truncate text-[14px] font-semibold leading-tight text-ink">
          {current?.title || channel.name}
        </div>
        {progress != null && (
          <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-canvas/55">
            <div
              className="h-full rounded-full bg-danger"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        )}
      </div>
      <div className="truncate text-[11.5px] text-ink-subtle">
        {next ? (
          <>
            <span className="font-medium text-ink-muted">
              {t("Next {time}", { time: fmtClock(next.startMs) })} ·{" "}
            </span>
            {next.title}
          </>
        ) : (
          <span className="text-ink-subtle/70">{channel.group ?? t("Live")}</span>
        )}
      </div>
    </button>
  );
}
