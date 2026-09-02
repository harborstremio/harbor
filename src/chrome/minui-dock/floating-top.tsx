import { ArrowLeft, Monitor } from "lucide-react";
import { Search } from "@/components/icons/search-icon";
import { HarborMark } from "@/components/icons/harbor-mark";
import { NotificationCenter } from "@/components/notification-center/notification-center";
import { AccountMenu } from "@/chrome/account-menu/account-menu";
import { RecordingPill } from "@/chrome/recording-pill";
import { TogetherButton } from "@/chrome/topbar";
import { useBigPictureEntry } from "@/chrome/use-big-picture-entry";
import { useT } from "@/lib/i18n";
import { useSearch } from "@/lib/search-context";
import { useSettings } from "@/lib/settings";
import { getThemeById } from "@/lib/theme";
import { useView } from "@/lib/view";
import { close, minimize, toggleMaximize } from "@/lib/window";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function FloatingTop() {
  const { view, setView, chromeHidden, canGoBack, goBack, topKind, exitPlayback } = useView();
  const { settings } = useSettings();
  const { setOpen: setSearchOpen } = useSearch();
  const t = useT();
  const bigPicture = useBigPictureEntry();

  const themePreset =
    settings.theme.preset !== "custom" ? getThemeById(settings.theme.preset) : null;
  const customMark = themePreset?.logo?.mark ?? null;
  const liveActive = view === "live";
  const showBack = canGoBack && topKind !== "home" && topKind !== "picker";
  const onBack = () => (topKind === "picker" ? exitPlayback() : goBack());

  return (
    <div
      aria-hidden={chromeHidden}
      data-tauri-drag-region
      className={`fixed inset-x-0 top-0 z-[55] flex h-14 items-center gap-2 px-5 transition-opacity duration-300 ${chromeHidden ? "pointer-events-none opacity-0" : "opacity-100"}`}
    >
      <button
        type="button"
        onClick={() => setView("home")}
        className="harbor-minui-mark flex shrink-0 items-center gap-2 rounded-full px-1.5 py-1 text-ink transition-colors"
        aria-label={t("chrome.harborHome")}
      >
        {customMark ? (
          <img src={customMark} alt="" draggable={false} className="h-8 w-8 object-contain" />
        ) : (
          <HarborMark className="h-8 w-8" />
        )}
      </button>
      {showBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label={t("common.back")}
          className="pointer-events-auto flex h-10 shrink-0 items-center gap-2 rounded-full border border-edge-soft bg-surface ps-2.5 pe-4 text-[13px] font-semibold text-ink-muted shadow-[0_2px_8px_-4px_rgba(15,15,18,0.16)] transition-all hover:-translate-y-px hover:border-edge hover:text-ink hover:shadow-[0_4px_12px_-4px_rgba(15,15,18,0.22)]"
        >
          <ArrowLeft size={15} strokeWidth={2.2} className="dir-icon" />
          {t("common.back")}
        </button>
      )}
      <div className="flex flex-1" data-tauri-drag-region />
      <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
        <RecordingPill />
        <NotificationCenter />
        {!liveActive && <TogetherButton variant="ghost" popoverPlacement="below-right" />}
        {bigPicture.offer && (
          <PillBtn label={bigPicture.label} onClick={bigPicture.open}>
            <Monitor size={16} strokeWidth={2.2} />
          </PillBtn>
        )}
        <PillBtn label={t("common.search")} onClick={() => setSearchOpen(true)}>
          <Search size={16} strokeWidth={2.2} />
          <span className="hidden sm:inline">{t("common.search")}</span>
        </PillBtn>
        <AccountMenu trigger="pill" placement="down" align="end" showSettings onOpenSettings={() => setView("settings")} settingsActive={view === "settings"} />
        {IS_TAURI && !settings.useNativeTitleBar && !settings.hybridTitleBar && (
          <div className="ms-1 flex items-center gap-1">
            <WinBtn onClick={minimize} label={t("chrome.minimize")}>
              <path d="M3 6.5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </WinBtn>
            <WinBtn onClick={toggleMaximize} label={t("chrome.maximize")}>
              <rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.5" rx="1.5" />
            </WinBtn>
            <WinBtn onClick={close} label={t("common.close")} danger>
              <path d="M3.5 3.5l6 6M9.5 3.5l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </WinBtn>
          </div>
        )}
      </div>
    </div>
  );
}

function PillBtn({
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
      className="flex h-10 items-center gap-2 rounded-full border border-edge-soft bg-surface px-3.5 text-[13px] font-semibold text-ink-muted shadow-[0_2px_8px_-4px_rgba(15,15,18,0.18)] transition-all hover:-translate-y-px hover:border-edge hover:text-ink hover:shadow-[0_4px_12px_-4px_rgba(15,15,18,0.22)]"
    >
      {children}
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
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-9 w-9 items-center justify-center rounded-full border border-edge-soft bg-surface text-ink-muted shadow-[0_2px_6px_-4px_rgba(15,15,18,0.18)] transition-all hover:-translate-y-px ${danger ? "hover:border-danger/40 hover:text-danger" : "hover:border-edge hover:text-ink"}`}
    >
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        {children}
      </svg>
    </button>
  );
}
