export function LiveTvIcon({ active = false }: { active?: boolean }) {
  return (
    <svg width="34" height="18" viewBox="0 0 38 18" fill="none" aria-hidden style={{ direction: "ltr" }}>
      <rect
        x="1.25"
        y="1.25"
        width="35.5"
        height="15.5"
        rx="3.75"
        stroke="currentColor"
        strokeWidth="1.65"
        fill="none"
      />
      <circle
        cx="7"
        cy="9"
        r="2"
        fill={active ? "#ef4444" : "currentColor"}
        className={active ? "animate-pulse" : ""}
      />
      {active && (
        <circle
          cx="7"
          cy="9"
          r="2"
          fill="#ef4444"
          opacity="0.5"
          style={{
            transformOrigin: "7px 9px",
            animation: "live-ping 1.4s cubic-bezier(0, 0, 0.2, 1) infinite",
          }}
        />
      )}
      <text
        x="12"
        y="12.4"
        fontFamily='"Inter", -apple-system, system-ui, sans-serif'
        fontSize="8.4"
        fontWeight="800"
        letterSpacing="0.7"
        fill="currentColor"
      >
        LIVE
      </text>
      <style>{`
        @keyframes live-ping {
          0% { transform: scale(1); opacity: 0.55; }
          80%, 100% { transform: scale(2.4); opacity: 0; }
        }
      `}</style>
    </svg>
  );
}
