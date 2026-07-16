import { Lock } from "lucide-react";
import { useState } from "react";
import { HarborMark } from "@/components/icons/harbor-mark";
import { NAV_ITEMS, applyNavCustomization, type NavItem } from "@/chrome/nav-items";
import { ProfileChip } from "@/chrome/sidebar/profile-chip";
import { CollapseToggle } from "@/chrome/sidebar/collapse-toggle";
import { ParentalPinModal } from "@/components/parental-pin-modal";
import { useT } from "@/lib/i18n";
import { useParental } from "@/lib/parental";
import { useSettings } from "@/lib/settings";
import { useView, type View } from "@/lib/view";
import { HoverNavIcon } from "@/chrome/hover-nav-icon";

const PRIMARY_IDS = new Set([
  "home",
  "discover",
  "movies",
  "shows",
  "kids",
  "anime",
  "live",
  "vod",
]);

export function DraculaSidebar() {
  const { view, setView, chromeHidden } = useView();
  const { locked, unlock, hiddenTabs } = useParental();
  const { settings } = useSettings();
  const t = useT();
  const collapsed = settings.sidebarCollapsed;
  const [pinFor, setPinFor] = useState<View | null>(null);

  const items = applyNavCustomization(NAV_ITEMS, settings.navCustomization);
  const primary = items.filter((i) => PRIMARY_IDS.has(i.id));
  const collections = items.filter((i) => !PRIMARY_IDS.has(i.id));

  const isVisible = (item: NavItem) => {
    if (item.id === "kids") return false;
    if (item.view === "vod" && !settings.showPlaylistsTab) return false;
    if (item.hideKey && settings.hideContent[item.hideKey]) return false;
    if (locked && item.parentalKey && hiddenTabs[item.parentalKey]) return false;
    return true;
  };

  const go = (item: NavItem) => {
    if (item.pinGated && locked) {
      setPinFor(item.view);
      return;
    }
    setView(item.view);
  };

  return (
    <>
      <aside
        aria-hidden={chromeHidden}
        data-tv-nav-zone
        className={`relative z-[60] flex w-[78px] shrink-0 flex-col transition-[opacity,transform,width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[width] ${
          collapsed ? "" : "lg:w-64"
        } ${
          chromeHidden
            ? "pointer-events-none -translate-x-2 rtl:translate-x-2 opacity-0"
            : "translate-x-0 opacity-100"
        }`}
      >
        <div
          className="relative flex min-h-0 flex-1 flex-col rounded-e-[30px] shadow-[8px_0_34px_-18px_rgba(0,0,0,0.65)] rtl:shadow-[-8px_0_34px_-18px_rgba(0,0,0,0.65)] ring-1 ring-inset ring-edge-soft/70"
          style={{
            background: "linear-gradient(180deg, var(--color-surface), var(--color-canvas) 60%)",
          }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-e-[30px]"
          >
            <span
              className="absolute inset-x-0 top-0 h-44"
              style={{
                background:
                  "radial-gradient(125% 80% at 50% -8%, var(--color-accent-soft), transparent 72%)",
              }}
            />
          </span>

          <div
            data-tauri-drag-region
            className={`relative flex h-20 shrink-0 items-center justify-center px-3 ${
              collapsed ? "" : "lg:justify-start lg:px-6"
            }`}
          >
            <button
              type="button"
              onClick={() => setView("home")}
              aria-label={t("chrome.harborHome")}
              className="flex items-center gap-2 text-ink"
            >
              <HarborMark className="harbor-dracula-moon h-7 w-7 shrink-0 text-accent drop-shadow-[0_0_10px_var(--color-accent-soft)] lg:h-[26px] lg:w-[26px]" />
              {!collapsed && (
                <span
                  className="hidden text-[40px] font-medium leading-none tracking-tight lg:inline"
                  style={{ fontFamily: "var(--font-display)", transform: "translateY(1px)" }}
                >
                  Harb
                  <span
                    className="inline-block"
                    style={{ transform: "rotate(8deg)", transformOrigin: "50% 65%" }}
                  >
                    o
                  </span>
                  r
                </span>
              )}
            </button>
          </div>

          <nav className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3 pb-4 pt-1 [scrollbar-width:none] lg:px-4 [&::-webkit-scrollbar]:hidden">
            {primary.filter(isVisible).map((item) => (
              <NavPill
                key={item.id}
                item={item}
                active={view === item.view}
                collapsed={collapsed}
                onClick={() => go(item)}
              />
            ))}

            {collections.filter(isVisible).map((item) => (
              <NavPill
                key={item.id}
                item={item}
                active={view === item.view}
                gated={!!item.pinGated && locked}
                collapsed={collapsed}
                onClick={() => go(item)}
              />
            ))}
          </nav>

          <div className={`relative px-3 pb-3 pt-1 ${collapsed ? "" : "lg:px-4"}`}>
            <div
              aria-hidden
              className="pointer-events-none mb-2 h-px bg-gradient-to-r from-transparent via-edge-soft to-transparent"
            />
            <div className={`mb-1 flex ${collapsed ? "justify-center" : ""}`}>
              <CollapseToggle collapsed={collapsed} />
            </div>
            {locked ? (
              <div
                className={`flex items-center justify-center gap-3 rounded-2xl py-2.5 ${
                  collapsed ? "" : "lg:justify-start lg:px-3"
                }`}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full ring-1 ring-edge-soft text-ink-subtle">
                  <Lock size={16} />
                </div>
                {!collapsed && (
                  <div className="hidden min-w-0 lg:block">
                    <div className="truncate text-[13px] font-medium text-ink-muted">
                      {t("chrome.locked")}
                    </div>
                    <div className="truncate text-[11.5px] text-ink-subtle">
                      {t("chrome.parentalOn")}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <ProfileChip collapsed={collapsed} />
            )}
          </div>
        </div>
      </aside>

      {pinFor !== null && (
        <ParentalPinModal
          mode={{
            kind: "unlock",
            onUnlock: () => {
              const v = pinFor;
              setPinFor(null);
              if (v) setView(v);
            },
            onCancel: () => setPinFor(null),
          }}
          verify={unlock}
        />
      )}
    </>
  );
}

function NavPill({
  item,
  active,
  gated,
  collapsed,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  gated?: boolean;
  collapsed?: boolean;
  onClick: () => void;
}) {
  const t = useT();
  const label = t(item.label);
  return (
    <button
      onClick={onClick}
      aria-label={gated ? t("chrome.lockedRequiresPin", { label }) : label}
      title={gated ? t("chrome.lockedShort", { label }) : label}
      className={`group relative flex h-12 items-center justify-center gap-3.5 rounded-[18px] transition-colors duration-200 ${
        collapsed ? "" : "lg:justify-start lg:px-4"
      } ${active ? "text-accent" : "text-ink-muted hover:text-ink"}`}
    >
      {active ? (
        <span
          aria-hidden
          className="absolute inset-0 rounded-[18px]"
          style={{
            background: "var(--color-accent-soft)",
            boxShadow:
              "inset 0 0 0 1px var(--color-accent-soft), 0 6px 20px -14px var(--color-accent)",
          }}
        />
      ) : (
        <span
          aria-hidden
          className="absolute inset-0 rounded-[18px] bg-elevated/0 transition-colors duration-200 group-hover:bg-elevated/50"
        />
      )}
      <span className={`relative ${gated ? "opacity-70" : ""}`}>
        <HoverNavIcon render={item.render} />
        {gated && (
          <span className="absolute -bottom-1 -end-1 flex h-4 w-4 items-center justify-center rounded-full bg-canvas text-ink-subtle ring-1 ring-edge">
            <Lock size={9} strokeWidth={2.4} />
          </span>
        )}
      </span>
      {!collapsed && (
        <span className="relative hidden flex-1 text-[17px] font-medium tracking-tight lg:inline">
          {label}
        </span>
      )}
    </button>
  );
}
