import { useEffect, useMemo, useState } from "react";
import { useSettings } from "@/lib/settings";
import { getThemeById } from "@/lib/theme";
import { useView } from "@/lib/view";
import { scanTheme } from "@/lib/theme-scan";
import { subscribeCustomThemes, type CustomTheme } from "@/lib/custom-themes";

const STYLE_ID = "harbor-custom-css";
const THEME_STYLE_ID = "harbor-theme-css";
const OVERLAY_ID = "harbor-custom-overlay";

function runThemeCleanup(key: "__harborCustomCleanup" | "__harborThemeCleanup") {
  const w = window as unknown as Record<string, unknown>;
  const fn = w[key];
  if (typeof fn === "function") {
    try {
      (fn as () => void)();
    } catch {
      void 0;
    }
  }
  w[key] = undefined;
}

export function CustomCodeMount() {
  const { settings } = useSettings();
  const { player } = useView();
  const [themesTick, setThemesTick] = useState(0);

  useEffect(() => subscribeCustomThemes(() => setThemesTick((t) => t + 1)), []);

  const themeExt = useMemo(() => {
    if (settings.theme.preset === "custom") return null;
    const t = getThemeById(settings.theme.preset) as CustomTheme | null;
    if (!t) return null;
    const payload = { css: t.css ?? "", js: t.js ?? "", html: t.html ?? "" };
    const scan = scanTheme(payload);
    if (scan.verdict === "block") {
      console.warn(
        "[harbor-theme] blocked unsafe theme code:",
        scan.findings.map((f) => `${f.category}:${f.rule}`).join(", "),
      );
      return { css: "", js: "", html: "" };
    }
    return payload;
  }, [settings.theme.preset, themesTick]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = settings.customCss ?? "";
    return () => {
      if (el && !settings.customCss) el.textContent = "";
    };
  }, [settings.customCss]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    let el = document.getElementById(THEME_STYLE_ID) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = THEME_STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = themeExt?.css ?? "";
  }, [themeExt?.css]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const code = (settings.customJs ?? "").trim();
    if (!code) return;
    try {
      new Function(code)();
    } catch (err) {
      console.warn("[harbor-custom-js] error:", err);
    }
    return () => runThemeCleanup("__harborCustomCleanup");
  }, [settings.customJs]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const code = (themeExt?.js ?? "").trim();
    if (!code) return;
    try {
      new Function(code)();
    } catch (err) {
      console.warn("[harbor-theme-js] error:", err);
    }
    return () => runThemeCleanup("__harborThemeCleanup");
  }, [themeExt?.js]);

  const html = `${settings.customHtml ?? ""}${themeExt?.html ?? ""}`;
  return (
    <div
      id={OVERLAY_ID}
      aria-hidden
      className={`pointer-events-none fixed inset-0 z-[100] ${player ? "hidden" : ""}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
