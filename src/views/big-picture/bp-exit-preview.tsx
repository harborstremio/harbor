const FRAME_EDGE = "inset 0 0 0 1px color-mix(in oklab, var(--bp-void) 55%, transparent)";

const TOP_NAV_LAYOUTS = new Set(["topdock", "stremio", "cinematic"]);

const SLOTS = [0, 1, 2, 3, 4];

const DIM = "color-mix(in oklab, var(--color-ink) 22%, transparent)";

function navInset(): number {
  if (typeof document === "undefined") return 64;
  const layout = document.documentElement.dataset.themeLayout ?? "sidebar";
  return TOP_NAV_LAYOUTS.has(layout) ? 10 : 64;
}

// Drawn, never a screenshot. The theme preset ships a full resolution PNG of the
// desktop app, and painting it here cost a decode on open and read as a photo of
// the app rather than a small sign pointing back at it.
//
// fill="var(--x)" as a presentation attribute is not honoured everywhere, so
// these stay in style and the drawing picks up the user's real desktop theme.
export function BpExitPreview({ className }: { className?: string }) {
  const nav = navInset();
  const top = nav === 10;
  const bodyX = nav + 2;

  return (
    <div
      className={className}
      style={{
        position: "relative",
        aspectRatio: "8 / 5",
        overflow: "hidden",
        borderRadius: "var(--bp-r-sm)",
        background: "var(--bp-panel)",
        boxShadow: FRAME_EDGE,
      }}
    >
      <svg viewBox="0 0 320 200" width="100%" height="100%" aria-hidden="true">
        <rect x="0" y="0" width="320" height="200" style={{ fill: "var(--color-canvas)" }} />
        <rect x="0" y="0" width="320" height="14" style={{ fill: "var(--color-surface)" }} />
        {[0, 1, 2].map((i) => (
          <circle key={`dot-${i}`} cx={274 + i * 16} cy="7" r="3" style={{ fill: DIM }} />
        ))}
        <rect
          x="0"
          y="14"
          width={top ? 320 : 54}
          height={top ? 12 : 186}
          style={{ fill: "var(--color-surface)" }}
        />
        {SLOTS.map((i) => (
          <rect
            key={`nav-${i}`}
            x={top ? 8 + i * 44 : 8}
            y={top ? 17 : 24 + i * 16}
            width={top ? 34 : 38}
            height={top ? 6 : 7}
            rx="3"
            style={{ fill: DIM }}
          />
        ))}
        <rect
          x={bodyX}
          y={top ? 34 : 26}
          width={320 - nav - 14}
          height="96"
          rx="6"
          style={{ fill: "var(--color-elevated)" }}
        />
        {SLOTS.map((i) => (
          <rect
            key={`cell-${i}`}
            x={bodyX + i * 50}
            y="132"
            width="40"
            height="60"
            rx="4"
            style={{ fill: "var(--color-elevated)" }}
          />
        ))}
      </svg>
    </div>
  );
}
