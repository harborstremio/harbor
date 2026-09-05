import { useEffect, useState } from "react";
import { Spinner } from "@/components/spinner";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useView } from "@/lib/view";
import { usePageVisible } from "@/lib/visibility";
import { MultiPlayer } from "@/views/multiview/multi-player";
import type { IptvChannel } from "@/lib/iptv/types";

const PREVIEW_VOLUME = 0.22;

// A stream that refuses once refuses every time the cursor comes back.
const FAILED = new Set<string>();

export function GuideHoverPreview({
  channel,
  title,
}: {
  channel: IptvChannel | null;
  title: string | null;
}) {
  const t = useT();
  const reduced = useReducedMotion();
  const pageVisible = usePageVisible();
  const { stackKinds } = useView();
  const [playing, setPlaying] = useState(false);
  const [failedTick, setFailedTick] = useState(0);

  const channelId = channel?.id ?? "";

  useEffect(() => {
    setPlaying(false);
  }, [channelId]);

  if (!channel || !channel.url) return null;

  // An invisible video keeps decoding and keeps its socket open, and many IPTV
  // accounts cap concurrent connections at 1, so a preview left running would
  // make real playback reject.
  const mount =
    !FAILED.has(channel.id) &&
    pageVisible &&
    !stackKinds.includes("player") &&
    !reduced &&
    failedTick >= 0;

  if (!mount) return null;

  return createPortal(
    <div
      aria-hidden
      className="harbor-guide-preview pointer-events-none fixed z-[120] overflow-hidden rounded-[10px] bg-black shadow-[0_24px_60px_-18px_rgba(0,0,0,0.85)] ring-1 ring-edge-soft"
      style={{ insetInlineEnd: 24, bottom: 24, width: 288, aspectRatio: "16 / 9" }}
    >
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{ opacity: playing ? 1 : 0 }}
      >
        <MultiPlayer
          key={channel.id}
          url={channel.url}
          muted={false}
          volume={PREVIEW_VOLUME}
          exclusive
          cover
          onPlaying={() => setPlaying(true)}
          onError={() => {
            FAILED.add(channel.id);
            setFailedTick((n) => n + 1);
          }}
        />
      </div>

      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner size={20} className="text-ink-subtle" />
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/85 to-transparent px-3 pb-2 pt-6">
        <span className="flex h-[15px] shrink-0 items-center gap-1 rounded-full bg-danger px-1.5 text-[8.5px] font-semibold uppercase tracking-[0.16em] text-canvas">
          <span className="h-1 w-1 rounded-full bg-canvas" />
          {t("Live")}
        </span>
        <span dir="auto" className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-white">
          {title || channel.name}
        </span>
      </div>
    </div>,
    document.body,
  );
}
