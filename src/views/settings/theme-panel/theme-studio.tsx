import { SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Inspector } from "./theme-studio/inspector";
import { StudioHeader } from "./theme-studio/studio-header";
import { CodePopout } from "./theme-studio/code-popout";
import { buildChrome, DEFAULT_CHROME } from "./theme-studio/chrome-config";
import { SUITE_CHROME as STABLE_CHROME } from "./theme-studio/suite-theme";
import { useStudioPreview } from "./theme-studio/hooks/use-studio-preview";
import { useDraftHistory } from "./theme-studio/hooks/use-draft-history";
import type { Draft } from "./theme-studio/studio-types";
import type { CodeLang } from "@/components/code-editor";
import { saveCustomTheme, type CustomTheme } from "@/lib/custom-themes";
import { downloadText } from "@/lib/download-text";
import { serializeHarborStyle } from "@/lib/harborstyle";
import {
  applyTheme,
  customColorsToTokens,
  DEFAULT_CUSTOM_COLORS,
  type ActiveThemeId,
  type ChromeConfig,
  type ThemePreset,
} from "@/lib/theme";
import { useSettings } from "@/lib/settings";
import { pushOverlayPin } from "@/lib/overlay-pin";
import { pushActivityHint } from "@/lib/discord/activity-hint";

function cssColorToHex(input: string): string {
  const s = input.trim();
  if (s.startsWith("#")) return s.slice(0, 7);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "#808080";
    ctx.fillStyle = "#808080";
    ctx.fillStyle = s;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    const hex = (n: number) => n.toString(16).padStart(2, "0");
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  } catch {
    return "#808080";
  }
}

function emptyDraft(seed?: ThemePreset): Draft {
  if (!seed) {
    return {
      name: "",
      blurb: "",
      layout: "sidebar",
      cardStyle: "flat",
      buttonStyle: "flat",
      fontPair: "sentient-switzer",
      customFontId: null,
      bokeh: false,
      colors: { ...DEFAULT_CUSTOM_COLORS },
      chrome: { ...DEFAULT_CHROME },
      chromeDirty: false,
      css: "",
      js: "",
      html: "",
    };
  }
  const t = seed.tokens;
  const ext = seed as ThemePreset & {
    css?: string;
    js?: string;
    html?: string;
    customFontId?: string | null;
  };
  return {
    name: `${seed.name} copy`,
    blurb: seed.blurb ?? "",
    layout: seed.layout ?? "sidebar",
    cardStyle: seed.cardStyle ?? "flat",
    buttonStyle: seed.buttonStyle ?? "flat",
    fontPair: seed.fontPair ?? "sentient-switzer",
    customFontId: ext.customFontId ?? null,
    bokeh: !!seed.bokeh,
    colors: {
      canvas: cssColorToHex(t["--color-canvas"]),
      surface: cssColorToHex(t["--color-surface"]),
      elevated: cssColorToHex(t["--color-elevated"]),
      raised: cssColorToHex(t["--color-raised"]),
      ink: cssColorToHex(t["--color-ink"]),
      inkMuted: cssColorToHex(t["--color-ink-muted"]),
      inkSubtle: cssColorToHex(t["--color-ink-subtle"]),
      edge: cssColorToHex(t["--color-edge"]),
      accent: cssColorToHex(t["--color-accent"]),
      danger: cssColorToHex(t["--color-danger"]),
    },
    chrome: seed.chrome ? { ...seed.chrome } : { ...DEFAULT_CHROME },
    chromeDirty: false,
    css: ext.css ?? "",
    js: ext.js ?? "",
    html: ext.html ?? "",
  };
}

const STUDIO_STYLE_ID = "harbor-studio-preview-css";
const STUDIO_HTML_ID = "harbor-studio-preview-html";
const STUDIO_AUTHORITY_ID = "harbor-studio-authority-css";

export function ThemeStudio({ seed, onClose }: { seed?: ThemePreset; onClose: () => void }) {
  const { settings, update } = useSettings();
  const { draft, setDraft, undo, redo, canUndo, canRedo } = useDraftHistory(() => emptyDraft(seed));
  const restoreRef = useState(() => settings.theme.preset)[0];
  const liveThemeRef = useRef(settings.theme);
  liveThemeRef.current = settings.theme;
  const [popoutTab, setPopoutTab] = useState<CodeLang | null>(null);
  const { inspectorHidden, setInspectorHidden } = useStudioPreview(draft.layout, draft.bokeh);
  const [initialJson] = useState(() => JSON.stringify(emptyDraft(seed)));
  const [confirmClose, setConfirmClose] = useState(false);
  const dirty = useMemo(() => JSON.stringify(draft) !== initialJson, [draft, initialJson]);
  const requestClose = () => {
    if (dirty) setConfirmClose(true);
    else onClose();
  };

  useEffect(() => pushOverlayPin(), []);

  useEffect(() => {
    const name = draft.name.trim();
    return pushActivityHint({
      details: name ? `Designing "${name}"` : "Designing a theme",
      state: "Theme Studio",
    });
  }, [draft.name]);

  const draftPreset = useMemo<ThemePreset>(
    () => ({
      id: "user:__studio_preview__" as never,
      name: draft.name || "Untitled theme",
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
    [draft],
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
      if (e.key === "Escape") {
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
    saveCustomTheme(theme);
    update({
      theme: {
        ...settings.theme,
        preset: theme.id as ActiveThemeId,
        customFontId: draft.customFontId,
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
    <div className="pointer-events-none fixed inset-0 z-[210]">
      <div
        style={STABLE_CHROME}
        className={`pointer-events-auto absolute end-0 top-0 flex h-full w-[440px] max-w-full flex-col border-s border-edge bg-canvas shadow-[-24px_0_60px_-20px_rgba(0,0,0,0.6)] transition-transform duration-300 ${
          inspectorHidden ? "translate-x-full rtl:-translate-x-full" : "translate-x-0"
        }`}
      >
        <StudioHeader
          name={trimmedName}
          onCancel={requestClose}
          onHidePanel={() => setInspectorHidden(true)}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
        />
        <Inspector
          draft={draft}
          onPatch={onPatch}
          onSeed={onSeed}
          onChromeChange={onChromeChange}
          onRegenerateChrome={onRegenerateChrome}
          onExpand={(t) => setPopoutTab(t)}
        />
        <footer className="flex shrink-0 items-center gap-2.5 border-t border-edge-soft bg-surface px-5 py-3.5">
          <button
            type="button"
            onClick={onExport}
            disabled={!canSave}
            className="flex h-12 flex-1 items-center justify-center rounded-lg border border-edge-soft text-[15px] font-semibold text-ink-muted transition-colors hover:border-edge hover:bg-white/[0.03] hover:text-ink disabled:opacity-40"
          >
            Export
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave}
            className="flex h-12 flex-[1.6] items-center justify-center rounded-lg text-[15px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "var(--color-accent)" }}
          >
            Save theme
          </button>
        </footer>
      </div>

      {inspectorHidden && (
        <button
          type="button"
          onClick={() => setInspectorHidden(false)}
          style={STABLE_CHROME}
          className="pointer-events-auto fixed bottom-6 end-6 z-[211] flex h-12 items-center gap-2 rounded-full border border-edge bg-elevated px-5 text-[13px] font-semibold text-ink shadow-[0_18px_40px_-16px_rgba(0,0,0,0.7)] transition-transform hover:-translate-y-0.5"
        >
          <SlidersHorizontal size={15} strokeWidth={2.2} />
          Edit theme
        </button>
      )}

      {popoutTab && (
        <CodePopout
          css={draft.css}
          html={draft.html}
          js={draft.js}
          themeName={draft.name || "Untitled theme"}
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
          className="animate-in fade-in pointer-events-auto fixed inset-0 z-[230] flex items-center justify-center bg-black/55 px-4 backdrop-blur-[2px] duration-150"
          onClick={() => setConfirmClose(false)}
        >
          <div
            style={STABLE_CHROME}
            onClick={(e) => e.stopPropagation()}
            className="animate-in zoom-in-95 fade-in w-[340px] max-w-full overflow-hidden rounded-2xl border border-edge bg-elevated shadow-[0_30px_80px_-24px_rgba(0,0,0,0.8)] duration-150"
          >
            <div className="flex flex-col px-6 pb-6 pt-5">
              <h2 className="text-[17px] font-semibold tracking-tight text-ink">
                Leave without saving?
              </h2>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted">
                Your changes to this theme aren&apos;t saved yet. They&apos;ll be lost if you leave
                now.
              </p>
              <div className="mt-5 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmClose(false);
                    onClose();
                  }}
                  className="h-10 rounded-lg px-4 text-[13.5px] font-semibold text-ink-subtle transition-colors hover:bg-danger/12 hover:text-danger"
                >
                  Discard
                </button>
                <button
                  type="button"
                  autoFocus
                  onClick={() => setConfirmClose(false)}
                  className="h-10 rounded-lg px-5 text-[13.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
                  style={{ background: "var(--color-accent)" }}
                >
                  Keep editing
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
