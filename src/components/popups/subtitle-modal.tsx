import { useEffect } from "react";
import { SubtitleMenuBody } from "@/components/player/subtitle-menu";
import {
  publishSubtitleContext,
  type SubtitleContentContext,
} from "@/components/player/subtitle-menu/subtitle-context-store";
import type { TrackInfo } from "@/lib/player/bridge";
import type { SubtitleAddHandler } from "@/lib/player/subtitle-load";
import { ResizableSubtitlePanel } from "@/components/player/subtitle-menu/resizable-panel";

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
  subtitleContext: SubtitleContentContext | null;
};

type Props = {
  state: SubtitleModalState;
  onSelect: (id: string | null) => void;
  onSelectSecondary: (id: string | null) => void;
  onDelay: (sec: number) => void;
  onEnterSync: () => void;
  onAddSubtitle: SubtitleAddHandler;
  onClose: () => void;
};

export function SubtitleModal({
  state,
  onSelect,
  onSelectSecondary,
  onDelay,
  onEnterSync,
  onAddSubtitle,
  onClose,
}: Props) {
  useEffect(() => {
    publishSubtitleContext(state.subtitleContext);
    return () => publishSubtitleContext(null);
  }, [state.subtitleContext]);

  return (
    <div
      className="fixed inset-0 flex items-end justify-end"
      style={{ background: "transparent" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <ResizableSubtitlePanel className="mb-24 me-6">
        <div className="flex min-h-0 flex-1 flex-col" onClick={(e) => e.stopPropagation()}>
          <SubtitleMenuBody
            tracks={state.tracks}
            selectedId={state.selectedId}
            delaySec={state.delaySec}
            onSelect={onSelect}
            onSelectSecondary={onSelectSecondary}
            onDelay={onDelay}
            onEnterSync={onEnterSync}
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
      </ResizableSubtitlePanel>
    </div>
  );
}
