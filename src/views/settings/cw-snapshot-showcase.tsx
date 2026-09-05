import { Camera } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useSettingsPreviewArt } from "@/lib/settings-preview-art";
import { PreviewImage } from "./preview-image";

export function CwSnapshotShowcase() {
  const t = useT();
  const art = useSettingsPreviewArt();
  const still = art?.stills?.[0];
  return (
    <div className="flex items-center gap-4 rounded-md border border-edge-soft bg-canvas/30 p-4">
      <div className="relative aspect-video w-44 shrink-0 overflow-hidden rounded-md ring-1 ring-edge-soft/60">
        {still ? (
          <PreviewImage src={still} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-elevated to-canvas" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/20" />
        <span className="absolute start-2 top-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-white backdrop-blur-sm">
          <Camera size={9} strokeWidth={2.4} /> {t("Saved frame")}
        </span>
        <div className="absolute inset-x-2 bottom-2.5">
          <div className="text-[11px] font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            {t("The Last Stand")}
          </div>
          <div className="font-mono text-[9px] text-white/75">31:42</div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/25">
          <div className="h-full w-[62%] bg-accent" />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[16.5px] font-medium leading-[24px] tracking-[-0.1px] text-ink">{t("Picks up right where you left off")}</div>
        <p className="mt-1 max-w-[66ch] text-[15.5px] leading-[22px] text-ink-muted">
          {t("Back out mid-episode and the card keeps the exact frame you stopped on, with your progress, so it looks like a pause instead of a thumbnail.")}
        </p>
      </div>
    </div>
  );
}
