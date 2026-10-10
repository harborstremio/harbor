import { UiIcon } from "@/components/ui-icon";
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
        className="group flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-ink transition-[transform,background-color] duration-200 hover:bg-white/[0.10] active:scale-[0.94]"
      >
        <UiIcon name="list" className="h-5 w-5" />
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
