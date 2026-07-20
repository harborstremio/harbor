import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Lock } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { HarborMark } from "@/components/icons/harbor-mark";
import { ProfileChip } from "@/chrome/sidebar/profile-chip";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { preloadNavPage } from "@/lib/query";
import { useSettings } from "@/lib/settings";
import { useHarborLogo } from "@/lib/harbor-logo";
import { ParentalPinModal } from "@/components/parental-pin-modal";
import { useParental, type LockableTab } from "@/lib/parental";
import { useActiveKid } from "@/lib/profiles";
import { useView, type View } from "@/lib/view";
import { KidsSidebarDoodles } from "./kids-sidebar-doodles";
import { CollapseToggle } from "@/chrome/sidebar/collapse-toggle";
import { NAV_ITEMS, applyNavCustomization, type NavItem } from "@/chrome/nav-items";

const PRIMARY_IDS = new Set([
  "home",
  "discover",
  "catalogs",
  "movies",
  "shows",
  "kids",
  "anime",
  "live",
  "vod",
]);

export function Sidebar() {
  const { view, setView, chromeHidden } = useView();
  const { locked, unlock, hiddenTabs } = useParental();
  const { settings } = useSettings();
  const kid = useActiveKid();
  const t = useT();
  const [pendingPinView, setPendingPinView] = useState<View | null>(null);

  const { mark: customMark, wordmark: customWordmark } = useHarborLogo();
  const collapsed = settings.sidebarCollapsed;

  return (
    <>
      <aside
        aria-hidden={chromeHidden}
        data-harbor-sidebar
        data-tv-nav-zone
        className={`relative z-[60] flex w-[72px] shrink-0 flex-col border-e border-edge-soft bg-canvas transition-[opacity,transform,width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[width] ${
          collapsed ? "" : "lg:w-60"
        } ${
          chromeHidden
            ? "pointer-events-none -translate-x-2 rtl:translate-x-2 opacity-0"
            : "translate-x-0 opacity-100"
        }`}
      >
        {kid && <KidsSidebarDoodles />}
        <div
          data-tauri-drag-region
          className={`flex h-20 shrink-0 items-center justify-center gap-0.5 px-3 text-ink ${
            collapsed ? "" : "lg:justify-start lg:px-7"
          }`}
        >
          {customMark ? (
            <img
              src={customMark}
              alt=""
              draggable={false}
              className={`h-9 w-9 shrink-0 object-contain ${collapsed ? "" : "lg:h-10 lg:w-10"}`}
            />
          ) : (
            <HarborMark className={`h-9 w-9 shrink-0 ${collapsed ? "" : "lg:h-10 lg:w-10"}`} />
          )}
          {!collapsed &&
            (customWordmark ? (
              <img
                src={customWordmark}
                alt=""
                draggable={false}
                className="hidden h-8 w-auto object-contain lg:inline-block"
              />
            ) : kid ? (
              <span
                className="hidden whitespace-nowrap text-[42px] font-bold leading-none tracking-tight lg:inline-flex lg:items-center"
                style={{
                  fontFamily: '"Fredoka", "Baloo 2", system-ui, sans-serif',
                  transform: "translateY(1px)",
                }}
              >
                Harb
                <img
                  src="/kids/wheel.png"
                  alt="o"
                  draggable={false}
                  className="inline-block h-[0.92em] w-auto"
                  style={{
                    transform: "translateY(0.08em)",
                    marginLeft: "-5px",
                    marginRight: "-5px",
                  }}
                />
                r
              </span>
            ) : (
              <span
                className="hidden whitespace-nowrap text-[44px] font-medium leading-none tracking-tight lg:inline"
                style={{
                  fontFamily: '"Fraunces", "Iowan Old Style", "Georgia", serif',
                  transform: "translateY(2px)",
                }}
              >
                Harb
                <span
                  className="inline-block"
                  style={{ transform: "rotate(7deg)", transformOrigin: "50% 65%" }}
                >
                  o
                </span>
                r
              </span>
            ))}
        </div>
        <ScrollableNav
          view={view}
          setView={setView}
          locked={locked}
          collapsed={collapsed}
          hiddenTabs={hiddenTabs}
          onPinNav={(v) => setPendingPinView(v)}
        />
        <div className={`relative p-2 ${collapsed ? "" : "lg:p-4"}`}>
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-x-2 top-0 h-px bg-gradient-to-r from-transparent via-edge-soft/55 to-transparent ${
              collapsed ? "" : "lg:inset-x-4"
            }`}
          />
          <div className={`flex pb-1 ${collapsed ? "justify-center" : ""}`}>
            <CollapseToggle collapsed={collapsed} />
          </div>
          {locked ? (
            <div
              className={`flex w-full items-center justify-center gap-3 rounded-xl py-2.5 ${
                collapsed ? "" : "lg:justify-start lg:px-3"
              }`}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-edge-soft bg-elevated/50 text-ink-subtle">
                <Lock size={17} />
              </div>
              {!collapsed && (
                <div className="hidden min-w-0 flex-1 lg:block">
                  <div className="truncate text-[13.5px] font-medium text-ink-muted">
                    {t("chrome.locked")}
                  </div>
                  <div className="truncate text-[12px] text-ink-subtle">
                    {t("chrome.parentalOn")}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <ProfileChip collapsed={collapsed} />
          )}
        </div>
      </aside>
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
    </>
  );
}

function ScrollableNav({
  view,
  setView,
  locked,
  collapsed,
  hiddenTabs,
  onPinNav,
}: {
  view: View;
  setView: (v: View) => void;
  locked: boolean;
  collapsed: boolean;
  hiddenTabs: Record<LockableTab, boolean>;
  onPinNav: (v: View) => void;
}) {
  const { settings } = useSettings();
  const { authKey } = useAuth();
  const queryClient = useQueryClient();
  const kid = useActiveKid();
  const t = useT();
  const items = applyNavCustomization(NAV_ITEMS, settings.navCustomization);
  const warm = (view: View) => {
    preloadNavPage(queryClient, view, settings.tmdbKey, settings.region, authKey, settings);
  };
  const isItemVisible = (item: NavItem) => {
    if (kid) return item.view === "kids";
    if (item.view === "kids") return false;
    if (item.view === "vod" && !settings.showPlaylistsTab) return false;
    if (item.hideKey && settings.hideContent[item.hideKey]) return false;
    if (locked && item.parentalKey && hiddenTabs[item.parentalKey]) return false;
    return true;
  };
  const visible = items.filter(isItemVisible);
  const primary = visible.filter((item) => PRIMARY_IDS.has(item.id));
  const collections = visible.filter((item) => !PRIMARY_IDS.has(item.id));
  const ref = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState<{ top: boolean; bottom: boolean }>({
    top: false,
    bottom: false,
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const top = el.scrollTop > 4;
      const bottom = el.scrollHeight - el.scrollTop - el.clientHeight > 4;
      setOverflow((prev) => (prev.top === top && prev.bottom === bottom ? prev : { top, bottom }));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const scrollDown = () => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ top: 112, behavior: "smooth" });
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={ref}
        className="flex flex-1 flex-col overflow-y-auto px-4 pt-3 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex flex-col gap-1.5">
          {primary.map((item) => (
            <NavItem
              key={item.id}
              {...item}
              collapsed={collapsed}
              big={!!kid}
              active={view === item.view}
              onClick={() => setView(item.view)}
              onIntent={() => warm(item.view)}
            />
          ))}
        </div>
        <div data-tauri-drag-region className="py-2.5">
          <div className="mx-3 h-px bg-gradient-to-r from-transparent via-edge-soft/55 to-transparent" />
        </div>
        <div className="flex flex-col gap-1.5">
          {collections.map((item) => {
            const gated = !!item.pinGated && locked;
            return (
              <NavItem
                key={item.id}
                {...item}
                gated={gated}
                collapsed={collapsed}
                active={view === item.view}
                onClick={() => (gated ? onPinNav(item.view) : setView(item.view))}
              />
            );
          })}
        </div>
        <div data-tauri-drag-region className="flex-1 min-h-2" />
      </div>
      {overflow.top && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-canvas to-transparent" />
      )}
      {overflow.bottom && (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-canvas via-canvas/85 to-transparent" />
          <button
            type="button"
            onClick={scrollDown}
            aria-label={t("chrome.scrollForMore")}
            className="absolute bottom-1 left-1/2 flex h-4 w-7 -translate-x-1/2 items-center justify-center text-ink-subtle/55 transition-colors hover:text-ink-muted"
          >
            <ChevronDown size={11} strokeWidth={2} />
          </button>
        </>
      )}
    </div>
  );
}

function NavItem({
  render,
  label,
  active,
  onClick,
  onIntent,
  gated,
  collapsed,
  big,
  view,
}: {
  render: (active: boolean) => ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
  /** TanStack Query preload on hover/focus. */
  onIntent?: () => void;
  gated?: boolean;
  collapsed?: boolean;
  big?: boolean;
  view?: View;
}) {
  const t = useT();
  const text = t(label);
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => {
        setHovered(true);
        onIntent?.();
      }}
      onFocus={() => onIntent?.()}
      onMouseLeave={() => setHovered(false)}
      data-harbor-nav={view}
      data-active={active ? "" : undefined}
      aria-label={gated ? t("chrome.lockedRequiresPin", { label: text }) : text}
      title={gated ? t("chrome.lockedShort", { label: text }) : text}
      className={`relative flex items-center justify-center gap-4 transition-colors duration-150 ${
        big ? "h-[68px] rounded-2xl text-[20px] font-bold" : "h-14 rounded-xl text-[16px]"
      } ${collapsed ? "" : big ? "lg:justify-start lg:px-5" : "lg:justify-start lg:px-4"} ${
        collapsed
          ? active
            ? "text-accent"
            : "text-ink-muted hover:text-ink"
          : active
            ? "bg-elevated text-ink"
            : "text-ink-muted hover:bg-elevated/50 hover:text-ink"
      }`}
    >
      <span className={`relative ${big ? "scale-110" : ""} ${gated ? "opacity-70" : ""}`}>
        {render(hovered)}
        {gated && (
          <span className="absolute -bottom-1 -end-1 flex h-4 w-4 items-center justify-center rounded-full bg-canvas text-ink-subtle ring-1 ring-edge">
            <Lock size={9} strokeWidth={2.4} />
          </span>
        )}
      </span>
      {!collapsed && <span className="hidden lg:inline">{text}</span>}
    </button>
  );
}
