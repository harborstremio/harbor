import { AdSkipIcon } from "@/components/icons/adskip-icon";
import { submitAdReport, type AdRange } from "@/lib/ad-report/submit";
import { withinAdWindow } from "@/lib/ad-report/window";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { usePlaybackPosition } from "@/lib/player/playback-clock";
import { useSettings } from "@/lib/settings";
import { activeSegment, type SkipSegment } from "@/lib/skip-intro";
import { sourceKey } from "@/lib/skip-intro/fingerprint";
import type { PlayerSrc } from "@/lib/view";
import { shouldShowAdReport } from "@/views/player/should-show-adreport";
import { nextEpisodeLead } from "@/views/player/skip-pill-container";
import { useState } from "react";

import { AdReportFirstTip } from "./ad-report-first-tip";
import { AdReportModal } from "./ad-report-modal";

export function AdReportButton({
  meta,
  src,
  visible,
  skipSegments,
  durationSec,
  hasNextEp,
}: {
  meta: Meta;
  src: PlayerSrc;
  visible: boolean;
  skipSegments: SkipSegment[];
  durationSec: number;
  hasNextEp: boolean;
}) {
  const { settings, update } = useSettings();
  const t = useT();
  const [open, setOpen] = useState(false);
  const positionSec = usePlaybackPosition();

  const source = sourceKey(src.streamRef, src.url);
  const isDirectStream = !!src.isLive || source.startsWith("u_");
  const show = shouldShowAdReport({
    enabled: settings.adSkipEnabled,
    alwaysShow: settings.adReportAlwaysShow,
    isDirectStream,
    recentRelease: withinAdWindow(meta),
  });
  if (!show) return null;

  const leadSec = nextEpisodeLead(settings.nextEpisodeLeadSec, durationSec);
  const remainingSec = durationSec - positionSec;
  const pillInSlot =
    !!activeSegment(skipSegments, positionSec) ||
    (hasNextEp && leadSec > 0 && remainingSec > 0 && remainingSec <= leadSec);
  const buttonVisible = visible && !pillInSlot;

  const dismissTip = () => {
    if (!settings.adReportFirstSeen) update({ adReportFirstSeen: true });
  };
  const openModal = () => {
    dismissTip();
    setOpen(true);
  };
  const onSubmit = (ranges: AdRange[]) =>
    submitAdReport({
      metaId: meta.id,
      imdbId: src.imdbId ?? null,
      streamRef: src.streamRef,
      url: src.url,
      ranges,
    });

  return (
    <>
      <div
        className={`absolute end-7 bottom-40 z-30 transition-opacity duration-200 ${
          buttonVisible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="relative">
          {!settings.adReportFirstSeen && <AdReportFirstTip onDismiss={dismissTip} />}
          <button
            type="button"
            onClick={openModal}
            aria-label={t("Report an injected ad")}
            title={t("Report an injected ad")}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/65 text-white/90 shadow-[0_14px_40px_-15px_rgba(0,0,0,0.85)] backdrop-blur-md transition-colors hover:bg-black/85 hover:text-white"
          >
            <AdSkipIcon className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
      <AdReportModal open={open} onClose={() => setOpen(false)} onSubmit={onSubmit} />
    </>
  );
}
