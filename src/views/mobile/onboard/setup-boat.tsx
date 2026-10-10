import jlMark from "@/assets/brand/jl-mark.webp";

/**
 * The JL mark, revealed in bands so the setup flow can build it one confirmed
 * step at a time. Each part is the whole image clipped to a horizontal band, so
 * the bands line up exactly and every transform here is plain CSS pixels.
 */
type Part = "hull" | "jib" | "sail";

/** Earned order. The mark builds from the bottom band up. */
const BUILD_ORDER: readonly Part[] = ["hull", "jib", "sail"];
/** Paint order. Bands do not overlap, so this only fixes the DOM order. */
const PAINT_ORDER: readonly Part[] = ["sail", "jib", "hull"];

export const BOAT_PARTS = BUILD_ORDER.length;

const CLIP_OF: Record<Part, string> = {
  hull: "inset(66% 0 0 0)",
  jib: "inset(33% 0 34% 0)",
  sail: "inset(0 0 67% 0)",
};
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
          <img
            key={part}
            src={jlMark}
            alt=""
            draggable={false}
            className={`setup-boat-part object-contain ${hoist}`}
            style={{ clipPath: CLIP_OF[part] }}
          />
        );
      })}
    </span>
  );
}
