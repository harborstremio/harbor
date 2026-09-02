import { Pencil, ScrollText } from "lucide-react";
import { useMemo } from "react";
import { useT } from "@/lib/i18n";
import { renderBbcode } from "@/lib/social/bbcode";
import { handleLinkOutActivation } from "@/lib/social/link-out-activation";
import { openLinkOut } from "@/lib/social/link-out";
import { SectionHeader } from "./section-header";

export function AboutCard({
  description,
  isOwner,
  userFont,
  onEdit,
  hideTitle,
}: {
  description?: string;
  isOwner: boolean;
  userFont?: string;
  onEdit?: () => void;
  hideTitle?: boolean;
}) {
  const t = useT();
  const html = useMemo(() => (description ? renderBbcode(description) : ""), [description]);
  const copyFont = userFont ? { fontFamily: `"${userFont}", inherit` } : undefined;

  return (
    <section aria-label={t("About")} className="rounded-lg bg-surface p-5 ring-1 ring-edge-soft">
      {!hideTitle && <SectionHeader icon={<ScrollText size={20} />} label={t("About")} />}
      {html ? (
        <div
          className="max-w-none break-words text-[14px] leading-relaxed text-ink-muted [&_a]:break-words"
          style={copyFont}
          onClick={(e) => handleLinkOutActivation(e, openLinkOut)}
          onAuxClick={(e) => handleLinkOutActivation(e, openLinkOut)}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : isOwner ? (
        <button
          onClick={onEdit}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md border border-dashed border-edge text-[13px] font-medium text-ink-muted transition-colors hover:border-accent/40 hover:text-ink"
        >
          <Pencil size={16} /> {t("Write something about yourself")}
        </button>
      ) : (
        <p className="py-6 text-center text-[13px] text-ink-subtle">
          {t("This user hasn't written anything yet")}
        </p>
      )}
    </section>
  );
}
