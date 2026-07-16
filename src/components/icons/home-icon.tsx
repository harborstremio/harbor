export function HomeIcon({ active = false }: { active?: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <g
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <path d="M4 11 L12 4 L20 11" className={active ? "animate-home-roof-build" : ""} />
        <path
          d="M5.5 10 L5.5 20.5 Q5.5 21 6 21 L18 21 Q18.5 21 18.5 20.5 L18.5 10"
          className={active ? "animate-home-walls-build" : ""}
        />
        <path
          d="M9.5 21 L9.5 14.5 Q9.5 14 10 14 L14 14 Q14.5 14 14.5 14.5 L14.5 21"
          className={active ? "animate-home-door-build" : ""}
        />
      </g>
      <circle
        cx="12"
        cy="17"
        r="1.3"
        fill="var(--color-accent)"
        className={active ? "animate-home-hearth" : "opacity-0"}
      />
    </svg>
  );
}
