import { MoveDiagonal2 } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { useT } from "@/lib/i18n";
import {
  clampSubtitlePanelSize,
  DEFAULT_SUBTITLE_PANEL_SIZE,
  type SubtitlePanelSize,
} from "./panel-size";

const STORAGE_KEY = "harbor.subtitle-menu-size-v1";

function currentViewport(): SubtitlePanelSize {
  return { width: window.innerWidth, height: window.innerHeight };
}

function readStoredSize(): SubtitlePanelSize {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "null",
    ) as Partial<SubtitlePanelSize> | null;
    if (typeof parsed?.width === "number" && typeof parsed.height === "number") {
      return clampSubtitlePanelSize(
        { width: parsed.width, height: parsed.height },
        currentViewport(),
      );
    }
  } catch {
    // Ignore stale or invalid preferences and use the current default.
  }
  return clampSubtitlePanelSize(DEFAULT_SUBTITLE_PANEL_SIZE, currentViewport());
}

function saveSize(size: SubtitlePanelSize) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(size));
  } catch {
    // Resizing should keep working even when storage is unavailable.
  }
}

type ResizeStart = SubtitlePanelSize & {
  clientX: number;
  clientY: number;
  rtl: boolean;
};

export function ResizableSubtitlePanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const tr = useT();
  const [size, setSize] = useState<SubtitlePanelSize>(readStoredSize);
  const [resizing, setResizing] = useState(false);
  const resizeStart = useRef<ResizeStart | null>(null);

  useEffect(() => {
    const onResize = () => {
      setSize((current) => {
        const next = clampSubtitlePanelSize(current, currentViewport());
        saveSize(next);
        return next;
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const applySize = (next: SubtitlePanelSize, persist = false) => {
    const clamped = clampSubtitlePanelSize(next, currentViewport());
    setSize(clamped);
    if (persist) saveSize(clamped);
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    resizeStart.current = {
      ...size,
      clientX: event.clientX,
      clientY: event.clientY,
      rtl: window.getComputedStyle(document.documentElement).direction === "rtl",
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setResizing(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const start = resizeStart.current;
    if (!start) return;
    const horizontalDelta = start.rtl
      ? event.clientX - start.clientX
      : start.clientX - event.clientX;
    const verticalDelta = start.clientY - event.clientY;
    applySize({ width: start.width + horizontalDelta, height: start.height + verticalDelta });
  };

  const endPointerResize = (event: PointerEvent<HTMLButtonElement>) => {
    if (!resizeStart.current) return;
    resizeStart.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setResizing(false);
    setSize((current) => {
      saveSize(current);
      return current;
    });
  };

  const onResizeKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = event.shiftKey ? 48 : 24;
    let next: SubtitlePanelSize | null = null;
    if (event.key === "ArrowLeft") next = { ...size, width: size.width - step };
    if (event.key === "ArrowRight") next = { ...size, width: size.width + step };
    if (event.key === "ArrowUp") next = { ...size, height: size.height + step };
    if (event.key === "ArrowDown") next = { ...size, height: size.height - step };
    if (event.key === "Home") next = DEFAULT_SUBTITLE_PANEL_SIZE;
    if (!next) return;
    event.preventDefault();
    event.stopPropagation();
    applySize(next, true);
  };

  return (
    <div className={className} style={{ width: `${size.width}px`, height: `${size.height}px` }}>
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-md bg-elevated shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]">
        <button
          type="button"
          aria-label={tr("Resize subtitle menu")}
          aria-describedby="subtitle-menu-resize-help"
          title={tr("Drag to resize. Use arrow keys to adjust, or Home to reset.")}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointerResize}
          onPointerCancel={endPointerResize}
          onKeyDown={onResizeKeyDown}
          className={`absolute start-1 top-1 z-20 flex h-7 w-7 touch-none items-center justify-center rounded-md text-ink-subtle transition-[color,background-color] hover:bg-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent [cursor:nwse-resize] rtl:[cursor:nesw-resize] ${
            resizing ? "bg-raised text-ink" : ""
          }`}
        >
          <MoveDiagonal2 size={14} strokeWidth={2} className="rtl:-rotate-90" />
        </button>
        <span id="subtitle-menu-resize-help" className="sr-only">
          {tr(
            "Drag the corner to resize. Left and right change width; up and down change height; Home resets the size.",
          )}
        </span>
        {children}
      </div>
    </div>
  );
}
