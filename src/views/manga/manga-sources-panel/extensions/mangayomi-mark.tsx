export function MangayomiMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#e01118" />
      <g fill="#ffffff">
        <rect x="6.2" y="7.2" width="11.6" height="1.9" rx="0.35" />
        <rect x="11.0" y="9.1" width="2.0" height="4.8" rx="0.3" />
        <path d="M6.4 9.1 C5.9 12.1 5.4 14.8 5.0 17.2 L7.2 17.2 C7.6 14.8 7.9 12.1 8.2 9.1 Z" />
        <path d="M17.6 9.1 C18.1 12.1 18.6 14.8 19.0 17.2 L16.8 17.2 C16.4 14.8 16.1 12.1 15.8 9.1 Z" />
      </g>
    </svg>
  );
}
