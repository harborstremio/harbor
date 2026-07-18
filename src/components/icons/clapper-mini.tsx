export function ClapperMini({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
      style={{ overflow: "visible" }}
    >
      <rect
        x="1.4"
        y="6.4"
        width="11.2"
        height="6"
        rx="0.9"
        fill="currentColor"
        fillOpacity="0.95"
      />
      <g
        style={{
          transformOrigin: "1.4px 6.4px",
          transformBox: "fill-box",
          transform: "rotate(-22deg)",
        }}
      >
        <rect x="1.4" y="3.6" width="11.2" height="3" rx="0.55" fill="currentColor" />
        <path
          d="M3 6.6 L4.7 3.6 M5.9 6.6 L7.6 3.6 M8.8 6.6 L10.5 3.6"
          stroke="var(--color-canvas)"
          strokeWidth="0.85"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
