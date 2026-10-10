import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Poster } from "@/components/poster";
import { searchManga } from "@/lib/manga/api";
import { hasAnyMangaSource } from "@/lib/manga/sources";
import type { MangaFavEntry } from "@/lib/manga-favorites";
import { useView } from "@/lib/view";

export function MangaFavCard({ entry }: { entry: MangaFavEntry }) {
  const { openManga } = useView();
  const [busy, setBusy] = useState(false);

  const open = async () => {
    if (busy) return;
    const title = entry.title.trim();
    if (!title || !hasAnyMangaSource()) {
      openManga(entry.id);
      return;
    }
    setBusy(true);
    let target = entry.id;
    try {
      const norm = (s: string) => s.trim().toLowerCase();
      const results = await searchManga(title);
      const match =
        results.find(
          (r) => norm(r.title) === norm(title) || (r.altTitle != null && norm(r.altTitle) === norm(title)),
        ) ?? results[0];
      if (match) target = match.id;
    } catch {
      /* fall back to the stored id */
    }
    setBusy(false);
    openManga(target);
  };

  return (
    <button
      type="button"
      onClick={() => void open()}
      disabled={busy}
      className="group flex w-full min-w-0 flex-col gap-2.5 text-start"
    >
      <div className="relative w-full transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0.24,1)] group-hover:will-change-transform group-hover:[transform:translate3d(0,-0.5rem,0)]">
        <Poster
          src={entry.cover}
          seed={entry.id}
          ratio="portrait"
          className="harbor-card-ring rounded-xl shadow-[0_2px_8px_-2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)] transition-[box-shadow] duration-300 group-hover:shadow-[0_24px_48px_-14px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.08)]"
        />
        {busy && (
          <div className="absolute inset-0 grid place-items-center rounded-xl bg-canvas/55 backdrop-blur-[1px]">
            <Loader2 size={22} className="animate-spin text-ink" />
          </div>
        )}
      </div>
      <p className="line-clamp-2 min-h-9 text-[13px] font-medium leading-snug text-ink">
        {entry.title}
      </p>
    </button>
  );
}
