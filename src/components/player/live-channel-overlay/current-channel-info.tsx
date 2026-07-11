import { HoverTooltip } from "@/components/hover-tooltip";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { isHydratableChannel } from "@/lib/iptv/channel-hydration";
import { useFavorites } from "@/lib/iptv/favorites";
import type { EpgProgram, IptvChannel } from "@/lib/iptv/types";
import { FavoriteButton } from "@/views/live/favorite-button";
import { formatTimeLabel } from "@/views/live/guide/guide-utils";
import { useChannelHydration } from "@/views/live/hooks/use-channel-hydration";
import { Tv } from "lucide-react";
import { useMemo, useState } from "react";

export function CurrentChannelInfo({
  channel,
  current,
  now,
}: {
  channel: IptvChannel | null;
  current: EpgProgram | null;
  now: number;
}) {
  const hydrationNames = useMemo(() => {
    if (!channel) return [];
    if (!isHydratableChannel(channel)) return [];
    return [channel.name];
  }, [channel]);
  const hydrations = useChannelHydration(hydrationNames);
  const hydrated = channel ? (hydrations.get(channel.name) ?? null) : null;
  if (!channel) return null;
  return (
    <div className="flex h-[140px] w-full overflow-hidden rounded-2xl border border-edge-soft/60 bg-canvas/85 backdrop-blur">
      <Backdrop hydrated={hydrated} logo={channel.logo} />
      <div className="relative flex min-w-0 flex-1 items-center gap-5 px-5 py-4">
        <ChannelLogo channel={channel} hydrated={hydrated} />
        <Body channel={channel} current={current} hydrated={hydrated} now={now} />
      </div>
    </div>
  );
}

function Backdrop({ hydrated, logo }: { hydrated: Meta | null; logo: string | null }) {
  const [errored, setErrored] = useState(false);
  const url = hydrated?.background || hydrated?.poster || logo;
  if (!url || errored) {
    return <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-elevated/40 to-canvas/95" />;
  }
  return (
    <>
      <img
        src={url}
        alt=""
        draggable={false}
        onError={() => setErrored(true)}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-canvas/90 via-canvas/75 to-canvas/95" />
    </>
  );
}

function ChannelLogo({ channel, hydrated }: { channel: IptvChannel; hydrated: Meta | null }) {
  const [errored, setErrored] = useState(false);
  const url = hydrated?.poster || channel.logo;
  if (!url || errored) {
    return (
      <div className="flex h-[108px] w-[80px] shrink-0 items-center justify-center rounded-xl bg-elevated text-ink-subtle">
        <Tv size={24} strokeWidth={1.7} />
      </div>
    );
  }
  const isPoster = !!hydrated?.poster;
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-elevated ${
        isPoster ? "h-[108px] w-[80px]" : "h-[88px] w-[88px] p-3"
      }`}
    >
      <img
        src={url}
        alt=""
        draggable={false}
        onError={() => setErrored(true)}
        className={isPoster ? "h-full w-full object-cover" : "max-h-full max-w-full object-contain"}
      />
    </div>
  );
}

function Body({
  channel,
  current,
  hydrated,
  now,
}: {
  channel: IptvChannel;
  current: EpgProgram | null;
  hydrated: Meta | null;
  now: number;
}) {
  const t = useT();
  const title = hydrated?.name?.trim() || channel.name;
  const description = current?.description || hydrated?.description || null;
  const progress =
    current && now && current.endMs > current.startMs
      ? Math.max(0, Math.min(1, (now - current.startMs) / (current.endMs - current.startMs)))
      : null;
  const remainingMin = current && now ? Math.max(0, Math.round((current.endMs - now) / 60_000)) : null;
  const favorites = useFavorites();
  const isFav = favorites.has(channel.id);
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="flex h-5 items-center gap-1 rounded-full bg-danger px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-canvas">
          <span className="h-1.5 w-1.5 rounded-full bg-canvas" />
          {t("Live")}
        </span>
        {channel.group && (
          <span className="truncate text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
            {channel.group}
          </span>
        )}
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <HoverTooltip label={title} sublabel={channel.group} className="min-w-0">
          <h2 className="truncate text-[20px] font-semibold leading-tight text-ink">{title}</h2>
        </HoverTooltip>
        <FavoriteButton active={isFav} onToggle={() => favorites.toggle(channel)} size={16} variant="inline" />
      </div>
      {current ? (
        <>
          <div className="flex items-center gap-2 text-[13px] text-ink-muted">
            <span className="truncate font-medium text-ink">{current.title}</span>
            <span className="text-ink-subtle">·</span>
            <span className="tabular-nums">
              {formatTimeLabel(current.startMs)} – {formatTimeLabel(current.endMs)}
            </span>
            {remainingMin != null && (
              <>
                <span className="text-ink-subtle">·</span>
                <span className="tabular-nums">{t("{m}m left", { m: remainingMin })}</span>
              </>
            )}
          </div>
          {description && <p className="truncate text-[12.5px] text-ink-muted/85">{description}</p>}
          {progress != null && (
            <div className="mt-1 h-[3px] w-full max-w-[280px] overflow-hidden rounded-full bg-canvas/55">
              <div className="h-full rounded-full bg-danger" style={{ width: `${progress * 100}%` }} />
            </div>
          )}
        </>
      ) : description ? (
        <p className="truncate text-[12.5px] text-ink-muted/85">{description}</p>
      ) : (
        <p className="text-[12.5px] text-ink-subtle">{t("No program info available")}</p>
      )}
    </div>
  );
}
