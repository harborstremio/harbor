export function AlarmClockIcon({
  size = 20,
  strokeWidth = 1.9,
}: {
  size?: number;
  strokeWidth?: number;
}) {
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
      <circle cx="12" cy="13.5" r="7" />
      <path d="M12 10.4v3.1l2.3 1.4" />
      <path d="M5.3 3.6 2.9 5.9" />
      <path d="M18.7 3.6 21.1 5.9" />
      <path d="M6.3 19.4 4.8 21" />
      <path d="M17.7 19.4 19.2 21" />
    </svg>
  );
}
