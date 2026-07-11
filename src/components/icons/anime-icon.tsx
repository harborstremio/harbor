export function AnimeIcon({ active = false }: { active?: boolean }) {
  return (
    <span className="relative inline-flex h-[26px] w-[26px] items-center justify-center">
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        style={{ overflow: "visible" }}
      >
        <path d="M12 5c.67 0 1.35.09 2 .26 1.78-2 5.03-2.84 6.42-2.26 1.4.58-.42 7-.42 11 0 5.5-2.5 10-10 10S0 19.5 0 14c0-4 1.82-10.42 3.42-11 1.39-.58 4.64.26 6.42 2.26C10.65 5.09 11.33 5 12 5z" />
        <path d="M8 14v.5" />
        <path d="M16 14v.5" />
      </svg>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        className={`pointer-events-none absolute -end-1 -top-1 ${active ? "animate-anger-pop" : "opacity-0"}`}
      >
        <g stroke="var(--color-danger)" strokeWidth="2.6" strokeLinecap="round" fill="none">
          <path d="M12 3 L12 21" />
          <path d="M3 12 L21 12" />
          <path d="M5.5 5.5 L18.5 18.5" />
          <path d="M18.5 5.5 L5.5 18.5" />
        </g>
      </svg>
    </span>
  );
}
