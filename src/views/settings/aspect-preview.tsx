import { useT } from "@/lib/i18n";

type Shape = { w: string; h: string; distort?: boolean; note: string };

const SCREEN = 16 / 9;

function boxFor(ratio: number): { w: string; h: string } {
  if (ratio >= SCREEN) return { w: "100%", h: `${((SCREEN / ratio) * 100).toFixed(1)}%` };
  return { w: `${((ratio / SCREEN) * 100).toFixed(1)}%`, h: "100%" };
}

export function AspectPreview({ mode }: { mode: string }) {
  const t = useT();
  const shapes: Record<string, Shape> = {
    fit: { ...boxFor(2.39), note: t("Whole picture, black bars where it does not match") },
    fill: { w: "134%", h: "100%", note: t("Fills the screen, edges cropped away") },
    stretch: { w: "100%", h: "100%", distort: true, note: t("Fills the screen, picture distorted") },
    "16:9": { ...boxFor(16 / 9), note: t("Forced to 16:9") },
    "4:3": { ...boxFor(4 / 3), note: t("Forced to 4:3, bars down the sides") },
    "21:9": { ...boxFor(21 / 9), note: t("Forced to 21:9") },
    "1.85:1": { ...boxFor(1.85), note: t("Forced to 1.85:1") },
    original: { ...boxFor(2.39), note: t("Forced to 2.39:1, widescreen letterbox") },
  };
  const shape = shapes[mode] ?? shapes.fit;
  return (
    <div className="flex flex-col gap-2.5 rounded-md bg-canvas/40 p-3.5 ring-1 ring-edge-soft">
      <div className="relative grid aspect-video w-full max-w-[300px] place-items-center overflow-hidden rounded-md bg-canvas ring-1 ring-inset ring-edge-soft">
        <div
          className="flex items-center justify-center overflow-hidden rounded-[3px] bg-raised transition-[width,height] duration-300 ease-in-out"
          style={{ width: shape.w, height: shape.h }}
        >
          <span
            className="block h-8 w-8 rounded-full bg-ink-subtle/50 transition-transform duration-300 ease-in-out"
            style={{ transform: shape.distort ? "scale(1.5, 0.62)" : "none" }}
          />
        </div>
      </div>
      <p className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-subtle">{shape.note}</p>
    </div>
  );
}
