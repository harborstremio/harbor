export function TvIcon({ active = false }: { active?: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <g stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M8.5 3 L11.5 8" />
        <path d="M15.5 3 L12.5 8" />
        <rect x="3" y="8" width="18" height="13" rx="2" />
      </g>
      <line
        x1="6"
        y1="11"
        x2="18"
        y2="11"
        stroke="var(--color-accent)"
        strokeWidth="1.4"
        strokeLinecap="round"
        className={active ? "animate-tv-scan" : "opacity-0"}
      />
    </svg>
  );
}
