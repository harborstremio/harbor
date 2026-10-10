export function GameCollectionsIcon({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: `0 0 ${size}px` }}>
    <path d="M8 3h11a2 2 0 0 1 2 2v11M5.5 5.5h11a2 2 0 0 1 2 2v11" />
    <rect x="3" y="8" width="13" height="13" rx="2" />
    <path d="M7.5 12.5v4m-2-2h4" />
    <circle cx="12" cy="13" r=".8" fill="currentColor" stroke="none" />
    <circle cx="13" cy="16" r=".8" fill="currentColor" stroke="none" />
  </svg>;
}
