import type { Group } from "@/lib/social/groups";

const COLS = 4;
const PER_COL = 3;
const COL_SHIFT = [0, 38, 14, 52];
const TILES = COLS * PER_COL;

export function GroupsHeroMosaic({ groups }: { groups: Group[] }) {
  const art = [...new Set(groups.map((g) => g.avatarUrl).filter((u): u is string => !!u))];
  if (art.length < 3) return null;
  const tiles = Array.from({ length: TILES }, (_, i) => ({ src: art[i % art.length], key: i }));

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute end-0 top-0 hidden h-[470px] w-[62%] max-w-[780px] select-none overflow-hidden lg:block"
    >
      <div
        className="flex -translate-y-8 gap-3 opacity-[0.42] motion-safe:animate-in motion-safe:fade-in"
        style={{ animationDuration: "700ms", animationFillMode: "both" }}
      >
        {Array.from({ length: COLS }, (_, c) => (
          <div
            key={c}
            className="flex flex-1 flex-col gap-3"
            style={{ transform: `translateY(${COL_SHIFT[c]}px)` }}
          >
            {tiles
              .filter((_, i) => i % COLS === c)
              .slice(0, PER_COL)
              .map((tile) => (
                <img
                  key={tile.key}
                  src={tile.src}
                  alt=""
                  loading="lazy"
                  draggable={false}
                  className="aspect-square w-full rounded-[16px] object-cover shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)] ring-1 ring-white/5"
                />
              ))}
          </div>
        ))}
      </div>
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(90deg, var(--color-canvas) 3%, transparent 66%)" }}
      />
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(0deg, var(--color-canvas) 2%, transparent 60%)" }}
      />
    </div>
  );
}
