export function PenCursor({ tint, size = 36 }: { tint: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.5))" }}
    >
      <g transform="rotate(-15 32 32)">
        <rect x="36" y="6" width="8" height="34" rx="1.5" fill={tint} />
        <rect x="36" y="6" width="8" height="6" rx="1.5" fill="rgba(255,255,255,0.25)" />
        <polygon points="36,40 44,40 40,52" fill="#1f1f1f" />
        <polygon points="38,46 42,46 40,52" fill="#fefefe" />
      </g>
      <path
        d="M 14 30 Q 14 22 22 22 L 36 22 Q 42 22 42 28 Q 42 34 36 34 L 28 34 Q 24 34 24 38 L 24 50 Q 24 56 18 56 L 14 56 Q 8 56 8 50 L 8 36 Q 8 30 14 30 Z"
        fill="#fefefe"
        stroke="#222"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M 16 38 Q 16 34 20 34 L 26 34" fill="none" stroke="#222" strokeWidth="1.2" opacity="0.55" />
      <path d="M 24 44 L 24 52" fill="none" stroke="#222" strokeWidth="1.2" opacity="0.55" />
    </svg>
  );
}
