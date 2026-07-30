import { ArrowLeft, Search, Users } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BackChrome } from "@/chrome/back-chrome";
import { HarborMark } from "@/components/icons/harbor-mark";
import { TogetherPopover, TogetherModalShell } from "@/components/together-modal";
import { DownloadsButton } from "@/components/downloads-popover";
import { BookmarksButton } from "@/components/bookmarks-popover";
import { NotificationCenter } from "@/components/notification-center/notification-center";
import { ThreeLiquidGlassSurface } from "@/components/ThreeLiquidGlassSurface";
import { RecordingPill } from "@/chrome/recording-pill";
import { SleepTimerButton } from "@/chrome/sleep-timer-button";
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

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function Topbar({ connecting = false }: { connecting?: boolean } = {}) {
  const { chromeHidden, canGoBack, view, setView, topKind } = useView();
  const { settings } = useSettings();
  const kid = useActiveKid();
  const t = useT();
  const [closeConfirm, setCloseConfirm] = useState(false);
  const preview = useThemePreview();
  const fullscreen = useWindowFullscreen();
  const [scrolled, setScrolled] = useState(false);
  const scrolledRef = useRef(false);
  useEffect(() => {
    const onScroll = (e: Event) => {
      const el = e.target;
      if (!(el instanceof HTMLElement) || el.tagName !== "MAIN") return;
      const next = el.scrollTop > 40;
      if (next !== scrolledRef.current) {
        scrolledRef.current = next;
        setScrolled(next);
      }
    };
    document.addEventListener("scroll", onScroll, true);
    return () => document.removeEventListener("scroll", onScroll, true);
  }, []);
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
  const hybridBar =
    IS_TAURI && !settings.useNativeTitleBar && settings.hybridTitleBar && !fullscreen;
  return (
    <header
      data-cleannav={settings.topbarAppearance === "transparent" ? "on" : undefined}
      className={`fixed inset-x-0 top-0 ${topKind === "picker" || connecting ? "z-[130]" : "z-[55]"} h-20`}
    >
      {settings.topbarScrollBlur && settings.topbarAppearance !== "transparent" && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 transition-opacity duration-[350ms] ease-out"
          style={{
            opacity: scrolled ? 1 : 0,
            background: "color-mix(in oklch, var(--color-canvas), transparent 20%)",
            backdropFilter: "blur(14px) saturate(115%)",
            WebkitBackdropFilter: "blur(14px) saturate(115%)",
            maskImage: "linear-gradient(to bottom, #000 0%, #000 62%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, #000 0%, #000 62%, transparent 100%)",
          }}
        />
      )}
      <div
          {...dragProps}
          className={`relative z-10 grid h-full grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 sm:px-8 ${
            hybridBar ? "pt-11" : ""
          }`}
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
            {!hideSearch && !kid && !hybridBar && <SearchPill />}
          </div>
          <div
            {...dragProps}
            className="flex h-full min-w-0 items-center justify-end gap-2"
          >
          <RecordingPill />
          {settings.navbarSleepTimer && <SleepTimerButton />}
          <DownloadsButton />
          {!kid && <NotificationCenter />}
          {!kid && <BookmarksButton />}
          {!onLiveRoot && !kid && <TogetherButton />}
            {IS_TAURI && !settings.useNativeTitleBar && !settings.hybridTitleBar && (
            <div className="ms-1 flex items-center gap-2">
              <Control label={t("chrome.minimize")} onClick={minimize}>
                <svg width="18" height="18" viewBox="0 0 13 13" fill="none">
                  <path d="M3 6.5h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </Control>
              <Control label={fullscreen ? t("chrome.restore") : t("chrome.maximize")} onClick={() => void toggleWindowFullscreen()}>
                <svg width="18" height="18" viewBox="0 0 13 13" fill="none">
                  {fullscreen ? (
                    <>
                      <rect x="2.5" y="4.5" width="6" height="6" stroke="currentColor" strokeWidth="1.4" rx="1" />
                      <path d="M5 4.5V3a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-.5.5H9" stroke="currentColor" strokeWidth="1.4" fill="none" />
                    </>
                  ) : (
                    <rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.4" rx="1.2" />
                  )}
                </svg>
              </Control>
              <Control label={t("common.close")} onClick={kid ? () => setCloseConfirm(true) : close} danger>
                <svg width="18" height="18" viewBox="0 0 13 13" fill="none">
                  <path d="M3.5 3.5l6 6M9.5 3.5l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
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

function CloseConfirmKids({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
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
  const { snapshot, modalOwner, openModal, closeModal, clientId } = useTogether();
  const { avatar: selfAvatar, color: selfColor } = useSelfIdentity();
  const { settings } = useSettings();
  const cleanModal = settings.topbarAppearance === "transparent";
  const glassControls = settings.topbarAppearance === "glass";
  const t = useT();
  const live = snapshot.state === "joined";
  const wrapRef = useRef<HTMLDivElement>(null);
  const modalId = useId();
  const ownsModal = modalOwner === modalId;

  useEffect(() => {
    if (modalOwner === "auto") openModal(modalId);
  }, [modalId, modalOwner, openModal]);

  useEffect(() => {
    if (!ownsModal || cleanModal) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) closeModal();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [ownsModal, closeModal, cleanModal]);

  const visible = snapshot.participants.slice(0, TOPBAR_MAX_AVATARS);
  const overflow = Math.max(0, snapshot.participants.length - TOPBAR_MAX_AVATARS);

  const above = popoverPlacement === "above-left";
  const tabOpen = ownsModal && !cleanModal && !above;
  const idleSize = live
    ? variant === "ghost"
      ? "h-9 gap-2 ps-3 pe-2"
      : "h-11 gap-2.5 ps-3 pe-2"
    : variant === "ghost"
      ? "h-9 w-9 justify-center"
      : "h-11 w-11 justify-center";
  const sizing = idleSize;
  const idleChrome = `${glassControls ? "border border-white/[0.10]" : "border border-transparent"} ${variant === "ghost" ? "rounded-full" : "rounded-xl"} ${
    live
      ? variant === "ghost"
        ? "text-ink hover:bg-white/12"
        : glassControls ? "text-ink hover:text-ink" : "bg-elevated/70 text-ink hover:bg-elevated"
      : variant === "ghost"
        ? "text-ink-muted hover:bg-white/12 hover:text-ink"
        : glassControls ? "text-ink-muted hover:text-ink" : "bg-elevated/70 text-ink-muted hover:bg-elevated hover:text-ink"
  }`;
  const chrome = tabOpen
    ? `z-[51] harbor-together-surface border border-edge text-ink ${
        above ? "rounded-t-none rounded-b-lg border-t-0" : "rounded-b-none rounded-t-lg border-b-0"
      }`
    : idleChrome;

  const trigger = (
    <button
      type="button"
      data-tauri-drag-region="false"
      aria-label={t("chrome.watchTogether")}
      aria-haspopup="dialog"
      aria-expanded={ownsModal}
      onClick={() => (ownsModal ? closeModal() : openModal(modalId))}
      className={`harbor-together-btn relative flex items-center transition-colors duration-150 ${tabOpen ? "harbor-wt-tab" : ""} ${sizing} ${glassControls ? "rounded-[inherit] bg-transparent outline-none hover:bg-white/[0.06]" : chrome}`}
    >
      {live ? (
        <>
          <span className="font-mono text-[11.5px] tracking-[0.22em] text-ink">
            {snapshot.room}
          </span>
          <div className="flex -space-x-1.5">
            {visible.map((p) => {
              const self = p.id === clientId;
              const fallbackColor = `oklch(0.78 0.13 ${nameHue(p.name)})`;
              const avatarSrc = self ? selfAvatar : p.avatar ?? null;
              const color = self ? selfColor ?? fallbackColor : p.color ?? fallbackColor;
              if (avatarSrc) {
                return (
                  <span
                    key={p.id}
                    title={p.name}
                    className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full ring-2 ring-elevated"
                    style={{ boxShadow: `inset 0 0 0 1.5px ${color}` }}
                  >
                    <img src={avatarSrc} alt="" draggable={false} className="h-full w-full object-cover" />
                  </span>
                );
              }
              return (
                <span
                  key={p.id}
                  title={p.name}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-canvas ring-2 ring-elevated"
                  style={{ backgroundColor: color }}
                >
                  {(p.name.trim()[0] || "?").toUpperCase()}
                </span>
              );
            })}
            {overflow > 0 && (
              <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-canvas px-1 text-[10px] font-semibold text-ink-muted ring-2 ring-elevated">
                +{overflow}
              </span>
            )}
          </div>
        </>
      ) : (
        <Users size={17} strokeWidth={1.9} />
      )}
    </button>
  );

  return (
    <div ref={wrapRef} className="relative">
      {glassControls ? (
        <ThreeLiquidGlassSurface
          radius={tabOpen ? (above ? "0 0 8px 8px" : "8px 8px 0 0") : variant === "ghost" ? "9999px" : "12px"}
          shaderRadius={variant === "ghost" ? 1 : tabOpen ? 0.3 : 0.48}
          intensity={0.9}
          className={`relative inline-flex transition-colors duration-150 ${chrome} ${tabOpen ? "harbor-wt-tab" : ""}`}
          contentClassName="h-full w-full"
        >
          {trigger}
        </ThreeLiquidGlassSurface>
      ) : (
        trigger
      )}
      {ownsModal && !cleanModal && (
        <div
          className={`harbor-wt-modal absolute z-50 ${
            above ? "bottom-[calc(100%-1px)] start-0" : "end-0 top-[calc(100%-1px)]"
          }`}
        >
          <TogetherPopover placement={popoverPlacement} connectStyle={connectStyle} />
        </div>
      )}
      {ownsModal && cleanModal && <TogetherModalShell />}
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
    return () => window.removeEventListener("keydown", onKey);
  }, [binding, setOpen]);

  const pill = (
    <button
      type="button"
      data-tauri-drag-region="false"
      onClick={() => setOpen(true)}
      className={
        settings.liquidGlass
          ? "flex h-full w-full items-center gap-3 rounded-full bg-transparent px-5 text-start outline-none"
          : "harbor-search-pill flex h-11 w-full items-center gap-3 rounded-full border border-edge-soft/60 bg-elevated/80 px-5 text-start outline-none transition-colors duration-200 hover:bg-elevated"
      }
    >
      <Search size={16} strokeWidth={1.75} className="shrink-0 text-ink-subtle" />
      <span className="flex-1 truncate text-[14px] text-ink-subtle">{t("search.placeholder")}</span>
      <kbd className="hidden shrink-0 rounded-md border border-white/[0.10] bg-transparent px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-ink-subtle sm:inline">
        {formatBindingForDisplay(binding)}
      </kbd>
    </button>
  );

  if (!settings.liquidGlass) return pill;

  return (
    <ThreeLiquidGlassSurface
      radius="9999px"
      shaderRadius={0.58}
      intensity={0.9}
      onClick={() => setOpen(true)}
      style={{
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -1px 0 rgba(0,0,0,0.05)",
      }}
      className="harbor-search-pill h-11 w-full border border-white/[0.08]"
      contentClassName="flex h-full w-full"
    >
      {pill}
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
  const { settings } = useSettings();
  const glassControls = settings.topbarAppearance === "glass";
  const button = (
    <button
      type="button"
      data-tauri-drag-region="false"
      aria-label={label}
      onClick={onClick}
      className={`harbor-win-control ${danger ? "harbor-win-close" : ""} flex h-full w-full items-center justify-center rounded-[inherit] bg-transparent text-ink-muted outline-none transition-colors duration-150 ${
        danger ? "hover:bg-[#e5484d] hover:text-white" : "hover:bg-white/[0.06] hover:text-ink"
      }`}
    >
      {children}
    </button>
  );

  if (glassControls) {
    return (
      <ThreeLiquidGlassSurface
        radius="12px"
        shaderRadius={0.48}
        intensity={0.9}
        className="h-11 w-12 shrink-0 border border-white/[0.10]"
        contentClassName="h-full w-full"
      >
        {button}
      </ThreeLiquidGlassSurface>
    );
  }

  return (
    <button
      type="button"
      data-tauri-drag-region="false"
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
