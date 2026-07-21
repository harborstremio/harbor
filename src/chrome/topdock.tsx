import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import { ThreeLiquidGlassSurface } from "@/components/ThreeLiquidGlassSurface";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function TopDock() {
  const { view, setView, chromeHidden } = useView();
  const { locked, unlock, hiddenTabs } = useParental();
  const { settings } = useSettings();

  const navbarLiquidGlassEnabled = true;

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
            data-active={active ? "" : undefined}
            onClick={() => navigate(item)}
            className={`
              relative h-9
              whitespace-nowrap rounded-full
              px-3 text-[12.5px] font-medium
              transition-colors
              ${active ? "text-ink" : "text-ink-muted hover:text-ink"}
            `}
          >
            {active && (
              <span
                aria-hidden
                className={`
                  absolute inset-0 -z-10
                  rounded-full
                  ${
                    navbarLiquidGlassEnabled
                      ? "bg-white/[0.10] ring-1 ring-white/[0.18] backdrop-blur-md"
                      : "bg-white/15 ring-1 ring-white/25 backdrop-blur-md"
                  }
                `}
                style={{
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.22), 0 4px 12px -4px rgba(0,0,0,0.25)",
                }}
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
        className={`
          ${
            navbarLiquidGlassEnabled
              ? "pointer-events-none fixed inset-x-0 top-3 z-[60] px-4"
              : "fixed inset-x-0 top-0 z-[60] flex h-20 items-center px-4"
          }
          transition-opacity duration-300
          ${chromeHidden ? "pointer-events-none opacity-0" : "opacity-100"}
        `}
      >
        {navbarLiquidGlassEnabled ? (
          <ThreeLiquidGlassSurface
            data-tauri-drag-region
            data-tv-top-chrome
            radius="99999px"
            motionSpeed={0.5}
            intensity={1.05}
            shaderRadius={0.58}
            refractionStrength={1.42}
            lensStrength={1.05}
            interactive={false}
            alwaysActive
            causticsStrength={-6}
            className="
              pointer-events-auto
              mx-auto
              h-14 w-full max-w-[1400px]
              rounded-full
              border border-white/[0.14]
            "
            contentClassName="
              flex h-full w-full min-w-0
              items-center gap-2
              overflow-visible
              ps-5 pe-2
            "
            style={{
              background: "rgba(255,255,255,0.001)",
              overflow: "visible",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(110,185,255,0.05)",
            }}
          >
            <button
              type="button"
              onClick={() => setView("home")}
              className="
              flex shrink-0
              items-center gap-2
              text-ink
            "
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
              className="min-w-0 flex-1"
              moreClassName="
              relative flex h-9
              items-center gap-1
              whitespace-nowrap rounded-full
              px-3 text-[12.5px] font-medium
              text-ink-muted
              transition-colors
              hover:text-ink
            "
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

              <ProfileChipCompact
                onOpenSettings={() => setView("settings")}
                settingsActive={view === "settings"}
              />

              {IS_TAURI && !settings.useNativeTitleBar && (
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
          </ThreeLiquidGlassSurface>
        ) : (
          <div
            data-tauri-drag-region
            data-tv-top-chrome
            className="
              pointer-events-auto
              flex h-14 w-full
              items-center gap-2
              rounded-full
              border border-white/20
              bg-black/55
              ps-4 pe-2
              shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_18px_60px_-20px_rgba(0,0,0,0.75)]
              backdrop-blur-md
            "
          >
            <button
              type="button"
              onClick={() => setView("home")}
              className="
              flex shrink-0
              items-center gap-2
              text-ink
            "
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
              className="min-w-0 flex-1"
              moreClassName="
              relative flex h-9
              items-center gap-1
              whitespace-nowrap rounded-full
              px-3 text-[12.5px] font-medium
              text-ink-muted
              transition-colors
              hover:text-ink
            "
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

              <ProfileChipCompact
                onOpenSettings={() => setView("settings")}
                settingsActive={view === "settings"}
              />

              {IS_TAURI && !settings.useNativeTitleBar && (
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
        )}
      </header>

      {pinFor !== null && (
        <ParentalPinModal
          mode={{
            kind: "unlock",

            onUnlock: () => {
              const nextView = pinFor;

              setPinFor(null);

              if (nextView) {
                setView(nextView);
              }
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

  /*
   * This deliberately mirrors TogetherButton:
   * - wrapRef remains inside TopDock
   * - the opened surface is rendered in document.body
   * - the trigger becomes a connected glass tab while open
   */
  const wrapRef = useRef<HTMLDivElement>(null);
  const popoverPortalRef = useRef<HTMLDivElement>(null);

  const [popoverPosition, setPopoverPosition] = useState({
    top: 0,
    left: 0,
    visibility: "hidden" as "hidden" | "visible",
  });

  useTvFocusScope(open, popoverPortalRef);

  useEffect(() => {
    if (!open) return;

    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;

      const insideButton = wrapRef.current?.contains(target) ?? false;

      const insidePopover = popoverPortalRef.current?.contains(target) ?? false;

      if (!insideButton && !insidePopover) {
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
    const popover = popoverPortalRef.current;

    if (!anchor || !popover) return;

    let frameId: number | null = null;

    const updatePosition = () => {
      if (frameId != null) {
        cancelAnimationFrame(frameId);
      }

      frameId = requestAnimationFrame(() => {
        const anchorRect = anchor.getBoundingClientRect();

        const popoverRect = popover.getBoundingClientRect();

        const viewportPadding = 12;

        /*
         * Same connected-tab gap as TogetherButton.
         */
        const gap = -1;

        let top = anchorRect.bottom + gap;

        let left = anchorRect.right - popoverRect.width;

        top = Math.max(
          viewportPadding,
          Math.min(top, window.innerHeight - popoverRect.height - viewportPadding),
        );

        left = Math.max(
          viewportPadding,
          Math.min(left, window.innerWidth - popoverRect.width - viewportPadding),
        );

        setPopoverPosition({
          top,
          left,
          visibility: "visible",
        });
      });
    };

    updatePosition();

    const resizeObserver = new ResizeObserver(updatePosition);

    resizeObserver.observe(anchor);
    resizeObserver.observe(popover);

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

  const color = activeProfile?.color ?? "#7cd6ff";

  const avatarSrc = activeProfile?.avatar ?? settings.harborAvatar ?? user?.avatar ?? null;

  const otherProfiles = profiles.filter((profile) => profile.id !== activeProfile?.id);

  const liquidGlassEnabled = true;

  /*
   * These contrast helpers are active only in Liquid Glass mode.
   */
  const strongTextClass = liquidGlassEnabled
    ? "text-white/[0.96] [text-shadow:0_1px_2px_rgba(0,0,0,0.72)]"
    : "text-ink";

  const subtleTextClass = liquidGlassEnabled
    ? "text-white/[0.64] [text-shadow:0_1px_2px_rgba(0,0,0,0.60)]"
    : "text-ink-subtle";

  const profileItemClass = liquidGlassEnabled
    ? "mx-1 rounded-xl border border-white/[0.08] bg-white/[0.05] text-white/[0.92] hover:border-white/[0.18] hover:bg-white/[0.13] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
    : "rounded-lg hover:bg-white/10";

  const menuButtonClass = liquidGlassEnabled
    ? "mx-1 rounded-xl border border-transparent bg-black/[0.10] text-white/[0.84] hover:border-white/[0.16] hover:bg-white/[0.13] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
    : "text-ink-muted hover:bg-white/10 hover:text-ink";

  const dividerClass = liquidGlassEnabled ? "border-white/[0.14]" : "border-white/10";

  /*
   * These values intentionally match the ghost TogetherButton.
   */
  const sizing = open ? "h-14 gap-2 ps-1 pe-3" : "h-9 gap-2 ps-1 pe-3";

  const glassRadius = open ? "8px 8px 0 0" : "9999px";

  const glassChrome = open
    ? `
      z-[51]
      harbor-together-surface
      border border-white/[0.18] border-b-0
      text-white
      [text-shadow:0_1px_2px_rgba(0,0,0,0.72)]
    `
    : `
      border border-white/[0.12]
      text-white/[0.88]
      [text-shadow:0_1px_2px_rgba(0,0,0,0.68)]
      hover:border-white/[0.22]
      hover:text-white
    `;

  const legacyChrome = open
    ? `
      rounded-b-none rounded-t-lg
      border border-edge border-b-0
      bg-elevated text-ink
    `
    : `
      rounded-full
      border border-transparent
      text-ink-muted
      hover:bg-white/12 hover:text-ink
    `;

  const buttonContent = (
    <>
      <span
        className="
          flex h-7 w-7 shrink-0
          items-center justify-center
          overflow-hidden rounded-full
          ring-1 ring-white/25
        "
        style={{ background: color }}
      >
        {avatarSrc ? (
          <img src={avatarSrc} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <CatAvatar className="h-full w-full" />
        )}
      </span>

      <span className={`hidden max-w-[8rem] truncate sm:inline ${strongTextClass}`}>{name}</span>
    </>
  );

  const dropdownContent = (
    <>
      <TvModalClose onClose={() => setOpen(false)} label={t("common.close")} />

      <div className={`border-b px-4 py-3 ${dividerClass}`}>
        <div className={`text-[13.5px] font-semibold ${strongTextClass}`}>{name}</div>

        {user?.email && (
          <div className={`truncate text-[11.5px] ${subtleTextClass}`}>{user.email}</div>
        )}
      </div>

      {otherProfiles.length > 0 && (
        <div className={`flex flex-col gap-1 border-b p-1.5 ${dividerClass}`}>
          <span
            className={`px-2.5 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] ${subtleTextClass}`}
          >
            {t("profile.switch")}
          </span>

          {otherProfiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              data-tauri-drag-region="false"
              onClick={() => {
                setOpen(false);

                if (profile.passwordHash) {
                  openPicker({
                    kind: "unlock",
                    profileId: profile.id,
                  });
                } else {
                  selectProfile(profile.id);
                }
              }}
              className={`
                flex items-center gap-2
                px-2 py-1.5
                text-start transition-colors
                ${profileItemClass}
              `}
            >
              <span
                className="
                  flex h-6 w-6 shrink-0
                  items-center justify-center
                  overflow-hidden rounded-full
                  text-[10px] font-bold
                  text-canvas
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

              <span className={`truncate text-[12.5px] ${strongTextClass}`}>{profile.name}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col">
        <button
          type="button"
          data-tauri-drag-region="false"
          onClick={() => {
            openPicker({ kind: "list" });
            setOpen(false);
          }}
          className={`
            flex items-center gap-2.5
            px-4 py-2.5 text-start
            text-[13px] transition-colors
            ${menuButtonClass}
          `}
        >
          <Users size={13} strokeWidth={2.2} />
          {t("profile.whoWatching")}
        </button>

        {activeProfile && (
          <button
            type="button"
            data-tauri-drag-region="false"
            onClick={() => {
              openPicker({
                kind: "edit",
                profileId: activeProfile.id,
              });

              setOpen(false);
            }}
            className={`
            flex items-center gap-2.5
            px-4 py-2.5 text-start
            text-[13px] transition-colors
            ${menuButtonClass}
          `}
          >
            <Pencil size={13} strokeWidth={2.2} />
            {t("Edit profile")}
          </button>
        )}

        <button
          type="button"
          data-tauri-drag-region="false"
          onClick={() => {
            onOpenSettings();
            setOpen(false);
          }}
          className={`
            flex items-center gap-2.5
            px-4 py-2.5 text-start
            text-[13px] transition-colors
            ${menuButtonClass}
            ${
              settingsActive
                ? liquidGlassEnabled
                  ? "border-white/[0.20] bg-white/[0.14] text-white"
                  : "text-ink"
                : ""
            }
          `}
        >
          <SettingsIcon size={13} strokeWidth={2.2} />
          {t("nav.settings")}
        </button>

        {user && (
          <button
            type="button"
            data-tauri-drag-region="false"
            onClick={() => {
              signOut();
              setOpen(false);
            }}
            className={`
              flex items-center gap-2.5
              border-t px-4 py-2.5 text-start
              text-[13px] transition-colors
              ${dividerClass}
              ${menuButtonClass}
            `}
          >
            <LogOut size={13} strokeWidth={2.2} />
            {t("Sign out")}
          </button>
        )}
      </div>
    </>
  );

  return (
    <div
      ref={wrapRef}
      className={`
        relative
        ${open ? "harbor-wt-wrap flex flex-col self-stretch justify-end" : ""}
      `}
    >
      {liquidGlassEnabled ? (
        <ThreeLiquidGlassSurface
          radius={glassRadius}
          shaderRadius={1}
          intensity={0.78}
          style={{
            background: open ? "rgba(8,12,18,0.15)" : "rgba(255,255,255,0.028)",
            boxShadow: open
              ? "inset 0 1px 0 rgba(255,255,255,0.17)"
              : "inset 0 1px 0 rgba(255,255,255,0.10)",
          }}
          className={`
            relative inline-flex
            transition-colors duration-150
            ${glassChrome}
            ${open ? "harbor-wt-tab" : ""}
          `}
          contentClassName="h-full w-full"
        >
          <button
            type="button"
            data-tauri-drag-region="false"
            aria-label={name}
            onClick={() => setOpen((current) => !current)}
            data-open={String(open)}
            aria-haspopup="menu"
            aria-expanded={open}
            className={`
              harbor-together-btn
              harbor-profile-btn
              relative flex items-center
              rounded-[inherit]
              border-0 bg-transparent
              outline-none
              transition-colors duration-150
              ${sizing}
            `}
          >
            {buttonContent}
          </button>
        </ThreeLiquidGlassSurface>
      ) : (
        <button
          type="button"
          data-tauri-drag-region="false"
          aria-label={name}
          onClick={() => setOpen((current) => !current)}
          data-open={String(open)}
          aria-haspopup="menu"
          aria-expanded={open}
          className={`
            harbor-together-btn
            harbor-profile-btn
            relative flex items-center
            transition-colors duration-150
            ${open ? "harbor-wt-tab" : ""}
            ${sizing}
            ${legacyChrome}
          `}
        >
          {buttonContent}
        </button>
      )}

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverPortalRef}
            data-tv-focus-scope
            data-tauri-drag-region="false"
            data-profile-dropdown-portal
            className="
              harbor-wt-modal
              fixed z-[300]
              isolate
              w-60
              pointer-events-auto
            "
            style={{
              top: popoverPosition.top,
              left: popoverPosition.left,
              visibility: popoverPosition.visibility,
            }}
          >
            {liquidGlassEnabled ? (
              <ThreeLiquidGlassSurface
                role="menu"
                aria-label={name}
                radius="16px"
                shaderRadius={0.3}
                intensity={0.74}
                refractionStrength={1.42}
                lensStrength={1.05}
                interactive={false}
                alwaysActive
                style={{
                  background: "rgba(7,11,17,0.18)",
                  overflow: "hidden",
                  borderStartEndRadius: 0,
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(110,185,255,0.07), 0 24px 60px -20px rgba(0,0,0,0.76)",
                }}
                className="
                  harbor-together-surface
                  harbor-profile-dropdown
                  w-full overflow-hidden
                  border border-white/15
                  border-t-0
                  shadow-[0_20px_50px_-15px_rgba(0,0,0,0.8)]
                  animate-popover-in
                "
                contentClassName="
                  flex w-full flex-col
                  overflow-hidden
                  text-white/[0.94]
                  [text-shadow:0_1px_2px_rgba(0,0,0,0.66)]
                "
              >
                {dropdownContent}
              </ThreeLiquidGlassSurface>
            ) : (
              <div
                role="menu"
                aria-label={name}
                className="
                  harbor-profile-dropdown
                  w-full overflow-hidden
                  rounded-2xl rounded-se-none
                  border border-t-0
                  border-white/15
                  bg-canvas/95
                  shadow-[0_20px_50px_-15px_rgba(0,0,0,0.8)]
                  backdrop-blur-2xl
                  animate-popover-in
                "
              >
                {dropdownContent}
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
