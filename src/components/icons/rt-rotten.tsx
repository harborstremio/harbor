export function RtRotten({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-label="Rotten Tomatoes Rotten" role="img">
      <path
        d="M5 20 C 4 17 4.5 14 6 12 C 7 10.5 8.5 10 10 10.5 C 10.5 9 12 8 14 8.5 C 15 7 17 6.5 18.5 7.5 C 20 6.5 22 7 23 8.5 C 25 8 26.5 9.5 26.5 11.5 C 28 12.5 28.5 14.5 28 16.5 C 28.5 18 28 19.5 27 20.5 C 27.5 22 26.5 23.5 25 24 C 24.5 25.5 22.5 26 21 25 C 20 26 18 26.5 16.5 25.5 C 15 26.5 13 26 12 24.5 C 10 25 8 24 7.5 22 C 6 21.5 5 21 5 20 Z"
        fill="#5C7A3A"
      />
      <path
        d="M9 25 L 8 29 M 14 26 L 13.5 30 M 19 26 L 19.5 30 M 24 24.5 L 25 28"
        stroke="#3F5526"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
      <ellipse cx="11" cy="14" rx="1.6" ry="2" fill="rgba(255,255,255,0.18)" />
    </svg>
  );
}
