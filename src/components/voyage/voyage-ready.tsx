import { Flag } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import { useT } from "@/lib/i18n";
import { endVoyage } from "@/lib/voyage/store";
import type { Voyage } from "@/lib/voyage/types";

export function VoyageReady({ voyage, onStart }: { voyage: Voyage; onStart: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-3.5 rounded-lg bg-canvas/40 px-6 py-9 text-center ring-1 ring-inset ring-edge-soft">
      <span
        className="grid h-14 w-14 place-items-center rounded-md"
        style={{
          background: `color-mix(in oklch, ${voyage.accent}, transparent 88%)`,
          color: voyage.accent,
        }}
      >
        <Play size={22} strokeWidth={2} fill="currentColor" />
      </span>
      <span className="text-[16px] font-semibold text-ink">{t("Your voyage is ready")}</span>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={onStart}
          className="flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-[13px] font-semibold text-canvas transition-[opacity,transform] hover:opacity-90 active:scale-[0.97]"
        >
          <Play size={14} strokeWidth={2.4} fill="currentColor" /> {t("Start voyage")}
        </button>
        <button
          type="button"
          onClick={endVoyage}
          className="flex h-10 items-center gap-1.5 rounded-full border border-edge-soft px-4 text-[12.5px] font-semibold text-ink-muted transition-colors hover:border-danger/40 hover:text-danger"
        >
          <Flag size={13} strokeWidth={2.2} /> {t("Start over")}
        </button>
      </div>
    </div>
  );
}
