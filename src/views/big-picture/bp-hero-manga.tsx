import { useEffect, useState } from "react";
import { exitBigPicture } from "@/lib/big-picture";
import type { Meta } from "@/lib/cinemeta";
import { resolveAnimeSourceReading, type AnimeReadingSource } from "@/lib/manga/anime-adaptation";
import { useProxiedImageSrc } from "@/lib/remote-image-proxy";
import { bpCardArt } from "./bp-art";
import { SFX } from "@/lib/sfx";
import { useView } from "@/lib/view";
import { BP_HERO_RING } from "./bp-hero-style";
import { useBpT } from "./bp-i18n";

// 2:3 against the clamp(52px, 6.6vh, 96px) height below, taken at its tallest.
const THUMB_W = 64;

export function BpHeroManga({ meta }: { meta: Meta }) {
  const t = useBpT();
  const { openEBook, openManga } = useView();
  const [source, setSource] = useState<AnimeReadingSource | null>(null);
  const poster = useProxiedImageSrc(bpCardArt(source?.node.poster, THUMB_W));

  useEffect(() => {
    let cancelled = false;
    setSource(null);
    resolveAnimeSourceReading(meta.id, meta.malId, meta.name ?? "")
      .then((resolved) => {
        if (!cancelled) setSource(resolved);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [meta.id, meta.malId, meta.name]);

  if (!source) return null;
  const { kind, node } = source;
  const actionLabel = t(kind === "ebook" ? "Read the eBook" : "Read the Manga");

  const open = async () => {
    SFX.click();
    if (kind === "ebook") {
      const { ebookDetail } = await import("@/lib/ebook/api");
      const ebook = await ebookDetail(`anilist:${node.anilistId}`).catch(() => null);
      openEBook(ebook?.id ?? `anilist:${node.anilistId}`);
      exitBigPicture();
      return;
    }
    const { searchManga } = await import("@/lib/manga/api");
    const found = (await searchManga(node.title, 0).catch(() => []))[0];
    openManga(found?.id);
    exitBigPicture();
  };

  return (
    <button
      type="button"
      data-bp-focusable
      onClick={() => void open()}
      aria-label={`${actionLabel} ${node.title}`}
      className={`flex shrink-0 items-center gap-[clamp(9px,0.8vw,16px)] rounded-[var(--bp-r-md)] border border-[var(--bp-edge)] p-[clamp(8px,0.8vh,14px)] pe-[clamp(12px,1.1vw,22px)] text-start ${BP_HERO_RING}`}
    >
      {poster && (
        <img
          src={poster}
          alt=""
          className="h-[clamp(52px,6.6vh,96px)] w-auto shrink-0 rounded-[var(--bp-r-xs)] object-cover shadow-[0_3px_14px_rgba(0,0,0,0.6)]"
        />
      )}
      <span className="flex min-w-0 flex-col gap-[2px]">
        <span className="text-[clamp(9.5px,1.24vh,14px)] font-bold uppercase tracking-[0.14em] text-[var(--bp-touch)]">
          {actionLabel}
        </span>
        <span className="max-w-[clamp(150px,15vw,300px)] truncate text-[clamp(12px,1.66vh,19px)] font-semibold text-ink">
          {node.title}
        </span>
      </span>
    </button>
  );
}
