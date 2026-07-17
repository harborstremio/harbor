import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { LogIn, LogOut, Pencil, Search, Settings as SettingsLucide, Users } from "lucide-react";
import { HarborMark } from "@/components/icons/harbor-mark";
import { CatAvatar } from "@/components/icons/cat-avatar";
import { AuthModal } from "@/components/auth-modal";
import { ParentalPinModal } from "@/components/parental-pin-modal";
import { ThreeLiquidGlassSurface } from "@/components/ThreeLiquidGlassSurface";
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
  isTypingTarget,
} from "@/lib/hotkeys";
import { useSettings } from "@/lib/settings";
import { getThemeById } from "@/lib/theme";
import { useParental } from "@/lib/parental";
import { useView, type View } from "@/lib/view";
import { close, minimize, toggleMaximize, useMaximized } from "@/lib/window";
import { OverflowNav, type NavEntry } from "@/chrome/nav-overflow";
import { NAV_ITEMS, applyNavCustomization, type NavItem } from "@/chrome/nav-items";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function RoyalTopbar() {
  const { view, setView, chromeHidden } = useView();
  const { locked, unlock, hiddenTabs } = useParental();
  const { settings } = useSettings();

  const liquidGlassEnabled = settings.liquidGlassEnabled ?? true;

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
            {item.render(false)}
          </span>
          <span className="hidden xl:inline">{label}</span>
        </button>
      ),
    };
  });

  const royalBarContent = (
    <>
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
              <path d="M3 6.5h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
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
    </>
  );

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
        {liquidGlassEnabled ? (
          <ThreeLiquidGlassSurface
            data-tauri-drag-region
            data-tv-top-chrome
            radius="10px"
            shaderRadius={0.28}
            intensity={0.92}
            refractionStrength={1.3}
            spectralStrength={0.38}
            lensStrength={0.98}
            causticsStrength={0.14}
            motionSpeed={0.42}
            motionStrength={0.42}
            interactive={false}
            alwaysActive
            style={{
              background: "rgba(7,11,17,0.13)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.17), inset 0 -1px 0 rgba(105,180,255,0.05), 0 22px 60px -26px rgba(0,0,0,0.82)",
            }}
            className="
              harbor-royal-bar
              pointer-events-auto
              h-14 w-full
              overflow-visible
              border
              border-[color-mix(in_srgb,var(--color-accent)_22%,rgba(255,255,255,0.12))]
            "
            contentClassName="
              grid h-full w-full
              grid-cols-[1fr_auto]
              items-center gap-3
              overflow-visible
              ps-3.5 pe-2
              text-white/[0.92]
              [text-shadow:0_1px_2px_rgba(0,0,0,0.58)]
              [&_.text-ink]:!text-white/[0.96]
              [&_.text-ink-muted]:!text-white/[0.74]
              [&_.text-ink-subtle]:!text-white/[0.56]
            "
          >
            {royalBarContent}
          </ThreeLiquidGlassSurface>
        ) : (
          <div
            data-tauri-drag-region
            data-tv-top-chrome
            className="harbor-royal-bar pointer-events-auto grid h-14 w-full grid-cols-[1fr_auto] items-center gap-3 rounded-[10px] border border-[color-mix(in_srgb,var(--color-accent)_22%,var(--color-edge))] bg-canvas/85 ps-3.5 pe-2 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--color-accent)_14%,transparent),0_22px_60px_-26px_rgba(0,0,0,0.85)] backdrop-blur-xl"
          >
            {royalBarContent}
          </div>
        )}
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
      if (isTypingTarget(e)) return;
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

  const wrapRef = useRef<HTMLDivElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);

  const [menuPosition, setMenuPosition] = useState({
    top: 0,
    left: 0,
    visibility: "hidden" as "hidden" | "visible",
  });

  useTvFocusScope(open, menuPortalRef);

  const liquidGlassEnabled = settings.liquidGlassEnabled ?? true;

  useEffect(() => {
    if (!open) return;

    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;

      const insideTrigger = wrapRef.current?.contains(target) ?? false;

      const insideMenu = menuPortalRef.current?.contains(target) ?? false;

      if (!insideTrigger && !insideMenu) {
        setOpen(false);
      }
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;

    const anchor = wrapRef.current;
    const menu = menuPortalRef.current;

    if (!anchor || !menu) return;

    let frameId: number | null = null;

    const updatePosition = () => {
      if (frameId != null) {
        cancelAnimationFrame(frameId);
      }

      frameId = requestAnimationFrame(() => {
        const anchorRect = anchor.getBoundingClientRect();

        const menuRect = menu.getBoundingClientRect();

        const viewportPadding = 12;
        const connectedGap = -1;

        let top = anchorRect.bottom + connectedGap;

        let left = anchorRect.right - menuRect.width;

        top = Math.max(
          viewportPadding,
          Math.min(top, window.innerHeight - menuRect.height - viewportPadding),
        );

        left = Math.max(
          viewportPadding,
          Math.min(left, window.innerWidth - menuRect.width - viewportPadding),
        );

        setMenuPosition({
          top,
          left,
          visibility: "visible",
        });
      });
    };

    updatePosition();

    const resizeObserver = new ResizeObserver(updatePosition);

    resizeObserver.observe(anchor);
    resizeObserver.observe(menu);

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      if (frameId != null) {
        cancelAnimationFrame(frameId);
      }

      resizeObserver.disconnect();

      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const name =
    activeProfile?.name ?? user?.fullname ?? user?.email?.split("@")[0] ?? t("profile.fallback");

  const color = activeProfile?.color ?? "#f08032";

  const avatarSrc = activeProfile?.avatar ?? settings.harborAvatar ?? user?.avatar ?? null;

  const otherProfiles = profiles.filter((profile) => profile.id !== activeProfile?.id);

  const dismiss = (run: () => void) => {
    setOpen(false);
    run();
  };

  const triggerContent = (
    <>
      <span
        className="
          flex h-7 w-7 shrink-0
          items-center justify-center
          overflow-hidden rounded-full
          ring-1
          ring-[color-mix(in_srgb,var(--color-accent)_40%,transparent)]
        "
        style={{ background: color }}
      >
        {avatarSrc ? (
          <img src={avatarSrc} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <CatAvatar className="h-full w-full" />
        )}
      </span>

      <span
        className={`
          hidden max-w-[8rem] truncate
          text-[13px] font-medium md:inline
          ${
            liquidGlassEnabled
              ? "text-white/[0.92] [text-shadow:0_1px_2px_rgba(0,0,0,0.62)]"
              : "text-ink-muted"
          }
        `}
      >
        {name}
      </span>
    </>
  );

  const menuContent = (
    <>
      <TvModalClose onClose={() => setOpen(false)} label={t("common.close")} />

      <div
        className={`
          border-b px-4 py-3
          ${liquidGlassEnabled ? "border-white/[0.13]" : "border-edge-soft"}
        `}
      >
        <div
          className={
            liquidGlassEnabled
              ? "text-[14px] leading-tight text-white/[0.96] [text-shadow:0_1px_2px_rgba(0,0,0,0.68)]"
              : "text-[14px] leading-tight text-ink"
          }
          style={{
            fontFamily: "var(--font-display)",
          }}
        >
          {name}
        </div>

        {user?.email && (
          <div
            className={`
              truncate pt-0.5 text-[11.5px]
              ${
                liquidGlassEnabled
                  ? "text-white/[0.58] [text-shadow:0_1px_2px_rgba(0,0,0,0.58)]"
                  : "text-ink-subtle"
              }
            `}
          >
            {user.email}
          </div>
        )}
      </div>

      {otherProfiles.length > 0 && (
        <div
          className={`
            flex flex-col gap-1
            border-b p-1.5
            ${liquidGlassEnabled ? "border-white/[0.13]" : "border-edge-soft"}
          `}
        >
          <span
            className={`
              px-2.5 pb-1 pt-1
              text-[10px] font-bold uppercase
              tracking-[0.16em]
              ${liquidGlassEnabled ? "text-white/[0.58]" : "text-ink-subtle"}
            `}
          >
            {t("profile.switch")}
          </span>

          {otherProfiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              data-tauri-drag-region="false"
              onClick={() =>
                dismiss(() =>
                  profile.passwordHash
                    ? openPicker({
                        kind: "unlock",
                        profileId: profile.id,
                      })
                    : selectProfile(profile.id),
                )
              }
              className={`
                flex items-center gap-2
                px-2 py-1.5 text-start
                transition-colors
                ${
                  liquidGlassEnabled
                    ? "rounded-lg border border-white/[0.07] bg-white/[0.035] hover:border-white/[0.16] hover:bg-white/[0.11]"
                    : "rounded-md hover:bg-elevated"
                }
              `}
            >
              <span
                className="
                  flex h-6 w-6 shrink-0
                  items-center justify-center
                  overflow-hidden rounded-full
                  text-[10px] font-bold text-canvas
                "
                style={{
                  background: profile.color,
                }}
              >
                {profile.avatar ? (
                  <img
                    src={profile.avatar}
                    alt=""
                    draggable={false}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  profile.name.slice(0, 1).toUpperCase()
                )}
              </span>

              <span
                className={
                  liquidGlassEnabled
                    ? "truncate text-[12.5px] text-white/[0.92]"
                    : "truncate text-[12.5px] text-ink"
                }
              >
                {profile.name}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1 p-1">
        <MenuItem
          liquidGlassEnabled={liquidGlassEnabled}
          onClick={() => dismiss(() => openPicker({ kind: "list" }))}
        >
          <Users size={13} strokeWidth={2.2} />
          {t("profile.whoWatching")}
        </MenuItem>

        {activeProfile && (
          <MenuItem
            liquidGlassEnabled={liquidGlassEnabled}
            onClick={() =>
              dismiss(() =>
                openPicker({
                  kind: "edit",
                  profileId: activeProfile.id,
                }),
              )
            }
          >
            <Pencil size={13} strokeWidth={2.2} />
            {t("Edit profile")}
          </MenuItem>
        )}

        <MenuItem
          liquidGlassEnabled={liquidGlassEnabled}
          active={settingsActive}
          onClick={() => dismiss(onOpenSettings)}
        >
          <SettingsLucide size={13} strokeWidth={2.2} />
          {t("nav.settings")}
        </MenuItem>

        {user ? (
          <MenuItem
            liquidGlassEnabled={liquidGlassEnabled}
            bordered
            onClick={() => dismiss(signOut)}
          >
            <LogOut size={13} strokeWidth={2.2} />
            {t("Sign out")}
          </MenuItem>
        ) : (
          <MenuItem
            liquidGlassEnabled={liquidGlassEnabled}
            bordered
            onClick={() => dismiss(() => setAuthOpen(true))}
          >
            <LogIn size={13} strokeWidth={2.2} />
            {t("profile.signIn")}
          </MenuItem>
        )}
      </div>
    </>
  );

  return (
    <>
      <div
        ref={wrapRef}
        className={`
          relative
          ${open && liquidGlassEnabled ? "flex flex-col self-stretch justify-end" : ""}
        `}
      >
        {liquidGlassEnabled ? (
          <ThreeLiquidGlassSurface
            radius={open ? "8px 8px 0 0" : "7px"}
            shaderRadius={open ? 0.3 : 0.5}
            intensity={0.76}
            refractionStrength={1.16}
            spectralStrength={0.28}
            lensStrength={0.88}
            causticsStrength={0.08}
            motionSpeed={0.38}
            motionStrength={0.36}
            interactive={false}
            alwaysActive
            style={{
              background: open ? "rgba(8,13,20,0.17)" : "rgba(255,255,255,0.025)",
              boxShadow: open
                ? "inset 0 1px 0 rgba(255,255,255,0.17)"
                : "inset 0 1px 0 rgba(255,255,255,0.09)",
            }}
            className={`
              relative inline-flex
              border transition-colors
              duration-150
              ${
                open
                  ? "z-[301] border-white/[0.18] border-b-0"
                  : "border-transparent hover:border-white/[0.16]"
              }
            `}
            contentClassName="h-full w-full"
          >
            <button
              type="button"
              data-tauri-drag-region="false"
              onClick={() => setOpen((current) => !current)}
              aria-haspopup="menu"
              aria-expanded={open}
              className={`
                relative flex items-center
                gap-2 border-0 bg-transparent
                ps-1 pe-2.5
                outline-none
                transition-all duration-150
                ${open ? "h-14 rounded-t-[8px] rounded-b-none" : "h-9 rounded-[7px]"}
              `}
            >
              {triggerContent}
            </button>
          </ThreeLiquidGlassSurface>
        ) : (
          <button
            type="button"
            data-tauri-drag-region="false"
            onClick={() => setOpen((current) => !current)}
            aria-haspopup="menu"
            aria-expanded={open}
            className="
              flex h-9 items-center gap-2
              rounded-md border
              border-transparent
              ps-1 pe-2.5
              text-[13px] font-medium
              text-ink-muted
              transition-colors duration-150
              hover:border-[color-mix(in_srgb,var(--color-accent)_30%,transparent)]
              hover:text-ink
            "
          >
            {triggerContent}
          </button>
        )}

        {open &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              ref={menuPortalRef}
              data-tv-focus-scope
              data-tauri-drag-region="false"
              data-royal-profile-menu-portal
              className="
                fixed z-[300] isolate
                w-60 pointer-events-auto
              "
              style={{
                top: menuPosition.top,
                left: menuPosition.left,
                visibility: menuPosition.visibility,
              }}
            >
              {liquidGlassEnabled ? (
                <ThreeLiquidGlassSurface
                  role="menu"
                  aria-label={name}
                  radius="10px"
                  shaderRadius={0.26}
                  intensity={0.92}
                  refractionStrength={1.36}
                  spectralStrength={0.4}
                  lensStrength={1.02}
                  causticsStrength={0.12}
                  motionSpeed={0.42}
                  motionStrength={0.42}
                  interactive={false}
                  alwaysActive
                  style={{
                    background: "rgba(7,11,17,0.17)",
                    overflow: "hidden",
                    borderStartEndRadius: 0,
                    boxShadow:
                      "inset 0 1px 0 rgba(255,255,255,0.17), inset 0 -1px 0 rgba(100,175,255,0.05), 0 24px 60px -18px rgba(0,0,0,0.82)",
                  }}
                  className="
                    harbor-royal-menu
                    w-full overflow-hidden
                    border border-white/[0.16]
                    border-t-0
                    shadow-[0_24px_60px_-18px_rgba(0,0,0,0.82)]
                    animate-popover-in
                  "
                  contentClassName="
                    flex w-full flex-col
                    overflow-hidden
                    text-white/[0.92]
                    [text-shadow:0_1px_2px_rgba(0,0,0,0.62)]
                  "
                >
                  {menuContent}
                </ThreeLiquidGlassSurface>
              ) : (
                <div
                  role="menu"
                  aria-label={name}
                  className="
                    harbor-royal-menu
                    w-full overflow-hidden
                    rounded-[10px]
                    border
                    border-[color-mix(in_srgb,var(--color-accent)_24%,var(--color-edge))]
                    bg-canvas/95
                    shadow-[0_24px_60px_-18px_rgba(0,0,0,0.85)]
                    backdrop-blur-2xl
                    animate-popover-in
                  "
                >
                  {menuContent}
                </div>
              )}
            </div>,
            document.body,
          )}
      </div>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </>
  );
}

function MenuItem({
  onClick,
  active,
  bordered,
  liquidGlassEnabled,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  bordered?: boolean;
  liquidGlassEnabled: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      data-tauri-drag-region="false"
      onClick={onClick}
      className={`
        flex items-center gap-2.5
        rounded-lg px-3 py-2.5
        text-start text-[13px]
        transition-colors
        ${
          liquidGlassEnabled
            ? `
              border border-transparent
              bg-white/[0.035]
              text-white/[0.78]
              hover:border-white/[0.15]
              hover:bg-white/[0.11]
              hover:text-white
              focus-visible:outline-none
              focus-visible:ring-1
              focus-visible:ring-white/30
            `
            : `
              hover:bg-elevated
              hover:text-ink
              ${active ? "text-accent" : "text-ink-muted"}
            `
        }
        ${
          bordered
            ? liquidGlassEnabled
              ? "mt-1 border-t border-white/[0.13] pt-3"
              : "mt-1 border-t border-edge-soft pt-3"
            : ""
        }
        ${active && liquidGlassEnabled ? "border-white/[0.18] bg-white/[0.12] text-white" : ""}
      `}
    >
      {children}
    </button>
  );
}
