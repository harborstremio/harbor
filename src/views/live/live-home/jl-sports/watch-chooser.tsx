import { ExternalLink, Info, Play, Tv } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { IptvChannel } from "@/lib/iptv/types";
import { isStreamingOnly, type GameChannelSource } from "@/lib/jl/sports/channels";
import type { SportsGame } from "@/lib/sports/espn";
import { JlDialog } from "./jl-dialog";
import type { JlHubGame } from "./use-jl-sports";

const SOURCE_LABEL: Record<GameChannelSource, string> = {
  event: "Game feed",
  network: "Network",
  guide: "From the TV guide",
};

/** Every way to watch a game: your M3U channels first, then anything else. Nothing plays until you pick. */
export function WatchChooser({
  item,
  onPlay,
  onOpenGame,
  onClose,
}: {
  item: JlHubGame;
  onPlay: (channel: IptvChannel) => void;
  onOpenGame: (game: SportsGame) => void;
  onClose: () => void;
}) {
  const t = useT();
  const { game, channels } = item;
  const title = `${game.away.location || game.away.name} ${t("at")} ${game.home.location || game.home.name}`;
  const network = game.network ?? null;
  const streaming = network && isStreamingOnly(network);
  return (
    <JlDialog title={title} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <section className="flex flex-col gap-1.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">{t("Your channels")}</h3>
          {channels.length === 0 && (
            <p className="text-[13px] text-ink-subtle">{t("None of your channels lists this game yet.")}</p>
          )}
          {channels.map((c) => (
            <button
              key={c.channel.id}
              onClick={() => {
                onClose();
                onPlay(c.channel);
              }}
              className="flex items-center gap-3 rounded-xl border border-edge-soft bg-canvas/40 px-3.5 py-2.5 text-start transition-colors hover:border-edge focus:border-ink-subtle focus:outline-none"
            >
              {c.channel.logo ? (
                <img src={c.channel.logo} alt="" className="h-7 w-7 shrink-0 rounded object-contain" loading="lazy" />
              ) : (
                <Tv size={18} className="shrink-0 text-ink-subtle" />
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13.5px] font-medium text-ink">{c.channel.name}</span>
                <span className="text-[11.5px] text-ink-subtle">
                  {t(SOURCE_LABEL[c.via])}
                  {c.alternate ? ` · ${t("Alternate language")}` : ""}
                </span>
              </span>
              <Play size={14} fill="currentColor" strokeWidth={0} className="shrink-0 text-accent" />
            </button>
          ))}
        </section>
        <section className="flex flex-col gap-1.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">{t("Other ways to watch")}</h3>
          {network && (
            <div className="flex items-center gap-3 rounded-xl border border-edge-soft/60 px-3.5 py-2.5 text-[13px] text-ink-muted">
              <ExternalLink size={15} className="shrink-0 text-ink-subtle" />
              {streaming
                ? t("Streaming on {network}", { network })
                : t("Broadcast on {network}", { network })}
            </div>
          )}
          <button
            onClick={() => {
              onClose();
              onOpenGame(game);
            }}
            className="flex items-center gap-3 rounded-xl border border-edge-soft/60 px-3.5 py-2.5 text-start text-[13px] text-ink-muted transition-colors hover:border-edge hover:text-ink focus:border-ink-subtle focus:outline-none"
          >
            <Info size={15} className="shrink-0 text-ink-subtle" />
            {t("Game details and live field")}
          </button>
        </section>
      </div>
    </JlDialog>
  );
}
