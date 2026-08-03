import { Share2 } from "lucide-react";
import { useState } from "react";
import { useT } from "@/lib/i18n";
import { CommunityShareModal } from "./community-share-modal";

export function CommunityShareButton({
  collectionId,
  variant = "pill",
  className = "",
}: {
  collectionId: string;
  variant?: "pill" | "icon";
  className?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const label = t("Share");

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          title={label}
          aria-label={label}
          className={`flex h-9 w-9 items-center justify-center rounded-full border border-edge-soft bg-canvas/85 text-ink-muted backdrop-blur-md transition-colors hover:border-edge hover:text-ink ${className}`}
        >
          <Share2 size={15} strokeWidth={2} />
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          aria-label={label}
          className={`inline-flex h-11 items-center gap-2 rounded-full border border-edge bg-canvas/80 px-5 text-[14px] font-semibold text-ink transition-colors hover:border-ink-subtle hover:bg-canvas/95 ${className}`}
        >
          <Share2 size={16} strokeWidth={2} />
          {label}
        </button>
      )}
      {open && <CommunityShareModal collectionId={collectionId} onClose={() => setOpen(false)} />}
    </>
  );
}
