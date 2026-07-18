import { ArrowLeft, ListVideo, RadioTower, RotateCcw } from "lucide-react";
import { useT } from "@/lib/i18n";

export function LiveChannelError({
  channelName,
  onBack,
  onRetry,
  onBrowse,
}: {
  channelName: string;
  onBack: () => void;
  onRetry: () => void;
  onBrowse?: () => void;
}) {
  const t = useT();
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/85 backdrop-blur-md">
      <div className="flex max-w-xl flex-col items-center gap-5 px-8 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-400/15 text-rose-200">
          <RadioTower size={26} strokeWidth={1.8} />
        </span>
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-[24px] font-semibold text-white">
            {t("This channel isn't responding")}
          </h2>
          <p className="text-[13.5px] leading-relaxed text-white/70">{channelName}</p>
          <p className="mx-auto max-w-md text-[13px] leading-relaxed text-white/55">
            {t(
              "It looks offline right now. Free playlists often include channels that have gone dark, so another one is usually a click away.",
            )}
          </p>
        </div>
        <div className="flex items-center gap-2.5 pt-2">
          <button
            onClick={onBack}
            className="flex h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 text-[13px] font-medium text-white/75 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft size={14} strokeWidth={2} className="dir-icon" />
            {t("Back")}
          </button>
          <button
            onClick={onRetry}
            className="flex h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 text-[13px] font-medium text-white/75 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white"
          >
            <RotateCcw size={14} strokeWidth={2} />
            {t("Try again")}
          </button>
          {onBrowse && (
            <button
              onClick={onBrowse}
              className="flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-[13px] font-semibold text-black transition-colors hover:bg-white/85"
            >
              <ListVideo size={15} strokeWidth={2.2} />
              {t("Browse channels")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
