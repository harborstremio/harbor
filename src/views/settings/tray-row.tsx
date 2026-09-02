import { Minimize2 } from "lucide-react";
import { useSettings } from "@/lib/settings";
import { ToggleRow } from "./shared";
import { SettingGroup } from "./kit";

import { useT } from "@/lib/i18n";

export function TrayRow() {
  const t = useT();
  const { settings, update } = useSettings();
  const on = settings.closeToTray;
  return (
    <SettingGroup>
      <ToggleRow
        label={t("Close to the system tray")}
        sub={t("Closing the window tucks Harbor into the tray instead of quitting, so it reopens instantly. Right-click the tray icon for quick controls, or pick Quit to exit fully.")}
        leading={
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-md ${
              on ? "bg-accent-soft text-accent" : "bg-raised text-ink-subtle"
            }`}
          >
            <Minimize2 size={16} strokeWidth={2.2} />
          </span>
        }
        value={on}
        onChange={(closeToTray) => update({ closeToTray })}
      />
      <ToggleRow
        label={t("Always on top")}
        sub={t("Keep the Harbor window above other windows.")}
        value={settings.trayAlwaysOnTop}
        onChange={(trayAlwaysOnTop) => update({ trayAlwaysOnTop })}
      />
      <ToggleRow
        label={t("Pause when minimized")}
        sub={t("Stop playback when you minimize Harbor or send it to the tray.")}
        value={settings.pauseMinimized}
        onChange={(pauseMinimized) => update({ pauseMinimized })}
      />
      <ToggleRow
        label={t("Pause when unfocused")}
        sub={t("Stop playback whenever another window takes focus.")}
        value={settings.pauseUnfocused}
        onChange={(pauseUnfocused) => update({ pauseUnfocused })}
      />
    </SettingGroup>
  );
}
