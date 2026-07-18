import { Minimize2 } from "lucide-react";
import { useSettings } from "@/lib/settings";

import { useT } from "@/lib/i18n";

function SubToggle({
  label,
  hint,
  on,
  onToggle,
}: {
  label: string;
  hint: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-edge-soft/60 bg-canvas/30 px-3.5 py-2.5">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[13px] font-medium text-ink">{label}</span>
        <span className="text-[11.5px] leading-snug text-ink-subtle">{hint}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={onToggle}
        className={`flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition-colors ${
          on ? "bg-accent" : "bg-raised"
        }`}
      >
        <span
          className={`h-4 w-4 rounded-full bg-canvas shadow-sm transition-transform ${
            on ? "translate-x-4 rtl:-translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

export function TrayRow() {
  const t = useT();
  const { settings, update } = useSettings();
  const on = settings.closeToTray;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-start gap-3 rounded-xl border border-edge-soft bg-canvas/40 px-4 py-3.5">
        <span
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            on ? "bg-accent/15 text-accent" : "bg-raised text-ink-subtle"
          }`}
        >
          <Minimize2 size={15} strokeWidth={2.2} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[14px] font-medium text-ink">{t("Close to the system tray")}</span>
          <p className="text-[12.5px] leading-relaxed text-ink-subtle">
            {t(
              "Closing the window tucks Harbor into the tray instead of quitting, so it reopens instantly. Right-click the tray icon for quick controls, or pick Quit to exit fully.",
            )}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          onClick={() => update({ closeToTray: !on })}
          className={`mt-1 flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors ${
            on ? "bg-accent" : "bg-raised"
          }`}
        >
          <span
            className={`h-5 w-5 rounded-full bg-canvas shadow-sm transition-transform ${
              on ? "translate-x-5 rtl:-translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>
      <div className="flex flex-col gap-1.5 ps-4">
        <SubToggle
          label={t("Always on top")}
          hint={t("Keep the Harbor window above other windows.")}
          on={settings.trayAlwaysOnTop}
          onToggle={() => update({ trayAlwaysOnTop: !settings.trayAlwaysOnTop })}
        />
        <SubToggle
          label={t("Pause when minimized")}
          hint={t("Stop playback when you minimize Harbor or send it to the tray.")}
          on={settings.pauseMinimized}
          onToggle={() => update({ pauseMinimized: !settings.pauseMinimized })}
        />
        <SubToggle
          label={t("Pause when unfocused")}
          hint={t("Stop playback whenever another window takes focus.")}
          on={settings.pauseUnfocused}
          onToggle={() => update({ pauseUnfocused: !settings.pauseUnfocused })}
        />
      </div>
    </div>
  );
}
