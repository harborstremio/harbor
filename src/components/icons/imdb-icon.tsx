export function ImdbIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 32" className={className} aria-label="IMDb" role="img" preserveAspectRatio="xMidYMid meet">
      <rect width="64" height="32" rx="5" fill="#F5C518" />
      <text
        x="32"
        y="22.5"
        textAnchor="middle"
        fill="#000"
        fontFamily='"Helvetica Neue", "Arial Black", Arial, sans-serif'
        fontSize="16.5"
        fontWeight="900"
        letterSpacing="-0.6"
      >
        IMDb
      </text>
    </svg>
  );
}
