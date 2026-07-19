import { useEffect, useRef, useState } from "react";
import { LogOut, Pencil, Search, Settings as SettingsIcon, Users } from "lucide-react";
import { HarborMark } from "@/components/icons/harbor-mark";
import { CatAvatar } from "@/components/icons/cat-avatar";
import { RecordingPill } from "@/chrome/recording-pill";
import { TogetherButton } from "@/chrome/topbar";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { useTvFocusScope } from "@/lib/keyboard-navigation";
import { useProfiles } from "@/lib/profiles";
import { useSearch } from "@/lib/search-context";
import { useSettings } from "@/lib/settings";
import { getThemeById } from "@/lib/theme";
import { useParental } from "@/lib/parental";
import { useView, type View } from "@/lib/view";
import { ParentalPinModal } from "@/components/parental-pin-modal";
import { TvModalClose } from "@/components/tv-modal-close";
import { close, minimize, toggleMaximize, useMaximized } from "@/lib/window";
import { OverflowNav, type NavEntry } from "@/chrome/nav-overflow";
import { NAV_ITEMS, applyNavCustomization, type NavItem } from "@/chrome/nav-items";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function TopDock() {
  const { view, setView, chromeHidden } = useView();
  const { locked, unlock, hiddenTabs } = useParental();
  const { settings } = useSettings();
  const { setOpen: setSearchOpen } = useSearch();
  const t = useT();
  const [pinFor, setPinFor] = useState<View | null>(null);
  const maxed = useMaximized();

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

  const navEntries: NavEntry[] = applyNavCustomization(NAV_ITEMS, settings.navCustomization)
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
        node: (
          <button
            type="button"
            data-harbor-nav={item.view}
            onClick={() => navigate(item)}
            className={`relative h-9 whitespace-nowrap rounded-full px-3 text-[12.5px] font-medium transition-colors ${
              active ? "text-ink" : "text-ink-muted hover:text-ink"
            }`}
          >
            {active && (
              <span
                aria-hidden
                className="absolute inset-0 -z-10 rounded-full bg-white/15 ring-1 ring-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_12px_-2px_rgba(0,0,0,0.3)] backdrop-blur-md"
              />
            )}
            {label}
          </button>
        ),
      };
    });

  return (
    <>
      <header
        aria-hidden={chromeHidden}
        className={`fixed inset-x-0 top-0 z-[60] flex h-20 items-center px-4 transition-opacity duration-300 ${
          chromeHidden ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <div
          data-tauri-drag-region
          data-tv-top-chrome
          className="pointer-events-auto flex h-14 w-full items-center gap-2 rounded-full border border-white/20 bg-black/55 ps-4 pe-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_18px_60px_-20px_rgba(0,0,0,0.75)] backdrop-blur-md"
        >
          <button
            type="button"
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
                Harbor
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
            {view !== "live" && <TogetherButton variant="ghost" connectStyle="tab" />}
            <IconBtn
              onClick={() => setSearchOpen(true)}
              label={t("common.search")}
              active={false}
            >
              <Search size={15} strokeWidth={2.2} />
            </IconBtn>
            <ProfileChipCompact onOpenSettings={() => setView("settings")} settingsActive={view === "settings"} />
            {IS_TAURI && !settings.useNativeTitleBar && (
              <div className="ms-1 flex items-center gap-0.5">
                <WinBtn onClick={minimize} label={t("chrome.minimize")}>
                  <path d="M3 6.5h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </WinBtn>
                <WinBtn onClick={toggleMaximize} label={maxed ? t("chrome.restore") : t("chrome.maximize")}>
                  {maxed ? (
                    <>
                      <rect x="2.5" y="4.5" width="6" height="6" stroke="currentColor" strokeWidth="1.4" rx="1" />
                      <path d="M5 4.5V3a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-.5.5H9" stroke="currentColor" strokeWidth="1.4" fill="none" />
                    </>
                  ) : (
                    <rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.4" rx="1.2" />
                  )}
                </WinBtn>
                <WinBtn onClick={close} label={t("common.close")}>
                  <path d="M3.5 3.5l6 6M9.5 3.5l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
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

function ProfileChipCompact({
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
  const color = activeProfile?.color ?? "#7cd6ff";
  const avatarSrc = activeProfile?.avatar ?? settings.harborAvatar ?? user?.avatar ?? null;
  const otherProfiles = profiles.filter((p) => p.id !== activeProfile?.id);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        data-open={String(open)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 items-center gap-2 rounded-full ps-1 pe-3 text-[12.5px] font-medium text-ink-muted transition-colors hover:bg-white/12 hover:text-ink"
      >
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-white/25"
          style={{ background: color }}
        >
          {avatarSrc ? (
            <img src={avatarSrc} alt="" className="h-full w-full object-cover" draggable={false} />
          ) : (
            <CatAvatar className="h-full w-full" />
          )}
        </span>
        <span className="hidden max-w-[8rem] truncate sm:inline">{name}</span>
      </button>
      {open && (
        <div
          data-tv-focus-scope
          className="harbor-profile-dropdown absolute end-0 top-[calc(100%+8px)] z-40 w-60 overflow-hidden rounded-2xl border border-white/15 bg-canvas/95 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.8)] backdrop-blur-2xl"
        >
          <TvModalClose onClose={() => setOpen(false)} label={t("common.close")} />
          <div className="border-b border-white/10 px-4 py-3">
            <div className="text-[13.5px] font-semibold text-ink">{name}</div>
            {user?.email && (
              <div className="truncate text-[11.5px] text-ink-subtle">{user.email}</div>
            )}
          </div>
          {otherProfiles.length > 0 && (
            <div className="flex flex-col gap-0.5 border-b border-white/10 p-1.5">
              <span className="px-2.5 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
                {t("profile.switch")}
              </span>
              {otherProfiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    if (p.passwordHash) {
                      openPicker({ kind: "unlock", profileId: p.id });
                    } else {
                      selectProfile(p.id);
                    }
                  }}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-start transition-colors hover:bg-white/10"
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-bold text-canvas"
                    style={{ background: p.color }}
                  >
                    {p.avatar ? (
                      <img src={p.avatar} alt="" draggable={false} className="h-full w-full object-cover" />
                    ) : (
                      p.name.slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <span className="truncate text-[12.5px] text-ink">{p.name}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-col">
            <button
              type="button"
              onClick={() => {
                openPicker({ kind: "list" });
                setOpen(false);
              }}
              className="flex items-center gap-2.5 px-4 py-2.5 text-start text-[13px] text-ink-muted transition-colors hover:bg-white/10 hover:text-ink"
            >
              <Users size={13} strokeWidth={2.2} /> {t("profile.whoWatching")}
            </button>
            {activeProfile && (
              <button
                type="button"
                onClick={() => {
                  openPicker({ kind: "edit", profileId: activeProfile.id });
                  setOpen(false);
                }}
                className="flex items-center gap-2.5 px-4 py-2.5 text-start text-[13px] text-ink-muted transition-colors hover:bg-white/10 hover:text-ink"
              >
                <Pencil size={13} strokeWidth={2.2} /> {t("Edit profile")}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onOpenSettings();
                setOpen(false);
              }}
              className={`flex items-center gap-2.5 px-4 py-2.5 text-start text-[13px] transition-colors hover:bg-white/10 ${
                settingsActive ? "text-ink" : "text-ink-muted hover:text-ink"
              }`}
            >
              <SettingsIcon size={13} strokeWidth={2.2} /> {t("nav.settings")}
            </button>
            {user && (
              <button
                type="button"
                onClick={() => {
                  signOut();
                  setOpen(false);
                }}
                className="flex items-center gap-2.5 border-t border-white/10 px-4 py-2.5 text-start text-[13px] text-ink-muted transition-colors hover:bg-white/10 hover:text-ink"
              >
                <LogOut size={13} strokeWidth={2.2} /> {t("Sign out")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
