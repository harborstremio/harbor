export function PosterServiceMark({ size = 24 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center text-ink-muted"
      style={{ height: size, width: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="2.6" y="6.2" width="6.2" height="13.4" rx="1.9" opacity="0.45" />
        <rect x="10" y="2.6" width="11.4" height="18.8" rx="2.6" />
        <circle cx="17.6" cy="7.6" r="1.15" />
        <path d="M11 19.4 14.9 13.6 20.4 19.4" />
      </svg>
    </span>
  );
}
