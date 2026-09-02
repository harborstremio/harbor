import psCircle from "@/assets/pad-glyphs/ps-circle.svg";
import psCross from "@/assets/pad-glyphs/ps-cross.svg";
import psDpad from "@/assets/pad-glyphs/ps-dpad.svg";
import psDpadVertical from "@/assets/pad-glyphs/ps-dpad-vertical.svg";
import psL1 from "@/assets/pad-glyphs/ps-l1.svg";
import psL2 from "@/assets/pad-glyphs/ps-l2.svg";
import psOptions from "@/assets/pad-glyphs/ps-options.svg";
import psR1 from "@/assets/pad-glyphs/ps-r1.svg";
import psR2 from "@/assets/pad-glyphs/ps-r2.svg";
import psSquare from "@/assets/pad-glyphs/ps-square.svg";
import psTriangle from "@/assets/pad-glyphs/ps-triangle.svg";
import xboxA from "@/assets/pad-glyphs/xbox-a.svg";
import xboxB from "@/assets/pad-glyphs/xbox-b.svg";
import xboxDpad from "@/assets/pad-glyphs/xbox-dpad.svg";
import xboxDpadVertical from "@/assets/pad-glyphs/xbox-dpad-vertical.svg";
import xboxLb from "@/assets/pad-glyphs/xbox-lb.svg";
import xboxLt from "@/assets/pad-glyphs/xbox-lt.svg";
import xboxMenu from "@/assets/pad-glyphs/xbox-menu.svg";
import xboxRb from "@/assets/pad-glyphs/xbox-rb.svg";
import xboxRt from "@/assets/pad-glyphs/xbox-rt.svg";
import xboxX from "@/assets/pad-glyphs/xbox-x.svg";
import xboxY from "@/assets/pad-glyphs/xbox-y.svg";
import type { Layout } from "./controller-shape";

export type GlyphKind =
  | "dpad"
  | "dpadVertical"
  | "north"
  | "east"
  | "south"
  | "west"
  | "center"
  | "bumpers"
  | "triggers";

const SRC: Record<Layout, Partial<Record<GlyphKind, string[]>>> = {
  xbox: {
    dpad: [xboxDpad],
    dpadVertical: [xboxDpadVertical],
    north: [xboxY],
    east: [xboxB],
    south: [xboxA],
    west: [xboxX],
    center: [xboxMenu],
    bumpers: [xboxLb, xboxRb],
    triggers: [xboxLt, xboxRt],
  },
  ps: {
    dpad: [psDpad],
    dpadVertical: [psDpadVertical],
    north: [psTriangle],
    east: [psCircle],
    south: [psCross],
    west: [psSquare],
    center: [psOptions],
    bumpers: [psL1, psR1],
    triggers: [psL2, psR2],
  },
};

export function ButtonGlyph({ kind, pad }: { kind: GlyphKind; pad: Layout }) {
  const srcs = SRC[pad][kind];
  if (!srcs) return null;
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {srcs.map((src) => (
        <img key={src} src={src} alt="" draggable={false} className="h-[30px] w-[30px]" />
      ))}
    </span>
  );
}
