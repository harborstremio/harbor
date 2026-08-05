import { SubtitleMenuBody } from "@/components/player/subtitle-menu";
import type { TrackInfo } from "@/lib/player/bridge";
import type { SubtitleAddHandler } from "@/lib/player/subtitle-load";

export type SubtitleModalState = {
  tracks: TrackInfo[];
  selectedId: string | null;
  delaySec: number;
  metaImdbId: string | null;
  metaTitle: string | null;
  metaReleaseDate: string | null;
  season: number | null;
  episode: number | null;
  preferredLanguages: string[];
};

type Props = {
  state: SubtitleModalState;
  onSelect: (id: string | null) => void;
  onSelectSecondary: (id: string | null) => void;
  onDelay: (sec: number) => void;
  onAddSubtitle: SubtitleAddHandler;
  onClose: () => void;
};

export function SubtitleModal({
  state,
  onSelect,
  onSelectSecondary,
  onDelay,
  onAddSubtitle,
  onClose,
}: Props) {
  return (
    <div
      className="fixed inset-0 flex items-end justify-end"
      style={{ background: "transparent" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="m-2 mb-[84px] flex h-[460px] max-h-[calc(100vh-108px)] w-[560px] max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-2xl border border-edge bg-elevated shadow-[0_24px_60px_-15px_rgba(0,0,0,0.85)] backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <SubtitleMenuBody
          tracks={state.tracks}
          selectedId={state.selectedId}
          delaySec={state.delaySec}
          onSelect={onSelect}
          onSelectSecondary={onSelectSecondary}
          onDelay={onDelay}
          onAddSubtitle={onAddSubtitle}
          metaImdbId={state.metaImdbId}
          metaTitle={state.metaTitle}
          metaReleaseDate={state.metaReleaseDate}
          season={state.season}
          episode={state.episode}
          preferredLanguages={state.preferredLanguages}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
