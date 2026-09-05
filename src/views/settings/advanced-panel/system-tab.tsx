import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { Section, Segmented } from "../shared";
import { TrayRow } from "../tray-row";
import { DownloadsSection } from "../player-panel";
import { DesktopOnlyBlock, isTauri } from "../player-panel/internals";

type GfxBackend = "auto" | "d3d11" | "opengl" | "vulkan" | "software";

export function SystemTab() {
  const t = useT();
  const { settings, update } = useSettings();
  const isWindows = typeof navigator !== "undefined" && navigator.userAgent.includes("Windows");
  return (
    <>
      <Section
        title={t("Downloads")}
        subtitle={t(
          "Where Harbor saves videos when you hit Download in the player. Pick any folder, including one on a different drive.",
        )}
      >
        {isTauri ? (
          <DownloadsSection />
        ) : (
          <div data-tv-skip="">
            <DesktopOnlyBlock>
              <DownloadsSection />
            </DesktopOnlyBlock>
          </div>
        )}
      </Section>

      {isTauri && (
        <Section
          title={t("System tray")}
          subtitle={t(
            "Keep Harbor a click away. Close it to the system tray instead of quitting, and control it from the tray menu. These also mirror into the tray menu live.",
          )}
        >
          <TrayRow />
        </Section>
      )}
      {isTauri && isWindows && (
        <Section
          title={t("Graphics")}
          subtitle={t(
            "How Harbor draws its own interface. Leave this on Automatic unless the app itself stutters, flickers or tears while scrolling, which some G-SYNC and high refresh rate setups do. Switching backends usually settles it. This does not affect video playback.",
          )}
        >
          <Segmented<GfxBackend>
            value={settings.uiGraphicsBackend}
            options={[
              { value: "auto", label: t("Automatic") },
              { value: "d3d11", label: t("Direct3D") },
              { value: "opengl", label: t("OpenGL") },
              { value: "vulkan", label: t("Vulkan") },
              { value: "software", label: t("Software") },
            ]}
            onChange={(uiGraphicsBackend) => update({ uiGraphicsBackend })}
            label={t("Rendering backend")}
            sub={t("Takes effect the next time Harbor starts.")}
          />
        </Section>
      )}

    </>
  );
}
