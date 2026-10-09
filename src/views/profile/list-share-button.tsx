import { Share2 } from "lucide-react";
import { useState } from "react";
import { useT } from "@/lib/i18n";
import { listShareUrl } from "@/lib/social/featured-lists";
import { ShareModal } from "./share-modal";

export function ListShareButton({
  handle,
  listId,
  name,
  className = "",
}: {
  handle: string;
  listId: string;
  name: string;
  className?: string;
}) {
  const t = useT();
  const [sharing, setSharing] = useState(false);
  if (!handle || !listId) return null;
  const url = listShareUrl(handle, listId);
  const title = name || t("Harbor list");
  return (
    <>
      <button
        type="button"
        onClick={() => setSharing(true)}
        aria-label={t("Share list")}
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-elevated text-ink-muted ring-1 ring-edge-soft transition-colors hover:bg-raised hover:text-ink ${className}`}
      >
        <Share2 size={14} strokeWidth={2.2} />
      </button>
      {sharing && (
        <ShareModal
          target={{
            heading: t("Share list"),
            linkLabel: t("List link"),
            url,
            cardUrl: `${url}/card.png`,
            text: t("{title} on Harbor", { title }),
            name: title,
          }}
          onClose={() => setSharing(false)}
        />
      )}
    </>
  );
}
