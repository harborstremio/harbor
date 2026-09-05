import { SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Inspector } from "./theme-studio/inspector";
import { StudioHeader } from "./theme-studio/studio-header";
import { CodePopout } from "./theme-studio/code-popout";
import { buildChrome } from "./theme-studio/chrome-config";
import { nextBackgroundImage } from "@/lib/theme-background";
import { SUITE_CHROME_LIGHT as STABLE_CHROME } from "./theme-studio/suite-theme";
import { useStudioPreview } from "./theme-studio/hooks/use-studio-preview";
import { useDraftHistory } from "./theme-studio/hooks/use-draft-history";
import { usePanelDrag } from "./theme-studio/hooks/use-panel-drag";
import { StudioShell } from "./theme-studio/studio-shell";
import { emptyDraft } from "./theme-studio/studio-draft";
import type { Draft } from "./theme-studio/studio-types";
import type { CodeLang } from "@/components/code-editor";
import { saveCustomTheme, type CustomTheme } from "@/lib/custom-themes";
import { downloadText } from "@/lib/download-text";
import { serializeHarborStyle } from "@/lib/harborstyle";
import {
  applyTheme,
  customColorsToTokens,
  getThemeById,
  type ActiveThemeId,
  type ChromeConfig,
  type ThemePreset,
} from "@/lib/theme";
import { useSettings } from "@/lib/settings";
import { captureFocusReturn, tvFocus } from "@/lib/keyboard-navigation";
import { isBackKey } from "@/lib/keyboard-navigation/geometry";
import { pushOverlayPin } from "@/lib/overlay-pin";
import { pushActivityHint } from "@/lib/discord/activity-hint";
import { useT } from "@/lib/i18n";

const STUDIO_STYLE_ID = "harbor-studio-preview-css";
const STUDIO_HTML_ID = "harbor-studio-preview-html";
const STUDIO_AUTHORITY_ID = "harbor-studio-authority-css";

export function ThemeStudio({ seed, onClose }: { seed?: ThemePreset; onClose: () => void }) {
  const t = useT();
  const { settings, update } = useSettings();
  const { draft, setDraft, undo, redo, canUndo, canRedo } = useDraftHistory(() => emptyDraft(seed));
  const drag = usePanelDrag();
  const restoreRef = useState(() => settings.theme.preset)[0];
  const liveThemeRef = useRef(settings.theme);
  liveThemeRef.current = settings.theme;
  const [popoutTab, setPopoutTab] = useState<CodeLang | null>(null);
  const { inspectorHidden, setInspectorHidden } = useStudioPreview(draft.layout, draft.bokeh);
  const [initialJson] = useState(() => JSON.stringify(emptyDraft(seed)));
  const [confirmClose, setConfirmClose] = useState(false);
  const minimizeRef = useRef<HTMLButtonElement>(null);
  const editThemeRef = useRef<HTMLButtonElement>(null);
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const activityName = draft.name.trim();
  const activityDetails = activityName
    ? t('Designing "{name}"', { name: activityName })
    : t("Designing a theme");
  const activityState = t("Theme Studio");
  const untitledThemeName = t("Untitled theme");
  const dirty = useMemo(() => JSON.stringify(draft) !== initialJson, [draft, initialJson]);
  const requestClose = () => {
    if (dirty) setConfirmClose(true);
    else onClose();
  };

  useEffect(() => pushOverlayPin(), []);

  useEffect(
    () => pushActivityHint({ details: activityDetails, state: activityState }),
    [activityDetails, activityState],
  );

  const draftPreset = useMemo<ThemePreset>(
    () => ({
      id: "user:__studio_preview__" as never,
      name: draft.name || untitledThemeName,
      blurb: draft.blurb,
      swatch: [draft.colors.canvas, draft.colors.surface, draft.colors.accent] as [
        string,
        string,
        string,
      ],
      tokens: customColorsToTokens(draft.colors),
      layout: draft.layout,
      cardStyle: draft.cardStyle,
      buttonStyle: draft.buttonStyle,
      fontPair: draft.fontPair,
      bokeh: draft.bokeh,
    }),
    [draft, untitledThemeName],
  );

  useEffect(() => {
    applyTheme({
      preset: "custom",
      customColors: draft.colors,
      backgroundImage: null,
      backgroundDim: 0,
      fontPair: draft.fontPair,
      customFontId: draft.customFontId,
    });
    const root = document.documentElement;
    root.dataset.themeLayout = draft.layout;
    root.dataset.themeCard = draft.cardStyle;
    root.dataset.themeButton = draft.buttonStyle;
    root.dataset.themeBokeh = draft.bokeh ? "on" : "off";
  }, [draft]);

  useEffect(() => {
    let style = document.getElementById(STUDIO_STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = STUDIO_STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = draft.css;
  }, [draft.css]);

  useEffect(() => {
    let authority = document.getElementById(STUDIO_AUTHORITY_ID) as HTMLStyleElement | null;
    if (!authority) {
      authority = document.createElement("style");
      authority.id = STUDIO_AUTHORITY_ID;
      document.head.appendChild(authority);
    }
    const vars = Object.entries(customColorsToTokens(draft.colors))
      .map(([k, v]) => `${k}: ${v} !important;`)
      .join("\n  ");
    authority.textContent = `:root:root {\n  ${vars}\n}`;
  }, [draft.colors]);

  useEffect(() => {
    let overlay = document.getElementById(STUDIO_HTML_ID) as HTMLDivElement | null;
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = STUDIO_HTML_ID;
      overlay.style.cssText = "position:fixed;inset:0;z-index:59;pointer-events:none;";
      overlay.setAttribute("data-tv-skip", "");
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = draft.layout === "custom" ? draft.html : "";
  }, [draft.html, draft.layout]);

  useEffect(() => {
    return () => {
      document.getElementById(STUDIO_STYLE_ID)?.remove();
      document.getElementById(STUDIO_HTML_ID)?.remove();
      document.getElementById(STUDIO_AUTHORITY_ID)?.remove();
      applyTheme({ ...liveThemeRef.current, preset: restoreRef });
    };
  }, [restoreRef]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isBackKey(e)) {
        if (e.defaultPrevented) return;
        if (document.querySelector("[data-search-editing]")) return;
        e.preventDefault();
        e.stopPropagation();
        if (confirmClose) setConfirmClose(false);
        else if (popoutTab) setPopoutTab(null);
        else if (inspectorHidden) setInspectorHidden(false);
        else requestClose();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z")) {
        const el = e.target as HTMLElement | null;
        if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable))
          return;
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, inspectorHidden, setInspectorHidden, popoutTab, confirmClose, dirty, undo, redo]);

  useEffect(() => {
    const el = inspectorHidden ? editThemeRef.current : minimizeRef.current;
    if (el) tvFocus(el);
  }, [inspectorHidden]);

  useEffect(() => {
    if (!confirmClose) return;
    const restore = captureFocusReturn();
    if (keepEditingRef.current) tvFocus(keepEditingRef.current);
    return restore;
  }, [confirmClose]);

  const runJs = () => {
    const code = draft.js.trim();
    if (!code) return;
    try {
      new Function(code)();
    } catch (err) {
      console.warn("[harbor-studio-js] error:", err);
    }
  };

  const onPatch = (patch: Partial<Draft>) =>
    setDraft((d) => {
      const next = { ...d, ...patch };
      if (patch.layout === "custom" && !d.html.trim()) {
        const gen = buildChrome(d.chrome);
        next.html = gen.html;
        next.css = gen.css;
      }
      if ((patch.css !== undefined || patch.html !== undefined) && d.layout === "custom") {
        next.chromeDirty = true;
      }
      return next;
    });
  const onSeed = (t: ThemePreset) => setDraft(emptyDraft(t));

  const onChromeChange = (config: ChromeConfig) =>
    setDraft((d) => {
      if (d.chromeDirty) return { ...d, chrome: config };
      const gen = buildChrome(config);
      return { ...d, chrome: config, html: gen.html, css: gen.css };
    });

  const onRegenerateChrome = () =>
    setDraft((d) => {
      const gen = buildChrome(d.chrome);
      return { ...d, html: gen.html, css: gen.css, chromeDirty: false };
    });

  const trimmedName = draft.name.trim();
  const canSave =
    trimmedName.length > 0 && (draft.layout !== "custom" || draft.chrome.items.length > 0);

  const buildTheme = (): CustomTheme => {
    const slug =
      trimmedName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40) || "theme";
    const nav = settings.navCustomization;
    const hasNav =
      nav.order.length > 0 || nav.hidden.length > 0 || Object.keys(nav.renamed).length > 0;
    return {
      id: `user:${slug}-${Date.now().toString(36)}`,
      name: trimmedName.slice(0, 60),
      blurb: draft.blurb.trim().slice(0, 160),
      swatch: draftPreset.swatch as [string, string, string],
      tokens: draftPreset.tokens,
      layout: draft.layout,
      cardStyle: draft.cardStyle,
      buttonStyle: draft.buttonStyle,
      fontPair: draft.fontPair,
      bokeh: draft.bokeh,
      ...(settings.theme.backgroundImage
        ? {
            background: {
              image: settings.theme.backgroundImage,
              dim: settings.theme.backgroundDim,
            },
          }
        : {}),
      ...(draft.customFontId ? { customFontId: draft.customFontId } : {}),
      ...(draft.layout === "custom" ? { chrome: draft.chrome } : {}),
      ...(hasNav ? { navCustomization: nav } : {}),
      ...(draft.css.trim() ? { css: draft.css } : {}),
      ...(draft.js.trim() ? { js: draft.js } : {}),
      ...(draft.html.trim() ? { html: draft.html } : {}),
    };
  };

  const onSave = () => {
    if (!canSave) return;
    const theme = buildTheme();
    const previous =
      settings.theme.preset !== "custom" ? getThemeById(settings.theme.preset) : null;
    const image = nextBackgroundImage(settings.theme.backgroundImage, previous, theme);
    saveCustomTheme(theme);
    update({
      theme: {
        ...settings.theme,
        preset: theme.id as ActiveThemeId,
        customFontId: draft.customFontId,
        backgroundImage: image,
      },
    });
    onClose();
  };

  const onExport = async () => {
    if (!canSave) return;
    const text = serializeHarborStyle(buildTheme());
    const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "theme";
    await downloadText(`${slug}.harborstyle`, text, ["harborstyle"]);
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("Theme studio")}
      className="pointer-events-none fixed inset-0 z-[210]"
    >
      {!inspectorHidden && (
        <StudioShell cardRef={drag.ref} position={drag.position} dragging={drag.dragging}>
          <StudioHeader
            name={trimmedName}
            minimizeRef={minimizeRef}
            onCancel={requestClose}
            onHidePanel={() => setInspectorHidden(true)}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            dragHandleProps={drag.handleProps}
          />
          <Inspector
            draft={draft}
            onPatch={onPatch}
            onSeed={onSeed}
            onChromeChange={onChromeChange}
            onRegenerateChrome={onRegenerateChrome}
            onExpand={(t) => setPopoutTab(t)}
          />
          <footer className="flex shrink-0 items-center gap-2.5 bg-canvas px-5 py-3.5">
            <button
              type="button"
              onClick={onExport}
              disabled={!canSave}
              className="harbor-press-pop flex h-12 flex-1 items-center justify-center rounded-md bg-surface text-[15px] font-semibold text-ink-muted transition-colors hover:bg-raised hover:text-ink disabled:opacity-40"
            >
              {t("Export")}
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!canSave}
              className="harbor-press-pop flex h-12 flex-[1.6] items-center justify-center rounded-md bg-ink text-[15px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("Save theme")}
            </button>
          </footer>
        </StudioShell>
      )}

      {inspectorHidden && (
        <button
          type="button"
          ref={editThemeRef}
          onClick={() => setInspectorHidden(false)}
          style={STABLE_CHROME}
          className="pointer-events-auto fixed bottom-6 end-6 z-[242] flex h-12 items-center gap-2 rounded-md bg-elevated px-5 text-[15px] font-semibold text-ink harbor-float transition-colors hover:bg-raised"
        >
          <SlidersHorizontal size={16} strokeWidth={2.2} />
          {t("Edit theme")}
        </button>
      )}

      {popoutTab && (
        <CodePopout
          css={draft.css}
          html={draft.html}
          js={draft.js}
          themeName={draft.name || untitledThemeName}
          initialTab={popoutTab}
          onChange={onPatch}
          onRunJs={runJs}
          onClose={() => setPopoutTab(null)}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
        />
      )}

      {confirmClose && (
        <div
          className="animate-in fade-in pointer-events-auto fixed inset-0 z-[244] flex items-center justify-center bg-black/55 px-4 backdrop-blur-[2px] duration-150"
          onClick={() => setConfirmClose(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("Leave without saving?")}
            style={STABLE_CHROME}
            onClick={(e) => e.stopPropagation()}
            className="animate-in zoom-in-95 fade-in w-[340px] max-w-full overflow-hidden rounded-md ring-1 ring-edge bg-elevated harbor-float duration-150"
          >
            <div className="flex flex-col px-6 pb-6 pt-5">
              <h2 className="text-[17px] font-semibold tracking-tight text-ink">
                {t("Leave without saving?")}
              </h2>
              <p className="mt-1.5 max-w-[66ch] text-[15.5px] leading-[22px] text-ink-muted">
                {t(
                  "Your changes to this theme aren't saved yet. They'll be lost if you leave now.",
                )}
              </p>
              <div className="mt-5 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmClose(false);
                    onClose();
                  }}
                  className="h-11 rounded-md px-4 text-[15px] font-semibold text-ink-subtle transition-colors hover:bg-danger/25 hover:text-danger"
                >
                  {t("Discard")}
                </button>
                <button
                  type="button"
                  ref={keepEditingRef}
                  data-tv-initial-focus
                  onClick={() => setConfirmClose(false)}
                  className="h-11 rounded-md bg-ink px-5 text-[15px] font-semibold text-canvas transition-opacity hover:opacity-90"
                >
                  {t("Keep editing")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
