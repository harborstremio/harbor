import { useState, type ReactNode } from "react";
import { useLastPlaybackContinuation } from "@/hooks/use-last-playback-continuation";
import { useContextWatchedState } from "@/lib/context-watched-state";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { lastPlaybackPresentation } from "@/lib/last-playback-presentation";
import { UiIcon } from "@/components/ui-icon";
import { CoverImg } from "@/components/cover-img";
import type { ContextAction } from "@/lib/context-actions";
import { ActionItems } from "./action-items";

function PlaybackArtwork({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <span className="relative inline-flex size-[18px] shrink-0 items-center justify-center overflow-hidden rounded-[4px]">
      {(!loaded || failed) && <UiIcon name="continue-last-watched" className="size-[18px]" />}
      {src && !failed && (
        <CoverImg
          src={src}
          alt=""
          draggable={false}
          className={`absolute inset-0 size-full object-cover ${loaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

type LastPlaybackCommandProps = {
  onClose: (restoreFocus?: boolean) => void;
  enabled?: boolean;
  children?: (action: ContextAction | null) => ReactNode;
};

export function LastPlaybackCommand({ enabled = true, ...props }: LastPlaybackCommandProps) {
  return enabled ? <ResolvedLastPlaybackCommand {...props} /> : props.children?.(null);
}

function ResolvedLastPlaybackCommand({ onClose, children }: LastPlaybackCommandProps) {
  const continuation = useLastPlaybackContinuation();
  const { settings } = useSettings();
  const t = useT();
  const target = continuation.target;
  const { summary } = useContextWatchedState(
    target?.src.episode
      ? {
          meta: target.src.meta,
          episode: target.src.episode,
          imdbId: target.src.imdbId,
          episodeScope: true,
        }
      : null,
  );
  if (!target) return children?.(null) ?? null;
  const presentation = lastPlaybackPresentation(target, settings, summary?.status === "watched");
  const tooltip = [presentation.title ?? t("Local video"), presentation.episode]
    .filter(Boolean)
    .join(" · ");
  const action: ContextAction = {
    id: `playback:last:${target.id}`,
    label: t("Continue last watched"),
    icon: <PlaybackArtwork key={presentation.artwork ?? "fallback"} src={presentation.artwork} />,
    reason: tooltip,
    tooltipIntent: "deliberate",
    restoreFocus: false,
    disabled: continuation.pending,
    dismiss: "on-success",
    confirmation: target.completed
      ? {
          key: `${target.id}:restart`,
          title: t("Playback finished"),
          description: t("Play this same video from the beginning?"),
          summary: t("Play this same video from the beginning?"),
          confirmLabel: t("Play from beginning"),
          pendingLabel: t("Opening playback…"),
          successLabel: t("Opening playback…"),
        }
      : undefined,
    run: async () => {
      await continuation.continuePlayback(target, { restart: target.completed });
    },
  };
  if (children) return children(action);
  return (
    <>
      <ActionItems source={{ actions: () => [action] }} onClose={onClose} />
    </>
  );
}
