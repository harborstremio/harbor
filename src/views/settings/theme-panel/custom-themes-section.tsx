import { AlertCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActiveBanner } from "./custom-themes-section/active-banner";
import { ExportBlock } from "./custom-themes-section/export-block";
import { HeroCards } from "./custom-themes-section/hero-cards";
import { LibraryBrowser } from "./custom-themes-section/library-browser";
import type { LibraryEntry } from "./custom-themes-section/library-grid";
import { ThemeStudio } from "./theme-studio";
import {
  getCustomThemes,
  parseThemeJson,
  removeCustomTheme,
  saveCustomTheme,
  subscribeCustomThemes,
  type CustomTheme,
} from "@/lib/custom-themes";
import { downloadText } from "@/lib/download-text";
import { nextBackgroundImage } from "@/lib/theme-background";
import {
  consumeThemeLibraryRequest,
  setThemeLibraryOpen,
  subscribeThemeLibraryRequest,
} from "./library-open-store";
import type { StoreTab } from "./custom-themes-section/community-store/store-tabs";
import { importForeignTheme } from "@/lib/theme-import";
import { isHarborStyleName, parseHarborStyle, serializeHarborStyle } from "@/lib/harborstyle";
import { useSettings } from "@/lib/settings";
import { pushActivityHint } from "@/lib/discord/activity-hint";
import {
  FEATURED_CUSTOM_THEMES,
  getThemeById,
  TEMPLATE_THEMES,
  THEME_PRESETS,
  type ActiveThemeId,
  type ThemePreset,
} from "@/lib/theme";
import { useT } from "@/lib/i18n";

export function CustomThemesSection() {
  const t = useT();
  const { settings, update } = useSettings();
  const [themes, setThemes] = useState<CustomTheme[]>(() => getCustomThemes());
  const [error, setError] = useState<string | null>(null);
  const [exportText, setExportText] = useState("");
  const [studioOpen, setStudioOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryTab, setLibraryTab] = useState<"library" | "community" | "mine">("library");
  const [libraryStoreTab, setLibraryStoreTab] = useState<StoreTab | undefined>(undefined);
  const [importedNotice, setImportedNotice] = useState<string | null>(null);
  const browsingActivity = t("Browsing the theme library");
  const localizeImportError = (message: string): string => {
    const missingColor = /^This theme is missing a color \((.+)\)\.$/.exec(message);
    if (missingColor) {
      return t("This theme is missing a color ({color}).", { color: missingColor[1] });
    }
    switch (message) {
      case "This file isn't a readable theme.":
        return t("This file isn't a readable theme.");
      case "This file isn't a Harbor theme.":
        return t("This file isn't a Harbor theme.");
      case "Theme is missing a name.":
        return t("Theme is missing a name.");
      case "This theme's preview colors look invalid.":
        return t("This theme's preview colors look invalid.");
      case "This theme is missing its colors.":
        return t("This theme is missing its colors.");
      case "This theme file is missing a name.":
        return t("This theme file is missing a name.");
      case "This theme file is missing its colors.":
        return t("This theme file is missing its colors.");
      default:
        return message;
    }
  };

  useEffect(() => subscribeCustomThemes(() => setThemes(getCustomThemes())), []);

  useEffect(() => {
    setThemeLibraryOpen(libraryOpen);
  }, [libraryOpen]);
  useEffect(() => () => setThemeLibraryOpen(false), []);

  const openLibrary = useCallback((tab: "library" | "community" | "mine", storeTab?: StoreTab) => {
    setLibraryTab(tab);
    setLibraryStoreTab(storeTab);
    setImportedNotice(null);
    setLibraryOpen(true);
  }, []);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (
        e as CustomEvent<{ tab?: "library" | "community" | "mine"; storeTab?: StoreTab }>
      ).detail;
      openLibrary(detail?.tab ?? "library", detail?.storeTab);
    };
    window.addEventListener("harbor:open-theme-library", onOpen);
    return () => window.removeEventListener("harbor:open-theme-library", onOpen);
  }, [openLibrary]);

  useEffect(() => {
    const apply = () => {
      const req = consumeThemeLibraryRequest();
      if (req) openLibrary(req.tab, req.storeTab);
    };
    apply();
    return subscribeThemeLibraryRequest(apply);
  }, [openLibrary]);

  useEffect(() => {
    if (!libraryOpen || studioOpen) return;
    return pushActivityHint({ details: browsingActivity });
  }, [libraryOpen, studioOpen, browsingActivity]);

  const activeId = settings.theme.preset;
  const activeTheme = activeId === "custom" ? null : getThemeById(activeId);

  const entries = useMemo(() => buildEntries(themes), [themes]);

  const activateTheme = (id: string, nav?: ThemePreset["navCustomization"]) => {
    const next = getThemeById(id);
    const bg = next?.background;
    const held = settings.navCustomizationOwn;
    const navPatch = nav
      ? {
          navCustomization: {
            order: nav.order ?? [],
            hidden: nav.hidden ?? [],
            renamed: nav.renamed ?? {},
          },
          navCustomizationOwn: held ?? settings.navCustomization,
        }
      : held
        ? { navCustomization: held, navCustomizationOwn: null }
        : {};
    update({
      theme: {
        ...settings.theme,
        preset: id as ActiveThemeId,
        backgroundImage: nextBackgroundImage(settings.theme.backgroundImage, activeTheme, next),
        ...(bg ? { backgroundDim: bg.dim ?? settings.theme.backgroundDim } : {}),
      },
      ...navPatch,
    });
  };

  const importFile = async (file: File) => {
    setError(null);
    try {
      const name = file.name.toLowerCase();
      if (name.endsWith(".zip") || file.type === "application/zip") {
        setError(t("Zipped themes aren't supported yet. Drop the theme file directly."));
        return;
      }
      const text = await file.text();
      let result = isHarborStyleName(file.name) ? parseHarborStyle(text) : parseThemeJson(text);
      if (!result.ok && !isHarborStyleName(file.name) && /(^|\n)\s*@tokens\b/.test(text)) {
        result = parseHarborStyle(text);
      }
      if (!result.ok) {
        const foreign = importForeignTheme(text, file.name);
        if (foreign.ok && foreign.themes.length > 0) {
          for (const t of foreign.themes) saveCustomTheme(t);
          const first = foreign.themes[0];
          setImportedNotice(
            foreign.themes.length > 1
              ? t("{name} +{count} more ({format})", {
                  name: first.name,
                  count: foreign.themes.length - 1,
                  format: foreign.format,
                })
              : t("{name} ({format})", { name: first.name, format: foreign.format }),
          );
          activateTheme(first.id, first.navCustomization);
          return;
        }
        setError(localizeImportError(result.error));
        return;
      }
      saveCustomTheme(result.theme);
      setImportedNotice(result.theme.name);
      activateTheme(result.theme.id, result.theme.navCustomization);
    } catch {
      setError(t("Could not read file"));
    }
  };

  const pickImportFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept =
      ".harborstyle,.json,.txt,.harbortheme.json,.yaml,.yml,.ini,.xml,application/json,text/plain";
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) importFile(f);
    };
    input.click();
  };

  const activate = (id: string) => activateTheme(id, getThemeById(id)?.navCustomization);

  const remove = (id: string) => {
    const wasActive = settings.theme.preset === id;
    const image = wasActive
      ? nextBackgroundImage(
          settings.theme.backgroundImage,
          getThemeById(id),
          getThemeById("cool-grey"),
        )
      : null;
    removeCustomTheme(id);
    if (wasActive) {
      update({ theme: { ...settings.theme, preset: "cool-grey", backgroundImage: image } });
    }
  };

  const showExport = (id: string) => {
    const preset = getThemeById(id);
    if (!preset) return;
    setExportText(serializeHarborStyle(preset));
  };

  const downloadThemeFile = async (id: string) => {
    const preset = getThemeById(id);
    if (!preset) return;
    const text = serializeHarborStyle(preset);
    const safeName = preset.name.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase() || "theme";
    await downloadText(`${safeName}.harborstyle`, text, ["harborstyle"]);
  };

  if (studioOpen) {
    return <ThemeStudio seed={activeTheme ?? undefined} onClose={() => setStudioOpen(false)} />;
  }

  if (libraryOpen) {
    return (
      <div className="flex flex-col gap-6">
        <LibraryBrowser
          entries={entries}
          activeId={activeId}
          onActivate={activate}
          onExport={showExport}
          onDownload={downloadThemeFile}
          onRemove={remove}
          onClose={() => setLibraryOpen(false)}
          initialTab={libraryTab}
          initialStoreTab={libraryStoreTab}
        />
        {exportText && <ExportBlock text={exportText} onClose={() => setExportText("")} />}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ActiveBanner
        theme={activeTheme}
        onExport={() => activeTheme && showExport(activeTheme.id)}
        onCustomize={() => window.dispatchEvent(new CustomEvent("harbor:open-theme-editor"))}
      />

      <HeroCards
        onOpenLibrary={() => {
          setImportedNotice(null);
          setLibraryTab("library");
          setLibraryOpen(true);
        }}
        onOpenStudio={() => setStudioOpen(true)}
        onImport={pickImportFile}
        libraryCount={entries.length}
        previewThemes={entries.slice(0, 10).map((e) => e.theme)}
        importedNotice={importedNotice}
      />

      {error && (
        <div className="flex flex-wrap items-start gap-2.5 rounded-[10px] border border-danger/40 bg-elevated px-4 py-3 text-[15.5px] leading-[22px] text-danger">
          <AlertCircle size={18} strokeWidth={2.2} className="mt-[2px] shrink-0" />
          <span className="max-w-[66ch] flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="-my-1 flex h-11 shrink-0 items-center rounded-[8px] px-3 text-[15.5px] font-semibold opacity-80 transition-opacity hover:opacity-100"
          >
            {t("Dismiss")}
          </button>
        </div>
      )}

      {exportText && <ExportBlock text={exportText} onClose={() => setExportText("")} />}
    </div>
  );
}

const PROMOTE_TO_FEATURED = new Set(["crunch"]);
const PROMOTE_TO_BUILTIN = new Set(["velvet"]);

function buildEntries(userThemes: CustomTheme[]): LibraryEntry[] {
  const list: LibraryEntry[] = [];
  for (const t of Object.values(THEME_PRESETS)) {
    list.push({
      theme: t,
      category: PROMOTE_TO_FEATURED.has(t.id) ? "Featured" : "Built-in",
      removable: false,
    });
  }
  for (const t of FEATURED_CUSTOM_THEMES) {
    list.push({ theme: t as ThemePreset, category: "Featured", removable: false });
  }
  for (const t of TEMPLATE_THEMES) {
    list.push({
      theme: t as ThemePreset,
      category: PROMOTE_TO_BUILTIN.has(t.id) ? "Built-in" : "Template",
      removable: false,
    });
  }
  for (const t of userThemes) {
    list.push({ theme: t as ThemePreset, category: "Yours", removable: true });
  }
  return list;
}
