import type { Meta } from "@/lib/cinemeta";
import type { LiveTvHit } from "@/lib/search";
import { useView } from "@/lib/view";
import { Radio, Tv } from "lucide-react";

export function LiveTvRow({ items, onClose }: { items: LiveTvHit[]; onClose: () => void }) {
  const { openPlayer } = useView();
  if (items.length === 0) return null;
  const play = (hit: LiveTvHit) => {
    const meta: Meta = {
      id: `iptv:${hit.channelId}`,
      type: "tv",
      name: hit.name,
      poster: hit.logo ?? undefined,
      logo: hit.logo ?? undefined,
      background: hit.logo ?? undefined,
      description: hit.group ? `Live channel · ${hit.group}` : "Live channel",
      releaseInfo: "Live",
    };
    onClose();
    openPlayer({
      meta,
      url: hit.url,
      title: hit.name,
      subtitle: hit.group ?? "Live",
      notWebReady: true,
    });
  };

  return (
    <section>
      <h3 className="mb-3 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
        <Radio size={11} strokeWidth={2.2} />
        Live TV
      </h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((hit, ix) => (
          <button
            key={`${hit.playlistId}:${hit.channelId}:${ix}`}
            onClick={() => play(hit)}
            className="group flex items-center gap-3 rounded-xl border border-edge-soft/60 bg-elevated/40 px-3 py-2.5 text-start transition-colors hover:border-edge hover:bg-elevated"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-canvas">
              {hit.logo ? (
                <img src={hit.logo} alt="" loading="lazy" draggable={false} className="h-full w-full object-contain" />
              ) : (
                <Tv size={18} strokeWidth={1.7} className="text-ink-subtle" />
              )}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex items-center gap-1.5">
                <span className="flex h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />
                <span className="truncate text-[13.5px] font-semibold text-ink">{hit.name}</span>
              </span>
              <span className="truncate text-[11.5px] text-ink-subtle">
                {hit.group ? `${hit.group} · ` : ""}
                {hit.playlistName}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
