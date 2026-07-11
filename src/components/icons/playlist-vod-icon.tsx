export function PlaylistVodIcon({ active = false }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden style={{ overflow: "visible" }}>
      <rect x="2" y="4" width="20" height="16" rx="3.5" stroke="currentColor" strokeWidth="1.7" fill="none" />
      <path d="M10 9.1v5.8l5-2.9z" fill="currentColor" opacity={active ? 1 : 0.92} />
    </svg>
  );
}
