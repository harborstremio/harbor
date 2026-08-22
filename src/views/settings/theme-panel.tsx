import { Moon, PanelTop } from "lucide-react";
import { useSettings } from "@/lib/settings";
import { type ThemeSettings } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { Section, Segmented, ToggleRow } from "./shared";
import { SeekBarPanel } from "./player-panel";
import { BackgroundPicker } from "./theme-panel/background-picker";
import { ColorThemeBody } from "./theme-panel/color-theme-body";
import { CustomThemesSection } from "./theme-panel/custom-themes-section";
import { DisplaySection } from "./theme-panel/display-section";
import { FontGrid } from "./theme-panel/font-grid";
import { LogoPicker } from "./theme-panel/logo-picker";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function ThemePanel() {
  const t = useT();
  const { settings, update } = useSettings();
  const theme = settings.theme;

  const setTheme = (patch: Partial<ThemeSettings>) => {
    update({ theme: { ...theme, ...patch } });
  };

  return (
    <>
      <Section
        title={t("Theme")}
        subtitle={t("Pick a look. Every color and surface updates instantly.")}
      >
        <ColorThemeBody
          activePreset={theme.preset}
          fontPair={theme.fontPair}
          customColors={theme.customColors}
          onSelect={(id) => setTheme({ preset: id })}
          onSaveCustom={(c) => setTheme({ preset: "custom", customColors: c })}
          onClearCustom={() =>
            setTheme({
              customColors: null,
              preset: theme.preset === "custom" ? "cool-grey" : theme.preset,
            })
          }
        />
      </Section>

      <Section
        title={t("Background image")}
        subtitle={t("Drop a wallpaper behind the app. The dim slider keeps text readable.")}
      >
        <BackgroundPicker
          imageData={theme.backgroundImage}
          dim={theme.backgroundDim}
          onImageChange={(d) => setTheme({ backgroundImage: d })}
          onDimChange={(d) => setTheme({ backgroundDim: d })}
        />
      </Section>

      <Section
        title={t("Logo & app icon")}
        subtitle={t("Make Harbor yours: swap the sidebar logo and the window/taskbar icon.")}
      >
        <LogoPicker />
      </Section>

      <Section
        title={t("Typography")}
        subtitle={t(
          "Pick a display and body pairing, or upload your own font to use across Harbor.",
        )}
      >
        <FontGrid
          pairValue={theme.fontPair}
          customValue={theme.customFontId ?? null}
          onPickPair={(f) => setTheme({ fontPair: f, customFontId: null })}
          onPickCustom={(id) => setTheme({ customFontId: id })}
        />
      </Section>

      <Section
        title={t("Your themes")}
        subtitle={t("Make your own in the Theme Studio, or import one a friend shared.")}
      >
        <CustomThemesSection />
      </Section>

      <DisplaySection />

      <AmbientScreensaverSection />

      <Section
        title={t("Seek bar")}
        subtitle={t(
          "Style the timeline at the bottom of the player. Swap the dot for a sticker, change the bar height, recolor it. Settings live-preview right here.",
        )}
      >
        <SeekBarPanel />
      </Section>

      {isTauri && (
        <Section
          title={t("Window title bar")}
          subtitle={t(
            "Use your operating system's native title bar and window buttons instead of Harbor's built-in ones. Handy if the in-app buttons ever feel out of reach, like during playback.",
          )}
        >
          <NativeTitleBarRow />
        </Section>
      )}
    </>
  );
}

function AmbientScreensaverSection() {
  const t = useT();
  const { settings, update } = useSettings();
  const delay = String(settings.screensaverDelayMin || 5);

  return (
    <Section
      title={t("Ambient screensaver")}
      subtitle={t(
        "Show a quiet clock and rotating artwork when Harbor has been left idle. Playback and media selection always keep it off.",
      )}
    >
      <ToggleRow
        label={t("Start the ambient screensaver")}
        sub={t("Any pointer, keyboard, wheel, or touch activity dismisses it immediately.")}
        value={settings.screensaver}
        onChange={(screensaver) => update({ screensaver })}
        leading={
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Moon size={16} strokeWidth={2.2} />
          </span>
        }
      />
      {settings.screensaver && (
        <div className="flex flex-col gap-2 px-1">
          <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
            {t("Start after")}
          </span>
          <Segmented
            value={delay}
            options={[
              { value: "1", label: "1 minute" },
              { value: "5", label: "5 minutes" },
              { value: "10", label: "10 minutes" },
              { value: "15", label: "15 minutes" },
              { value: "30", label: "30 minutes" },
            ]}
            onChange={(value) => update({ screensaverDelayMin: Number(value) })}
          />
        </div>
      )}
    </Section>
  );
}

function NativeTitleBarRow() {
  const t = useT();
  const { settings, update } = useSettings();
  const on = settings.useNativeTitleBar;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-edge-soft bg-canvas/40 px-4 py-3.5">
      <span
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          on ? "bg-accent/15 text-accent" : "bg-raised text-ink-subtle"
        }`}
      >
        <PanelTop size={15} strokeWidth={2.2} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[14px] font-medium text-ink">
          {t("Use the native window title bar")}
        </span>
        <p className="text-[12.5px] leading-relaxed text-ink-subtle">
          {t(
            "Show your operating system's own title bar with its minimize, maximize, and close buttons. They stay reachable everywhere, including while a video is playing. Turn this off to use Harbor's built-in window buttons.",
          )}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => update({ useNativeTitleBar: !on })}
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
  );
}
