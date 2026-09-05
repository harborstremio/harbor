import { Film, Maximize, Minimize, Plus, Save, Tv, Users, X } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { captureFocusReturn, tvFocus } from "@/lib/keyboard-navigation";
import { isBackKey, isVisible } from "@/lib/keyboard-navigation/geometry";
import {
  CONTROL_META,
  type ControlVariant,
  type PanelCorner,
  type PanelId,
  type PlayerChromeConfig,
  type PlayerControlId,
  type ThemeId,
} from "@/lib/player-chrome";
import type { LayoutProfile } from "@/lib/player-chrome-profiles";
import { renderControl, type ControlContext } from "@/components/player/transport/control-renderer";
import {
  RenderedStremioControl,
  type StremioRenderCtx,
} from "@/components/player/transport/control-renderer-stremio";
import { setPlaybackClock } from "@/lib/player/playback-clock";
import { useT } from "@/lib/i18n";
import { DefaultLayout, FauxBackdrop, StremioLayout, TopRow } from "./editor-chrome";
import { buildDefaultCtx, buildStremioCtx, type PlayerMode } from "./editor-mock-ctx";
import { EditorPanels } from "./editor-panels";
import { FloatingInspector } from "./floating-inspector";
import { ProfilePicker } from "./profile-picker";
import { usePreviewBackdrop } from "./use-preview-backdrop";
import { stripArrowKeys } from "../shared";

const OVERLAY_LABEL =
  "text-[13px] font-extrabold uppercase leading-[17px] tracking-[0.72px]";

type Props = {
  theme: ThemeId;
  config: PlayerChromeConfig;
  selectedId: PlayerControlId | null;
  onSelect: (id: PlayerControlId | null) => void;
  selectedPanelId: PanelId | null;
  onSelectPanel: (id: PanelId | null) => void;
  onSetPanelCorner: (id: PanelId, corner: PanelCorner) => void;
  onTogglePanelHidden: (id: PanelId) => void;
  onClose: () => void;
  onMoveSlot: (dir: -1 | 1) => void;
  onMoveOrder: (dir: -1 | 1) => void;
  onToggleHidden: () => void;
  onResetControl: () => void;
  onSetCustomIcon: (id: PlayerControlId, dataUrl: string | null, state?: string) => void;
  onSetVariant: (id: PlayerControlId, variant: ControlVariant | null) => void;
  profiles: LayoutProfile[];
  activeProfileId: string | null;
  dirty: boolean;
  justSaved: boolean;
  onSave: () => void;
  onSwitchProfile: (id: string) => void;
  onSaveAsNew: (name: string) => void;
  onRenameProfile: (newName: string) => void;
  onDeleteProfile: () => void;
  onExportProfile: () => void;
  onImportProfile: (text: string) => void;
  onResetToDefaults: () => void;
  onUnhide: (id: PlayerControlId) => void;
};

export function EditorOverlay({
  theme,
  config,
  selectedId,
  onSelect,
  selectedPanelId,
  onSelectPanel,
  onSetPanelCorner,
  onTogglePanelHidden,
  onClose,
  onMoveSlot,
  onMoveOrder,
  onToggleHidden,
  onResetControl,
  onSetCustomIcon,
  onSetVariant,
  profiles,
  activeProfileId,
  dirty,
  justSaved,
  onSave,
  onSwitchProfile,
  onSaveAsNew,
  onRenameProfile,
  onDeleteProfile,
  onExportProfile,
  onImportProfile,
  onResetToDefaults,
  onUnhide,
}: Props) {
  const t = useT();
  const chromeRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const [chromeW, setChromeW] = useState(0);
  const [winSize, setWinSize] = useState(() => ({
    w: window.innerWidth,
    h: window.innerHeight,
  }));
  const [isFs, setIsFs] = useState(false);
  const [mode, setMode] = useState<PlayerMode>("normal");
  const previewBg = usePreviewBackdrop();
  const [previewStates, setPreviewStates] = useState<Partial<Record<PlayerControlId, string>>>({});
  const setPreviewState = (id: PlayerControlId, state: string) =>
    setPreviewStates((cur) => ({ ...cur, [id]: state }));
  const handleSetMode = (m: PlayerMode) => {
    setMode(m);
    onSelect(null);
    onSelectPanel(null);
    setPreviewStates({});
  };

  const focusHeader = () => {
    const el = headerRef.current?.querySelector<HTMLElement>("button:not([disabled])");
    if (el) tvFocus(el);
  };

  useEffect(() => {
    document.body.style.overflow = "hidden";
    setPlaybackClock(1342, 1500);
    const restore = captureFocusReturn();
    const land =
      rootRef.current?.querySelector<HTMLElement>(
        "[data-control-id][data-tv-initial-focus], [data-panel-id][data-tv-initial-focus]",
      ) ?? headerRef.current?.querySelector<HTMLElement>("button:not([disabled])");
    if (land) tvFocus(land);
    return () => {
      document.body.style.overflow = "";
      setPlaybackClock(0, 0);
      restore();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || !isBackKey(e)) return;
      const stacked = Array.from(
        document.querySelectorAll<HTMLElement>('[role="dialog"], [role="menu"]'),
      ).some((el) => el !== rootRef.current && isVisible(el));
      if (stacked) return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const onResize = () => setWinSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const fs = await getCurrentWindow().isFullscreen();
        if (!cancelled) setIsFs(fs);
      } catch {
        if (!cancelled) setIsFs(document.fullscreenElement != null);
      }
    };
    check();
    window.addEventListener("resize", check);
    document.addEventListener("fullscreenchange", check);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", check);
      document.removeEventListener("fullscreenchange", check);
    };
  }, []);

  useEffect(() => {
    const el = chromeRef.current;
    if (!el) return;
    const measure = () => setChromeW(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const mid = chromeW > 0 && chromeW < 1300;
  const compact = chromeW > 0 && chromeW < 1000;
  const tight = chromeW > 0 && chromeW < 600;
  const sizeLabel = tight ? t("Tight") : compact ? t("Compact") : mid ? t("Mid") : t("Wide");

  const controlVariants = useMemo(
    () => Object.fromEntries(config.controls.map((c) => [c.id, c.variant ?? "auto"])),
    [config.controls],
  );

  const ctx = useMemo(() => {
    const opts = {
      mid,
      compact,
      tight,
      mode,
      customIcons: config.customIcons,
      controlVariants,
      timeFormat: config.options.timeFormat,
      volumeStyle: config.options.volumeStyle,
      previewStates,
    };
    return theme === "stremio" ? buildStremioCtx(opts) : buildDefaultCtx(opts);
  }, [
    theme,
    mid,
    compact,
    tight,
    mode,
    config.customIcons,
    controlVariants,
    config.options.timeFormat,
    config.options.volumeStyle,
    previewStates,
  ]);

  const renderOne = (id: PlayerControlId) => {
    if (theme === "stremio")
      return <RenderedStremioControl id={id} ctx={ctx as StremioRenderCtx} />;
    return renderControl(id, ctx as ControlContext);
  };

  const selectControl = (id: PlayerControlId | null) => {
    onSelect(id);
    if (id) onSelectPanel(null);
  };

  const toggleFullscreen = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      const current = await win.isFullscreen();
      await win.setFullscreen(!current);
      setIsFs(!current);
    } catch {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else {
          await document.documentElement.requestFullscreen();
        }
      } catch {}
    }
  };

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[300] flex flex-col bg-black text-white"
    >
      <header
        ref={headerRef}
        className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-3 px-8 py-4"
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className={`${OVERLAY_LABEL} text-white/60`}>
            {t("Layout editor")} · {theme === "stremio" ? t("Stremio") : t("Default")}
          </span>
          <h2 className="font-display text-[22px] font-medium tracking-tight">
            {t("Click any control to edit it.")}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ModeSwitch mode={mode} onChange={handleSetMode} />
          <ProfilePicker
            profiles={profiles}
            activeProfileId={activeProfileId}
            onSwitch={onSwitchProfile}
            onSaveAsNew={onSaveAsNew}
            onRename={onRenameProfile}
            onDelete={onDeleteProfile}
            onExport={onExportProfile}
            onImport={onImportProfile}
            onResetToDefaults={onResetToDefaults}
          />
          <button
            type="button"
            onClick={onSave}
            disabled={!dirty && !justSaved}
            className={`harbor-press-pop flex h-11 items-center gap-2 rounded-md px-4 text-[15px] font-semibold transition-opacity ${
              justSaved
                ? "bg-accent text-black"
                : dirty
                  ? "bg-white text-black hover:opacity-90"
                  : "cursor-not-allowed bg-white/8 text-white/35"
            }`}
          >
            <Save size={17} strokeWidth={2.4} />
            {justSaved ? t("Saved") : t("Save")}
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFs ? t("Exit fullscreen") : t("Enter fullscreen")}
            title={isFs ? t("Exit fullscreen") : t("Enter fullscreen")}
            className="flex h-11 w-11 items-center justify-center rounded-md bg-white/8 text-white/85 transition-colors hover:bg-white/15 hover:text-white"
          >
            {isFs ? (
              <Minimize size={17} strokeWidth={2.4} />
            ) : (
              <Maximize size={17} strokeWidth={2.4} />
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Close editor")}
            className="flex h-11 items-center gap-2 rounded-md bg-white/8 px-4 text-[15px] font-semibold text-white/85 transition-colors hover:bg-white/15 hover:text-white"
          >
            <X size={17} strokeWidth={2.4} />
            {t("Close")}
          </button>
        </div>
      </header>

      <HiddenTray
        config={config}
        mode={mode}
        onUnhide={onUnhide}
        onSelect={onSelect}
        onEmptied={focusHeader}
      />

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <FauxBackdrop width={winSize.w} height={winSize.h} sizeLabel={sizeLabel} bg={previewBg} />

        <TopRow
          theme={theme}
          config={config}
          selectedId={selectedId}
          onSelect={selectControl}
          renderOne={renderOne}
        />

        <EditorPanels
          config={config}
          selectedPanelId={selectedPanelId}
          onSelect={(id) => {
            onSelectPanel(id);
            if (id) onSelect(null);
          }}
          mode={mode}
        />

        <FloatingInspector
          config={config}
          selectedId={selectedId}
          onSelect={(id) => {
            onSelect(id);
            if (id) onSelectPanel(null);
          }}
          selectedPanelId={selectedPanelId}
          onSelectPanel={onSelectPanel}
          onSetPanelCorner={onSetPanelCorner}
          onTogglePanelHidden={onTogglePanelHidden}
          onMoveSlot={onMoveSlot}
          onMoveOrder={onMoveOrder}
          onToggleHidden={onToggleHidden}
          onResetControl={onResetControl}
          onSetCustomIcon={onSetCustomIcon}
          onSetVariant={onSetVariant}
          previewStates={previewStates}
          onSetPreviewState={setPreviewState}
        />

        <div
          ref={chromeRef}
          className={
            theme === "stremio"
              ? "absolute inset-x-0 bottom-0 z-30 flex flex-col gap-1 bg-gradient-to-t from-black/35 to-transparent px-8 pb-3 pt-12"
              : `absolute inset-x-0 bottom-0 z-30 flex flex-col gap-2.5 bg-gradient-to-t from-black/70 via-black/25 to-transparent ${
                  tight ? "px-3 pt-6 pb-3" : "px-7 pt-10 pb-5"
                }`
          }
        >
          {theme === "default" ? (
            <DefaultLayout
              config={config}
              selectedId={selectedId}
              onSelect={selectControl}
              renderOne={renderOne}
              isLive={mode === "live"}
              compact={compact}
            />
          ) : (
            <StremioLayout
              config={config}
              selectedId={selectedId}
              onSelect={selectControl}
              renderOne={renderOne}
              isLive={mode === "live"}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

const LIVE_ONLY_CONTROLS = new Set<PlayerControlId>(["dvr"]);
const NOT_IN_LIVE_CONTROLS = new Set<PlayerControlId>([
  "download",
  "seek-back",
  "seek-forward",
  "prev-episode",
  "next-episode",
]);

function controlAppliesToMode(id: PlayerControlId, mode: PlayerMode): boolean {
  if (mode === "live") return !NOT_IN_LIVE_CONTROLS.has(id);
  return !LIVE_ONLY_CONTROLS.has(id);
}

function HiddenTray({
  config,
  mode,
  onUnhide,
  onSelect,
  onEmptied,
}: {
  config: PlayerChromeConfig;
  mode: PlayerMode;
  onUnhide: (id: PlayerControlId) => void;
  onSelect: (id: PlayerControlId | null) => void;
  onEmptied: () => void;
}) {
  const t = useT();
  const chipRefs = useRef(new Map<PlayerControlId, HTMLButtonElement>());
  const pending = useRef<PlayerControlId | null>(null);
  const hidden = config.controls.filter((c) => c.hidden && controlAppliesToMode(c.id, mode));

  useLayoutEffect(() => {
    const id = pending.current;
    if (!id) return;
    pending.current = null;
    const el = chipRefs.current.get(id);
    if (el) tvFocus(el);
  });

  if (hidden.length === 0) return null;
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3 px-8 pb-3">
      <span className={`shrink-0 ${OVERLAY_LABEL} text-white/60`}>{t("Hidden")}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {hidden.map((c, i) => (
          <button
            key={c.id}
            type="button"
            ref={(el) => {
              if (el) chipRefs.current.set(c.id, el);
              else chipRefs.current.delete(c.id);
            }}
            onClick={() => {
              const next = hidden[i + 1] ?? hidden[i - 1] ?? null;
              if (next) pending.current = next.id;
              else onEmptied();
              onUnhide(c.id);
              onSelect(c.id);
            }}
            title={t("Show {label}", { label: t(CONTROL_META[c.id]?.label ?? c.id) })}
            className="flex h-11 shrink-0 items-center gap-2 rounded-md bg-white/8 ps-3 pe-4 text-[15px] font-medium text-white/80 transition-colors hover:bg-white/15 hover:text-white"
          >
            <Plus size={16} strokeWidth={2.6} />
            <span className="max-w-[160px] truncate">{t(CONTROL_META[c.id]?.label ?? c.id)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const MODE_ORDER: PlayerMode[] = ["normal", "live", "together"];

function ModeSwitch({ mode, onChange }: { mode: PlayerMode; onChange: (m: PlayerMode) => void }) {
  const t = useT();
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div
      onKeyDown={stripArrowKeys(btnRefs, (i) => onChange(MODE_ORDER[i]))}
      className="flex h-11 items-center gap-0.5 rounded-md bg-white/8"
    >
      <ModePill
        btnRef={(el) => {
          btnRefs.current[0] = el;
        }}
        active={mode === "normal"}
        onClick={() => onChange("normal")}
        icon={<Film size={16} strokeWidth={2.4} />}
      >
        {t("Normal")}
      </ModePill>
      <ModePill
        btnRef={(el) => {
          btnRefs.current[1] = el;
        }}
        active={mode === "live"}
        onClick={() => onChange("live")}
        icon={<Tv size={16} strokeWidth={2.4} />}
      >
        {t("Live TV")}
      </ModePill>
      <ModePill
        btnRef={(el) => {
          btnRefs.current[2] = el;
        }}
        active={mode === "together"}
        onClick={() => onChange("together")}
        icon={<Users size={16} strokeWidth={2.4} />}
      >
        {t("Together")}
      </ModePill>
    </div>
  );
}

function ModePill({
  active,
  onClick,
  icon,
  children,
  btnRef,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  btnRef?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={btnRef}
      type="button"
      onClick={onClick}
      className={`flex h-11 items-center gap-2 rounded-md px-4 text-[15px] font-medium transition-colors ${
        active ? "bg-white text-black" : "text-white/70 hover:text-white"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
