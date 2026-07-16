export function CatalogsIcon({ active = false }: { active?: boolean }) {
  const shift = (dx: number, dy: number) => ({
    transformBox: "fill-box" as const,
    transformOrigin: "center",
    transform: active ? `translate(${dx}px, ${dy}px)` : "translate(0, 0)",
    transition: "transform 340ms cubic-bezier(0.16, 1, 0.3, 1)",
  });
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{ overflow: "visible" }}
    >
      <g stroke="currentColor" strokeWidth="1.65" strokeLinejoin="round">
        <rect
          x="8.5"
          y="3.5"
          width="12"
          height="12"
          rx="2.4"
          fill="currentColor"
          fillOpacity="0.09"
          style={shift(1.6, -1.6)}
        />
        <g style={shift(-1.6, 1.6)}>
          <rect
            x="3.5"
            y="8"
            width="12"
            height="12"
            rx="2.4"
            fill="currentColor"
            fillOpacity="0.2"
          />
          <path
            d="M6.4 16.6h6.2"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.55"
          />
        </g>
      </g>
    </svg>
  );
}
