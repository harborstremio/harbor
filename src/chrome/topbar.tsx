import { ArrowLeft, Search, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BackChrome } from "@/chrome/back-chrome";
import { HarborMark } from "@/components/icons/harbor-mark";
import { TogetherPopover } from "@/components/together-modal";
import { DownloadsButton } from "@/components/downloads-popover";
import { RecordingPill } from "@/chrome/recording-pill";
import {
  effectiveBinding,
  eventToBinding,
  formatBindingForDisplay,
  shouldHandleGlobalKeyboardEvent,
} from "@/lib/hotkeys";
import { useT } from "@/lib/i18n";
import { useActiveKid } from "@/lib/profiles";
import { useSearch } from "@/lib/search-context";
import { useSettings } from "@/lib/settings";
import { useTogether } from "@/lib/together/provider";
import { useSelfIdentity } from "@/lib/together/use-self-identity";
import { activeLayout } from "@/lib/theme";
import { useThemePreview } from "@/lib/theme-preview";
import { useView } from "@/lib/view";
import { useWindowFullscreen } from "@/lib/use-window-fullscreen";
import { toggleWindowFullscreen } from "@/lib/fullscreen-state";
import { close, minimize } from "@/lib/window";
import { ThreeLiquidGlassSurface } from "@/components/ThreeLiquidGlassSurface";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function Topbar({ connecting = false }: { connecting?: boolean } = {}) {
  const { chromeHidden, canGoBack, view, setView, topKind } = useView();
  const { settings } = useSettings();
  const kid = useActiveKid();
  const t = useT();
  const [closeConfirm, setCloseConfirm] = useState(false);
  const preview = useThemePreview();
  const fullscreen = useWindowFullscreen();
  if (chromeHidden && !connecting) return null;
  const layout = kid ? "sidebar" : preview ? preview.layout : activeLayout(settings.theme);
  const onLiveRoot = topKind === "live";
  const sidebarHidden = connecting || view === "settings" || onLiveRoot || topKind === "picker";
  const hideSearch = view === "addons" || connecting || topKind === "picker";
  const sidebarOffset =
    layout === "stremio"
      ? "ps-[80px]"
      : settings.sidebarCollapsed
        ? "ps-[84px]"
        : "ps-[84px] lg:ps-[260px]";
  const searchWidth = canGoBack
    ? "w-[14rem] sm:w-[18rem] lg:w-[22rem] xl:w-[24rem]"
    : "w-[14rem] sm:w-[20rem] lg:w-[24rem] xl:w-[28rem] hover:w-[18rem] sm:hover:w-[24rem] lg:hover:w-[28rem] xl:hover:w-[34rem] focus-within:w-[18rem] sm:focus-within:w-[24rem] lg:focus-within:w-[28rem] xl:focus-within:w-[34rem]";
  const dragProps = IS_TAURI && !fullscreen ? { "data-tauri-drag-region": true } : {};
  return (
    <header
      className={`fixed inset-x-0 top-0 ${topKind === "picker" || connecting ? "z-[130]" : "z-[55]"} h-20`}
    >
      <div
        {...dragProps}
        className="relative z-10 grid h-full grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 sm:px-8"
      >
        <div
          {...dragProps}
          className={
            sidebarHidden
              ? "flex h-full min-w-0 items-center justify-start gap-3"
              : `flex h-full min-w-0 items-center justify-start ${sidebarOffset}`
          }
        >
          {onLiveRoot && (
            <button
              onClick={() => setView("home")}
              aria-label={t("common.back")}
              className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-edge-soft/60 bg-canvas/85 ps-3 pe-4 text-[13.5px] font-medium text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
            >
              <ArrowLeft size={15} strokeWidth={2.2} className="dir-icon" />
              {t("common.back")}
            </button>
          )}
          {onLiveRoot && (
            <div className="flex items-center gap-1.5 text-ink">
              <HarborMark className="h-7 w-7" />
              <span className="font-display text-[18px] font-semibold leading-none tracking-tight">
                {t("Live")}
              </span>
            </div>
          )}
          {!onLiveRoot && !connecting && <BackChrome />}
        </div>
        <div
          {...dragProps}
          className={`min-w-0 max-w-full transition-[width] duration-200 ease-out ${searchWidth}`}
        >
          {!hideSearch && !kid && <SearchPill />}
        </div>
        <div {...dragProps} className="flex h-full min-w-0 items-center justify-end gap-2">
          <RecordingPill />
          <DownloadsButton />
          {!onLiveRoot && !kid && <TogetherButton />}
          {IS_TAURI && !settings.useNativeTitleBar && (
            <div className="ms-1 flex items-center gap-2">
              <Control label={t("chrome.minimize")} onClick={minimize}>
                <svg width="18" height="18" viewBox="0 0 13 13" fill="none">
                  <path
                    d="M3 6.5h7"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              </Control>
              <Control
                label={fullscreen ? t("chrome.restore") : t("chrome.maximize")}
                onClick={() => void toggleWindowFullscreen()}
              >
                <svg width="18" height="18" viewBox="0 0 13 13" fill="none">
                  {fullscreen ? (
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
                </svg>
              </Control>
              <Control
                label={t("common.close")}
                onClick={kid ? () => setCloseConfirm(true) : close}
                danger
              >
                <svg width="18" height="18" viewBox="0 0 13 13" fill="none">
                  <path
                    d="M3.5 3.5l6 6M9.5 3.5l-6 6"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              </Control>
            </div>
          )}
        </div>
      </div>
      {closeConfirm && (
        <CloseConfirmKids onConfirm={close} onCancel={() => setCloseConfirm(false)} />
      )}
    </header>
  );
}

function CloseConfirmKids({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  return createPortal(
    <div
      className="fixed inset-0 z-[290] flex items-center justify-center bg-black/60 px-8 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-[28px] bg-gradient-to-b from-[#3aa6c4] via-[#1c789f] to-[#0c4a6e] p-8 text-center text-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]">
        <img
          src="/kids/doodles/lilbluewhale.png"
          alt=""
          draggable={false}
          className="pointer-events-none absolute -bottom-2 -right-2 h-20 w-auto opacity-85"
          style={{ transform: "scaleX(-1)" }}
        />
        <h2 className="relative font-display text-[32px] font-bold">{t("Close Harbor?")}</h2>
        <p className="relative mt-2 text-[16px] font-medium text-white/85">
          {t("Ask a grown-up before you close.")}
        </p>
        <div className="relative mt-7 flex gap-4">
          <button
            onClick={onCancel}
            autoFocus
            className="h-16 flex-1 rounded-full bg-white text-[20px] font-extrabold text-[#0c4a6e] transition-transform hover:scale-105 active:scale-95"
          >
            {t("Stay")}
          </button>
          <button
            onClick={onConfirm}
            className="h-16 flex-1 rounded-full bg-[#e5484d] text-[20px] font-extrabold text-white transition-transform hover:scale-105 active:scale-95"
          >
            {t("Close")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const TOPBAR_MAX_AVATARS = 3;

export function TogetherButton({
  variant = "chip",
  popoverPlacement = "below-right",
  connectStyle = "popover",
}: {
  variant?: "chip" | "ghost";
  popoverPlacement?: "below-right" | "above-left";
  connectStyle?: "tab" | "popover";
} = {}) {
  const { snapshot, modalOpen, openModal, closeModal, clientId } = useTogether();

  const { avatar: selfAvatar, color: selfColor } = useSelfIdentity();

  const t = useT();
  const live = snapshot.state === "joined";
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!modalOpen) return;

    const onDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        closeModal();
      }
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeModal();
      }
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [modalOpen, closeModal]);

  const visible = snapshot.participants.slice(0, TOPBAR_MAX_AVATARS);

  const overflow = Math.max(0, snapshot.participants.length - TOPBAR_MAX_AVATARS);

  const above = popoverPlacement === "above-left";

  const idleSize = live
    ? variant === "ghost"
      ? "h-9 gap-2 ps-3 pe-2"
      : "h-11 gap-2.5 ps-3 pe-2"
    : variant === "ghost"
      ? "h-9 w-9 justify-center"
      : "h-11 w-11 justify-center";

  const sizing =
    modalOpen && !above ? (live ? "h-14 gap-2 px-3" : "h-14 w-11 justify-center") : idleSize;

  /*
   * شكل الزجاج يتغير عند اتصاله بالـPopover.
   */
  const glassRadius = modalOpen
    ? above
      ? "0 0 8px 8px"
      : "8px 8px 0 0"
    : variant === "ghost"
      ? "9999px"
      : "12px";

  const glassChrome = modalOpen
    ? `z-[51] harbor-together-surface border border-edge text-ink ${
        above ? "border-t-0" : "border-b-0"
      }`
    : `border border-white/[0.10] ${live ? "text-ink" : "text-ink-muted hover:text-ink"}`;

  return (
    <div
      ref={wrapRef}
      className={`relative ${
        modalOpen && !above ? "harbor-wt-wrap flex flex-col self-stretch justify-end" : ""
      }`}
    >
      <ThreeLiquidGlassSurface
        radius={glassRadius}
        shaderRadius={variant === "ghost" ? 1 : modalOpen ? 0.3 : 0.48}
        intensity={0.78}
        style={{
          background: "transparent",
          boxShadow: "none",
        }}
        className={`
          relative inline-flex
          transition-colors duration-150
          ${glassChrome}
          ${modalOpen && !above ? "harbor-wt-tab" : ""}
        `}
        contentClassName="h-full w-full"
      >
        <button
          type="button"
          aria-label={t("chrome.watchTogether")}
          onClick={() => {
            if (modalOpen) {
              closeModal();
            } else {
              openModal();
            }
          }}
          className={`
            harbor-together-btn
            relative flex items-center
            rounded-[inherit]
            border-0 bg-transparent
            outline-none
            transition-colors duration-150
            ${sizing}
          `}
        >
          {live ? (
            <>
              <span className="font-mono text-[11.5px] tracking-[0.22em] text-ink">
                {snapshot.room}
              </span>

              <div className="flex -space-x-1.5">
                {visible.map((participant) => {
                  const self = participant.id === clientId;

                  const fallbackColor = `oklch(0.78 0.13 ${nameHue(participant.name)})`;

                  const avatarSrc = self ? selfAvatar : (participant.avatar ?? null);

                  const color = self
                    ? (selfColor ?? fallbackColor)
                    : (participant.color ?? fallbackColor);

                  if (avatarSrc) {
                    return (
                      <span
                        key={participant.id}
                        title={participant.name}
                        className="
                          flex h-6 w-6
                          items-center justify-center
                          overflow-hidden rounded-full
                          ring-2 ring-elevated
                        "
                        style={{
                          boxShadow: `inset 0 0 0 1.5px ${color}`,
                        }}
                      >
                        <img
                          src={avatarSrc}
                          alt=""
                          draggable={false}
                          className="h-full w-full object-cover"
                        />
                      </span>
                    );
                  }

                  return (
                    <span
                      key={participant.id}
                      title={participant.name}
                      className="
                        flex h-6 w-6
                        items-center justify-center
                        rounded-full
                        text-[10px] font-semibold
                        text-canvas
                        ring-2 ring-elevated
                      "
                      style={{
                        backgroundColor: color,
                      }}
                    >
                      {(participant.name.trim()[0] || "?").toUpperCase()}
                    </span>
                  );
                })}

                {overflow > 0 && (
                  <span
                    className="
                      flex h-6 min-w-[24px]
                      items-center justify-center
                      rounded-full
                      bg-canvas px-1
                      text-[10px] font-semibold
                      text-ink-muted
                      ring-2 ring-elevated
                    "
                  >
                    +{overflow}
                  </span>
                )}
              </div>
            </>
          ) : (
            <Users size={17} strokeWidth={1.9} />
          )}
        </button>
      </ThreeLiquidGlassSurface>

      {modalOpen && (
        <div
          className={`harbor-wt-modal absolute z-50 ${
            above ? "bottom-[calc(100%-1px)] start-0" : "end-0 top-[calc(100%-1px)]"
          }`}
        >
          <TogetherPopover placement={popoverPlacement} connectStyle={connectStyle} />
        </div>
      )}
    </div>
  );
}

function nameHue(name: string): number {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

function SearchPill() {
  const { setOpen } = useSearch();
  const { settings } = useSettings();
  const t = useT();

  const binding = effectiveBinding("globalSearchFocus", settings.hotkeys ?? {});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!shouldHandleGlobalKeyboardEvent(e)) return;
      if (eventToBinding(e) !== binding) return;

      e.preventDefault();
      setOpen(true);
    };

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [binding, setOpen]);

  return (
    <ThreeLiquidGlassSurface
      radius="9999px"
      shaderRadius={0.58}
      intensity={0.9}
      style={{
        background: "transparent",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -1px 0 rgba(0,0,0,0.05)",
      }}
      className="
        h-11 w-full
        border border-white/[0.08]
      "
      contentClassName="flex h-full w-full"
    >
      <button
        type="button"
        data-tauri-drag-region="false"
        onClick={() => setOpen(true)}
        className="
          harbor-search-pill
          flex h-full w-full
          items-center gap-3
          rounded-full
          bg-transparent px-5
          text-start outline-none
        "
      >
        <Search size={16} strokeWidth={1.75} className="shrink-0 text-ink-subtle" />

        <span className="flex-1 truncate text-[14px] text-ink-subtle">
          {t("search.placeholder")}
        </span>

        <kbd
          className="
            hidden shrink-0
            rounded-md
            border border-white/[0.10]
            bg-transparent
            px-1.5 py-0.5
            font-mono text-[10.5px]
            font-medium text-ink-subtle
            sm:inline
          "
        >
          {formatBindingForDisplay(binding)}
        </kbd>
      </button>
    </ThreeLiquidGlassSurface>
  );
}

function Control({
  label,
  onClick,
  danger = false,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={`harbor-win-control ${danger ? "harbor-win-close" : ""} flex h-11 w-12 items-center justify-center rounded-xl bg-elevated/70 text-ink-muted transition-colors duration-150 ${
        danger ? "hover:bg-[#e5484d] hover:text-white" : "hover:bg-elevated hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
