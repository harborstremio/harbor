import { ArrowLeft, LogOut, Pencil, Search, Settings as SettingsIcon, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CatAvatar } from "@/components/icons/cat-avatar";
import { HarborMark } from "@/components/icons/harbor-mark";
import { TvModalClose } from "@/components/tv-modal-close";
import { RecordingPill } from "@/chrome/recording-pill";
import { TogetherButton } from "@/chrome/topbar";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { useTvFocusScope } from "@/lib/keyboard-navigation";
import { useProfiles } from "@/lib/profiles";
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
        {!liveActive && <TogetherButton variant="ghost" popoverPlacement="below-right" />}
        <PillBtn label={t("common.search")} onClick={() => setSearchOpen(true)}>
          <Search size={16} strokeWidth={2.2} />
          <span className="hidden sm:inline">{t("common.search")}</span>
        </PillBtn>
        <ProfilePill
          onOpenSettings={() => setView("settings")}
          settingsActive={view === "settings"}
        />
        {IS_TAURI && !settings.useNativeTitleBar && (
          <div className="ms-1 flex items-center gap-1">
            <WinBtn onClick={minimize} label={t("chrome.minimize")}>
              <path d="M3 6.5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </WinBtn>
            <WinBtn onClick={toggleMaximize} label={t("chrome.maximize")}>
              <rect
                x="3"
                y="3"
                width="7"
                height="7"
                stroke="currentColor"
                strokeWidth="1.5"
                rx="1.5"
              />
            </WinBtn>
            <WinBtn onClick={close} label={t("common.close")} danger>
              <path
                d="M3.5 3.5l6 6M9.5 3.5l-6 6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
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

function ProfilePill({
  onOpenSettings,
  settingsActive,
}: {
  onOpenSettings: () => void;
  settingsActive: boolean;
}) {
  const { user, signOut } = useAuth();
  const { settings } = useSettings();
  const { profiles, activeProfile, openPicker, selectProfile } = useProfiles();
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useTvFocusScope(open, ref);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const name =
    activeProfile?.name ?? user?.fullname ?? user?.email?.split("@")[0] ?? t("profile.fallback");
  const color = activeProfile?.color ?? "var(--color-accent)";
  const harborAvatar = settings.harborAvatar;
  const otherProfiles = profiles.filter((p) => p.id !== activeProfile?.id);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 items-center gap-2 rounded-full border border-edge-soft bg-surface ps-1.5 pe-3 text-[13px] font-semibold text-ink-muted shadow-[0_2px_8px_-4px_rgba(15,15,18,0.18)] transition-all hover:-translate-y-px hover:border-edge hover:text-ink hover:shadow-[0_4px_12px_-4px_rgba(15,15,18,0.22)]"
      >
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2"
          style={{ background: color, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)" }}
        >
          {harborAvatar ? (
            <img
              src={harborAvatar}
              alt=""
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <CatAvatar className="h-full w-full" />
          )}
        </span>
        <span className="hidden max-w-[9rem] truncate sm:inline">{name}</span>
      </button>
      {open && (
        <div
          data-tv-focus-scope
          className="absolute end-0 top-[calc(100%+10px)] z-50 w-64 overflow-hidden rounded-2xl border border-edge bg-surface shadow-[0_24px_60px_-20px_rgba(15,15,18,0.35)]"
        >
          <TvModalClose onClose={() => setOpen(false)} label={t("common.close")} />
          <div className="border-b border-edge-soft px-4 py-3">
            <div className="text-[13.5px] font-semibold text-ink">{name}</div>
            {user?.email && (
              <div className="truncate text-[11.5px] text-ink-subtle">{user.email}</div>
            )}
          </div>
          {otherProfiles.length > 0 && (
            <div className="flex flex-col gap-0.5 border-b border-edge-soft p-1.5">
              <span className="px-2.5 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
                {t("profile.switch")}
              </span>
              {otherProfiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    if (p.passwordHash) openPicker({ kind: "unlock", profileId: p.id });
                    else selectProfile(p.id);
                  }}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-start transition-colors hover:bg-raised"
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-canvas"
                    style={{ background: p.color }}
                  >
                    {p.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="truncate text-[12.5px] text-ink">{p.name}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-col">
            <MenuRow
              onClick={() => {
                openPicker({ kind: "list" });
                setOpen(false);
              }}
              icon={<Users size={14} strokeWidth={2.2} />}
            >
              {t("profile.whoWatching")}
            </MenuRow>
            {activeProfile && (
              <MenuRow
                onClick={() => {
                  openPicker({ kind: "edit", profileId: activeProfile.id });
                  setOpen(false);
                }}
                icon={<Pencil size={14} strokeWidth={2.2} />}
              >
                {t("Edit profile")}
              </MenuRow>
            )}
            <MenuRow
              onClick={() => {
                onOpenSettings();
                setOpen(false);
              }}
              icon={<SettingsIcon size={14} strokeWidth={2.2} />}
              active={settingsActive}
            >
              {t("nav.settings")}
            </MenuRow>
            {user && (
              <MenuRow
                onClick={() => {
                  signOut();
                  setOpen(false);
                }}
                icon={<LogOut size={14} strokeWidth={2.2} />}
                separator
              >
                {t("Sign out")}
              </MenuRow>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MenuRow({
  onClick,
  icon,
  active,
  separator,
  children,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  active?: boolean;
  separator?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2.5 px-4 py-2.5 text-start text-[13.5px] font-medium transition-colors hover:bg-raised ${active ? "text-ink" : "text-ink-muted hover:text-ink"} ${separator ? "border-t border-edge-soft" : ""}`}
    >
      {icon} {children}
    </button>
  );
}
