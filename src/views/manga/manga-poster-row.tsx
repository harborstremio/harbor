import { memo } from "react";
import { Poster } from "@/components/poster";
import { Row } from "@/components/row";
import type { MangaSummary } from "@/lib/manga/types";
import { useMangaContext } from "@/lib/use-manga-context";

export function MangaPosterRow({
  items,
  onOpen,
  award = false,
  art,
  scrollKey,
  min = 144,
  alwaysActive = false,
  releasePosters = true,
}: {
  items: MangaSummary[] | null;
  onOpen: (item: MangaSummary) => void;
  award?: boolean;
  art?: string | null;
  scrollKey?: string;
  min?: number;
  alwaysActive?: boolean;
  releasePosters?: boolean;
}) {
  if (items && items.length === 0) return null;

  return (
    <Row min={min} shape="portrait" scrollKey={scrollKey} alwaysActive={alwaysActive}>
      {items === null
        ? Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="w-full animate-pulse motion-reduce:animate-none">
              <div className="aspect-[2/3] w-full rounded-xl bg-elevated/60" />
              <div className="mt-2 h-3.5 w-4/5 rounded bg-elevated/50" />
            </div>
          ))
        : items.map((m) => (
            <MemoPosterButton
              key={m.id}
              m={m}
              onOpen={onOpen}
              award={award}
              art={art}
              releasePosters={releasePosters}
            />
          ))}
    </Row>
  );
}

export const MemoPosterButton = memo(function PosterButton({
  m,
  onOpen,
  award,
  art,
  releasePosters,
  ring = true,
}: {
  m: MangaSummary;
  onOpen: (item: MangaSummary) => void;
  award: boolean;
  art?: string | null;
  releasePosters: boolean;
  ring?: boolean;
}) {
  const context = useMangaContext(m, { open: () => onOpen(m) });
  return (
    <button
      ref={context.ref}
      type="button"
      onClick={() => onOpen(m)}
      className="group flex w-full flex-col gap-2 text-start"
    >
      <div className="relative w-full transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0.24,1)] group-hover:-translate-y-1.5 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
        <Poster
          src={m.cover}
          seed={m.id}
          ratio="portrait"
          lazy={releasePosters ? "release" : true}
          className={`${ring ? "harbor-card-ring " : ""}rounded-xl shadow-[0_2px_8px_-2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)] transition-[box-shadow] duration-300 group-hover:shadow-[0_24px_48px_-14px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.08)]`}
        />
        {award && art && (
          <img
            src={art}
            alt=""
            draggable={false}
            className="pointer-events-none absolute start-1.5 top-1.5 h-8 w-8 object-contain drop-shadow-[0_3px_9px_rgba(0,0,0,0.6)]"
          />
        )}
      </div>
      <p className="line-clamp-2 text-[13px] font-medium leading-snug text-ink">{m.title}</p>
    </button>
  );
});
