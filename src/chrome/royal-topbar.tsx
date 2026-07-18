import { useEffect, useRef, useState, type ReactNode } from "react";
import { LogIn, LogOut, Pencil, Search, Settings as SettingsLucide, Users } from "lucide-react";
import { HarborMark } from "@/components/icons/harbor-mark";
import { CatAvatar } from "@/components/icons/cat-avatar";
import { AuthModal } from "@/components/auth-modal";
import { ParentalPinModal } from "@/components/parental-pin-modal";
import { TvModalClose } from "@/components/tv-modal-close";
import { TogetherButton } from "@/chrome/topbar";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { useTvFocusScope } from "@/lib/keyboard-navigation";
import { useProfiles } from "@/lib/profiles";
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
import { HoverNavIcon } from "@/chrome/hover-nav-icon";
import { NAV_ITEMS, applyNavCustomization, type NavItem } from "@/chrome/nav-items";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function RoyalTopbar() {
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
          data-harbor-nav={item.view}
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
          <span className="grid h-[18px] w-[18px] place-items-center [&_svg]:h-[18px] [&_svg]:w-[18px]">
            <HoverNavIcon render={item.render} />
          </span>
          <span className="hidden xl:inline">{label}</span>
        </button>
      ),
    };
  });

  return (
    <>
      <header
        aria-hidden={chromeHidden}
        className={`fixed inset-x-0 top-0 z-[60] flex h-20 items-center px-4 transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          chromeHidden
            ? "pointer-events-none -translate-y-1.5 opacity-0"
            : "translate-y-0 opacity-100"
        }`}
      >
        <div
          data-tauri-drag-region
          data-tv-top-chrome
          className="harbor-royal-bar pointer-events-auto grid h-14 w-full grid-cols-[1fr_auto] items-center gap-3 rounded-[10px] border border-[color-mix(in_srgb,var(--color-accent)_22%,var(--color-edge))] bg-canvas/85 ps-3.5 pe-2 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--color-accent)_14%,transparent),0_22px_60px_-26px_rgba(0,0,0,0.85)] backdrop-blur-xl"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
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
            {view !== "live" && <TogetherButton variant="ghost" />}
            <RoyalProfileMenu
              onOpenSettings={() => setView("settings")}
              settingsActive={view === "settings"}
            />
            {IS_TAURI && !settings.useNativeTitleBar && (
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

function RoyalProfileMenu({
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
  const [authOpen, setAuthOpen] = useState(false);
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
  const color = activeProfile?.color ?? "#f08032";
  const avatarSrc = activeProfile?.avatar ?? settings.harborAvatar ?? user?.avatar ?? null;
  const otherProfiles = profiles.filter((p) => p.id !== activeProfile?.id);
  const dismiss = (run: () => void) => {
    setOpen(false);
    run();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 items-center gap-2 rounded-md border border-transparent ps-1 pe-2.5 text-[13px] font-medium text-ink-muted transition-colors duration-150 hover:border-[color-mix(in_srgb,var(--color-accent)_30%,transparent)] hover:text-ink"
      >
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-[color-mix(in_srgb,var(--color-accent)_40%,transparent)]"
          style={{ background: color }}
        >
          {avatarSrc ? (
            <img src={avatarSrc} alt="" className="h-full w-full object-cover" draggable={false} />
          ) : (
            <CatAvatar className="h-full w-full" />
          )}
        </span>
        <span className="hidden max-w-[8rem] truncate md:inline">{name}</span>
      </button>
      {open && (
        <div
          data-tv-focus-scope
          className="harbor-royal-menu absolute end-0 top-[calc(100%+10px)] z-40 w-60 overflow-hidden rounded-[10px] border border-[color-mix(in_srgb,var(--color-accent)_24%,var(--color-edge))] bg-canvas/95 shadow-[0_24px_60px_-18px_rgba(0,0,0,0.85)] backdrop-blur-2xl"
        >
          <TvModalClose onClose={() => setOpen(false)} label={t("common.close")} />
          <div className="border-b border-edge-soft px-4 py-3">
            <div
              className="text-[14px] leading-tight text-ink"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {name}
            </div>
            {user?.email && (
              <div className="truncate pt-0.5 text-[11.5px] text-ink-subtle">{user.email}</div>
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
                  onClick={() =>
                    dismiss(() =>
                      p.passwordHash
                        ? openPicker({ kind: "unlock", profileId: p.id })
                        : selectProfile(p.id),
                    )
                  }
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-start transition-colors hover:bg-elevated"
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
          <div className="flex flex-col py-1">
            <MenuItem onClick={() => dismiss(() => openPicker({ kind: "list" }))}>
              <Users size={13} strokeWidth={2.2} /> {t("profile.whoWatching")}
            </MenuItem>
            {activeProfile && (
              <MenuItem
                onClick={() =>
                  dismiss(() => openPicker({ kind: "edit", profileId: activeProfile.id }))
                }
              >
                <Pencil size={13} strokeWidth={2.2} /> {t("Edit profile")}
              </MenuItem>
            )}
            <MenuItem active={settingsActive} onClick={() => dismiss(onOpenSettings)}>
              <SettingsLucide size={13} strokeWidth={2.2} /> {t("nav.settings")}
            </MenuItem>
            {user ? (
              <MenuItem bordered onClick={() => dismiss(signOut)}>
                <LogOut size={13} strokeWidth={2.2} /> {t("Sign out")}
              </MenuItem>
            ) : (
              <MenuItem bordered onClick={() => dismiss(() => setAuthOpen(true))}>
                <LogIn size={13} strokeWidth={2.2} /> {t("profile.signIn")}
              </MenuItem>
            )}
          </div>
        </div>
      )}
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </div>
  );
}

function MenuItem({
  onClick,
  active,
  bordered,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  bordered?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2.5 px-4 py-2.5 text-start text-[13px] transition-colors hover:bg-elevated hover:text-ink ${
        bordered ? "mt-1 border-t border-edge-soft pt-3" : ""
      } ${active ? "text-accent" : "text-ink-muted"}`}
    >
      {children}
    </button>
  );
}
