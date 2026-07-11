import { Poster, usePosterChain } from "@/components/poster";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import type { IptvChannel } from "@/lib/iptv/types";
import { useSettings } from "@/lib/settings";
import { Play } from "lucide-react";

import { hydrationKey, type NowItem } from "./use-live-home";

export function MoreOnNow({
  items,
  hydrations,
  onPlay,
}: {
  items: NowItem[];
  hydrations: Map<string, Meta | null>;
  onPlay: (ch: IptvChannel) => void;
}) {
  const t = useT();
  if (items.length === 0) return null;
  return (
    <div className="flex w-[40%] min-w-[300px] shrink-0 flex-col gap-3">
      <h3 className="ps-0.5 text-[15px] font-medium italic text-ink-muted">{t("On now")}</h3>
      <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((it) => (
          <Pick key={it.channel.id} item={it} hydrated={hydrations.get(hydrationKey(it)) ?? null} onPlay={onPlay} />
        ))}
      </div>
    </div>
  );
}

function Pick({ item, hydrated, onPlay }: { item: NowItem; hydrated: Meta | null; onPlay: (ch: IptvChannel) => void }) {
  const t = useT();
  const { settings } = useSettings();
  const { channel, current } = item;
  const poster = usePosterChain(
    settings.rpdbKey,
    hydrated?.id ?? "",
    hydrated?.poster ?? undefined,
    hydrated?.type === "series" ? "series" : "movie",
  );
  return (
    <button
      data-art={hydrated?.background || hydrated?.poster || channel.logo || ""}
      onClick={() => onPlay(channel)}
      title={channel.name}
      className="group/p flex w-[164px] shrink-0 flex-col gap-2 text-start"
    >
      <div className="relative overflow-hidden rounded-lg ring-1 ring-edge-soft/40 transition-shadow duration-200 group-hover/p:ring-edge group-hover/p:shadow-[0_8px_24px_-10px_rgba(0,0,0,0.6)]">
        <Poster
          src={poster.src}
          onError={poster.onError}
          seed={channel.id}
          ratio="portrait"
          className="harbor-card-ring rounded-lg shadow-[0_2px_8px_-2px_rgba(0,0,0,0.4)]"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-canvas/0 opacity-0 transition-all duration-200 group-hover/p:bg-canvas/35 group-hover/p:opacity-100">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-canvas shadow-[0_4px_14px_rgba(0,0,0,0.4)]">
            <Play size={17} fill="currentColor" />
          </span>
        </div>
        <span className="absolute start-2 top-2 flex h-[19px] items-center rounded bg-danger px-1.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-white">
          {t("Live")}
        </span>
      </div>
      <p className="line-clamp-2 text-[12.5px] font-medium leading-snug text-ink">
        {current?.title || hydrated?.name || channel.name}
      </p>
    </button>
  );
}
