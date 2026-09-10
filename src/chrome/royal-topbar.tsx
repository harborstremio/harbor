import { useEffect, useState, type ReactNode } from "react";
import { Monitor } from "lucide-react";
import { Search } from "@/components/icons/search-icon";
import { HarborMark } from "@/components/icons/harbor-mark";
import { NotificationCenter } from "@/components/notification-center/notification-center";
import { ParentalPinModal } from "@/components/parental-pin-modal";
import { TogetherButton } from "@/chrome/topbar";
import { AccountMenu } from "@/chrome/account-menu/account-menu";
import { useT } from "@/lib/i18n";
import { useSearch } from "@/lib/search-context";
import {
  effectiveBinding,
  eventToBinding,
  formatBindingForDisplay,
  shouldHandleGlobalKeyboardEvent,
} from "@/lib/hotkeys";
import { useSettings } from "@/lib/settings";
import { getThemeById } from "@/lib/theme";
import { useParental } from "@/lib/parental";
import { useView, type View } from "@/lib/view";
import { close, minimize, toggleMaximize, useMaximized } from "@/lib/window";
import { OverflowNav, type NavEntry } from "@/chrome/nav-overflow";
import { NAV_ITEMS, applyNavCustomization, type NavItem } from "@/chrome/nav-items";
import { useBigPictureEntry } from "@/chrome/use-big-picture-entry";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function RoyalTopbar() {
  const { view, setView, chromeHidden } = useView();
  const { locked, unlock, hiddenTabs } = useParental();
  const { settings } = useSettings();
  const { setOpen: setSearchOpen } = useSearch();
  const t = useT();
  const [pinFor, setPinFor] = useState<View | null>(null);
  const maxed = useMaximized();
  const bigPicture = useBigPictureEntry();

  const themePreset =
    settings.theme.preset !== "custom" ? getThemeById(settings.theme.preset) : null;
  const customMark = themePreset?.logo?.mark ?? null;

  const items = applyNavCustomization(NAV_ITEMS, settings.navCustomization);

  const isVisible = (item: NavItem) => {
    if (item.view === "vod" && !settings.showPlaylistsTab) return false;
    if (item.hideKey && settings.hideContent[item.hideKey]) return false;
    if (locked && item.parentalKey && hiddenTabs[item.parentalKey]) return false;
    return true;
  };

  const navigate = (item: NavItem) => {
    const needsPin =
      locked && (item.pinGated || (item.parentalKey && hiddenTabs[item.parentalKey]));
    if (needsPin) setPinFor(item.view);
    else setView(item.view);
  };

  const barItems = items.filter((i) => i.id !== "settings" && i.id !== "kids");
  const navEntries: NavEntry[] = barItems.filter(isVisible).map((item) => {
    const active = view === item.view;
    const label = t(item.label);
    return {
      key: item.id,
      label,
      active,
      onSelect: () => navigate(item),
      node: (
        <button
          type="button"
          onClick={() => navigate(item)}
          aria-label={label}
          title={label}
          className={`relative flex h-9 items-center gap-2 whitespace-nowrap rounded-md px-2.5 text-[13.5px] font-medium leading-none transition-colors duration-150 ${
            active ? "text-accent" : "text-ink-muted hover:text-ink"
          }`}
        >
          {active && (
            <span
              aria-hidden
              className="absolute inset-0 -z-10 rounded-md bg-accent-soft ring-1 ring-[color-mix(in_srgb,var(--color-accent)_22%,transparent)]"
            />
          )}
          <span className="grid h-[18px] w-[18px] place-items-center [&>*]:!h-[18px] [&>*]:!w-[18px] [&>*]:!p-0 [&_svg]:h-[18px] [&_svg]:w-[18px]">
            {item.render(active)}
          </span>
          <span className="hidden xl:inline">{label}</span>
        </button>
      ),
    };
  });

  return (
    <>
      <header
        data-tv-top-chrome
        aria-hidden={chromeHidden}
        className={`fixed inset-x-0 top-0 z-[60] flex h-20 items-center px-4 transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          chromeHidden
            ? "pointer-events-none -translate-y-1.5 opacity-0"
            : "translate-y-0 opacity-100"
        }`}
      >
        <div
          data-tauri-drag-region
          className="harbor-royal-bar pointer-events-auto grid h-14 w-full grid-cols-[1fr_auto] items-center gap-3 rounded-md border border-[color-mix(in_srgb,var(--color-accent)_22%,var(--color-edge))] bg-canvas/85 ps-3.5 pe-2 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--color-accent)_14%,transparent),0_22px_60px_-26px_rgba(0,0,0,0.85)] backdrop-blur-xl"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              tabIndex={-1}
              data-tv-skip="true"
              onClick={() => setView("home")}
              className="flex shrink-0 items-center gap-2.5 text-ink"
              aria-label={t("chrome.harborHome")}
            >
              {customMark ? (
                <img src={customMark} alt="" draggable={false} className="h-7 w-7 object-contain" />
              ) : (
                <HarborMark className="h-7 w-7" />
              )}
              <span
                className="hidden text-[18px] font-medium uppercase leading-none tracking-[0.14em] text-ink lg:inline"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Harbor
              </span>
            </button>

            <Filigree />

            <OverflowNav
              entries={navEntries}
              gapPx={2}
              className="flex-1"
              moreClassName="relative flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-[13.5px] font-medium leading-none text-ink-muted transition-colors duration-150 hover:text-ink"
            />
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <SearchPill onOpen={() => setSearchOpen(true)} />
            <NotificationCenter />
            {view !== "live" && <TogetherButton variant="ghost" />}
            {bigPicture.offer && (
              <button
                type="button"
                onClick={bigPicture.open}
                aria-label={bigPicture.label}
                title={bigPicture.label}
                className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-elevated/60 hover:text-ink"
              >
                <Monitor size={17} strokeWidth={2} />
              </button>
            )}
            <AccountMenu
              trigger="pill"
              placement="down"
              align="end"
              showSettings
              onOpenSettings={() => setView("settings")}
              settingsActive={view === "settings"}
            />
            {IS_TAURI && !settings.useNativeTitleBar && !settings.hybridTitleBar && (
              <div className="ms-0.5 flex items-center gap-1">
                <WinBtn onClick={minimize} label={t("chrome.minimize")}>
                  <path
                    d="M3 6.5h7"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </WinBtn>
                <WinBtn
                  onClick={toggleMaximize}
                  label={maxed ? t("chrome.restore") : t("chrome.maximize")}
                >
                  {maxed ? (
                    <>
                      <rect
                        x="2.5"
                        y="4.5"
                        width="6"
                        height="6"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        rx="1"
                      />
                      <path
                        d="M5 4.5V3a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-.5.5H9"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        fill="none"
                      />
                    </>
                  ) : (
                    <rect
                      x="3"
                      y="3"
                      width="7"
                      height="7"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      rx="1.2"
                    />
                  )}
                </WinBtn>
                <WinBtn onClick={close} label={t("common.close")} danger>
                  <path
                    d="M3.5 3.5l6 6M9.5 3.5l-6 6"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </WinBtn>
              </div>
            )}
          </div>
        </div>
      </header>
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

function Filigree() {
  return (
    <span
      aria-hidden
      className="harbor-royal-filigree relative mx-1 h-6 w-px shrink-0 overflow-hidden"
    >
      <span className="absolute inset-0 bg-[color-mix(in_srgb,var(--color-accent)_42%,transparent)]" />
      <span className="harbor-royal-glint absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(to_bottom,transparent,color-mix(in_srgb,var(--color-accent)_85%,white),transparent)]" />
    </span>
  );
}

function SearchPill({ onOpen }: { onOpen: () => void }) {
  const { settings } = useSettings();
  const t = useT();
  const binding = effectiveBinding("globalSearchFocus", settings.hotkeys ?? {});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!shouldHandleGlobalKeyboardEvent(e)) return;
      if (eventToBinding(e) !== binding) return;
      e.preventDefault();
      onOpen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [binding, onOpen]);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t("common.search")}
      className="group hidden h-9 items-center gap-2.5 rounded-full border border-[color-mix(in_srgb,var(--color-accent)_16%,var(--color-edge))] bg-surface/50 ps-3 pe-2 text-ink-subtle transition-colors duration-150 hover:border-[color-mix(in_srgb,var(--color-accent)_42%,transparent)] hover:bg-surface/80 hover:text-ink-muted sm:flex"
    >
      <Search size={14} strokeWidth={2.2} />
      <span className="hidden text-[12.5px] leading-none md:inline">{t("common.search")}</span>
      <kbd className="ms-2 hidden items-center rounded-[5px] border border-edge-soft bg-elevated/60 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase leading-none text-ink-subtle md:flex">
        {formatBindingForDisplay(binding)}
      </kbd>
    </button>
  );
}

function WinBtn({
  onClick,
  label,
  danger,
  children,
}: {
  onClick: () => void;
  label: string;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-ink-subtle transition-colors duration-150 hover:bg-elevated ${
        danger
          ? "hover:border-[color-mix(in_srgb,var(--color-danger)_45%,transparent)] hover:text-danger"
          : "hover:border-[color-mix(in_srgb,var(--color-accent)_40%,transparent)] hover:text-ink"
      }`}
    >
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        {children}
      </svg>
    </button>
  );
}
