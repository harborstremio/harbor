import { useId } from "react";

export function PosterServiceMark({ size = 28 }: { size?: number }) {
  const clip = "poster-mark-" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const glyph = Math.round(size * 0.68);
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-md bg-canvas text-ink"
      style={{ height: size, width: size }}
    >
      <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none" aria-hidden>
        <defs>
          <clipPath id={clip}>
            <rect x="10.8" y="3.6" width="10.4" height="16.8" rx="2.1" />
          </clipPath>
        </defs>
        <rect
          x="2.8"
          y="6.4"
          width="9.4"
          height="13.2"
          rx="1.9"
          fill="currentColor"
          opacity="0.32"
        />
        <rect x="9.2" y="2" width="13.6" height="20" rx="3.3" fill="var(--color-canvas)" />
        <g clipPath={`url(#${clip})`}>
          <rect x="10.8" y="3.6" width="10.4" height="16.8" rx="2.1" fill="currentColor" />
          <circle cx="18.5" cy="7.6" r="1.15" fill="var(--color-canvas)" />
          <path d="M10.8 20.4 15.4 14.1 21.2 20.4Z" fill="var(--color-canvas)" />
        </g>
      </svg>
    </span>
  );
}
