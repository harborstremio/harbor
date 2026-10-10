type IconProps = { size?: number; strokeWidth?: number };

export function DiscoverCompassIcon({ size = 15, strokeWidth = 2.2 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m15.7 8.3-2.3 5.4-5.4 2.3 2.3-5.4z" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ThemesDropIcon({ size = 15, strokeWidth = 2.2 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 21a6.5 6.5 0 0 0 6.5-6.5C18.5 10 12 3 12 3S5.5 10 5.5 14.5A6.5 6.5 0 0 0 12 21Z" />
      <path d="M9.3 15.4a2.7 2.7 0 0 0 2.2 2.2" />
    </svg>
  );
}

export function BadgesRosetteIcon({ size = 15, strokeWidth = 2.2 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9.2 12.9 7.8 20.4l4.2-2.3 4.2 2.3-1.4-7.5" />
      <circle cx="12" cy="8.5" r="5" />
      <path d="m12 6 .95 1.9 2.1.3-1.52 1.48.36 2.09L12 10.78l-1.89.99.36-2.09L8.95 8.2l2.1-.3z" />
    </svg>
  );
}
