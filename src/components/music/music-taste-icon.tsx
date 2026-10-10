export function MusicTasteIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 10.5 7.8 6.6a2.7 2.7 0 0 1 4.2-3.4 2.7 2.7 0 0 1 4.2 3.4Z" />
      <path d="M3 15h4m4 0h10M3 21h10m4 0h4" />
      <circle cx="9" cy="15" r="2" />
      <circle cx="15" cy="21" r="2" />
    </svg>
  );
}
