import { useActiveDownloadCount } from "@/lib/download/downloads-store";

export function DownloadsNavIcon({ active }: { active: boolean }) {
  const count = useActiveDownloadCount();
  return (
    <span className="relative inline-flex items-center justify-center">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M5 18.5h14" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        <g className={active ? "animate-download-arrow" : ""}>
          <path
            d="M12 4.5v10"
            stroke={active ? "var(--color-accent)" : "currentColor"}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="m8.5 11.5 3.5 3.5 3.5-3.5"
            stroke={active ? "var(--color-accent)" : "currentColor"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>
      {count > 0 && (
        <span className="absolute -end-1.5 -top-1.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-accent px-[3px] text-[9.5px] font-bold leading-none text-canvas tabular-nums">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </span>
  );
}
