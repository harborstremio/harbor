import { useState } from "react";
import { usePreviewNavCustomization } from "@/lib/theme-preview";
import { Monitor } from "lucide-react";
import { useContextMenu } from "@/lib/context-menu";
import { NavHiddenTray, NavEditableItem, NavEditClose, useNavDrag } from "@/chrome/nav-edit";
import { useNavEditMode } from "@/chrome/nav-edit-mode";
import { Search } from "@/components/icons/search-icon";
import { HarborMark } from "@/components/icons/harbor-mark";
import { NotificationCenter } from "@/components/notification-center/notification-center";
import { RecordingPill } from "@/chrome/recording-pill";
import { TogetherButton } from "@/chrome/topbar";
import { AccountMenu } from "@/chrome/account-menu/account-menu";
import { useT } from "@/lib/i18n";
import { useSearch } from "@/lib/search-context";
import { useSettings } from "@/lib/settings";
import { getThemeById } from "@/lib/theme";
import { useParental } from "@/lib/parental";
import { useView, type View } from "@/lib/view";
import { ParentalPinModal } from "@/components/parental-pin-modal";
import { close, minimize, toggleMaximize, useMaximized } from "@/lib/window";
import { OverflowNav, type NavEntry } from "@/chrome/nav-overflow";
import { useAvailableNavItems, applyNavCustomization, type NavItem } from "@/chrome/nav-items";
import { useBigPictureEntry } from "@/chrome/use-big-picture-entry";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function TopDock() {
  const { view, setView, chromeHidden } = useView();
  const { locked, unlock, hiddenTabs } = useParental();
  const { settings } = useSettings();
  const { setOpen: setSearchOpen } = useSearch();
  const t = useT();
  const [pinFor, setPinFor] = useState<View | null>(null);
  const maxed = useMaximized();
  const bigPicture = useBigPictureEntry();
  const editing = useNavEditMode();
  const { open: openContextMenu } = useContextMenu();
  const openEmptyMenu = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    openContextMenu(e, { kind: "nav" });
  };

  const themePreset =
    settings.theme.preset !== "custom" ? getThemeById(settings.theme.preset) : null;
  const customMark = themePreset?.logo?.mark ?? null;

  const navigate = (item: NavItem) => {
    if (item.parentalKey && locked && hiddenTabs[item.parentalKey]) {
      setPinFor(item.view);
      return;
    }
    setView(item.view);
  };

  const navEntries: NavEntry[] = applyNavCustomization(
    useAvailableNavItems(),
    usePreviewNavCustomization(settings.navCustomization),
  )
    .filter(
      (item) =>
        item.id !== "settings" &&
        item.id !== "kids" &&
        (item.view !== "vod" || settings.showPlaylistsTab) &&
        (!item.hideKey || !settings.hideContent[item.hideKey]) &&
        (!item.parentalKey || !locked || !hiddenTabs[item.parentalKey]),
    )
    .map((item) => {
      const active = view === item.view;
      const label = t(item.label);
      return {
        key: item.id,
        label,
        active,
        onSelect: () => navigate(item),
        node: <TopDockNavButton item={item} active={active} label={label} navigate={navigate} />,
      };
    });

  return (
    <>
      <header
        data-tv-focus-scope={editing || undefined}
        data-tv-top-chrome
        aria-hidden={chromeHidden}
        className={`fixed inset-x-0 top-0 z-[60] flex h-20 items-center px-4 transition-opacity duration-300 ${
          chromeHidden ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <div
          data-tauri-drag-region
          onContextMenu={openEmptyMenu}
          className="pointer-events-auto flex h-14 w-full items-center gap-2 rounded-full border border-white/20 bg-black/55 ps-4 pe-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_18px_60px_-20px_rgba(0,0,0,0.75)] backdrop-blur-md"
        >
          <button
            type="button"
            tabIndex={-1}
            data-tv-skip="true"
            onClick={() => setView("home")}
            className="flex shrink-0 items-center gap-2 text-ink"
            aria-label={t("chrome.harborHome")}
          >
            {customMark ? (
              <img src={customMark} alt="" draggable={false} className="h-7 w-7 object-contain" />
            ) : (
              <HarborMark className="h-7 w-7" />
            )}
            {themePreset?.id === "crunch" && (
              <span className="font-display text-[22px] font-bold leading-none text-ink">
                Media Vision
              </span>
            )}
          </button>

          <div className="mx-1 h-6 w-px shrink-0 bg-white/15" />

          <OverflowNav
            entries={navEntries}
            gapPx={2}
            className="flex-1"
            moreClassName="relative flex h-9 items-center gap-1 whitespace-nowrap rounded-full px-3 text-[12.5px] font-medium text-ink-muted transition-colors hover:text-ink"
          />

          <div className="ms-2 flex shrink-0 items-center gap-1">
            <RecordingPill />
            <NotificationCenter />
            {view !== "live" && <TogetherButton variant="ghost" connectStyle="tab" />}
            {bigPicture.offer && (
              <IconBtn onClick={bigPicture.open} label={bigPicture.label} active={false}>
                <Monitor size={15} strokeWidth={2.2} />
              </IconBtn>
            )}
            <IconBtn onClick={() => setSearchOpen(true)} label={t("common.search")} active={false}>
              <Search size={15} strokeWidth={2.2} />
            </IconBtn>
            <AccountMenu
              trigger="pill"
              placement="down"
              align="end"
              showSettings
              onOpenSettings={() => setView("settings")}
              settingsActive={view === "settings"}
            />
            {IS_TAURI && !settings.useNativeTitleBar && !settings.hybridTitleBar && (
              <div className="ms-1 flex items-center gap-0.5">
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
                <WinBtn onClick={close} label={t("common.close")}>
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
        {editing && <NavEditClose />}
      </header>
      {editing && (
        <div className="fixed inset-x-0 top-20 z-[59] flex justify-center px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/15 bg-black/70 p-2 shadow-2xl backdrop-blur-xl">
            <NavHiddenTray orientation="horizontal" />
          </div>
        </div>
      )}
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

function TopDockNavButton({
  item,
  active,
  label,
  navigate,
}: {
  item: NavItem;
  active: boolean;
  label: string;
  navigate: (item: NavItem) => void;
}) {
  const { open: openContextMenu } = useContextMenu();
  const editing = useNavEditMode();
  const drag = useNavDrag(item.id, "horizontal");
  return (
    <NavEditableItem itemId={item.id}>
      <button
        type="button"
        onClick={() => navigate(item)}
        onContextMenu={(e) =>
          openContextMenu(e, {
            kind: "nav",
            itemId: item.id,
            view: item.view,
            label,
            onOpen: () => navigate(item),
          })
        }
        data-tauri-drag-region={editing ? "false" : undefined}
        onPointerDown={drag.onPointerDown}
        onKeyDown={drag.onKeyDown}
        data-nav-drop-id={item.id}
        aria-label={label}
        data-harbor-nav={item.id}
        data-active={active ? "" : undefined}
        className={`relative flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[12.5px] font-medium transition-colors ${
          drag.over ? "ring-2 ring-accent" : ""
        } ${active ? "text-ink" : "text-ink-muted hover:text-ink"}`}
      >
        {active && (
          <span
            aria-hidden
            className="absolute inset-0 -z-10 rounded-full bg-white/15 ring-1 ring-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_12px_-2px_rgba(0,0,0,0.3)] backdrop-blur-md"
          />
        )}
        <span data-topdock-icon aria-hidden className="hidden">
          {item.render(active)}
        </span>
        <span data-topdock-label>{label}</span>
      </button>
    </NavEditableItem>
  );
}

function IconBtn({
  onClick,
  label,
  active,
  children,
}: {
  onClick: () => void;
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
        active
          ? "bg-white/20 text-ink ring-1 ring-white/25"
          : "text-ink-muted hover:bg-white/12 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function WinBtn({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-white/15 hover:text-ink"
    >
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        {children}
      </svg>
    </button>
  );
}
