import { Move, PanelTop } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { getCustomThemes, subscribeCustomThemes } from "@/lib/custom-themes";
import { useSettings } from "@/lib/settings";
import { FEATURED_CUSTOM_THEMES, getThemeById, THEME_PRESETS, type ThemeSettings } from "@/lib/theme";
import { nextBackgroundImage } from "@/lib/theme-background";
import { useT } from "@/lib/i18n";
import { Section, Segmented, ToggleRow } from "./shared";
import { SettingGroup, SettingRow } from "./kit";
import { useSubTabs } from "./sub-tabs";
import { BackgroundPicker } from "./theme-panel/background-picker";
import { ColorThemeBody } from "./theme-panel/color-theme-body";
import { CustomThemesSection } from "./theme-panel/custom-themes-section";
import {
  consumeThemeLibraryRequest,
  requestThemeLibrary,
  subscribeThemeLibraryRequest,
  useThemeLibraryOpen,
} from "./theme-panel/library-open-store";
import { MarketCta } from "./theme-panel/custom-themes-section/community-store/market/market-cta";
import type { IconThumb } from "./theme-panel/custom-themes-section/community-store/market/icon-fan";
import { AmbienceSection, DisplaySection } from "./theme-panel/display-section";
import { FontGrid } from "./theme-panel/font-grid";
import { LogoPicker } from "./theme-panel/logo-picker";
import { HybridBarArt, TitleBarArt, WindowControlArt } from "./theme-panel/window-control-art";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type Tab = "theme" | "library" | "logo" | "type" | "interface" | "ambience" | "window";

export function ThemePanel() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("theme");
  const libraryOpen = useThemeLibraryOpen();
  const [themeCount, setThemeCount] = useState(() => getCustomThemes().length);
  useEffect(
    () => subscribeCustomThemes(() => setThemeCount(getCustomThemes().length)),
    [],
  );

  useEffect(() => {
    const req = consumeThemeLibraryRequest();
    if (req) {
      setTab("library");
      requestThemeLibrary(req);
    }
    return subscribeThemeLibraryRequest(() => setTab("library"));
  }, []);

  const tabs = [
    { id: "theme" as const, label: t("Theme") },
    { id: "library" as const, label: t("Your themes"), count: themeCount },
    { id: "logo" as const, label: t("Logo & icon") },
    { id: "type" as const, label: t("Typography") },
    { id: "interface" as const, label: t("Interface") },
    { id: "ambience" as const, label: t("Ambience") },
    ...(isTauri ? [{ id: "window" as const, label: t("Window") }] : []),
  ];

  const active: Tab = libraryOpen ? "library" : tab;

  useSubTabs(libraryOpen ? [] : tabs, tab, (id) => setTab(id as Tab));

  return (
    <>
      <div key={active} className="harbor-cascade flex flex-col gap-10">
        {active === "theme" && <ThemeTab />}
        {active === "library" && <LibraryTab />}
        {active === "logo" && <LogoTab />}
        {active === "type" && <TypographyTab />}
        {active === "interface" && <DisplaySection />}
        {active === "ambience" && <AmbienceSection />}
        {active === "window" && <WindowTab />}
      </div>
    </>
  );
}

function ThemeTab() {
  const t = useT();
  const { settings, update } = useSettings();
  const theme = settings.theme;

  const setTheme = (patch: Partial<ThemeSettings>) => {
    update({ theme: { ...theme, ...patch } });
  };

  return (
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
          onSelect={(id) =>
            setTheme({
              preset: id,
              backgroundImage: nextBackgroundImage(
                theme.backgroundImage,
                getThemeById(theme.preset),
                getThemeById(id),
              ),
            })
          }
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

    </>
  );
}

function LogoTab() {
  const t = useT();
  return (
    <Section title={t("Logo & app icon")}>
      <LogoPicker />
    </Section>
  );
}

function LibraryTab() {
  const t = useT();
  const libraryOpen = useThemeLibraryOpen();
  return (
    <Section
      title={t("Your themes")}
      subtitle={t("Make your own in the Theme Studio, or import one a friend shared.")}
      bare={libraryOpen}
    >
      <CustomThemesSection />
    </Section>
  );
}

function TypographyTab() {
  const t = useT();
  const { settings, update } = useSettings();
  const theme = settings.theme;

  const setTheme = (patch: Partial<ThemeSettings>) => {
    update({ theme: { ...theme, ...patch } });
  };

  return (
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
  );
}

function WindowTab() {
  const t = useT();
  const { settings } = useSettings();
  return (
    <>
      {isTauri && (
        <Section
          title={t("Window title bar")}
          subtitle={t("Use your operating system's native title bar and window buttons instead of Harbor's built-in ones. Handy if the in-app buttons ever feel out of reach, like during playback.")}
        >
          <SettingGroup>
            <NativeTitleBarRow />
          </SettingGroup>
          <SettingGroup label={t("Harbor's own bar")}>
            <HybridBarRow />
            <TopbarAppearanceRow />
            {settings.topbarAppearance !== "transparent" && <TopbarScrollBlurRow />}
          </SettingGroup>
        </Section>
      )}

      {isTauri && (
        <Section
          title={t("Moving the window")}
          subtitle={t("Choose where you can grab Harbor to drag it around your screen.")}
        >
          <SettingGroup>
            <DragAnywhereRow />
          </SettingGroup>
        </Section>
      )}
    </>
  );
}

const COMMUNITY_PREVIEW: IconThumb[] = [...FEATURED_CUSTOM_THEMES, ...Object.values(THEME_PRESETS)]
  .filter((tp) => tp.previewImage)
  .slice(0, 5)
  .map((tp) => ({ src: tp.previewImage, alt: tp.name }));

function ThemeCommunityCta() {
  const t = useT();
  return (
    <MarketCta
      variant="browse"
      label={t("Browse community themes")}
      sublabel={t("Fresh looks shared by the Harbor community")}
      preview={COMMUNITY_PREVIEW}
      onClick={() => requestThemeLibrary({ tab: "community" })}
    />
  );
}

function RowIcon({ on, children }: { on?: boolean; children: ReactNode }) {
  return (
    <span
      className={`flex h-9 w-9 items-center justify-center rounded-md ${
        on ? "bg-accent text-canvas" : "bg-raised text-ink-subtle"
      }`}
    >
      {children}
    </span>
  );
}

function NativeTitleBarRow() {
  const t = useT();
  const { settings, update } = useSettings();
  const on = settings.useNativeTitleBar;
  return (
    <ToggleRow
      label={t("Use the native window title bar")}
      sub={t("Show your operating system's own title bar with its minimize, maximize, and close buttons. They stay reachable everywhere, including while a video is playing. Turn this off to use Harbor's built-in window buttons.")}
      value={on}
      onChange={(useNativeTitleBar) => update({ useNativeTitleBar })}
      leading={<TitleBarArt native={on} on={on} />}
    />
  );
}

function HybridBarRow() {
  const t = useT();
  const { settings, update } = useSettings();
  const nativeOn = settings.useNativeTitleBar;
  const on = settings.hybridTitleBar && !nativeOn;
  return (
    <ToggleRow
      label={t("Native-style hybrid bar")}
      sub={t("Tuck clean, native-looking window buttons into the top corner, with hover labels. On macOS they become traffic-light dots. Blends into Harbor while feeling like your system's own title bar.")}
      lockReason={
        nativeOn
          ? t("Turn off the native window title bar above to use Harbor's hybrid bar instead.")
          : undefined
      }
      value={on}
      onChange={(hybridTitleBar) => update({ hybridTitleBar })}
      leading={<HybridBarArt on={on} />}
    />
  );
}

function TopbarScrollBlurRow() {
  const t = useT();
  const { settings, update } = useSettings();
  const on = settings.topbarScrollBlur;
  return (
    <ToggleRow
      label={t("Frost the top bar on scroll")}
      sub={t("As you scroll, the top bar frosts over the content beneath it. Off by default; it uses a blur, so leave it off on lower-end machines.")}
      value={on}
      onChange={(topbarScrollBlur) => update({ topbarScrollBlur })}
      leading={
        <RowIcon on={on}>
          <PanelTop size={16} strokeWidth={2.2} />
        </RowIcon>
      }
    />
  );
}

function TopbarAppearanceRow() {
  const t = useT();
  const { settings, update } = useSettings();
  const nativeOn = settings.useNativeTitleBar;
  const lockedNote = nativeOn
    ? t("The operating system draws native window controls, so Harbor cannot change their appearance.")
    : undefined;
  return (
    <SettingRow
      icon={<WindowControlArt style={settings.topbarAppearance} on={!nativeOn} />}
      label={t("Top-right controls")}
      lockReason={lockedNote}
      tip={t("Choose how Watch Together and the minimize, maximize, and close buttons look. Liquid glass replaces the clean transparent controls.")}
      desc={lockedNote ?? t("How Watch Together and the window buttons are drawn.")}
    >
      <div className={nativeOn ? "pointer-events-none" : ""}>
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
    </SettingRow>
  );
}

function DragAnywhereRow() {
  const t = useT();
  const { settings, update } = useSettings();
  const on = settings.dragAnywhere;
  return (
    <ToggleRow
      label={t("Drag the window from anywhere")}
      newId="theme:drag-anywhere"
      sub={t("Move Harbor by dragging any empty space on a page, not just the top bar. Leave this off to keep clicks inside pages from nudging the window.")}
      value={on}
      onChange={(dragAnywhere) => update({ dragAnywhere })}
      leading={
        <RowIcon on={on}>
          <Move size={16} strokeWidth={2.2} />
        </RowIcon>
      }
    />
  );
}
