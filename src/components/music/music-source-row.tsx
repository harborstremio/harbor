import { MusicSourceSearchMotion } from "./music-source-search-motion";
import { Check, Music2, Play } from "@/components/icons/music-icons";
import type { MusicSourceCandidate } from "@/lib/music/types";
import { useT } from "@/lib/i18n";
import { MusicServiceLogo } from "./music-service-logo";
import { MusicQualityBadge } from "./music-quality-badge";

export function MusicSourceRow({
  candidate,
  preferred,
  pending,
  failed = false,
  onSelect,
}: {
  candidate: MusicSourceCandidate;
  preferred: boolean;
  pending: boolean;
  failed?: boolean;
  onSelect: () => void;
}) {
  const t = useT();
  const unavailable = candidate.health === "offline";

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={pending || unavailable}
      className="group grid min-h-20 w-full grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-4 rounded-md px-4 py-3 text-start transition-colors hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-45"
    >
      <span className="grid size-10 place-items-center overflow-hidden rounded-md bg-raised text-ink-muted">
        <MusicServiceLogo
          source={candidate.connectorId}
          size={28}
          fallback={<Music2 size={24} aria-hidden="true" />}
        />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <strong className="truncate text-[13px] font-semibold text-ink">
            {candidate.connectorName}
          </strong>
          {preferred && (
            <span className="inline-flex items-center gap-1 text-[10px] text-ink-subtle">
              <Check size={11} /> {t("music.source.preferred")}
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-ink-muted">
          {candidate.track.title} · {candidate.track.artist}
        </span>
        <MusicQualityBadge track={candidate.track} />
        {failed && (
          <span className="mt-1 block text-[11px] text-ink-muted">
            {t("music.recovery.retrySource")}
          </span>
        )}
      </span>
      <span className="grid size-9 place-items-center rounded-full bg-ink text-canvas transition-transform group-hover:scale-105">
        {pending ? (
          <MusicSourceSearchMotion source={candidate.connectorId} />
        ) : (
          <Play size={14} fill="currentColor" />
        )}
      </span>
    </button>
  );
}
