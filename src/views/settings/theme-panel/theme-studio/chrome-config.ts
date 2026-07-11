import type { ChromeConfig, ChromeNavId } from "@/lib/theme";

import { iconInnerSvg } from "./chrome-icons";

export const NAV_LABELS: Record<ChromeNavId, string> = {
  home: "Home",
  movies: "Movies",
  shows: "Shows",
  anime: "Anime",
  library: "Library",
  live: "Live TV",
  discover: "Discover",
  calendar: "Calendar",
  settings: "Settings",
};

export const NAV_CATALOG: ChromeNavId[] = [
  "home",
  "movies",
  "shows",
  "anime",
  "library",
  "live",
  "discover",
  "calendar",
  "settings",
];

export const DEFAULT_CHROME: ChromeConfig = {
  position: "sidebar",
  brand: "Harbor",
  items: ["home", "movies", "shows", "library", "live", "settings"],
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function resolveIconMarkup(value: string): string | undefined {
  if (value.startsWith("data:")) return `<img class="myc-ico" src="${value}" alt="" />`;
  const inner = iconInnerSvg(value);
  return inner
    ? `<svg class="myc-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`
    : undefined;
}

function buttons(config: ChromeConfig): string {
  return config.items
    .map((id) => {
      const label = config.labels?.[id]?.trim() || NAV_LABELS[id];
      const iconVal = config.icons?.[id];
      const iconMarkup = iconVal ? resolveIconMarkup(iconVal) : undefined;
      const inner = iconMarkup ? `${iconMarkup}<span>${esc(label)}</span>` : esc(label);
      return `    <button data-harbor-nav="${id}" onclick="window.harbor.navigate('${id}')">${inner}</button>`;
    })
    .join("\n");
}

const SIDEBAR_CSS = `html[data-theme-layout="custom"] .myc-rail {
  pointer-events: auto;
  position: fixed;
  inset: 0 auto 0 0;
  width: 224px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 26px 16px;
  background: var(--color-surface);
  border-right: 1px solid var(--color-edge);
  z-index: 60;
}
html[data-theme-layout="custom"] .myc-brand {
  font-family: var(--font-display, serif);
  font-size: 28px;
  font-weight: 600;
  color: var(--color-ink);
  padding: 2px 10px;
}
html[data-theme-layout="custom"] .myc-nav { display: flex; flex-direction: column; gap: 4px; }
html[data-theme-layout="custom"] .myc-nav button {
  display: flex;
  align-items: center;
  gap: 11px;
  text-align: left;
  padding: 12px 14px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--color-ink-muted);
  font-family: var(--font-sans, sans-serif);
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
html[data-theme-layout="custom"] .myc-nav button:hover { background: var(--color-raised); color: var(--color-ink); }
html[data-theme-layout="custom"] .myc-nav button[data-active] { background: var(--color-raised); color: var(--color-ink); }
html[data-theme-layout="custom"] .myc-nav .myc-ico { width: 19px; height: 19px; flex-shrink: 0; object-fit: contain; }
html[data-theme-layout="custom"]:not([data-chrome-hidden]) main { padding-left: 248px !important; }
html:not([data-theme-layout="custom"]) .myc-rail,
html[data-chrome-hidden] .myc-rail { display: none !important; }`;

const TOPBAR_CSS = `html[data-theme-layout="custom"] .myc-bar {
  pointer-events: auto;
  position: fixed;
  inset: 14px 18px auto 18px;
  height: 56px;
  display: flex;
  align-items: center;
  gap: 22px;
  padding: 0 20px;
  border-radius: 16px;
  background: var(--color-surface);
  border: 1px solid var(--color-edge);
  z-index: 60;
}
html[data-theme-layout="custom"] .myc-bar .myc-brand {
  font-family: var(--font-display, serif);
  font-size: 22px;
  font-weight: 600;
  color: var(--color-ink);
}
html[data-theme-layout="custom"] .myc-bar .myc-nav { display: flex; gap: 6px; }
html[data-theme-layout="custom"] .myc-bar button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 0;
  background: transparent;
  color: var(--color-ink-muted);
  font-family: var(--font-sans, sans-serif);
  font-size: 14px;
  font-weight: 600;
  padding: 8px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
html[data-theme-layout="custom"] .myc-bar button:hover { background: var(--color-raised); color: var(--color-ink); }
html[data-theme-layout="custom"] .myc-bar button[data-active] { background: var(--color-raised); color: var(--color-ink); }
html[data-theme-layout="custom"] .myc-bar .myc-ico { width: 17px; height: 17px; flex-shrink: 0; object-fit: contain; }
html[data-theme-layout="custom"]:not([data-chrome-hidden]) main { padding-top: 92px !important; }
html:not([data-theme-layout="custom"]) .myc-bar,
html[data-chrome-hidden] .myc-bar { display: none !important; }`;

export function buildChrome(config: ChromeConfig): { html: string; css: string } {
  const brand = config.brand.trim();
  if (config.position === "topbar") {
    const html = `<header class="myc-bar">\n${
      brand ? `  <div class="myc-brand">${esc(brand)}</div>\n` : ""
    }  <nav class="myc-nav">\n${buttons(config)}\n  </nav>\n</header>`;
    return { html, css: TOPBAR_CSS };
  }
  const html = `<aside class="myc-rail">\n${
    brand ? `  <div class="myc-brand">${esc(brand)}</div>\n` : ""
  }  <nav class="myc-nav">\n${buttons(config)}\n  </nav>\n</aside>`;
  return { html, css: SIDEBAR_CSS };
}
