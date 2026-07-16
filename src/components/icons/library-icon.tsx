export function LibraryIcon({ active = false }: { active?: boolean }) {
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
        <g className={active ? "animate-book-a" : ""}>
          <rect x="3.5" y="6" width="4" height="15" rx="0.7" />
          <path d="M3.5 9.5 L7.5 9.5" />
        </g>
        <g className={active ? "animate-book-b text-accent" : ""}>
          <rect x="9" y="8" width="4" height="13" rx="0.7" />
          <path d="M9 11 L13 11" />
        </g>
        <g className={active ? "animate-book-c" : ""}>
          <rect x="14.5" y="4" width="4" height="17" rx="0.7" />
          <path d="M14.5 7.5 L18.5 7.5" />
        </g>
      </g>
    </svg>
  );
}
