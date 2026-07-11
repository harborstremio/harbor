import { useT } from "@/lib/i18n";
import { Captions, CaptionsOff, Loader2, Scissors, X } from "lucide-react";

export function ClipChooser({
  open,
  saving,
  onPick,
  onClose,
}: {
  open: boolean;
  saving: boolean;
  onPick: (withSubs: boolean) => void;
  onClose: () => void;
}) {
  const t = useT();
  if (saving) {
    return (
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2">
        <div className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-white/15 bg-black/85 px-4 py-2.5 text-[13px] font-medium text-white backdrop-blur-xl">
          <Loader2 size={15} strokeWidth={2.2} className="animate-spin text-white/80" />
          {t("Saving clip…")}
        </div>
      </div>
    );
  }
  if (!open) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2 animate-[harbor-fade-in_160ms_ease-out]">
      <div className="pointer-events-auto flex flex-col gap-3.5 rounded-2xl border border-white/15 bg-black/85 p-5 text-white backdrop-blur-xl shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)]">
        <div className="flex items-center gap-2">
          <Scissors size={15} strokeWidth={2.2} className="text-white/80" />
          <span className="text-[13.5px] font-semibold">{t("Save the last 30 seconds")}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Cancel")}
            className="ms-2 flex h-6 w-6 items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={13} strokeWidth={2.2} />
          </button>
        </div>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => onPick(true)}
            className="flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[13.5px] font-semibold text-black transition-transform hover:scale-[1.03] active:scale-[0.98]"
          >
            <Captions size={16} strokeWidth={2.2} />
            {t("With subtitles")}
          </button>
          <button
            type="button"
            onClick={() => onPick(false)}
            className="flex h-11 items-center gap-2 rounded-full bg-white/15 px-5 text-[13.5px] font-semibold text-white transition-colors hover:bg-white/25"
          >
            <CaptionsOff size={16} strokeWidth={2.2} />
            {t("Without subtitles")}
          </button>
        </div>
      </div>
    </div>
  );
}
