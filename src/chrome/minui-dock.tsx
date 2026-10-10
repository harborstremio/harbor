import { usePreviewNavCustomization } from "@/lib/theme-preview";
import { useContextMenu } from "@/lib/context-menu";
import { useEffect, useRef, useState } from "react";
import { ParentalPinModal } from "@/components/parental-pin-modal";
import { useT } from "@/lib/i18n";
import { useParental } from "@/lib/parental";
import { useSettings } from "@/lib/settings";
import { useView, type View } from "@/lib/view";
import { useAvailableNavItems, applyNavCustomization, type NavItem } from "@/chrome/nav-items";
import { NavHiddenTray, NavHideBadge, useNavDrag } from "@/chrome/nav-edit";
import { useNavEditMode } from "@/chrome/nav-edit-mode";
import { DockButton } from "./minui-dock/dock-button";
import { FloatingTop } from "./minui-dock/floating-top";

const ICON_BASE = 54;
const ICON_GAP = 6;
const MAG_RANGE = 140;
const MAG_PEAK = 1.42;

export function MinUIDock() {
  const { view, setView, chromeHidden } = useView();
  const { locked, unlock, hiddenTabs } = useParental();
  const { settings } = useSettings();
  const [pinFor, setPinFor] = useState<View | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const buttonCentersRef = useRef<number[]>([]);
  const editing = useNavEditMode();
  const { open: openContextMenu } = useContextMenu();
  const openEmptyMenu = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    openContextMenu(e, { kind: "nav" });
  };

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const items = applyNavCustomization(
    useAvailableNavItems(),
    usePreviewNavCustomization(settings.navCustomization),
  );
  const visible = items.filter((it) => {
    if (it.id === "kids") return false;
    if (it.view === "vod" && !settings.showPlaylistsTab) return false;
    if (it.hideKey && settings.hideContent[it.hideKey]) return false;
    if (it.parentalKey && locked && hiddenTabs[it.parentalKey]) return false;
    return true;
  });

  const computeCenters = (scales: number[]) => {
    const centers: number[] = [];
    let cursor = 0;
    for (let i = 0; i < scales.length; i++) {
      const width = ICON_BASE * scales[i];
      centers.push(cursor + width / 2);
      cursor += width + ICON_GAP;
    }
    return centers;
  };

  let firstPassScales = visible.map(() => 1);
  if (cursor != null) {
    const centers =
      buttonCentersRef.current.length === visible.length
        ? buttonCentersRef.current
        : computeCenters(firstPassScales);
    firstPassScales = centers.map((c) => magnify(Math.abs(cursor - c)));
  }
  buttonCentersRef.current = computeCenters(firstPassScales);

  const navigate = (it: NavItem) => {
    if (it.parentalKey && locked && hiddenTabs[it.parentalKey]) {
      setPinFor(it.view);
      return;
    }
    setView(it.view);
  };

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const rtl = getComputedStyle(trackRef.current).direction === "rtl";
    setCursor(rtl ? rect.right - e.clientX : e.clientX - rect.left);
  };

  return (
    <>
      <FloatingTop />
      <div
        aria-hidden={chromeHidden}
        data-tv-focus-scope={editing || undefined}
        className={`pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex items-end justify-center transition-opacity duration-300 ${chromeHidden ? "opacity-0" : "opacity-100"}`}
        style={{
          paddingBottom:
            "calc(1.5rem + var(--harbor-music-dock, 0px) + var(--harbor-viewport-bottom, 0px))",
        }}
      >
        <div
          className="harbor-minui-shell pointer-events-auto rounded-2xl border border-edge p-1.5 shadow-[0_30px_60px_-22px_rgba(15,15,18,0.32),0_4px_18px_-6px_rgba(15,15,18,0.16)] backdrop-blur-xl"
          style={{
            background:
              "linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 88%, transparent), color-mix(in srgb, var(--color-surface) 72%, transparent))",
            transform: `translateY(${mounted ? 0 : 28}px)`,
            opacity: mounted ? 1 : 0,
            transition: "transform 420ms cubic-bezier(0.22, 1, 0.36, 1), opacity 300ms ease",
          }}
        >
          <div
            ref={trackRef}
            onPointerMove={onMove}
            onPointerLeave={() => setCursor(null)}
            onContextMenu={openEmptyMenu}
            className="flex items-end px-2 pt-3 pb-2"
            style={{ gap: `${ICON_GAP}px` }}
          >
            {visible.map((it, i) => {
              const active = view === it.view;
              const scale = firstPassScales[i] ?? 1;
              return (
                <MinUIDockItem
                  key={it.id}
                  item={it}
                  active={active}
                  scale={scale}
                  navigate={navigate}
                />
              );
            })}
          </div>
          {editing && (
            <div className="mx-2 mb-2 max-h-44 overflow-y-auto">
              <NavHiddenTray orientation="horizontal" />
            </div>
          )}
        </div>
      </div>
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

function MinUIDockItem({
  item,
  active,
  scale,
  navigate,
}: {
  item: NavItem;
  active: boolean;
  scale: number;
  navigate: (it: NavItem) => void;
}) {
  const t = useT();
  const label = t(item.label);
  const { open: openContextMenu } = useContextMenu();
  const editing = useNavEditMode();
  const drag = useNavDrag(item.id, "horizontal");
  return (
    <span
      className={`relative ${drag.over ? "ring-2 ring-accent rounded-2xl" : ""}`}
      data-harbor-nav={item.id}
      data-tauri-drag-region={editing ? "false" : undefined}
      onContextMenu={(e) =>
        openContextMenu(e, {
          kind: "nav",
          itemId: item.id,
          view: item.view,
          label,
          onOpen: () => navigate(item),
        })
      }
      onPointerDown={drag.onPointerDown}
      onKeyDown={drag.onKeyDown}
      data-nav-drop-id={item.id}
    >
      {editing && <NavHideBadge itemId={item.id} />}
      <DockButton
        label={label}
        active={active}
        scale={scale}
        baseSize={ICON_BASE}
        hideIndicator={editing}
        onClick={() => navigate(item)}
      >
        <span
          className="block"
          style={{
            transform: `scale(${0.92 + scale * 0.08})`,
            transition: "transform 140ms cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          {item.render(active)}
        </span>
      </DockButton>
    </span>
  );
}

function magnify(distance: number): number {
  if (distance > MAG_RANGE) return 1;
  const t = 1 - distance / MAG_RANGE;
  const eased = (1 - Math.cos(t * Math.PI)) / 2;
  return 1 + (MAG_PEAK - 1) * eased;
}
