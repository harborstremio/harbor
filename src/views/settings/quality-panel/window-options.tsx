import { Maximize2, Move } from "../icons";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { normalizeFullscreenMode, type FullscreenMode } from "@/lib/fullscreen-state";
import { SettingGroup, SettingRow } from "../kit";
import { Segmented, ToggleRow } from "../shared";
import { Anchored, Nested } from "../player-panel/choice";
import { FullscreenPreview } from "../fullscreen-preview";
import { VolumeHudPreview } from "../player-panel/volume-hud-preview";

export function PlayerWindowOptions() {
  const { settings, update } = useSettings();
  const t = useT();
  return (
    <div className="flex flex-col gap-9">
      <SettingGroup label={t("Fullscreen")}>
        <Anchored id="set-what-fullscreen-does">
          <Anchored id="set-fullscreen-mode">
            <SettingRow
              wide
              icon={<Maximize2 size={18} />}
              label={t("What fullscreen does")}
              desc={t(
                "True fullscreen covers the whole screen and hides the taskbar, but switching apps can flicker. Borderless window covers the same area with a frameless window, so alt-tab and overlays stay instant. Maximize fills the screen but keeps the taskbar and title bar.",
              )}
            >
              <div className="flex w-full flex-wrap items-start justify-between gap-x-6 gap-y-3">
                <Segmented<FullscreenMode>
                  value={normalizeFullscreenMode(settings.fullscreenMode)}
                  options={[
                    { value: "fullscreen", label: t("True fullscreen") },
                    { value: "borderless", label: t("Borderless window") },
                    { value: "maximized", label: t("Maximize") },
                  ]}
                  onChange={(mode) =>
                    update({ fullscreenMode: mode as typeof settings.fullscreenMode })
                  }
                />
                <FullscreenPreview mode={normalizeFullscreenMode(settings.fullscreenMode)} />
              </div>
            </SettingRow>
          </Anchored>
        </Anchored>
        <ToggleRow
          label={t("Stay in fullscreen after closing the player")}
          sub={t(
            "When you exit playback, keep the window fullscreen instead of dropping back to a window. Turn off to leave fullscreen automatically whenever the player closes.",
          )}
          value={settings.keepFullscreenOnExit}
          onChange={(v) => update({ keepFullscreenOnExit: v })}
        />
        <ToggleRow
          label={t("Restore window position after fullscreen")}
          sub={t(
            "When you exit fullscreen, return the window to exactly where it was. Turn off to center it on screen instead.",
          )}
          value={settings.fullscreenRestorePosition}
          onChange={(v) => update({ fullscreenRestorePosition: v })}
        />
      </SettingGroup>

      <SettingGroup label={t("Overlay")}>
        <ToggleRow
          label={t("Volume pop-up while watching")}
          sub={t(
            "Show a quick volume overlay when you change volume with the player controls hidden, so keyboard and scroll wheel changes are always visible.",
          )}
          value={settings.playerVolumeHud}
          onChange={(v) => update({ playerVolumeHud: v })}
        />
        {settings.playerVolumeHud && (
          <Nested>
            <SettingRow
              wide
              icon={<Move size={18} />}
              label={t("Pop-up position")}
              desc={t("Where the volume overlay appears on the video.")}
            >
              <div className="flex w-full flex-col gap-3">
                <Segmented
                  value={settings.playerVolumeHudPosition}
                  options={[
                    { value: "center", label: t("Center") },
                    { value: "top", label: t("Top") },
                    { value: "top-left", label: t("Top left") },
                    { value: "top-right", label: t("Top right") },
                  ]}
                  onChange={(playerVolumeHudPosition) => update({ playerVolumeHudPosition })}
                />
                <VolumeHudPreview position={settings.playerVolumeHudPosition} />
              </div>
            </SettingRow>
          </Nested>
        )}
      </SettingGroup>
    </div>
  );
}
