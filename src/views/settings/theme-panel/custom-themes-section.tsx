import {
  getCustomThemes,
  parseThemeJson,
  removeCustomTheme,
  saveCustomTheme,
  subscribeCustomThemes,
  type CustomTheme,
} from "@/lib/custom-themes";
import { pushActivityHint } from "@/lib/discord/activity-hint";
import { downloadText } from "@/lib/download-text";
import { isHarborStyleName, parseHarborStyle, serializeHarborStyle } from "@/lib/harborstyle";
import { useSettings } from "@/lib/settings";
import {
  FEATURED_CUSTOM_THEMES,
  getThemeById,
  TEMPLATE_THEMES,
  THEME_PRESETS,
  type ActiveThemeId,
  type ThemePreset,
} from "@/lib/theme";
import { importForeignTheme } from "@/lib/theme-import";
import { AlertCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ActiveBanner } from "./custom-themes-section/active-banner";
import { ExportBlock } from "./custom-themes-section/export-block";
import { HeroCards } from "./custom-themes-section/hero-cards";
import { LibraryBrowser } from "./custom-themes-section/library-browser";
import type { LibraryEntry } from "./custom-themes-section/library-grid";
import { ThemeStudio } from "./theme-studio";

export function CustomThemesSection() {
  const { settings, update } = useSettings();
  const [themes, setThemes] = useState<CustomTheme[]>(() => getCustomThemes());
  const [error, setError] = useState<string | null>(null);
  const [exportText, setExportText] = useState("");
  const [studioOpen, setStudioOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [importedNotice, setImportedNotice] = useState<string | null>(null);

  useEffect(() => subscribeCustomThemes(() => setThemes(getCustomThemes())), []);

  useEffect(() => {
    if (!libraryOpen || studioOpen) return;
    return pushActivityHint({ details: "Browsing the theme library" });
  }, [libraryOpen, studioOpen]);

  const activeId = settings.theme.preset;
  const activeTheme = activeId === "custom" ? null : getThemeById(activeId);

  const entries = useMemo(() => buildEntries(themes), [themes]);

  const activateTheme = (id: string, nav?: ThemePreset["navCustomization"]) =>
    update({
      theme: { ...settings.theme, preset: id as ActiveThemeId },
      ...(nav ? { navCustomization: nav } : {}),
    });

  const importFile = async (file: File) => {
    setError(null);
    try {
      const name = file.name.toLowerCase();
      if (name.endsWith(".zip") || file.type === "application/zip") {
        setError("Zipped themes aren't supported yet. Drop the theme file directly.");
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
              ? `${first.name} +${foreign.themes.length - 1} more (${foreign.format})`
              : `${first.name} (${foreign.format})`,
          );
          activateTheme(first.id, first.navCustomization);
          return;
        }
        setError(result.error);
        return;
      }
      saveCustomTheme(result.theme);
      setImportedNotice(result.theme.name);
      activateTheme(result.theme.id, result.theme.navCustomization);
    } catch {
      setError("Could not read file");
    }
  };

  const pickImportFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".harborstyle,.json,.txt,.harbortheme.json,.yaml,.yml,.ini,.xml,application/json,text/plain";
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) importFile(f);
    };
    input.click();
  };

  const activate = (id: string) => activateTheme(id, getThemeById(id)?.navCustomization);

  const remove = (id: string) => {
    removeCustomTheme(id);
    if (settings.theme.preset === id) {
      update({ theme: { ...settings.theme, preset: "cool-grey" } });
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
          setLibraryOpen(true);
        }}
        onOpenStudio={() => setStudioOpen(true)}
        onImport={pickImportFile}
        libraryCount={entries.length}
        importedNotice={importedNotice}
      />

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-[12.5px] text-danger">
          <AlertCircle size={14} strokeWidth={2.2} />
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="ms-auto rounded px-2 text-[11px] font-semibold uppercase tracking-wider opacity-70 hover:opacity-100"
          >
            Dismiss
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
