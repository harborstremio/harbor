export function SportsIcon({ active = false }: { active?: boolean }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{ overflow: "visible" }}
    >
      <g key={active ? "active-ball" : "idle-ball"} className={active ? "animate-ball-bounce" : ""}>
        <g
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3 L12 21" />
          <path d="M3 12 L21 12" />
          <path d="M5.6 5.6 Q12 12 5.6 18.4" />
          <path d="M18.4 5.6 Q12 12 18.4 18.4" />
        </g>
      </g>
    </svg>
  );
}
