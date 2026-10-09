import { Film } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import { useT } from "@/lib/i18n";
import { endVoyage } from "@/lib/voyage/store";

export function CompletePanel({ total }: { total: number }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-edge bg-canvas/30 px-6 py-10 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-md bg-accent/12 text-accent">
        <Film size={24} strokeWidth={1.9} />
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <span className="text-[16px] font-semibold text-ink">{t("Voyage complete")}</span>
        <span className="text-[13px] leading-relaxed text-ink-subtle">
          {t("You saw the whole run through.")} {total}{" "}
          {t("films, start to finish. Start another whenever you like.")}
        </span>
      </div>
      <button
        type="button"
        onClick={endVoyage}
        className="mt-1 flex h-10 items-center rounded-full bg-ink px-5 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90"
      >
        {t("Start another")}
      </button>
    </div>
  );
}

export function ExhaustedPanel({ picked, onStart }: { picked: number; onStart: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-edge bg-canvas/30 px-6 py-9 text-center">
      <span className="text-[13.5px] text-ink-muted">
        {picked > 0
          ? t("No more films to add. Start with what you picked.")
          : t("You've sailed these waters dry.")}
      </span>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {picked > 0 && (
          <button
            type="button"
            onClick={onStart}
            className="flex h-9 items-center gap-2 rounded-full bg-ink px-5 text-[12.5px] font-semibold text-canvas transition-[opacity,transform] hover:opacity-90 active:scale-[0.97]"
          >
            <Play size={13} strokeWidth={2.4} fill="currentColor" />{" "}
            {t("Start with these {count}", { count: picked })}
          </button>
        )}
        <button
          type="button"
          onClick={endVoyage}
          className="flex h-9 items-center rounded-full border border-edge-soft px-4 text-[12.5px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink"
        >
          {t("Wrap up here")}
        </button>
      </div>
    </div>
  );
}
