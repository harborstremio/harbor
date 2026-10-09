import { ImageDown } from "lucide-react";
import { useT } from "@/lib/i18n";

export function AvatarImportProgress({ done, total }: { done: number; total: number }) {
  const t = useT();
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 p-8">
      <span className="grid h-14 w-14 place-items-center rounded-[16px] bg-elevated text-accent ring-1 ring-edge-soft motion-safe:animate-pulse">
        <ImageDown size={24} strokeWidth={1.9} />
      </span>
      <div className="flex flex-col items-center gap-1">
        <span className="font-display text-[16px] font-semibold text-ink">{t("Preparing your images")}</span>
        <span className="text-[12.5px] tabular-nums text-ink-subtle">{t("{done} of {total}", { done, total })}</span>
      </div>
      <div className="h-1.5 w-[240px] overflow-hidden rounded-full bg-elevated">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function AvatarDropOverlay() {
  const t = useT();
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex animate-in fade-in items-center justify-center bg-canvas/90 duration-150">
      <div className="flex animate-in zoom-in-95 flex-col items-center gap-3 rounded-[16px] border-2 border-dashed border-accent/70 px-12 py-9 duration-200">
        <ImageDown size={30} strokeWidth={1.8} className="text-accent" />
        <span className="text-[14px] font-semibold text-ink">{t("Drop images to add them")}</span>
      </div>
    </div>
  );
}
