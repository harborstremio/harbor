import { Layers } from "lucide-react";
import { useRef, useState } from "react";
import { AddToListMenu } from "@/components/lists/add-to-list-menu";
import { useT } from "@/lib/i18n";

export function MangaAddToListButton({
  mangaId,
  title,
  cover,
}: {
  mangaId: string;
  title: string;
  cover?: string;
}) {
  const t = useT();
  const ref = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label={t("Add to list")}
        title={t("Add to list")}
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 w-12 items-center justify-center rounded-xl border border-edge bg-elevated/40 text-ink-muted backdrop-blur-sm transition-colors hover:bg-elevated hover:text-ink"
      >
        <Layers size={21} strokeWidth={2} />
      </button>
      <AddToListMenu
        item={{ id: mangaId, type: "manga", name: title, poster: cover }}
        anchorRef={ref}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
