import { useLayoutEffect, useRef, useState } from "react";
import { FormatBadge } from "@/components/format-badge";
import { useT } from "@/lib/i18n";
import { SETTINGS_SAMPLE_META } from "@/lib/sample-artwork";
import { parseStream } from "@/lib/streams/parser";
import type { ScoredStream } from "@/lib/streams/types";
import { PrimaryCard } from "@/views/play-picker/primary-card";
import { StremioRow } from "@/views/play-picker/stremio-row";
import { formatSize } from "@/views/play-picker/picker-utils";

const NOOP = () => {};
const QUALITIES = ["1080p", "720p"] as const;
const SAMPLE_STREAMS: ScoredStream[] = QUALITIES.map((quality, index) => ({
  ...parseStream({
    addonId: "harbor-settings-preview",
    addonName: "",
    name: SETTINGS_SAMPLE_META.name,
    title: `The.General.1926.${quality}.WEB-DL.AVC.mp4`,
    url: "about:blank",
    behaviorHints: {
      filename: `The.General.1926.${quality}.WEB-DL.AVC.mp4`,
      videoSize: index === 0 ? 1503238554 : 805306368,
    },
  }),
  score: 100 - index,
  reasons: [],
  tier: quality,
}));

export function PickerLayoutPreview({ layout }: { layout: "condensed" | "stremio" }) {
  const t = useT();
  const frameRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const streams = SAMPLE_STREAMS.map((stream) => ({ ...stream, addonName: t("Source") }));

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const stage = stageRef.current;
    if (!frame || !stage) return;
    const measure = () => {
      const width = frame.clientWidth - 8;
      const height = frame.clientHeight - 8;
      if (width <= 0 || height <= 0 || stage.offsetWidth <= 0 || stage.scrollHeight <= 0) return;
      setScale(Math.min(1, width / stage.offsetWidth, height / stage.scrollHeight));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  return (
    <figure className="w-[340px] max-w-full">
      <figcaption className="mb-2 flex items-center justify-between gap-3 text-[12px] leading-5 text-ink-subtle">
        <span>{t("Preview")}</span>
        <span dir="ltr">{SETTINGS_SAMPLE_META.name}</span>
      </figcaption>
      <div
        ref={frameRef}
        inert
        aria-hidden="true"
        data-tv-skip=""
        className="pointer-events-none relative h-[184px] overflow-hidden rounded-xl border border-edge-soft bg-canvas/40"
      >
        <div
          ref={stageRef}
          className="absolute left-1/2 top-1/2 w-[800px]"
          style={{ transform: `translate(-50%, -50%) scale(${scale})` }}
        >
          {layout === "condensed" ? (
            <div className="flex flex-col gap-5">
              <PrimaryCard
                meta={SETTINGS_SAMPLE_META}
                stream={streams[0]}
                debrids={[]}
                addonLogo={null}
                onPlay={NOOP}
                onCache={NOOP}
                resolving={false}
                queued={false}
                inSession={false}
              />
              <div className="flex gap-2.5 px-7 pb-5">
                {streams.map((stream, index) => (
                  <div
                    key={stream.resolution}
                    className={`flex min-h-[56px] items-center gap-3 rounded-lg border px-4 py-2.5 ${
                      index === 0 ? "border-ink/35 bg-ink/[0.05]" : "border-edge-soft"
                    }`}
                  >
                    <FormatBadge kind={index === 0 ? "1080p" : "720p"} size="lg" />
                    <div className="flex flex-col gap-0.5 text-[12.5px] font-semibold text-ink-muted">
                      <span>{stream.resolution}</span>
                      <span className="text-[12px] text-ink-subtle">{formatSize(stream.size!)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 p-3">
              {streams.map((stream) => (
                <StremioRow
                  key={stream.resolution}
                  stream={stream}
                  failed={false}
                  addonLogo={null}
                  onPlay={NOOP}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </figure>
  );
}
