export function DvrIcon({ recording = false, size = 24 }: { recording?: boolean; size?: number }) {
  const height = size;
  const width = Math.round(size * 1.45);
  return (
    <svg width={width} height={height} viewBox="0 0 32 22" fill="none" aria-hidden>
      <rect x="1" y="1" width="30" height="20" rx="3.5" stroke="currentColor" strokeWidth="1.6" />
      <circle
        cx="6.5"
        cy="11"
        r="2.4"
        fill={recording ? "var(--color-danger)" : "currentColor"}
        opacity={recording ? 1 : 0.55}
      >
        {recording && <animate attributeName="opacity" values="1;0.35;1" dur="1.4s" repeatCount="indefinite" />}
      </circle>
      <text
        x="11"
        y="14.4"
        fontFamily='Inter, "Helvetica Neue", sans-serif'
        fontSize="8.4"
        fontWeight="800"
        letterSpacing="0.3"
        fill="currentColor"
      >
        DVR
      </text>
    </svg>
  );
}
