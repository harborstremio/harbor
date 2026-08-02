import { AppWindow, Move, PanelTop, Sparkles } from "lucide-react";
import { useSettings } from "@/lib/settings";
import { FEATURED_CUSTOM_THEMES, THEME_PRESETS, type ThemeSettings } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { Section, Segmented } from "./shared";
import { NewBadge } from "./new-badge";
import { BackgroundPicker } from "./theme-panel/background-picker";
import { ColorThemeBody } from "./theme-panel/color-theme-body";
import { CustomThemesSection } from "./theme-panel/custom-themes-section";
import { requestThemeLibrary, useThemeLibraryOpen } from "./theme-panel/library-open-store";
import { MarketCta } from "./theme-panel/custom-themes-section/community-store/market/market-cta";
import type { IconThumb } from "./theme-panel/custom-themes-section/community-store/market/icon-fan";
import { DisplaySection } from "./theme-panel/display-section";
import { FontGrid } from "./theme-panel/font-grid";
import { FullscreenClockSettings } from "./theme-panel/fullscreen-clock-settings";
import { LogoPicker } from "./theme-panel/logo-picker";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function ThemePanel() {
  const t = useT();
  const { settings, update } = useSettings();
  const theme = settings.theme;

  const setTheme = (patch: Partial<ThemeSettings>) => {
    update({ theme: { ...theme, ...patch } });
  };

  const libraryOpen = useThemeLibraryOpen();

  return (
    <>
      {!libraryOpen && (
        <>
      <ThemeCommunityCta />

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
        </>
      )}

      <Section
        title={t("Your themes")}
        subtitle={t("Make your own in the Theme Studio, or import one a friend shared.")}
        bare={libraryOpen}
      >
        <CustomThemesSection />
      </Section>

      {!libraryOpen && (
        <>
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

      <DisplaySection />

      {isTauri && (
        <Section
          title={t("Window title bar")}
          subtitle={t("Use your operating system's native title bar and window buttons instead of Harbor's built-in ones. Handy if the in-app buttons ever feel out of reach, like during playback.")}
        >
          <NativeTitleBarRow />
          <HybridBarRow />
          <TopbarAppearanceRow />
          {settings.topbarAppearance !== "transparent" && <TopbarScrollBlurRow />}
        </Section>
      )}

      {isTauri && (
        <Section
          title={t("Moving the window")}
          subtitle={t("Choose where you can grab Harbor to drag it around your screen.")}
        >
          <DragAnywhereRow />
        </Section>
      )}

      <Section
        title={t("Fullscreen clock")}
        subtitle={t("Keep your local time visible during fullscreen playback and choose how it looks.")}
      >
        <FullscreenClockSettings />
      </Section>

      <Section
        title={t("Logo & app icon")}
        subtitle={t("Make Harbor yours: swap the sidebar logo and the window/taskbar icon.")}
      >
        <LogoPicker />
      </Section>
        </>
      )}
    </>
  );
}

const COMMUNITY_PREVIEW: IconThumb[] = [...FEATURED_CUSTOM_THEMES, ...Object.values(THEME_PRESETS)]
  .filter((tp) => tp.previewImage)
  .slice(0, 5)
  .map((tp) => ({ src: tp.previewImage, alt: tp.name }));

function ThemeCommunityCta() {
  return (
    <MarketCta
      variant="browse"
      label="Browse community themes"
      sublabel="Fresh looks shared by the Harbor community"
      preview={COMMUNITY_PREVIEW}
      onClick={() => requestThemeLibrary({ tab: "community" })}
    />
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
          {t("Show your operating system's own title bar with its minimize, maximize, and close buttons. They stay reachable everywhere, including while a video is playing. Turn this off to use Harbor's built-in window buttons.")}
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

function HybridBarRow() {
  const t = useT();
  const { settings, update } = useSettings();
  const nativeOn = settings.useNativeTitleBar;
  const on = settings.hybridTitleBar && !nativeOn;
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border border-edge-soft bg-canvas/40 px-4 py-3.5 ${
        nativeOn ? "opacity-55" : ""
      }`}
    >
      <span
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          on ? "bg-accent/15 text-accent" : "bg-raised text-ink-subtle"
        }`}
      >
        <AppWindow size={15} strokeWidth={2.2} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[14px] font-medium text-ink">{t("Native-style hybrid bar")}</span>
        <p className="text-[12.5px] leading-relaxed text-ink-subtle">
          {nativeOn
            ? t("Turn off the native window title bar above to use Harbor's hybrid bar instead.")
            : t("Tuck clean, native-looking window buttons into the top corner, with hover labels. On macOS they become traffic-light dots. Blends into Harbor while feeling like your system's own title bar.")}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={nativeOn}
        onClick={() => update({ hybridTitleBar: !on })}
        className={`mt-1 flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors ${
          nativeOn ? "cursor-not-allowed bg-raised" : on ? "bg-accent" : "bg-raised"
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

function TopbarScrollBlurRow() {
  const t = useT();
  const { settings, update } = useSettings();
  const on = settings.topbarScrollBlur;
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
        <span className="text-[14px] font-medium text-ink">{t("Frost the top bar on scroll")}</span>
        <p className="text-[12.5px] leading-relaxed text-ink-subtle">
          {t("As you scroll, the top bar frosts over the content beneath it. Off by default; it uses a blur, so leave it off on lower-end machines.")}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => update({ topbarScrollBlur: !on })}
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

function TopbarAppearanceRow() {
  const t = useT();
  const { settings, update } = useSettings();
  const nativeOn = settings.useNativeTitleBar;
  return (
    <div className={`flex items-start gap-3 rounded-xl border border-edge-soft bg-canvas/40 px-4 py-3.5 ${nativeOn ? "opacity-55" : ""}`}>
      <span
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          nativeOn ? "bg-raised text-ink-subtle" : "bg-accent/15 text-accent"
        }`}
      >
        <Sparkles size={15} strokeWidth={2.2} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[14px] font-medium text-ink">{t("Top-right controls")}</span>
        <p className="text-[12.5px] leading-relaxed text-ink-subtle">
          {nativeOn
            ? t("The operating system draws native window controls, so Harbor cannot change their appearance.")
            : t("Choose how Watch Together and the minimize, maximize, and close buttons look. Liquid glass replaces the clean transparent controls.")}
        </p>
        <div className={nativeOn ? "pointer-events-none mt-2" : "mt-2"}>
          <Segmented
            value={settings.topbarAppearance}
            options={[
              { value: "transparent", label: t("Clean transparent") },
              { value: "glass", label: t("Liquid glass") },
              { value: "filled", label: t("Filled") },
            ]}
            onChange={(topbarAppearance) =>
              update({
                topbarAppearance,
                transparentTopBar: topbarAppearance === "transparent",
              })
            }
          />
        </div>
      </div>
    </div>
  );
}

function DragAnywhereRow() {
  const t = useT();
  const { settings, update } = useSettings();
  const on = settings.dragAnywhere;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-edge-soft bg-canvas/40 px-4 py-3.5">
      <span
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          on ? "bg-accent/15 text-accent" : "bg-raised text-ink-subtle"
        }`}
      >
        <Move size={15} strokeWidth={2.2} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-2">
          <span className="text-[14px] font-medium text-ink">{t("Drag the window from anywhere")}</span>
          <NewBadge id="theme:drag-anywhere" />
        </span>
        <p className="text-[12.5px] leading-relaxed text-ink-subtle">
          {t("Move Harbor by dragging any empty space on a page, not just the top bar. Leave this off to keep clicks inside pages from nudging the window.")}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => update({ dragAnywhere: !on })}
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
