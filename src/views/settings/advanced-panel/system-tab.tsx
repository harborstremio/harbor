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
          "Choose where videos and eBooks are saved, and how their folders are organized.",
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
          title={t("Window behavior")}
          subtitle={t(
            "Choose what happens when you close, minimize, or switch away from Harbor.",
          )}
        >
          <TrayRow />
        </Section>
      )}
      {isTauri && isWindows && (
        <Section
          title={t("Graphics")}
          subtitle={t(
            "Leave this on Automatic unless Harbor's interface flickers or stutters. This controls the app window, not video playback.",
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
