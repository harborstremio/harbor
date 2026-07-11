import { useT } from "@/lib/i18n";
import { Star } from "lucide-react";

export function FavoriteButton({
  active,
  onToggle,
  size = 16,
  variant = "overlay",
}: {
  active: boolean;
  onToggle: () => void;
  size?: number;
  variant?: "overlay" | "inline";
}) {
  const t = useT();
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onToggle();
      }}
      aria-label={active ? t("Remove from favorites") : t("Add to favorites")}
      aria-pressed={active}
      className={
        variant === "overlay"
          ? `flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-md transition-colors ${
              active
                ? "bg-canvas/55 text-accent hover:bg-canvas/75"
                : "bg-canvas/55 text-ink-muted opacity-0 group-hover:opacity-100 hover:bg-canvas/75 hover:text-ink"
            }`
          : `flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
              active ? "text-accent hover:bg-elevated" : "text-ink-subtle hover:bg-elevated hover:text-ink"
            }`
      }
    >
      <Star size={size} strokeWidth={active ? 0 : 1.9} fill={active ? "currentColor" : "none"} />
    </button>
  );
}
