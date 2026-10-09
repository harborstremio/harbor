import { useSyncExternalStore, type RefObject } from "react";
import { ExternalLink, Loader2, Pause, Play } from "lucide-react";
import { AnchoredMenu } from "@/components/anchored-menu";
import { HoverTooltip } from "@/components/hover-tooltip";
import { Poster } from "@/components/poster";
import { useT } from "@/lib/i18n";
import {
  getMusicState,
  playMusic,
  subscribeMusic,
  toggleMusicPlayback,
} from "@/lib/music/player";
import type { MusicPlaybackPhase, MusicTrack } from "@/lib/music/types";
import { durationLabelOf, type CriticismEpisode } from "@/lib/providers/podcast-criticism";
import { openUrl } from "@/lib/window";

const PANEL_WIDTH = 340;

function asTrack(episode: CriticismEpisode): MusicTrack {
  return {
    id: episode.id,
    connectorId: "podcast",
    mediaKind: "audio",
    playbackUrl: episode.audioUrl,
    title: episode.title,
    artist: episode.show,
    artwork: episode.artwork,
    durationSeconds: episode.durationSeconds,
    durationLabel: durationLabelOf(episode.durationSeconds),
  };
}

function currentSignature(): string {
  const state = getMusicState();
  return `${state.current?.id ?? ""}|${state.phase}`;
}

function useNowPlaying(): { id: string; phase: MusicPlaybackPhase } {
  const signature = useSyncExternalStore(subscribeMusic, currentSignature, () => "|idle");
  const [id, phase] = signature.split("|");
  return { id: id ?? "", phase: (phase ?? "idle") as MusicPlaybackPhase };
}

export function CriticismPanel({
  anchorRef,
  open,
  onClose,
  title,
  episodes,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  title: string;
  episodes: CriticismEpisode[];
}) {
  const t = useT();
  const now = useNowPlaying();

  return (
    <AnchoredMenu anchorRef={anchorRef} open={open} onClose={onClose} width={PANEL_WIDTH}>
      <div
        role="dialog"
        aria-label={title}
        className="overflow-hidden rounded-xl border border-edge bg-elevated shadow-[0_18px_50px_-15px_rgba(0,0,0,0.7)] animate-popover-in"
      >
        <div className="flex flex-col gap-0.5 border-b border-edge-soft px-3.5 py-2.5">
          <h3 className="truncate text-[13.5px] font-semibold leading-tight text-ink">{title}</h3>
          <p className="truncate text-[10.5px] text-ink-muted">
            {episodes.length === 1
              ? t("One episode · Apple Podcasts")
              : t("{n} episodes · Apple Podcasts", { n: episodes.length })}
          </p>
        </div>
        <ul className="max-h-[300px] overflow-y-auto px-1.5 py-1.5 [scrollbar-width:thin]">
          {episodes.map((episode) => (
            <li key={episode.id} className="flex items-center gap-1">
              <EpisodeRow
                episode={episode}
                phase={now.id === episode.id ? now.phase : null}
              />
              {episode.pageUrl.length > 0 && (
                <HoverTooltip
                  label={t("Open in Apple Podcasts")}
                  align="center"
                  className="shrink-0"
                >
                  <button
                    type="button"
                    onClick={() => openUrl(episode.pageUrl)}
                    aria-label={t("Open in Apple Podcasts")}
                    className="flex h-11 w-9 shrink-0 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-canvas/60 hover:text-ink focus-visible:bg-canvas/60 focus-visible:text-ink focus-visible:outline-none"
                  >
                    <ExternalLink size={12} strokeWidth={2.2} />
                  </button>
                </HoverTooltip>
              )}
            </li>
          ))}
        </ul>
      </div>
    </AnchoredMenu>
  );
}

function EpisodeRow({
  episode,
  phase,
}: {
  episode: CriticismEpisode;
  phase: MusicPlaybackPhase | null;
}) {
  const t = useT();
  const busy = phase === "resolving";
  const playing = phase === "playing";

  const onClick = () => {
    if (phase === "playing" || phase === "paused") {
      toggleMusicPlayback();
      return;
    }
    const track = asTrack(episode);
    void playMusic(track, [track]).catch(() => {});
  };

  const facts = [
    episode.show,
    t("{n} min", { n: episode.minutes }),
    episode.year != null ? String(episode.year) : "",
  ].filter((fact) => fact.length > 0);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-11 flex-1 items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-start transition-colors hover:bg-canvas/60 focus-visible:bg-canvas/60 focus-visible:outline-none"
    >
      <span className="block w-10 shrink-0 overflow-hidden rounded-md">
        <Poster
          src={episode.artwork}
          seed={episode.id}
          ratio="square"
          className="w-full [--poster-radius:0px]"
          lazy
        />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[12px] font-semibold text-ink">{episode.title}</span>
        <span className="truncate text-[10.5px] leading-snug text-ink-muted">
          {facts.join(" · ")}
        </span>
      </span>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center text-ink-subtle transition-colors group-hover:text-ink">
        {busy ? (
          <Loader2 size={13} className="animate-spin" />
        ) : playing ? (
          <Pause size={13} strokeWidth={2.2} />
        ) : (
          <Play size={13} strokeWidth={2.2} />
        )}
      </span>
    </button>
  );
}
