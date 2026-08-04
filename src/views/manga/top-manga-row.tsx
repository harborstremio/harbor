import { useState } from "react";
import { Award, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { Poster } from "@/components/poster";
import { searchManga, type MangaSummary } from "@/lib/manga/api";
import type { MangaCollection } from "@/lib/manga/collections";
import { hasAnyMangaSource } from "@/lib/manga/sources";

function honorFor(collection: MangaCollection): string {
  return collection.name.replace(/\s+Winners?$/i, "");
}

export function TopMangaRow({
  item,
  collection,
  rank,
  onOpenManga,
}: {
  item: MangaSummary;
  collection: MangaCollection;
  rank: number;
  onOpenManga: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);
  const t = useT();

  const award = collection.award === true;
  const why = award ? t("{honor} winner", { honor: honorFor(collection) }) : collection.badge;

  const open = async () => {
    if (busy || missing) return;
    setBusy(true);
    try {
      const found = (await searchManga(item.title, 0))[0];
      if (found) onOpenManga(found.id);
      else setMissing(true);
    } catch {
      setMissing(true);
    } finally {
      setBusy(false);
    }
  };

  const inner = (
    <>
      <span className="w-8 shrink-0 text-end text-[14px] font-semibold tabular-nums text-ink-subtle">
        #{rank}
      </span>
      <div className="w-10 shrink-0">
        <Poster
          src={item.cover}
          seed={item.id}
          ratio="portrait"
          lazy
          className="rounded-md ring-1 ring-edge-soft"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[14px] font-medium text-ink">{item.title}</span>
        <span className="flex items-center gap-1 truncate text-[12px] text-ink-subtle">
          {award && <Award size={12} className="shrink-0 text-ink-subtle" strokeWidth={2} />}
          {why}
        </span>
      </div>
      {busy ? (
        <Loader2 size={15} className="shrink-0 animate-spin text-ink-subtle" />
      ) : missing ? (
        <span className="shrink-0 text-[12px] text-ink-subtle">{t("Not on this source")}</span>
      ) : null}
    </>
  );

  if (!hasAnyMangaSource()) {
    return <div className="flex min-h-[44px] items-center gap-3 py-1.5">{inner}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => void open()}
      disabled={missing}
      className="-mx-2 flex min-h-[44px] items-center gap-3 rounded-xl px-2 py-1.5 text-start outline-none transition-colors hover:bg-elevated/60 focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none"
    >
      {inner}
    </button>
  );
}
