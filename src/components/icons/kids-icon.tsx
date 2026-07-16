export function KidsIcon({ active = false }: { active?: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6.5 9.5h11l-1.2 10h-8.6z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M10 10l.7 9M14 10l-.7 9" stroke="currentColor" strokeWidth="1.35" />
      <g className={active ? "animate-kids-kernels" : ""}>
        <circle cx="8" cy="8" r="2.2" fill={active ? "var(--color-accent)" : "currentColor"} />
        <circle cx="12" cy="6.5" r="2.5" fill="currentColor" />
        <circle cx="16" cy="8" r="2.2" fill={active ? "var(--color-accent)" : "currentColor"} />
      </g>
    </svg>
  );
}
