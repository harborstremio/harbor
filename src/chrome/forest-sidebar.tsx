import { Lock } from "lucide-react";
import { useState, type ReactNode } from "react";
import { HarborMark } from "@/components/icons/harbor-mark";
import { ProfileChip } from "@/chrome/sidebar/profile-chip";
import { CollapseToggle } from "@/chrome/sidebar/collapse-toggle";
import { ParentalPinModal } from "@/components/parental-pin-modal";
import { NAV_ITEMS, applyNavCustomization, type NavItem } from "@/chrome/nav-items";
import { isRtl, useT, useUiLanguage } from "@/lib/i18n";
import { useParental } from "@/lib/parental";
import { useSettings } from "@/lib/settings";
import { useView, type View } from "@/lib/view";
import { HoverNavIcon } from "@/chrome/hover-nav-icon";

const SUN = "oklch(0.9 0.12 100)";
const LEAF = "oklch(0.8 0.15 145)";
const MIST = "oklch(0.72 0.05 150)";

const PRIMARY_IDS = new Set<string>([
  "home",
  "discover",
  "movies",
  "shows",
  "kids",
  "anime",
  "live",
  "vod",
]);

export function ForestSidebar() {
  const { view, setView, chromeHidden } = useView();
  const { locked, unlock, hiddenTabs } = useParental();
  const { settings } = useSettings();
  const t = useT();
  const collapsed = settings.sidebarCollapsed;
  const [pinFor, setPinFor] = useState<View | null>(null);

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

  const items = applyNavCustomization(NAV_ITEMS, settings.navCustomization);
  const primary = items.filter((i) => PRIMARY_IDS.has(i.id) && isVisible(i));
  const collections = items.filter((i) => !PRIMARY_IDS.has(i.id) && isVisible(i));

  return (
    <>
      <aside
        aria-hidden={chromeHidden}
        data-tv-nav-zone
        className={`relative z-[60] flex w-[78px] shrink-0 flex-col transition-[opacity,transform,width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[width] ${
          collapsed ? "" : "lg:w-60"
        } ${
          chromeHidden
            ? "pointer-events-none -translate-x-2 rtl:translate-x-2 opacity-0"
            : "translate-x-0 opacity-100"
        }`}
      >
        <div
          className="relative flex min-h-0 flex-1 flex-col"
          style={{
            background: "linear-gradient(180deg, var(--color-elevated), var(--color-canvas) 50%)",
          }}
        >
          <Canopy />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 end-0 w-px"
            style={{ background: tint(LEAF, 0.12) }}
          />

          <div
            data-tauri-drag-region
            className={`relative z-10 flex h-20 shrink-0 items-center justify-center px-3 ${
              collapsed ? "" : "lg:justify-start lg:px-6"
            }`}
          >
            <button
              type="button"
              onClick={() => setView("home")}
              aria-label={t("chrome.harborHome")}
              className="flex items-center gap-2.5 text-ink"
            >
              <HarborMark className="h-[26px] w-[26px] shrink-0 drop-shadow-[0_0_11px_var(--color-accent-soft)]" />
              {!collapsed && (
                <span
                  className="hidden text-[27px] font-medium leading-none lg:inline"
                  style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.2px" }}
                >
                  Harbor
                </span>
              )}
            </button>
          </div>

          <nav className="relative z-10 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-2.5 pb-4 pt-2 [scrollbar-width:none] lg:px-3 [&::-webkit-scrollbar]:hidden">
            {primary.map((item) => (
              <NavRow
                key={item.id}
                item={item}
                active={view === item.view}
                collapsed={collapsed}
                onClick={() => go(item)}
              />
            ))}

            {!collapsed && <SectionLabel>{t("chrome.sectionLibrary")}</SectionLabel>}

            {collections.map((item) => (
              <NavRow
                key={item.id}
                item={item}
                active={view === item.view}
                gated={!!item.pinGated && locked}
                collapsed={collapsed}
                onClick={() => go(item)}
              />
            ))}
          </nav>

          <div className={`relative z-10 shrink-0 px-2.5 pb-3 pt-1 ${collapsed ? "" : "lg:px-3"}`}>
            <MossLine className="mb-2" />
            <div className={`mb-1 flex ${collapsed ? "justify-center" : ""}`}>
              <CollapseToggle collapsed={collapsed} />
            </div>
            {locked ? (
              <div
                className={`flex items-center justify-center gap-3 py-2.5 ${
                  collapsed ? "" : "lg:justify-start lg:px-3"
                }`}
              >
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-subtle"
                  style={{ boxShadow: "inset 0 0 0 1.5px var(--color-edge)" }}
                >
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

function NavRow({
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
  const rtl = isRtl(useUiLanguage());
  const label = t(item.label);
  const glowX = rtl ? "82%" : "18%";
  return (
    <button
      onClick={onClick}
      aria-label={gated ? t("chrome.lockedRequiresPin", { label }) : label}
      title={gated ? t("chrome.lockedShort", { label }) : label}
      className={`group relative flex h-12 items-center justify-center gap-3.5 transition-colors duration-200 ${
        collapsed ? "" : "lg:justify-start lg:px-4"
      } ${active ? "text-accent" : "text-ink-muted hover:text-ink"}`}
    >
      {active ? (
        <span
          aria-hidden
          className="absolute inset-y-0 -start-1 end-2"
          style={{
            background: `radial-gradient(70% 140% at ${glowX} 50%, ${tint(LEAF, 0.22)}, transparent 72%)`,
          }}
        />
      ) : (
        <span
          aria-hidden
          className="absolute inset-y-0 -start-1 end-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          style={{
            background: `radial-gradient(70% 140% at ${glowX} 50%, ${tint(LEAF, 0.1)}, transparent 72%)`,
          }}
        />
      )}
      <span
        className={`relative ${gated ? "opacity-70" : ""} ${active ? "drop-shadow-[0_0_8px_var(--color-accent-soft)]" : ""}`}
      >
        <HoverNavIcon render={item.render} />
        {gated && (
          <span
            className="absolute -bottom-1 -end-1 flex h-4 w-4 items-center justify-center rounded-full bg-canvas text-ink-subtle"
            style={{ boxShadow: "0 0 0 1px var(--color-edge)" }}
          >
            <Lock size={9} strokeWidth={2.4} />
          </span>
        )}
      </span>
      {!collapsed && (
        <span className="relative hidden flex-1 text-start text-[16px] font-medium tracking-tight lg:inline">
          {label}
        </span>
      )}
    </button>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span
      data-tauri-drag-region
      className="hidden px-4 pb-1 pt-5 text-[10.5px] font-semibold uppercase leading-none tracking-[0.18em] text-ink-subtle lg:block"
    >
      {children}
    </span>
  );
}

function MossLine({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`h-px w-full ${className ?? ""}`}
      style={{
        background: `linear-gradient(90deg, transparent, ${tint(LEAF, 0.22)} 22%, ${tint(LEAF, 0.22)} 78%, transparent)`,
      }}
    />
  );
}

function Canopy() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <span
        className="harbor-forest-ray absolute -top-12 left-[-12%] h-[360px] w-[130px] rotate-[20deg] blur-[42px]"
        style={{
          background: `linear-gradient(180deg, ${tint(SUN, 0.17)}, transparent 70%)`,
          opacity: 0.5,
        }}
      />
      <span
        className="harbor-forest-ray absolute -top-20 left-[28%] h-[440px] w-[95px] rotate-[15deg] blur-[50px]"
        style={{
          background: `linear-gradient(180deg, ${tint(LEAF, 0.16)}, transparent 72%)`,
          opacity: 0.45,
          animationDelay: "1.7s",
        }}
      />
      <span
        className="harbor-forest-ray absolute -top-10 left-[64%] h-[320px] w-[80px] rotate-[23deg] blur-[44px]"
        style={{
          background: `linear-gradient(180deg, ${tint(SUN, 0.12)}, transparent 74%)`,
          opacity: 0.4,
          animationDelay: "3.2s",
        }}
      />
      <span
        className="absolute inset-x-0 bottom-0 h-44"
        style={{ background: `linear-gradient(0deg, ${tint(MIST, 0.1)}, transparent)` }}
      />
    </span>
  );
}

function tint(color: string, alpha: number): string {
  return color.replace(")", ` / ${alpha})`);
}
