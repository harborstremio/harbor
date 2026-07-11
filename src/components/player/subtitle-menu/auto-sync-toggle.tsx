import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { Wand2 } from "lucide-react";

import { Tooltip } from "../transport/tooltip";

export function AutoSyncToggle() {
  const tr = useT();
  const { settings, update } = useSettings();
  const on = settings.subtitleAutoSync;
  return (
    <Tooltip label={tr("Auto-sync subtitles to the audio (experimental)")} side="bottom" align="end">
      <button
        type="button"
        onClick={() => update({ subtitleAutoSync: !on })}
        aria-label={tr("Auto-sync subtitles")}
        aria-pressed={on}
        className={`relative flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
          on ? "bg-accent/20 text-accent" : "text-ink-muted hover:bg-raised hover:text-ink"
        }`}
      >
        <Wand2 size={16} strokeWidth={2} />
      </button>
    </Tooltip>
  );
}
