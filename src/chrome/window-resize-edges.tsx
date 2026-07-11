import { useSettings } from "@/lib/settings";
import { useWindowFullscreen } from "@/lib/use-window-fullscreen";
import { startResize, useMaximized, type ResizeDir } from "@/lib/window";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const EDGES: Array<{ dir: ResizeDir; cls: string }> = [
  { dir: "North", cls: "inset-x-0 top-0 h-2 cursor-ns-resize" },
  { dir: "South", cls: "inset-x-0 bottom-0 h-2 cursor-ns-resize" },
  { dir: "NorthWest", cls: "left-0 top-0 h-5 w-5 cursor-nwse-resize" },
  { dir: "NorthEast", cls: "right-0 top-0 h-5 w-5 cursor-nesw-resize" },
  { dir: "SouthWest", cls: "bottom-0 left-0 h-5 w-5 cursor-nesw-resize" },
  { dir: "SouthEast", cls: "bottom-0 right-0 h-5 w-5 cursor-nwse-resize" },
];

export function WindowResizeEdges() {
  const { settings } = useSettings();
  const fullscreen = useWindowFullscreen();
  const maximized = useMaximized();
  if (!IS_TAURI || settings.useNativeTitleBar || fullscreen || maximized) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[115]">
      {EDGES.map((e) => (
        <div
          key={e.dir}
          onPointerDown={(ev) => {
            if (ev.button !== 0) return;
            startResize(e.dir);
          }}
          className={`pointer-events-auto absolute ${e.cls}`}
        />
      ))}
    </div>
  );
}
