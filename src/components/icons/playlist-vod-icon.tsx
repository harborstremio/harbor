export function PlaylistVodIcon({ active = false }: { active?: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{ overflow: "visible" }}
    >
      <rect
        x="2"
        y="4"
        width="20"
        height="16"
        rx="3.5"
        stroke="currentColor"
        strokeWidth="1.7"
        fill="none"
      />
      <path
        d="M10 9.1v5.8l5-2.9z"
        fill={active ? "var(--color-accent)" : "currentColor"}
        opacity={active ? 1 : 0.92}
        className={active ? "animate-vod-play" : ""}
      />
      <circle
        cx="12"
        cy="12"
        r="7"
        stroke="var(--color-accent)"
        strokeWidth="1.25"
        className={active ? "animate-vod-ring" : "opacity-0"}
      />
    </svg>
  );
}
