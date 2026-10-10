import { bpBoxCss, type BpArtBox } from "./bp-art";

// Desktop's ranked card draws an OUTLINE numeral: a 2.6px rim in ink-muted with
// no fill. At two feet that reads as restraint. At ten feet a rim that thin is
// not a mark, it is a smudge, and the numeral is the one thing a Top 10 row
// exists to say. So Big Picture fills it and keeps the rim as the lit edge:
// a dark solid form punched into the ambient art, which is the house rule that
// depth comes from darkening rather than from a new colour.
//
// Both terms are custom properties on the element so they can be pushed live
// over CDP against the real 1140x641 canvas. Apparent size across a room is
// judged, never derived, and it has been derived wrong here before.
const FILL = "var(--bp-void)";
const INK = "var(--color-ink-muted)";

// A fraction of the cell, never a literal px. Desktop's 2.6 was authored for its
// own 181px cell; a literal here would render the same rim on a 220px floor and
// on a 350px ceiling, so the numeral would look heavier on a handheld than on a
// television for no reason anyone chose.
const RIM = 0.016;

// Opaque black because a mask reads alpha and nothing else. It is not a colour
// the theme has any say in, and swapping it for a token that resolves to
// anything translucent erases the numeral.
//
// A LEADING feather only. Desktop also fades the tail out from 54 percent, which
// on this surface buys nothing: the poster is opaque and covers everything past
// the gutter, so the tail fade is behind the art on every rank but 1, and on
// rank 1 it eats the half of the glyph that carries its identity. What the
// feather is actually for is the head: the glyph starts outside its own cell and
// would otherwise put a hard vertical edge in the gap, a few px off the
// neighbouring poster.
const MASK = "linear-gradient(to right, transparent 0, black 10%, black 100%)";

// TRAP, and it is the one a later polish pass will walk into. This mask is a
// render surface per cell, so a ranked row carries ten of them. They are safe
// ONLY because they are static: a static mask rasters once and re-resolves on
// damage, where an animated one re-resolves every frame. Do NOT give the numeral
// a focus response that touches transform, opacity, scale or the mask itself.
// That would put ten offscreen passes into every horizontal press, which is the
// same poison as the twenty-simultaneous-decode regression arriving through a
// different door, and it would read as a mysterious global regression rather
// than as a local change. The poster's grow and the ring already carry focus.
// The count itself is UNMEASURED on device: nobody has run a ranked row on a
// Stick 4K Max. If a ranked row ever measures slow, this is the first suspect.

/**
 * The 1-based position drawn behind a shape="rank" cell.
 *
 * Sized off the same clamp as the cell, where desktop uses 100cqw. Big Picture
 * has no container queries anywhere else, and a Fire TV WebView old enough to
 * not know cqw drops the whole font-size declaration with no other symptom: the
 * numeral would render at inherited body size and read as a layout bug.
 */
export function BpRankNumeral({ rank, box }: { rank: number; box: BpArtBox }) {
  const cell = bpBoxCss(box);
  const rim = `calc(${cell} * ${RIM})`;
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute top-0 flex h-full select-none items-center leading-none"
      style={{
        insetInlineStart: rank === 1 ? "18%" : "-3%",
        // Oswald arrives from a best-effort Google Fonts stylesheet that a
        // television may never fetch, and neither Arial Narrow nor Helvetica
        // Neue exists on Android, so the stack in --font-rank falls all the way
        // to Roboto: not condensed, far wider, and the numeral then runs the
        // wrong distance under the poster. Roboto Condensed IS on Android and
        // holds the proportions. Named here rather than in index.css because
        // that token is shared with desktop.
        fontFamily: '"Oswald", "Roboto Condensed", var(--font-rank)',
        fontWeight: 600,
        fontSize: `calc(${cell} * 230 / 228)`,
        letterSpacing: "-0.01em",
        color: FILL,
        WebkitTextStrokeWidth: rim,
        WebkitTextStrokeColor: INK,
        WebkitMaskImage: MASK,
        maskImage: MASK,
      }}
    >
      {rank >= 10 ? (
        <>
          <span>1</span>
          {/* Pulled back over the 1 so the pair reads as one numeral rather than
              two colliding glyphs. Desktop fills this one with the page colour
              to erase the overlap, which on this surface is a lie: Big Picture
              paints artwork behind the rail, so a page-coloured disc lands as an
              opaque grey blot on top of the art, and only ever on the tenth
              card. Same fill as the rest of the numeral instead, so the overlap
              is seamless and nothing is painted that is not the numeral. */}
          <span style={{ marginInlineStart: "-0.2em" }}>0</span>
        </>
      ) : (
        rank
      )}
    </span>
  );
}
