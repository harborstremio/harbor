import { BookOpen } from "lucide-react";
import type { MangaSummary } from "@/lib/manga/model";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";

export function MangaRow({ items, onClose }: { items: MangaSummary[]; onClose: () => void }) {
  const { openManga } = useView();
  const t = useT();
  if (items.length === 0) return null;

  const open = (m: MangaSummary) => {
    onClose();
    openManga(m.id);
  };

  return (
    <section>
      <h3 className="mb-3 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
        <BookOpen size={11} strokeWidth={2.2} />
        {t("Manga")}
      </h3>
      <div className="grid min-w-0 gap-1">
        {items.slice(0, 8).map((m) => (
          <MangaRowItem key={m.id} manga={m} onOpen={open} />
        ))}
      </div>
    </section>
  );
}

function MangaRowItem({
  manga,
  onOpen,
}: {
  manga: MangaSummary;
  onOpen: (m: MangaSummary) => void;
}) {
  const t = useT();
  const meta = [manga.year, manga.status, manga.author].filter(Boolean).join(" · ");
  return (
    <button
      onClick={() => onOpen(manga)}
      className="group flex min-w-0 items-center gap-4 rounded-2xl border border-transparent px-3 py-2.5 text-start transition-colors hover:border-edge-soft hover:bg-elevated/50 active:scale-[0.997]"
    >
      <span className="flex h-[96px] w-[64px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-canvas shadow-[0_6px_16px_-8px_rgba(0,0,0,0.55)] ring-1 ring-edge-soft">
        {manga.cover ? (
          <img
            src={manga.cover}
            alt=""
            loading="lazy"
            draggable={false}
            className="h-full w-full object-cover"
          />
        ) : (
          <BookOpen size={20} className="text-ink-subtle" />
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-[16px] font-semibold text-ink">{manga.title}</span>
        {meta && <span className="truncate text-[12.5px] text-ink-muted">{meta}</span>}
        <span className="flex items-center gap-1 text-[12px] text-ink-subtle">
          <BookOpen size={11} strokeWidth={2.2} />
          {manga.lastChapter ? `${t("Manga")} · ${manga.lastChapter}` : t("Manga")}
        </span>
      </div>
    </button>
  );
}
