export function CalendarIcon({ active = false }: { active?: boolean }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{ overflow: "visible" }}
    >
      <g
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <path d="M4 7.5 Q4 6.5 5 6.5 L19 6.5 Q20 6.5 20 7.5 L20 19.5 Q20 20.5 19 20.5 L5 20.5 Q4 20.5 4 19.5 Z" />
        <path d="M4 10.25 L20 10.25" />
        <rect
          x="6.75"
          y="2.75"
          width="2.5"
          height="3.75"
          rx="1.1"
          fill="currentColor"
          stroke="none"
        />
        <rect
          x="14.75"
          y="2.75"
          width="2.5"
          height="3.75"
          rx="1.1"
          fill="currentColor"
          stroke="none"
        />
        <line x1="8" y1="13.5" x2="9.5" y2="13.5" />
        <line x1="11.25" y1="13.5" x2="12.75" y2="13.5" />
        <line x1="14.5" y1="13.5" x2="16" y2="13.5" />
        <line x1="8" y1="16.5" x2="9.5" y2="16.5" />
      </g>
      <rect
        x="11"
        y="15.25"
        width="3"
        height="2.5"
        rx="0.7"
        fill={active ? "var(--color-accent)" : "currentColor"}
        className={active ? "animate-calendar-date" : ""}
      />
    </svg>
  );
}
