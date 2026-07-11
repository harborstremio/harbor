export function AddonsIcon({ active = false }: { active?: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden style={{ overflow: "visible" }}>
      <g stroke="currentColor" strokeWidth="1.65" strokeLinejoin="round" fill="currentColor" fillOpacity="0.12">
        <rect x="3" y="3" width="8" height="8" rx="1.4" className={active ? "animate-block-1" : ""} />
        <rect x="13" y="3" width="8" height="8" rx="1.4" className={active ? "animate-block-2" : ""} />
        <rect x="13" y="13" width="8" height="8" rx="1.4" className={active ? "animate-block-3" : ""} />
        <rect x="3" y="13" width="8" height="8" rx="1.4" className={active ? "animate-block-4" : ""} />
      </g>
    </svg>
  );
}
