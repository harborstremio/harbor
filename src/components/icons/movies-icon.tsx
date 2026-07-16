export function MoviesIcon({ active = false }: { active?: boolean }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{ overflow: "visible" }}
    >
      <rect
        x="3"
        y="11"
        width="18"
        height="10"
        rx="1.6"
        stroke="currentColor"
        strokeWidth="1.75"
        fill="none"
      />
      <path
        d="M7 16 L17 16"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.4"
      />
      <g className={active ? "animate-clapper" : ""}>
        <rect
          x="3"
          y="6"
          width="18"
          height="5"
          rx="0.9"
          stroke={active ? "var(--color-accent)" : "currentColor"}
          strokeWidth="1.6"
          fill="currentColor"
          fillOpacity="0.12"
        />
        <path
          d="M5.5 11 L8.5 6 M11 11 L14 6 M16.5 11 L19.5 6"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
