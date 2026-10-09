import { BookMarked } from "lucide-react";
import { CoverImg } from "@/components/cover-img";
import type { EBook } from "@/lib/ebook/api";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";

export function EBookRow({ items, onClose }: { items: EBook[]; onClose: () => void }) {
  const { openEBook } = useView();
  const t = useT();
  if (items.length === 0) return null;

  const open = (book: EBook) => {
    onClose();
    openEBook(book.id);
  };

  return (
    <section>
      <h3 className="mb-3 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
        <BookMarked size={11} strokeWidth={2.2} />
        {t("eBooks")}
      </h3>
      <div className="grid min-w-0 gap-1">
        {items.slice(0, 8).map((book) => {
          const meta = [book.year, book.authors.slice(0, 2).join(", ")].filter(Boolean).join(" · ");
          return (
            <button
              key={book.id}
              onClick={() => open(book)}
              className="group flex min-w-0 items-center gap-4 rounded-2xl border border-transparent px-3 py-2.5 text-start transition-colors hover:border-edge-soft hover:bg-elevated/50 active:scale-[0.997]"
            >
              <span className="flex h-[96px] w-[64px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-canvas shadow-[0_6px_16px_-8px_rgba(0,0,0,0.55)] ring-1 ring-edge-soft">
                {book.cover ? (
                  <CoverImg
                    src={book.cover}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <BookMarked size={20} className="text-ink-subtle" />
                )}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-[16px] font-semibold text-ink">{book.title}</span>
                {meta && <span className="truncate text-[12.5px] text-ink-muted">{meta}</span>}
                <span className="flex items-center gap-1 text-[12px] text-ink-subtle">
                  <BookMarked size={11} strokeWidth={2.2} />
                  {t("eBook")}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
