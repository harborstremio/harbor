import { memo, useRef, useState, type ReactNode } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useProxiedImageSrc } from "@/lib/remote-image-proxy";
import { useSettings } from "@/lib/settings";
import { BP_FLUID_BOX, BP_TILE_BOX, bpBoxCss, bpBoxPx, type BpArtBox } from "./bp-art";
import { publishBpMeta, registerBpTarget } from "./bp-focus-meta";
import { bpTintPlate, useArtGlow, useArtTint } from "./bp-art-color";
import { BpArt } from "./bp-art-img";
import { BpCardMarks } from "./bp-card-marks";
import {
  bpCardZones,
  BpCardStateMarks,
  useBpCardState,
  type BpCardLift,
} from "./bp-card-state-marks";
import { BpRankNumeral } from "./bp-rank-numeral";
import { bpScoreLimit } from "./bp-score-chips";
import { useBpPosterChain } from "./bp-poster-chain";
import { useBpArt } from "./use-bp-art";
import { useBpCardBadges } from "./use-bp-card-badges";

export type BpTileShape = "poster" | "wide" | "rank";

// Desktop's ranked cell, components/top-rank-card.tsx: the poster covers the end
// 60 percent of the cell and the numeral fills what is left, behind it.
const RANK_ART = 0.6;

// Derived from the poster box, never written out as its own clamp. Scaling all
// three terms of a clamp commutes with the clamp, so the poster inside a ranked
// cell measures exactly what a poster tile measures at every viewport and asks
// for the same art bucket. A second literal clamp here would drift silently the
// first time the poster box moved, which is the failure bp-art warns about.
const RANK_BOX: BpArtBox = {
  min: BP_TILE_BOX.poster.min / RANK_ART,
  vw: BP_TILE_BOX.poster.vw / RANK_ART,
  max: BP_TILE_BOX.poster.max / RANK_ART,
};

// 10/9, not desktop's 228/246. The extra height there is the caption printed
// under the poster, and Big Picture prints the title inside the art instead.
// 0.6 of the width at 2/3 is 0.9, so the cell ends exactly where the poster
// does and a ranked row keeps the same height as its neighbours in the rail.
const RANK_CELL_RATIO = "10 / 9";

// The row's label tile has to match the cell height, and that number belongs
// beside the box it comes from rather than as a second clamp in bp-row.
export const BP_RANK_CELL_HEIGHT = `calc(${bpBoxCss(RANK_BOX)} * 0.9)`;

const SHAPE = {
  poster: { ratio: "2 / 3", box: BP_TILE_BOX.poster, art: 1 },
  wide: { ratio: "16 / 9", box: BP_TILE_BOX.wide, art: 1 },
  // box is the whole cell, art is the fraction of it the poster actually draws.
  rank: { ratio: "2 / 3", box: RANK_BOX, art: RANK_ART },
} as const;

// A fluid poster cell comes from BP_POSTER_COLUMNS, clamp(122px, 9.8vw, 186px),
// which never exceeds the poster box across the viewport range, so one request
// serves both and a title in a rail and a grid still shares one decode. A fluid
// wide cell is clamp(240px, 20vw, 400px) and does exceed it, so those name
// BP_FLUID_BOX.wide instead.
function artWidth(shape: BpTileShape, fluid: boolean | undefined): number {
  if (fluid && shape === "wide") return bpBoxPx(BP_FLUID_BOX.wide);
  const dims = SHAPE[shape];
  return bpBoxPx(dims.box) * dims.art;
}

function BpTileBody({
  meta,
  shape = "poster",
  onSelect,
  autofocus,
  corner,
  fluid,
  rank,
}: {
  meta: Meta;
  shape?: BpTileShape;
  onSelect: (meta: Meta) => void;
  autofocus?: boolean;
  corner?: ReactNode;
  fluid?: boolean;
  /** 1-based position, drawn as the numeral behind a shape="rank" cell. */
  rank?: number;
}) {
  const boxRef = useRef<HTMLButtonElement | null>(null);
  const { settings } = useSettings();
  const ranked = shape === "rank";
  const override = useBpPosterChain(meta, shape, boxRef);
  const art = useBpArt({
    ref: boxRef,
    id: meta.id,
    type: meta.type,
    // A ranked cell draws a portrait poster, so it takes the poster art chain.
    // useBpArt has its own two-value shape and does not know this one.
    shape: shape === "wide" ? "wide" : "poster",
    override,
    poster: meta.poster,
    background: meta.background,
    targetWidth: artWidth(shape, fluid),
  });
  const src = useProxiedImageSrc(art.url);
  // The shimmer is gone, not merely ungated, and this must not be re-added
  // without the measurement below. It was gated on a per-tile
  // IntersectionObserver, and that observer is the thing that made idle drop
  // from 58.1fps to 48.8fps: content-visibility on an unfocused row makes every
  // tile inside it permanently non-intersecting, the observation is one-shot, so
  // about 254 of 262 observations never fired and never retired. The gate now
  // watches the rail row instead, which is coarser: a tile scrolled off the
  // right of a visible row counts as near. Under the old code that meant its
  // lazy image never loaded, `loaded` never flipped, and the shimmer animated
  // for the whole session, which measured 27 percent of the main thread on paint
  // while nobody was touching the remote. The plate behind it is the loading
  // state now.
  // The old comment, kept because the trap it records is still live:
  // a performance fix, not a cosmetic one. Posters are loading="lazy", so a tile
  // below the fold never loads, never flips `loaded`, and its shimmer animates
  // for the life of the session. Home carried 150 of them: 27 percent of the
  // main thread burned on paint while the user sat still, which read as input
  // lag because no frame was ever idle when a key arrived.

  const [loaded, setLoaded] = useState(false);
  const [focused, setFocused] = useState(false);
  const dims = SHAPE[shape];
  // Extraction refetches and decodes the whole poster, and the glow only paints
  // on the focused tile, so a grid of hundreds must not all pay for it.
  const glow = useArtGlow(focused && loaded ? src : undefined);
  // The only reader of the persisted tint store. Without this call bp-art-color
  // never hydrates, so its sample queue stays gated shut and the colours written
  // to IndexedDB every session are read back on none.
  const plate = bpTintPlate(useArtTint(src, loaded));

  // The badges live in the tile rather than in every caller, so bp-home,
  // bp-anime, bp-discover and the search rows all gain them untouched.
  const { badges, imdbId } = useBpCardBadges(meta, boxRef, undefined, "tile");
  const zones = bpCardZones(settings);
  const cardState = useBpCardState(meta, imdbId, zones);
  // The numeral already says where this title sits, so the top ten ribbon would
  // be the same fact twice on one card, on top of a row header that already
  // reads Top 10. Desktop's ranked card carries no ribbon either. This is the
  // ONLY suppression: the ribbon is right on every other surface, which is
  // Home, Search, Discover, Library and More Like This, and it is keyed on the
  // cell drawing a numeral rather than on any setting.
  const state = ranked ? { ...cardState, top10: false } : cardState;
  const showTitle = !settings.hidePosterTitles;
  const lift: BpCardLift = !showTitle ? "none" : art.url ? "focus" : "always";

  // No z-index on the ranked poster below, however much desktop's z-10 invites
  // one. bp-tokens gives the FOCUSED tile z-index 5, so a standing 10 on every
  // cell would paint each unfocused neighbour over the focused card's ring and
  // bloom. Document order already puts the poster above the numeral, which is
  // the only thing the stack has to settle here.
  const card = (
    <button
      type="button"
      data-bp-focusable
      data-bp-tile={shape === "wide" ? "wide" : "poster"}
      data-bp-autofocus={autofocus ? "true" : undefined}
      data-bp-restore-key={meta.id}
      ref={(el) => {
        boxRef.current = el;
        registerBpTarget(el, { meta });
      }}
      onFocus={() => {
        setFocused(true);
        publishBpMeta(meta);
      }}
      onBlur={() => setFocused(false)}
      onClick={() => onSelect(meta)}
      aria-label={meta.name}
      className={`group overflow-hidden rounded-[var(--bp-r-xs)] bg-[var(--bp-panel)] ${
        ranked ? "absolute end-0 top-0" : "relative"
      } ${ranked ? "w-[60%]" : fluid ? "w-full" : "shrink-0"}`}
      style={
        {
          width: ranked || fluid ? undefined : bpBoxCss(dims.box),
          aspectRatio: dims.ratio,
          ...(glow ? { "--bp-art-glow": glow } : null),
        } as React.CSSProperties
      }
    >
      <BpArt
        src={src}
        onLoad={() => setLoaded(true)}
        onError={art.onError}
        className={`object-cover transition-opacity duration-[var(--bp-dur-slow)] ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
      {art.url && !loaded && (
        <span
          aria-hidden
          className={`absolute inset-0 ${plate ? "" : "bg-[var(--bp-panel-2)]"}`}
          style={plate ? { background: plate } : undefined}
        />
      )}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 opacity-0 transition-opacity duration-[var(--bp-focus-fade)] group-data-[bp-focus=true]:opacity-100"
        style={{ background: "var(--bp-scrim-up)" }}
      />
      {/* --bp-focus-fade, not --bp-dur, on both this and the scrim above. These
          are the two elements that keep the arriving AND the departing tile
          dirty for the whole 260ms, which is why removing the card scale on its
          own measured +0%: the tile was still repainting either way. The title
          is the more expensive of the pair, because line-clamp-2 is its own clip
          over two glyph runs, so a group opacity strictly between 0 and 1 opens
          a real offscreen pass rather than folding into the draw. */}
      {showTitle && (
        <span
          data-bp-tile-title
          className={`pointer-events-none absolute inset-x-0 bottom-0 line-clamp-2 px-2.5 pb-2 text-start text-[clamp(10.5px,1.4vh,16px)] font-semibold leading-tight text-ink transition-opacity duration-[var(--bp-focus-fade)] group-data-[bp-focus=true]:opacity-100 ${
            art.url ? "opacity-0" : "opacity-100"
          }`}
        >
          {meta.name}
        </span>
      )}
      {/* After the scrim, so the bottom marks are not washed out by it. The
          corner prop is an override for the whole marks column, not an extra,
          and every anime row supplies one, so the top-start bookmark is owned by
          BpCardMarks rather than passed in: passing it here left a user with
          watchlistBadge set to topStart seeing the mark on every surface except
          anime, with no indication why. */}
      {corner ?? <BpCardMarks meta={meta} />}
      <BpCardStateMarks
        zones={zones}
        state={state}
        badges={badges}
        limit={bpScoreLimit(settings.cardBadgeLimit, shape)}
        lift={lift}
      />
    </button>
  );

  if (!ranked) return card;

  // The cell, not the card. Only the poster carries data-bp-focusable, so the
  // focus engine measures the same 2:3 box it measures in every other row and a
  // ranked row's geometry stays comparable to its neighbours'. A focusable
  // numeral would also stop the D-pad between every card.
  //
  // position:relative with no z-index, deliberately: it must NOT become a
  // stacking context, or the focused poster's z-index 5 would be trapped inside
  // this cell and the next cell would paint over its ring. That also rules out
  // container-type here, which is why the numeral is sized off the clamp.
  return (
    <div
      className="relative shrink-0"
      style={{ width: bpBoxCss(dims.box), aspectRatio: RANK_CELL_RATIO }}
    >
      <BpRankNumeral rank={rank ?? 1} box={RANK_BOX} />
      {card}
    </div>
  );
}

export const BpTile = memo(BpTileBody);
