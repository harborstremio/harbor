import { BADGE_ICON_BASE } from "@/views/profile/badge-catalog";
import { useT } from "@/lib/i18n";

export function VerifiedBadge({ label, size = "md" }: { label?: string; size?: "sm" | "md" }) {
  const t = useT();
  const resolvedLabel = label ?? t("Verified");
  const px = size === "sm" ? 18 : 22;
  return (
    <span className="group relative inline-flex align-middle">
      <img
        src={`${BADGE_ICON_BASE}/verified.webp`}
        width={px}
        height={px}
        className="inline-block"
        draggable={false}
        alt={resolvedLabel}
      />
      <span className="pointer-events-none absolute top-full left-1/2 z-20 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-elevated px-2 py-1 text-[11px] font-medium text-ink opacity-0 shadow-lg ring-1 ring-edge-soft transition-opacity duration-150 group-hover:opacity-100">
        {resolvedLabel}
      </span>
    </span>
  );
}
