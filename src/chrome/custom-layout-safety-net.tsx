import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { NAV_ITEMS, applyNavCustomization } from "@/chrome/nav-items";
import { ParentalPinModal } from "@/components/parental-pin-modal";
import { useT } from "@/lib/i18n";
import { useParental } from "@/lib/parental";
import { useSettings } from "@/lib/settings";
import { useView, type View } from "@/lib/view";

const STYLE_ID = "harbor-safety-net-css";
const ROOT_ID = "harbor-safety-net";
const DETECT_DELAY_MS = 1200;

/**
 * `layout: "custom"` themes (built-in "custom chrome" and every community
 * theme built the same way) render 100% of the navigation UI themselves via
 * injected HTML/CSS/JS (see CustomCodeMount). App.tsx intentionally renders
 * none of its own nav chrome for that layout - it trusts the theme.
 *
 * If the theme's script throws before it appends its nav, or its HTML/CSS
 * never produces a visible, working menu, the user is left with no way to
 * reach Settings or any other view at all (see issue #951 - "all the menus
 * disappear ... I am only left with the home screen"). custom-code-mount.tsx
 * only logs a console.warn on failure, which no real user ever sees.
 *
 * This component is the core-side defensive fallback: every built-in and
 * community nav control marks itself with `data-harbor-nav` (see
 * chrome-config.ts, the bundled Feishin/ElegantFin themes, and the cheat
 * sheet themes are told to follow). If none exist anywhere in the document
 * a little while after mounting, the theme's own navigation never showed up,
 * so we render a minimal escape hatch instead of leaving the app unusable.
 * Themes that render working navigation are completely unaffected.
 */
function ensureDefensiveStyle(): void {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = `
#${ROOT_ID} {
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
  position: fixed !important;
  z-index: 2147483647 !important;
  pointer-events: auto !important;
  margin: 0 !important;
}
#${ROOT_ID} * { pointer-events: auto !important; }
`;
  }
  // Re-append on every activation so this stays the LAST stylesheet in
  // <head>. A same-specificity `!important` rule wins by source order, so a
  // theme whose own `<style>` tag lands after ours (e.g. re-applied later)
  // would otherwise still be able to hide this fallback with a broad
  // `display: none !important` rule.
  document.head.appendChild(el);
}

function isNavPresent(): boolean {
  return document.querySelector("[data-harbor-nav]") !== null;
}

export function CustomLayoutSafetyNet() {
  const [navMissing, setNavMissing] = useState(false);
  const [open, setOpen] = useState(false);
  const [pendingPinView, setPendingPinView] = useState<View | null>(null);
  const { view, setView } = useView();
  const { settings } = useSettings();
  const { locked, unlock, hiddenTabs } = useParental();
  const t = useT();

  useEffect(() => {
    const check = () => setNavMissing(!isNavPresent());
    // Give the theme's own HTML/CSS/JS a moment to mount before judging it.
    const timer = window.setTimeout(check, DETECT_DELAY_MS);
    const observer = new MutationObserver(check);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-harbor-nav"],
    });
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (navMissing) ensureDefensiveStyle();
    else setOpen(false);
  }, [navMissing]);

  if (!navMissing) return null;

  const items = applyNavCustomization(NAV_ITEMS, settings.navCustomization).filter((item) => {
    if (item.view === "kids") return false;
    if (item.view === "vod" && !settings.showPlaylistsTab) return false;
    if (item.hideKey && settings.hideContent[item.hideKey]) return false;
    if (locked && item.parentalKey && hiddenTabs[item.parentalKey]) return false;
    return true;
  });

  const go = (v: View, pinGated?: boolean) => {
    setOpen(false);
    if (pinGated && locked) {
      setPendingPinView(v);
      return;
    }
    setView(v);
  };

  return (
    <div
      id={ROOT_ID}
      style={{ insetInlineStart: 20, bottom: 20 }}
      aria-label={t("chrome.safetyNetLabel")}
    >
      {open && (
        <div className="mb-2 flex max-h-[70vh] w-56 flex-col gap-1 overflow-y-auto rounded-2xl border border-edge-soft bg-canvas p-2 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.7)]">
          <p className="px-2 pb-1.5 pt-1 text-[11.5px] font-semibold uppercase tracking-wide text-ink-subtle">
            {t("chrome.safetyNetHeading")}
          </p>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => go(item.view, item.pinGated)}
              data-active={view === item.view ? "" : undefined}
              className={`flex h-10 items-center gap-2.5 rounded-lg px-3 text-start text-[14px] font-medium transition-colors ${
                view === item.view
                  ? "bg-elevated text-ink"
                  : "text-ink-muted hover:bg-elevated/60 hover:text-ink"
              }`}
            >
              {t(item.label)}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("chrome.safetyNetLabel")}
        title={t("chrome.safetyNetLabel")}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-edge-soft bg-canvas text-ink shadow-[0_10px_24px_-12px_rgba(0,0,0,0.6)] backdrop-blur-md transition-colors hover:bg-elevated"
      >
        {open ? <X size={18} strokeWidth={2.2} /> : <Menu size={18} strokeWidth={2.2} />}
      </button>
      {pendingPinView && (
        <ParentalPinModal
          mode={{
            kind: "unlock",
            onUnlock: () => {
              const v = pendingPinView;
              setPendingPinView(null);
              if (v) setView(v);
            },
            onCancel: () => setPendingPinView(null),
          }}
          verify={unlock}
        />
      )}
    </div>
  );
}
