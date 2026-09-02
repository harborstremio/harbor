import { type PanelPosition } from "./hooks/use-panel-drag";
import { SUITE_CHROME_LIGHT as STABLE_CHROME } from "./suite-theme";

const PANEL_W = 416;

export function StudioShell({
  cardRef,
  position,
  dragging,
  children,
}: {
  cardRef: React.RefObject<HTMLDivElement | null>;
  position: PanelPosition;
  dragging: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[210]">
      <div
        ref={cardRef}
        style={{ ...STABLE_CHROME, left: position.x, top: position.y, width: PANEL_W }}
        className={`pointer-events-auto absolute flex max-h-[calc(100vh-48px)] flex-col overflow-hidden rounded-md bg-surface ring-1 ring-edge harbor-float harbor-studio-panel ${dragging ? "cursor-grabbing select-none" : ""}`}
      >
        {children}
      </div>
    </div>
  );
}
