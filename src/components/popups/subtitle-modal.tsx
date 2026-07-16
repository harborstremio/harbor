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
};

type Props = {
  state: SubtitleModalState;
  onSelect: (id: string | null) => void;
  onDelay: (sec: number) => void;
  onAddSubtitle: SubtitleAddHandler;
  onClose: () => void;
};

export function SubtitleModal({ state, onSelect, onDelay, onAddSubtitle, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 flex items-end justify-end"
      style={{ background: "transparent" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="m-3 mb-[110px] me-[120px] flex max-h-[520px] w-[400px] flex-col overflow-hidden rounded-2xl border border-edge bg-elevated shadow-[0_24px_60px_-15px_rgba(0,0,0,0.85)] backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <SubtitleMenuBody
          tracks={state.tracks}
          selectedId={state.selectedId}
          delaySec={state.delaySec}
          onSelect={onSelect}
          onDelay={onDelay}
          onAddSubtitle={onAddSubtitle}
          metaImdbId={state.metaImdbId}
          metaTitle={state.metaTitle}
          metaReleaseDate={state.metaReleaseDate}
          season={state.season}
          episode={state.episode}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
