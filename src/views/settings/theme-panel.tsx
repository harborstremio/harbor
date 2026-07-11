import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { type ThemeSettings } from "@/lib/theme";
import { PanelTop } from "lucide-react";

import { SeekBarPanel } from "./player-panel";
import { Section } from "./shared";
import { BackgroundPicker } from "./theme-panel/background-picker";
import { ColorThemeBody } from "./theme-panel/color-theme-body";
import { CustomThemesSection } from "./theme-panel/custom-themes-section";
import { DisplaySection } from "./theme-panel/display-section";
import { FontGrid } from "./theme-panel/font-grid";

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
      <Section title={t("Theme")} subtitle={t("Pick a look. Every color and surface updates instantly.")}>
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
        title={t("Typography")}
        subtitle={t("Pick a display and body pairing, or upload your own font to use across Harbor.")}
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
        <span className="text-[14px] font-medium text-ink">{t("Use the native window title bar")}</span>
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
