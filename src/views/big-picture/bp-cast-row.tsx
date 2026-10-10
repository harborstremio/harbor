import { User } from "lucide-react";
import type { CastEntry } from "@/lib/providers/tmdb/tmdb-details";
import { pushBigPicture } from "@/lib/big-picture";
import { useRankings } from "@/lib/rankings";
import { useProxiedImageSrc } from "@/lib/remote-image-proxy";
import { SFX } from "@/lib/sfx";
import { bpBoxCss, bpBoxPx, bpCardArt, type BpArtBox } from "./bp-art";
import { BpArt } from "./bp-art-img";
import { useBpT } from "./bp-i18n";
import { BP_DETAIL_HEADING, BP_DETAIL_TRACK } from "./detail/bp-detail-chrome";

const TMDB_IMG = "https://image.tmdb.org/t/p/w342";
// One record for the drawn width and the requested one, the rule bp-art states.
// The base above is only where a bare TMDB path starts; bpCardArt is what
// decides the bucket, so a 124px cell on a television stops pulling w342.
const BOX: BpArtBox = { min: 124, vw: 10, max: 196 };
const CELL = bpBoxCss(BOX);
const SHELL =
  "flex shrink-0 flex-col overflow-hidden rounded-[var(--bp-r-md)] bg-[var(--bp-panel)] text-start transition-[transform,box-shadow] duration-[var(--bp-dur)] ease-[var(--bp-ease)]";

// Kitsu and TVDB store absolute profile urls and the desktop guards this at
// cast-card.tsx:12-16. Concatenating the TMDB base onto one produced
// image.tmdb.org/t/p/w342https://media.kitsu.app/... and every anime cast card
// fell back to the grey glyph.
function profileUrl(path: string | null): string | undefined {
  if (!path) return undefined;
  return path.startsWith("http") ? path : `${TMDB_IMG}${path}`;
}

function BpCastBody({ person, rank }: { person: CastEntry; rank?: number }) {
  const src = useProxiedImageSrc(bpCardArt(profileUrl(person.profilePath), bpBoxPx(BOX)));
  return (
    <>
      <span
        className="relative flex w-full items-center justify-center overflow-hidden bg-[var(--bp-panel-2)]"
        style={{ aspectRatio: "2 / 3" }}
      >
        {src ? (
          <BpArt src={src} className="object-cover" />
        ) : (
          <User size={26} className="text-ink-subtle" strokeWidth={1.7} />
        )}
        {rank != null && (
          <span data-bp-cell-rank className="pointer-events-none absolute start-2 top-2 rounded-full bg-[var(--bp-void)]/85 px-2 py-0.5 text-[clamp(9.5px,1.2vh,13px)] font-bold tabular-nums text-ink ring-1 ring-[var(--bp-edge-2)]">
            {rank}
          </span>
        )}
      </span>
      <span className="flex w-full flex-col gap-0.5 p-[clamp(9px,0.9vw,15px)]">
        <span data-bp-cell-name className="line-clamp-1 w-full text-[clamp(11.5px,1.55vh,17.5px)] font-semibold leading-tight text-ink">
          {person.name}
        </span>
        {person.character && (
          <span data-bp-cell-sub className="line-clamp-1 w-full text-[clamp(10px,1.3vh,14.5px)] font-medium leading-tight text-ink-subtle">
            {person.character}
          </span>
        )}
      </span>
    </>
  );
}

// Focusable either way, and deliberately so on the branch with no destination.
// A [data-bp-scroll-x] track is only ever scrolled by centerScroll reacting to
// focus, so a track of twenty cells holding zero focusables leaves half the row
// permanently off the right edge with no way to reach it on a remote. Walking a
// row to read it is a normal ten-foot move; being unable to is not.
function BpCastCard({
  person,
  rank,
  onOpen,
}: {
  person: CastEntry;
  rank?: number;
  onOpen?: () => void;
}) {
  const label = person.character ? `${person.name}, ${person.character}` : person.name;

  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-tile
      data-bp-restore-key={`bp-cast:${person.id}`}
      onClick={
        onOpen
          ? () => {
              SFX.click();
              onOpen();
            }
          : undefined
      }
      aria-label={label}
      className={SHELL}
      style={{ width: CELL }}
    >
      <BpCastBody person={person} rank={rank} />
    </button>
  );
}

// For anime the provider chain puts the character in `name` and the voice actor
// in `character` (anime-detail.ts:392-400), and the id is a kitsu character id,
// not a TMDB person id. Pushing a person route on it opens an empty page with no
// back cue, so the anime cells open nothing and the Acting rank, which is keyed
// on TMDB person ids, is never looked up against one.
//
// The heading stays "Cast" on both branches. Desktop titles this rail Cast and
// the AniList rail Characters; renaming it here put two consecutive <h2>
// Characters headings on every anime page.
export function BpCastRow({ cast, anime = false }: { cast: CastEntry[]; anime?: boolean }) {
  const t = useBpT();
  const { rank } = useRankings();
  if (cast.length === 0) return null;

  return (
    <section data-bp-row data-bp-row-key="cast" className="relative">
      <h2 className={BP_DETAIL_HEADING}>{t("Cast")}</h2>
      <div data-bp-scroll-x className={BP_DETAIL_TRACK}>
        {cast.slice(0, 20).map((p) => {
          const resolved = !anime && p.id > 0;
          return (
            <BpCastCard
              key={`${p.id}-${p.order}`}
              person={p}
              rank={resolved ? rank(p.id, "Acting") : undefined}
              onOpen={
                resolved
                  ? () => pushBigPicture({ kind: "person", personId: p.id, name: p.name })
                  : undefined
              }
            />
          );
        })}
      </div>
    </section>
  );
}
