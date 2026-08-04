import { useEffect, useState } from "react";
import { type AnilistRelatedNode } from "@/lib/anilist/media-details";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { resolveAnimeSourceManga } from "@/lib/manga/anime-adaptation";
import { useView } from "@/lib/view";

export function HeroMangaAdaptation({ meta }: { meta: Meta }) {
  const t = useT();
  const { openManga } = useView();
  const [node, setNode] = useState<AnilistRelatedNode | null>(null);

  useEffect(() => {
    let cancelled = false;
    setNode(null);
    resolveAnimeSourceManga(meta.id, meta.malId, meta.name)
      .then((n) => {
        if (!cancelled) setNode(n);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [meta.id, meta.malId, meta.name]);

  if (!node) return null;

  const open = async () => {
    const { searchManga } = await import("@/lib/manga/api");
    const found = (await searchManga(node.title, 0).catch(() => []))[0];
    openManga(found?.id);
  };

  return (
    <button
      type="button"
      onClick={open}
      className="group flex items-center gap-2.5 transition-opacity duration-150 hover:opacity-80"
    >
      {node.poster && (
        <img
          src={node.poster}
          alt=""
          className="h-12 w-[34px] shrink-0 rounded-md object-cover shadow-[0_3px_12px_rgba(0,0,0,0.6)]"
        />
      )}
      <div className="flex min-w-0 flex-col items-start">
        <span className="text-[9.5px] font-semibold uppercase tracking-[0.13em] text-accent drop-shadow-[0_1px_6px_rgba(0,0,0,0.8)]">
          {t("Read the Manga")}
        </span>
        <span className="max-w-[168px] truncate text-[12.5px] font-medium text-ink drop-shadow-[0_1px_6px_rgba(0,0,0,0.85)]">
          {node.title}
        </span>
      </div>
    </button>
  );
}
