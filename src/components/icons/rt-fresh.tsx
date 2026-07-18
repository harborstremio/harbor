export function RtFresh({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-label="Rotten Tomatoes Fresh" role="img">
      <path
        d="M16 27.5 C 8 27.5 4.5 22 4.5 17 C 4.5 12 7.5 8.5 11 7.5 C 13 6 14 5 14 4 C 14 2.5 15 2 16 2 C 17 2 18 2.5 18 4 C 18 5 19 6 21 7.5 C 24.5 8.5 27.5 12 27.5 17 C 27.5 22 24 27.5 16 27.5 Z"
        fill="#FA320A"
      />
      <path
        d="M14.5 4.5 Q 17.5 3 20 5"
        stroke="#3F8217"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
      />
      <ellipse cx="12.5" cy="13" rx="2.2" ry="2.8" fill="rgba(255,255,255,0.22)" />
    </svg>
  );
}
