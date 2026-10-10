export function MusicSurpriseIcon({ size = 26 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <g transform="rotate(-9 12 16)" className="music-surprise-die">
      <rect x="3.5" y="7.5" width="17" height="17" rx="5" stroke="currentColor" strokeWidth="1.65" />
      <circle cx="8.5" cy="12.5" r="1.2" fill="currentColor" />
      <circle cx="12" cy="16" r="1.2" fill="currentColor" />
      <circle cx="15.5" cy="19.5" r="1.2" fill="currentColor" />
    </g>
    <path d="M21.5 12V3.5l4 1v4" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" />
    <ellipse cx="19.8" cy="12.3" rx="2.1" ry="1.6" fill="currentColor" />
  </svg>;
}
