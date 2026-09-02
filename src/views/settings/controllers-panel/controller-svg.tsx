import { Fragment, useEffect, useMemo, useRef } from "react";
import type { GpButton } from "@/lib/gamepad/protocol";
import { liveAxes, subscribeLive, useLiveButtons } from "@/lib/gamepad/live";
import { useT } from "@/lib/i18n";
import { DUALSENSE_ART, XBOX_ART, type PadArt, type PadPart } from "./pad-art";
import { detectLayout, type Layout } from "./controller-shape";
import { useLatchedButtons } from "./use-latched-buttons";

export { detectLayout };
export type { Layout };

const ART: Record<Layout, PadArt> = { xbox: XBOX_ART, ps: DUALSENSE_ART };

const BUTTON: Record<string, GpButton> = {
  faceN: "north",
  faceE: "east",
  faceS: "south",
  faceW: "west",
  dpadU: "dup",
  dpadD: "ddown",
  dpadL: "dleft",
  dpadR: "dright",
  view: "back",
  menu: "start",
  create: "back",
  options: "start",
  guide: "guide",
  stickL: "lstick",
  stickR: "rstick",
  bumperL: "lb",
  bumperR: "rb",
};

const ARM_HUB = 18;
const ARM_TIP = 82;
const ARM_HALF = 26;

const DPAD_ARMS: Array<{
  b: GpButton;
  box: (cx: number, cy: number) => [number, number, number, number];
}> = [
  { b: "dup", box: (cx, cy) => [cx - ARM_HALF, cy - ARM_TIP, ARM_HALF * 2, ARM_TIP - ARM_HUB] },
  { b: "ddown", box: (cx, cy) => [cx - ARM_HALF, cy + ARM_HUB, ARM_HALF * 2, ARM_TIP - ARM_HUB] },
  { b: "dleft", box: (cx, cy) => [cx - ARM_TIP, cy - ARM_HALF, ARM_TIP - ARM_HUB, ARM_HALF * 2] },
  { b: "dright", box: (cx, cy) => [cx + ARM_HUB, cy - ARM_HALF, ARM_TIP - ARM_HUB, ARM_HALF * 2] },
];

function travelOf(art: PadArt, k: "stickL" | "stickR"): number {
  const well = art.stickWell[k] ?? Infinity;
  const radii = art.parts.filter((p) => p.k === k && p.r !== undefined).map((p) => p.r as number);
  const fixed = radii.filter((r) => r >= well);
  const caps = radii.filter((r) => r < well);
  if (!fixed.length || !caps.length) return 0;
  return Math.max(0, Math.min(...fixed) - Math.max(...caps));
}

const TRIGGER_LABEL: Record<Layout, [string, string]> = {
  xbox: ["LT", "RT"],
  ps: ["L2", "R2"],
};

const SHOULDER_X: Record<Layout, [number, number]> = {
  xbox: [282, 751],
  ps: [227, 797],
};

const PS_BUMPER: Array<[number, number]> = [
  [176, 182],
  [298, 182],
  [286.8, 216.6],
  [149.5, 242.9],
];

function points(list: Array<[number, number]>): string {
  return list.map(([x, y]) => `${x},${y}`).join(" ");
}

const CHIP_W = 104;
const CHIP_H = 48;
const CHIP_GAP = 132;

function isCap(part: PadPart, art: PadArt): boolean {
  const k = part.k;
  if (k !== "stickL" && k !== "stickR") return false;
  return part.r !== undefined && part.r < (art.stickWell[k] ?? Infinity);
}

const PUSHES = new Set([
  "faceN",
  "faceE",
  "faceS",
  "faceW",
  "dpadU",
  "dpadD",
  "dpadL",
  "dpadR",
  "view",
  "menu",
  "create",
  "options",
  "guide",
  "mic",
]);

const SINKS = new Set(["bumperL", "bumperR"]);

const STICK_PRESS = 0.965;

const LATCH_MS = 170;

function pressAbout(cx: number, cy: number, scale: number): string {
  return `translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})`;
}

type Slot = { part?: PadPart; caps?: PadPart[]; stick?: "stickL" | "stickR"; key: string };

function buildSequence(art: PadArt): Slot[] {
  const lastOf: Record<string, number> = {};
  art.parts.forEach((p, i) => {
    if (p.k) lastOf[p.k] = i;
  });
  const held: Record<string, PadPart[]> = {};
  const seq: Slot[] = [];
  art.parts.forEach((part, i) => {
    const k = part.k;
    if (isCap(part, art) && k) (held[k] ??= []).push(part);
    else seq.push({ part, key: `p${i}` });
    if (k && i === lastOf[k] && held[k]) {
      seq.push({ caps: held[k], stick: k as "stickL" | "stickR", key: `${k}caps` });
      delete held[k];
    }
  });
  return seq;
}

export function ControllerSvg({ layout, compact }: { layout: Layout; compact?: boolean }) {
  const t = useT();
  const art = ART[layout];
  const live = useLiveButtons();
  const buttons = useLatchedButtons(live, LATCH_MS);
  const down = (b: GpButton | undefined) => !!(b && buttons[b]);
  const capL = useRef<SVGGElement>(null);
  const capR = useRef<SVGGElement>(null);
  const applyRef = useRef<() => void>(() => {});
  const sunk = useRef({ l: false, r: false });
  sunk.current = { l: down("lstick"), r: down("rstick") };
  const everPressed = useRef(new Set<string>());
  for (const [part, btn] of Object.entries(BUTTON)) {
    if (buttons[btn]) everPressed.current.add(part);
  }

  const travelL = useMemo(() => travelOf(art, "stickL"), [art]);
  const travelR = useMemo(() => travelOf(art, "stickR"), [art]);

  useEffect(() => {
    const apply = () => {
      const ax = liveAxes();
      const set = (
        g: SVGGElement | null,
        x: number,
        y: number,
        reach: number,
        centre: [number, number] | undefined,
        pressed: boolean,
      ) => {
        if (!g) return;
        const mag = Math.hypot(x, y);
        const k = mag > 1 ? 1 / mag : 1;
        const dx = x * k * reach;
        const dy = y * k * reach;
        let tf = `translate(${dx.toFixed(2)} ${dy.toFixed(2)})`;
        if (pressed && centre) tf += ` ${pressAbout(centre[0], centre[1], STICK_PRESS)}`;
        g.setAttribute("transform", tf);
      };
      set(capL.current, ax.lx, ax.ly, travelL, art.centers.stickL, sunk.current.l);
      set(capR.current, ax.rx, ax.ry, travelR, art.centers.stickR, sunk.current.r);
    };
    applyRef.current = apply;
    apply();
    return subscribeLive(apply);
  }, [layout, travelL, travelR, art]);

  useEffect(() => {
    applyRef.current();
  }, [buttons]);
  const dpad = art.centers.dpad;
  const cross = [...art.parts].reverse().find((p) => p.k === "dpad")?.d;
  const [bx, by, bw, bh] = art.box;
  const shoulderX = SHOULDER_X[layout];
  const psBumper = (side: "l" | "r", on: boolean) =>
    on ? (
      <polygon
        points={points(
          side === "l"
            ? PS_BUMPER
            : [...PS_BUMPER].reverse().map(([x, y]): [number, number] => [1024 - x, y]),
        )}
        className="fill-accent"
        opacity={0.92}
        clipPath="url(#ps-body)"
      />
    ) : null;
  const sequence = useMemo(() => buildSequence(art), [art]);

  const band = compact ? 0 : CHIP_GAP;
  const chipY = by - CHIP_GAP + (CHIP_GAP - CHIP_H) / 2;
  const trigger = (cx: number, label: string, on: boolean) => (
    <g
      key={label}
      style={{ transform: on ? "translateY(3px)" : "none", transition: "transform 80ms ease" }}
    >
      <rect
        x={cx - CHIP_W / 2}
        y={chipY}
        width={CHIP_W}
        height={CHIP_H}
        rx={CHIP_H / 2}
        className={on ? "fill-accent" : "fill-elevated"}
        stroke="currentColor"
        strokeOpacity={0.18}
        strokeWidth={2}
        style={{ transition: "fill 90ms ease" }}
      />
      <text
        x={cx}
        y={chipY + CHIP_H / 2 + 1}
        dominantBaseline="central"
        textAnchor="middle"
        fontSize={24}
        fontWeight={700}
        className={on ? "fill-canvas" : "fill-ink-muted"}
      >
        {label}
      </text>
    </g>
  );

  return (
    <svg
      viewBox={`${bx} ${by - band} ${bw} ${bh + band}`}
      className="w-full text-ink"
      role="img"
      aria-label={t("Controller preview")}
    >
      <defs>
        {layout === "ps" && (
          <clipPath id="ps-body">
            <path d={art.bodyClip} />
          </clipPath>
        )}
        {layout === "xbox" && cross && (
          <clipPath id="xbox-dpad">
            <path d={cross} />
          </clipPath>
        )}
      </defs>

      {sequence.map((slot) => {
        if (slot.caps) {
          return (
            <g key={slot.key} ref={slot.stick === "stickL" ? capL : capR}>
              {slot.caps.map((cap, j) => (
                <path key={j} d={cap.d} fill={cap.f} />
              ))}
            </g>
          );
        }
        const part = slot.part!;
        const k = part.k;
        const on = down(k ? BUTTON[k] : undefined);
        const centre = k ? art.centers[k] : undefined;
        const tintable = k === "guide" ? part.f !== art.guideWindow : !!part.b;
        const tint = on && tintable;
        const pushes = !!k && PUSHES.has(k) && !!centre;
        const sinks = !!k && SINKS.has(k) && tintable;
        const primed = !!k && everPressed.current.has(k);
        const cls = pushes
          ? on
            ? "pad-press"
            : primed
              ? "pad-release"
              : undefined
          : sinks
            ? on
              ? "pad-sink"
              : primed
                ? "pad-rise"
                : undefined
            : undefined;
        return (
          <Fragment key={slot.key}>
            <g
              className={cls}
              style={
                pushes && centre ? { transformOrigin: `${centre[0]}px ${centre[1]}px` } : undefined
              }
            >
              <path
                d={part.d}
                fill={tint ? "var(--color-accent)" : part.f}
                style={tintable ? { transition: "fill 110ms ease-in-out" } : undefined}
              />
            </g>
            {slot.key === "p0" && layout === "ps" && (
              <>
                {psBumper("l", down("lb"))}
                {psBumper("r", down("rb"))}
              </>
            )}
          </Fragment>
        );
      })}

      {layout === "xbox" &&
        dpad &&
        cross &&
        DPAD_ARMS.filter(({ b }) => down(b)).map(({ b, box }) => {
          const [x, y, w, h] = box(dpad[0], dpad[1]);
          return (
            <rect
              key={b}
              x={x}
              y={y}
              width={w}
              height={h}
              className="fill-accent"
              opacity={0.92}
              clipPath="url(#xbox-dpad)"
            />
          );
        })}

      {!compact && trigger(shoulderX[0], TRIGGER_LABEL[layout][0], down("lt"))}
      {!compact && trigger(shoulderX[1], TRIGGER_LABEL[layout][1], down("rt"))}
    </svg>
  );
}
