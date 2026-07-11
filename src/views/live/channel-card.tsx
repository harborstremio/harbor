import { HoverTooltip } from "@/components/hover-tooltip";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { useFavorites } from "@/lib/iptv/favorites";
import { togglePin, usePinnedOrder } from "@/lib/iptv/pins";
import type { EpgProgram, IptvChannel } from "@/lib/iptv/types";
import { Info, Pin, Tv } from "lucide-react";
import { useState } from "react";

import { FavoriteButton } from "./favorite-button";

function formatRemaining(t: (key: string, vars?: Record<string, string | number>) => string, ms: number): string {
  const totalMin = Math.ceil(ms / 60_000);
  if (totalMin >= 60) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m ? t("{h}h {m}m left", { h, m }) : t("{h}h left", { h });
  }
  return t("{m}m left", { m: Math.max(1, totalMin) });
}

export function ChannelCard({
  channel,
  onPlay,
  onInfo,
  active,
  current,
  next,
  now,
  hydrated,
}: {
  channel: IptvChannel;
  onPlay: (ch: IptvChannel) => void;
  onInfo?: (meta: Meta) => void;
  active?: boolean;
  current?: EpgProgram | null;
  next?: EpgProgram | null;
  now?: number;
  hydrated?: Meta | null;
}) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const t = useT();
  const favorites = useFavorites();
  const isFav = favorites.has(channel.id);
  const pinned = usePinnedOrder();
  const isChannelPinned = pinned.includes(channel.id);
  const posterUrl = hydrated?.poster && !errored ? hydrated.poster : null;
  const logoUrl = !posterUrl && channel.logo && !errored ? channel.logo : null;
  const displayName = hydrated?.name?.trim() || channel.name;
  const progress =
    current && now && current.endMs > current.startMs
      ? Math.max(0, Math.min(1, (now - current.startMs) / (current.endMs - current.startMs)))
      : null;
  const timeLeft = current && now && current.endMs > now ? formatRemaining(t, current.endMs - now) : null;
  return (
    <div
      data-scroll-anchor={`channel-${channel.id}`}
      style={{
        contentVisibility: "auto",
        containIntrinsicSize: posterUrl ? "200px 240px" : "200px 170px",
      }}
      className={`group relative flex w-full flex-col items-stretch overflow-hidden rounded-2xl border bg-elevated transition-colors duration-150 ${
        active ? "border-ink/45 bg-raised" : "border-edge-soft/55 hover:border-edge/85 hover:bg-raised"
      }`}
    >
      <button
        type="button"
        onClick={() => onPlay(channel)}
        aria-label={t("Play {name}", { name: displayName })}
        className="flex w-full flex-col items-stretch text-start"
      >
        <div
          className={`relative flex items-center justify-center p-3 ${
            posterUrl ? "h-[160px] bg-canvas" : "h-[90px] bg-surface/70"
          }`}
        >
          {posterUrl ? (
            <>
              {!loaded && <div className="absolute inset-0 bg-canvas/60" />}
              <img
                src={posterUrl}
                alt=""
                draggable={false}
                loading="lazy"
                onLoad={() => setLoaded(true)}
                onError={() => setErrored(true)}
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
                  loaded ? "opacity-100" : "opacity-0"
                }`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-canvas/85 via-canvas/0 to-transparent" />
            </>
          ) : logoUrl ? (
            <>
              {!loaded && <div className="absolute inset-0 m-3 rounded-lg bg-canvas/60" />}
              <img
                src={logoUrl}
                alt=""
                draggable={false}
                loading="lazy"
                onLoad={() => setLoaded(true)}
                onError={() => setErrored(true)}
                className={`max-h-full max-w-full object-contain transition-opacity duration-200 ${
                  loaded ? "opacity-100" : "opacity-0"
                }`}
              />
            </>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-lg bg-canvas/40 text-ink-subtle">
              <Tv size={22} strokeWidth={1.7} />
              <span className="text-[10.5px] font-medium uppercase tracking-[0.18em]">{t("Live")}</span>
            </div>
          )}
          <span className="absolute start-2.5 top-2.5 flex h-5 items-center gap-1 rounded-full bg-canvas/90 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-danger">
            <span className="h-1.5 w-1.5 rounded-full bg-danger" />
            {t("Live")}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-1 px-3 py-2.5">
          <HoverTooltip label={displayName} sublabel={channel.group} side="top" className="min-w-0">
            <div dir="auto" className="truncate text-[14.5px] font-semibold leading-tight text-ink">
              {displayName}
            </div>
          </HoverTooltip>
          {current ? (
            <>
              <div className="flex items-baseline gap-2">
                <div dir="auto" className="min-w-0 flex-1 truncate text-[12.5px] leading-tight text-ink-muted">
                  {current.title}
                </div>
                {timeLeft && <span className="shrink-0 text-[10.5px] font-medium text-ink-subtle">{timeLeft}</span>}
              </div>
              {progress != null && (
                <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-canvas/55">
                  <div
                    className="h-full rounded-full bg-danger transition-[width] duration-500"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              )}
              {next && (
                <div className="mt-0.5 truncate text-[11px] leading-tight text-ink-subtle">
                  <span className="font-medium text-ink-subtle/80">{t("Next:")} </span>
                  {next.title}
                </div>
              )}
            </>
          ) : channel.group ? (
            <div className="truncate text-[12.5px] text-ink-subtle">{channel.group}</div>
          ) : (
            <div className="truncate text-[12.5px] text-ink-subtle">{t("No program info")}</div>
          )}
        </div>
      </button>
      <div className="absolute end-2 top-2 z-10 flex items-center gap-1.5">
        {onInfo && (
          <button
            type="button"
            onClick={() => onInfo(hydrated ?? channelMeta(channel))}
            aria-label={t("Open details")}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-canvas/85 text-ink opacity-0 transition-opacity duration-150 hover:bg-canvas group-hover:opacity-100"
          >
            <Info size={13} strokeWidth={2.2} />
          </button>
        )}
        <button
          type="button"
          onClick={() => togglePin(channel.id)}
          aria-label={isChannelPinned ? t("Unpin channel") : t("Pin to top")}
          className={`flex h-7 w-7 items-center justify-center rounded-full transition-opacity duration-150 ${
            isChannelPinned
              ? "bg-accent text-canvas opacity-100"
              : "bg-canvas/85 text-ink opacity-0 hover:bg-canvas group-hover:opacity-100"
          }`}
        >
          <Pin size={13} strokeWidth={2.2} className={isChannelPinned ? "fill-current" : ""} />
        </button>
        <FavoriteButton active={isFav} onToggle={() => favorites.toggle(channel)} size={14} />
      </div>
    </div>
  );
}

function channelMeta(ch: IptvChannel): Meta {
  return {
    id: `iptv:${ch.id}`,
    type: "tv",
    name: ch.name,
    poster: ch.logo ?? undefined,
    logo: ch.logo ?? undefined,
    background: ch.logo ?? undefined,
    description: ch.group ? `Live channel · ${ch.group}` : "Live channel",
    releaseInfo: "Live",
  };
}
