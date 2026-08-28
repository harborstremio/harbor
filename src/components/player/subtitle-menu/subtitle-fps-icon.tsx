type Props = {
  size?: number;
  className?: string;
};

export function SubtitleFpsIcon({ size = 18, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <rect
        x="2.75"
        y="3.25"
        width="15.5"
        height="10.5"
        rx="2.25"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path d="M6 7h9M6 10h6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path
        d="M3.75 19.5h16.5M5.75 17.75v3.5M9.75 18.25v2.5M13.75 17.75v3.5M18.25 18.25v2.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle
        cx="17.75"
        cy="14.25"
        r="4.25"
        fill="currentColor"
        fillOpacity="0.14"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M17.75 11.75v2.75l1.75 1"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
