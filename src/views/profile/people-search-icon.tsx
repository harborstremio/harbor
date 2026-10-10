export function PeopleSearchIcon({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="10" cy="10" r="8" />
      <path d="m15.8 15.8 5.2 5.2" />
      <circle cx="7.8" cy="8.4" r="1.5" />
      <circle cx="12.2" cy="8.4" r="1.5" />
      <path d="M4.8 14.4c.3-2 1.5-3.1 2.9-3.1.9 0 1.7.5 2.1 1.2.4-.7 1.2-1.2 2.1-1.2 1.4 0 2.6 1.1 2.9 3.1" />
    </svg>
  );
}
