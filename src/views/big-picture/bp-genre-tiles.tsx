import { GENRE_PALETTE } from "@/components/genre-tiles";
import { SFX } from "@/lib/sfx";
import { useBpT } from "./bp-i18n";
import { BpLeadTile } from "./bp-lead-tile";
import { BP_GENRES, useBpGenreArt } from "./use-bp-discover";
import { bpCardArt } from "./bp-art";

const CELL = "clamp(178px, 15vw, 300px)";

function BpGenreTile({
  genre,
  active,
  onOpen,
  onFocus,
}: {
  genre: string;
  active: boolean;
  onOpen: (genre: string) => void;
  onFocus?: (tint: string) => void;
}) {
  const t = useBpT();
  const art = useBpGenreArt(genre, active);
  const palette = GENRE_PALETTE[genre] ?? GENRE_PALETTE.Drama;

  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-tile
      data-bp-restore-key={`bp-genre:${genre}`}
      onFocus={() => onFocus?.(palette.from)}
      onClick={() => {
        SFX.click();
        onOpen(genre);
      }}
      aria-label={genre}
      className="group relative flex shrink-0 flex-col justify-end overflow-hidden rounded-[var(--bp-r-md)] border border-[var(--bp-edge)] p-[clamp(14px,1.2vw,26px)] text-start transition-[transform,box-shadow] duration-[var(--bp-dur)] ease-[var(--bp-ease)]"
      style={{
        width: CELL,
        aspectRatio: "5 / 4",
        background: palette.from,
      }}
    >
      {art.length > 0 && (
        <span aria-hidden className="absolute inset-0 grid grid-cols-3">
          {art.slice(0, 3).map((m, i) => (
            <span
              key={m.id}
              className="relative overflow-hidden"
              style={{ transform: `skewX(-8deg) translateX(${(i - 1) * 6}px)` }}
            >
              <img
                // Sized, not raw. This was the one art site in Big Picture that
                // handed the element a full-resolution backdrop: three of them
                // per tile, eighteen tiles, each decoded at whatever the source
                // happens to be, to fill a sliver about a third of a tile wide
                // under a multiply blend.
                src={bpCardArt(m.background ?? m.poster, 140) ?? ""}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover [transform:skewX(8deg)_scale(1.4)]"
              />
            </span>
          ))}
        </span>
      )}
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          background: palette.to,
          mixBlendMode: "multiply",
        }}
      />
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-2/5"
        style={{ background: `linear-gradient(to bottom, transparent, ${palette.to})` }}
      />
      <span
        className="relative font-display text-[clamp(16px,2.35vh,32px)] font-semibold leading-tight tracking-[-0.01em]"
        style={{ color: palette.ink }}
      >
        {t(genre)}
      </span>
    </button>
  );
}

/**
 * @param active the Genres row is the one the ring is on.
 *
 * Gating the art on this is the difference between Discover opening and
 * Discover stalling. The eighteen tiles each fetch a TMDB sample for a backdrop
 * that only ever surfaces as texture under a multiply blend, and React runs
 * child effects before parent effects, so those eighteen requests enqueued
 * ahead of all eight content rails in the one six-wide TMDB scheduler. The
 * rails could not leave the device until they drained. useBpGenreArt was
 * written with this gate; the only call site passed true.
 */
export function BpGenresBand({
  active,
  onOpen,
  onSurprise,
  onTint,
}: {
  active: boolean;
  onOpen: (genre: string) => void;
  onSurprise: () => void;
  onTint?: (tint: string) => void;
}) {
  const t = useBpT();
  return (
    <section data-bp-row data-bp-row-key="genres" aria-label={t("Genres")} className="relative">
      <div
        data-bp-scroll-x
        className="flex gap-[clamp(9px,0.85vw,17px)] overflow-x-auto px-[var(--bp-gutter)] pt-[clamp(22px,2.6vh,40px)] pb-[60px] -mb-[38px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {BP_GENRES.map((g) => (
          <BpGenreTile key={g} genre={g} active={active} onOpen={onOpen} onFocus={onTint} />
        ))}
        <BpLeadTile
          label={t("Surprise me")}
          action={t("Genres")}
          restoreKey="bp-lead:genres"
          onSelect={onSurprise}
        />
      </div>
    </section>
  );
}
