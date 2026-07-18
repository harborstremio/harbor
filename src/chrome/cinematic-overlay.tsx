import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LogOut, Pencil, Settings as SettingsIcon, Users } from "lucide-react";
import { CatAvatar } from "@/components/icons/cat-avatar";
import { ThreeLiquidGlassSurface } from "@/components/ThreeLiquidGlassSurface";
import { TvModalClose } from "@/components/tv-modal-close";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { useTvFocusScope } from "@/lib/keyboard-navigation";
import { useProfiles } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";

export function ProfileChipCompact({
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
   * Same structure as TogetherButton:
   * - trigger remains inside TopDock
   * - dropdown is portaled to document.body
   * - trigger itself is also a Liquid Glass surface
   */
  const wrapRef = useRef<HTMLDivElement>(null);
  const dropdownPortalRef = useRef<HTMLDivElement>(null);

  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    visibility: "hidden" as "hidden" | "visible",
  });

  useTvFocusScope(open, dropdownPortalRef);

  useEffect(() => {
    if (!open) return;

    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;

      const insideButton = wrapRef.current?.contains(target) ?? false;

      const insideDropdown = dropdownPortalRef.current?.contains(target) ?? false;

      if (!insideButton && !insideDropdown) {
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
    const dropdown = dropdownPortalRef.current;

    if (!anchor || !dropdown) return;

    let frameId: number | null = null;

    const updatePosition = () => {
      if (frameId != null) {
        cancelAnimationFrame(frameId);
      }

      frameId = requestAnimationFrame(() => {
        const anchorRect = anchor.getBoundingClientRect();

        const dropdownRect = dropdown.getBoundingClientRect();

        const viewportPadding = 12;

        /*
         * -1 makes the glass button and the glass menu
         * visually connect like TogetherButton.
         */
        const gap = -1;

        let top = anchorRect.bottom + gap;

        let left = anchorRect.right - dropdownRect.width;

        top = Math.max(
          viewportPadding,
          Math.min(top, window.innerHeight - dropdownRect.height - viewportPadding),
        );

        left = Math.max(
          viewportPadding,
          Math.min(left, window.innerWidth - dropdownRect.width - viewportPadding),
        );

        setDropdownPosition({
          top,
          left,
          visibility: "visible",
        });
      });
    };

    updatePosition();

    const resizeObserver = new ResizeObserver(updatePosition);

    resizeObserver.observe(anchor);
    resizeObserver.observe(dropdown);

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

  const liquidGlassEnabled = settings.liquidGlassEnabled ?? true;

  /*
   * Same open-state tab treatment used by TogetherButton.
   */
  const triggerRadius = open ? "8px 8px 0 0" : "9999px";

  const triggerChrome = open
    ? "z-[321] border border-edge border-b-0 text-ink"
    : "border border-white/[0.10] text-ink-muted hover:text-ink";

  const triggerSizing = open ? "h-14 gap-2 ps-1 pe-3" : "h-9 gap-2 ps-1 pe-3";

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

      <span className="hidden max-w-[8rem] truncate sm:inline">{name}</span>
    </>
  );

  const dropdownContent = (
    <>
      <TvModalClose onClose={() => setOpen(false)} label={t("common.close")} />

      <div className="border-b border-white/10 px-4 py-3">
        <div className="text-[13.5px] font-semibold text-ink">{name}</div>

        {user?.email && <div className="truncate text-[11.5px] text-ink-subtle">{user.email}</div>}
      </div>

      {otherProfiles.length > 0 && (
        <div className="flex flex-col gap-0.5 border-b border-white/10 p-1.5">
          <span className="px-2.5 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
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
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-start transition-colors hover:bg-white/10"
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-canvas"
                style={{
                  background: profile.color,
                }}
              >
                {profile.name.slice(0, 1).toUpperCase()}
              </span>

              <span className="truncate text-[12.5px] text-ink">{profile.name}</span>
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
          className="flex items-center gap-2.5 px-4 py-2.5 text-start text-[13px] text-ink-muted transition-colors hover:bg-white/10 hover:text-ink"
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
            className="flex items-center gap-2.5 px-4 py-2.5 text-start text-[13px] text-ink-muted transition-colors hover:bg-white/10 hover:text-ink"
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
          className={`flex items-center gap-2.5 px-4 py-2.5 text-start text-[13px] transition-colors hover:bg-white/10 ${
            settingsActive ? "text-ink" : "text-ink-muted hover:text-ink"
          }`}
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
            className="flex items-center gap-2.5 border-t border-white/10 px-4 py-2.5 text-start text-[13px] text-ink-muted transition-colors hover:bg-white/10 hover:text-ink"
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
      className={`relative ${open ? "flex flex-col self-stretch justify-end" : ""}`}
    >
      {liquidGlassEnabled ? (
        <ThreeLiquidGlassSurface
          radius={triggerRadius}
          shaderRadius={open ? 0.3 : 1}
          intensity={0.78}
          style={{
            background: "transparent",
            boxShadow: "none",
          }}
          className={`
            relative inline-flex
            transition-colors duration-150
            ${triggerChrome}
          `}
          contentClassName="h-full w-full"
        >
          <button
            type="button"
            data-tauri-drag-region="false"
            onClick={() => setOpen((value) => !value)}
            data-open={String(open)}
            aria-haspopup="menu"
            aria-expanded={open}
            className={`
              relative flex items-center
              rounded-[inherit]
              border-0 bg-transparent
              outline-none
              transition-all duration-150
              ${triggerSizing}
            `}
          >
            {buttonContent}
          </button>
        </ThreeLiquidGlassSurface>
      ) : (
        <button
          type="button"
          data-tauri-drag-region="false"
          onClick={() => setOpen((value) => !value)}
          data-open={String(open)}
          aria-haspopup="menu"
          aria-expanded={open}
          className={`
            relative flex items-center
            border transition-all duration-150
            ${
              open
                ? "h-14 gap-2 rounded-b-none rounded-t-lg border-edge border-b-0 bg-elevated text-ink ps-1 pe-3"
                : "h-9 gap-2 rounded-full border-transparent text-ink-muted hover:bg-white/12 hover:text-ink ps-1 pe-3"
            }
          `}
        >
          {buttonContent}
        </button>
      )}

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={dropdownPortalRef}
            data-tv-focus-scope
            data-tauri-drag-region="false"
            data-profile-dropdown-portal
            className="
              harbor-profile-dropdown
              fixed z-[320] isolate
              w-60 pointer-events-auto
            "
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              visibility: dropdownPosition.visibility,
            }}
          >
            {liquidGlassEnabled ? (
              <ThreeLiquidGlassSurface
                role="menu"
                aria-label={t("Profile menu")}
                radius="16px"
                shaderRadius={0.3}
                intensity={1.05}
                refractionStrength={1.42}
                spectralStrength={0.5}
                lensStrength={1.05}
                causticsStrength={0}
                motionSpeed={0.5}
                motionStrength={0.6}
                interactive={false}
                alwaysActive
                style={{
                  borderStartEndRadius: 0,
                }}
                className="
                  w-full overflow-hidden
                  border border-white/15
                  border-t-0
                  shadow-[0_20px_50px_-15px_rgba(0,0,0,0.8)]
                "
                contentClassName="
                  flex w-full flex-col
                  overflow-hidden
                "
              >
                {dropdownContent}
              </ThreeLiquidGlassSurface>
            ) : (
              <div
                role="menu"
                aria-label={t("Profile menu")}
                className="
                  w-full overflow-hidden
                  rounded-2xl rounded-se-none
                  border border-t-0 border-white/15
                  bg-canvas/95
                  shadow-[0_20px_50px_-15px_rgba(0,0,0,0.8)]
                  backdrop-blur-2xl
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
