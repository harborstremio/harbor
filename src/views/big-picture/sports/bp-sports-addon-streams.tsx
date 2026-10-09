import { type RefObject } from "react";
import { ArrowLeft, ExternalLink, Loader2, Play } from "lucide-react";
import { SFX } from "@/lib/sfx";
import { useBpT } from "../bp-i18n";
import type { BpSportsAddonPick } from "./bp-sports-addon-play";
import {
  BP_ADDON_CELL,
  BP_ADDON_CHIP,
  BP_ADDON_FLUSH,
  BP_ADDON_LIFT,
  BP_ADDON_NOTE,
  BP_ADDON_SPIN,
  BP_ADDON_SUB,
  BP_ADDON_TITLE,
  BpSportsAddonMark,
} from "./bp-sports-addon-parts";

const LIST =
  "-mx-[16px] flex flex-col gap-[clamp(7px,0.8vh,13px)] overflow-y-auto px-[16px] py-[clamp(12px,1.4vh,20px)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export function BpSportsAddonStreams({
  pick,
  seedRef,
}: {
  pick: BpSportsAddonPick;
  seedRef: RefObject<HTMLButtonElement | null>;
}) {
  const t = useBpT();
  const { picked, streams, pending, playing, error } = pick;
  if (!picked) return null;

  const note = pending
    ? t("Checking addon streams…")
    : error === "stream"
      ? t("Could not start this stream. Choose another source.")
      : error === "listing"
        ? t("Could not load the streams for this addon listing.")
        : streams.length === 0
          ? t("No streams returned. The event may not be available yet.")
          : "";

  return (
    <>
      <div className="flex min-w-0 items-center gap-[clamp(12px,1.1vw,22px)]">
        <BpSportsAddonMark src={picked.addon.manifest.logo} />
        <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span className={BP_ADDON_TITLE}>{picked.meta.name}</span>
          <span className={BP_ADDON_SUB}>{picked.addon.manifest.name}</span>
        </span>
      </div>

      {note !== "" && (
        <p
          role="status"
          className={`flex items-center gap-[clamp(8px,0.7vw,14px)] ${BP_ADDON_NOTE}`}
        >
          {pending && <Loader2 size={20} strokeWidth={2.3} className={BP_ADDON_SPIN} />}
          {note}
        </p>
      )}

      <div data-bp-scroll-y data-bp-center className={LIST}>
        {streams.map((stream, index) => {
          const external = !stream.url && (stream.externalUrl || stream.ytId);
          const busy = playing === index;
          return (
            <button
              key={`${stream.addonId}:${index}`}
              ref={index === 0 ? seedRef : undefined}
              type="button"
              data-bp-focusable
              data-bp-tile="wide"
              data-bp-disabled={playing !== null && !busy ? "true" : undefined}
              style={BP_ADDON_LIFT}
              onClick={() => {
                if (playing !== null) return;
                SFX.click();
                pick.play(stream, index);
              }}
              className={BP_ADDON_CELL}
            >
              {busy ? (
                <Loader2 size={24} strokeWidth={2.3} className={`shrink-0 ${BP_ADDON_SPIN}`} />
              ) : external ? (
                <ExternalLink size={24} strokeWidth={2.3} className="shrink-0" />
              ) : (
                <Play size={24} strokeWidth={2.3} className="shrink-0" />
              )}
              <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <span className={BP_ADDON_TITLE}>
                  {stream.name || stream.addonName || t("Play stream")}
                </span>
                <span className={BP_ADDON_SUB}>
                  {stream.title || stream.description || stream.addonName}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div
        data-bp-row
        data-bp-scroll-x
        style={BP_ADDON_FLUSH}
        className="flex shrink-0 gap-[clamp(9px,0.9vw,16px)] overflow-x-auto py-[26px] -my-[26px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <button
          type="button"
          data-bp-focusable
          data-bp-chip
          ref={streams.length === 0 ? seedRef : undefined}
          onClick={() => {
            SFX.close();
            pick.back();
          }}
          className={`${BP_ADDON_CHIP} flex items-center justify-center gap-[clamp(8px,0.7vw,14px)]`}
        >
          <ArrowLeft size={20} strokeWidth={2.3} />
          <span>{t("Back")}</span>
        </button>
      </div>
    </>
  );
}
