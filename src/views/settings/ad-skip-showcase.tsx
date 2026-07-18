import adskipVideo from "@/assets/adskip.mp4";
import { useT } from "@/lib/i18n";

export function AdSkipShowcase() {
  const t = useT();
  return (
    <div className="overflow-hidden rounded-2xl border border-edge-soft bg-black/50 shadow-[0_10px_34px_-14px_rgba(0,0,0,0.7)]">
      <video src={adskipVideo} autoPlay loop muted playsInline className="block w-full" />
      <div className="flex items-center gap-2 border-t border-edge-soft/60 px-4 py-2.5">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
        <span className="text-[11.5px] text-ink-muted">
          {t("When a flagged ad plays, a Skip button slides in so you jump straight past it.")}
        </span>
      </div>
    </div>
  );
}
