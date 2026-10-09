/**
 * Harbor's mark, taken apart so the setup flow can build it one confirmed step
 * at a time. The path data is copied from components/icons/harbor-mark.tsx
 * rather than imported: that component paints all three paths inside one
 * flipped matrix, and a transform on a child path would be applied in that
 * flipped, 0.1333-scaled user space. Each part gets its own upright <svg> so
 * every transform here is plain CSS pixels.
 */
const VIEW_BOX = "0 0 700 642.88";
const FLIP = "matrix(0.13333333,0,0,-0.13333333,0,642.88)";

const JIB_D =
  "m 72.0781,1534.27 c 0,0 1127.5819,922.03 1526.9319,2636.89 0,0 463.95,-1274.4 17.61,-2625.15 L 72.0781,1534.27";
const SAIL_D =
  "M 3975.59,2945.05 2812.18,2222.26 c -36.68,-22.79 -84.13,3.59 -84.13,46.78 v 1391.45 c 0,42.35 45.8,68.85 82.51,47.75 l 1163.41,-668.68 c 36.11,-20.75 37,-72.53 1.62,-94.51 z M 2021.85,4821.57 V 1438.84 l 2818.94,416.96 c 0,0 252.54,2501.82 -2818.94,2965.77";
const HULL_D =
  "m 615.313,4.40234 c 0,0 -364.817,308.39866 -604.4224,706.25766 -28.3125,47.012 1.4922,107.77 55.8555,115.281 L 5090.13,1520.12 c 57.31,7.92 102.66,-47.69 82.95,-102.09 C 5065.81,1122 4746.77,351.742 4222.68,0 L 615.313,4.40234";

type Part = "hull" | "jib" | "sail";

/** Earned order. A hull is the first thing that exists, sails go up after. */
const BUILD_ORDER: readonly Part[] = ["hull", "jib", "sail"];
/** Paint order. The hull has to sit over the foot of both sails. */
const PAINT_ORDER: readonly Part[] = ["jib", "sail", "hull"];

export const BOAT_PARTS = BUILD_ORDER.length;

const PATH_OF: Record<Part, string> = { hull: HULL_D, jib: JIB_D, sail: SAIL_D };
const HOIST_OF: Record<Part, string> = {
  hull: "setup-hoist-hull",
  jib: "setup-hoist-jib",
  sail: "setup-hoist-sail",
};
const LAG = ["", "setup-lag-1", "setup-lag-2"];

/** How much of the boat a run of steps is worth, so a one-step queue still
    finishes with a whole boat and a skipped step never fakes one. */
export function boatBuilt(confirmed: number, total: number): number {
  if (total <= 0 || confirmed <= 0) return 0;
  return Math.min(BOAT_PARTS, Math.ceil((BOAT_PARTS * confirmed) / total));
}

export function SetupBoat({
  built,
  animate = "none",
  ghost,
  className,
}: {
  built: number;
  animate?: "none" | "latest" | "all";
  /** Draws the parts not yet earned at a whisper, so the shape the viewer is
      filling in is visible from the first screen and each hoist lands into
      something. Off at the finish, where a missing sail would only nag. */
  ghost?: boolean;
  className?: string;
}) {
  return (
    <span className={`setup-boat ${className ?? ""}`} aria-hidden>
      {PAINT_ORDER.map((part) => {
        const step = BUILD_ORDER.indexOf(part);
        const earned = step < built;
        if (!earned && !ghost) return null;
        const hoist = !earned
          ? "opacity-[0.11]"
          : animate === "all"
            ? `${HOIST_OF[part]} ${LAG[step]}`
            : animate === "latest" && step === built - 1
              ? HOIST_OF[part]
              : "";
        return (
          <svg key={part} viewBox={VIEW_BOX} fill="currentColor" className={`setup-boat-part ${hoist}`}>
            <g transform={FLIP}>
              <path d={PATH_OF[part]} />
            </g>
          </svg>
        );
      })}
    </span>
  );
}
