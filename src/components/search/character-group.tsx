import { User, Waypoints } from "lucide-react";
import type { CharacterHit, CharacterMediaRef } from "@/lib/anilist/character";
import { searchManga } from "@/lib/manga/api";
import type { MangaSummary } from "@/lib/manga/model";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function bestManga(hits: MangaSummary[], title: string): MangaSummary | null {
  if (hits.length === 0) return null;
  const target = norm(title);
  const exact = hits.find((m) => norm(m.title) === target);
  if (exact) return exact;
  const starts = hits.find((m) => norm(m.title).startsWith(target) || target.startsWith(norm(m.title)));
  return starts ?? hits[0];
}

export function CharacterGroup({ items, onClose }: { items: CharacterHit[]; onClose: () => void }) {
  const { openMeta, openManga } = useView();
  const t = useT();
  if (items.length === 0) return null;

  const openAnime = (r: CharacterMediaRef) => {
    const meta: Meta = {
      id: `anilist:${r.anilistId}`,
      type: "anime",
      name: r.name,
      poster: r.poster ?? undefined,
      background: r.background ?? r.poster ?? undefined,
      description: r.overview,
      releaseInfo: r.year ?? undefined,
      imdbRating: r.score > 0 ? r.score.toFixed(1) : undefined,
    } as Meta;
    onClose();
    openMeta(meta);
  };

  const openMangaRef = (r: CharacterMediaRef) => {
    onClose();
    void searchManga(r.name)
      .then((hits) => openManga(bestManga(hits, r.name)?.id))
      .catch(() => openManga());
  };

  return (
    <section className="min-w-0">
      <h3 className="mb-3 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
        <Waypoints size={12} strokeWidth={2.2} />
        {t("Franchise")}
      </h3>
      <div className="flex flex-col gap-5">
        {items.map((c) => (
          <FranchiseCard key={c.id} character={c} onOpenAnime={openAnime} onOpenManga={openMangaRef} />
        ))}
      </div>
    </section>
  );
}

function FranchiseCard({
  character,
  onOpenAnime,
  onOpenManga,
}: {
  character: CharacterHit;
  onOpenAnime: (r: CharacterMediaRef) => void;
  onOpenManga: (r: CharacterMediaRef) => void;
}) {
  const t = useT();
  const media: Array<{ r: CharacterMediaRef; kind: "anime" | "manga" }> = [
    ...character.anime.map((r) => ({ r, kind: "anime" as const })),
    ...character.manga.map((r) => ({ r, kind: "manga" as const })),
  ];
  return (
    <div className="min-w-0">
      <div className="mb-2.5 flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-canvas ring-1 ring-edge-soft">
          {character.image ? (
            <img src={character.image} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />
          ) : (
            <User size={15} className="text-ink-subtle" />
          )}
        </span>
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-semibold text-ink">{character.name}</div>
          {character.native && <div className="truncate text-[11px] text-ink-subtle">{character.native}</div>}
        </div>
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {media.map(({ r, kind }) => (
          <PosterTile
            key={`${kind}:${r.anilistId}`}
            media={r}
            sub={kind === "manga" ? t("Manga") : r.year ?? t("Show")}
            onOpen={() => (kind === "anime" ? onOpenAnime(r) : onOpenManga(r))}
          />
        ))}
      </div>
    </div>
  );
}

function PosterTile({ media, sub, onOpen }: { media: CharacterMediaRef; sub: string; onOpen: () => void }) {
  const t = useT();
  return (
    <button
      onClick={onOpen}
      className="group w-[58px] shrink-0 text-start transition-transform duration-150 active:scale-[0.97] motion-reduce:active:scale-100"
    >
      <span className="block aspect-[2/3] overflow-hidden rounded-lg bg-canvas ring-1 ring-edge-soft/60 transition-[box-shadow] duration-150 group-hover:ring-2 group-hover:ring-accent">
        {media.poster ? (
          <img src={media.poster} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[9px] text-ink-subtle">{t("No art")}</span>
        )}
      </span>
      <span className="mt-1 line-clamp-1 block text-[11px] font-medium leading-tight text-ink-muted group-hover:text-ink">
        {media.name}
      </span>
      <span className="block text-[10px] text-ink-subtle">{sub}</span>
    </button>
  );
}
