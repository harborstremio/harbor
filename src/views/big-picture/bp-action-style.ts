// One primary action treatment for the whole surface. It was pasted inline in
// bp-detail-actions and bp-queue-rail as two copies of the same 300 character
// string, which is how a ring ends up a different weight on two pages and the
// app reads as two apps. Solid and achromatic on purpose: on a near black
// canvas a white plate outranks a coloured one, and an outlined pill is the
// cheap-looking option the owner called out.
export const BP_ACTION_SOLID =
  "rounded-[var(--bp-r-xs)] bg-[var(--bp-on)] font-semibold text-ink";

// These stay CLASS STRINGS in TypeScript. Do not move them into bp-tokens.ts:
// as sheet rules the [data-bp-tile] selectors there would win on specificity and
// drag the 1.06 tile scale onto a 58px pill. Sharing the string is safe because
// every caller still emits the identical class attribute it emitted before.
//
// [transform:scale()], never scale-[]. Tailwind v4 compiles scale-[1.05] to the
// CSS `scale` property and -translate-y-[5px] to `translate`, neither of which
// is `transform`, so a transition list naming transform never touched them: the
// grow was a hard pop while box-shadow, which WAS in the list, cross-dissolved.
// Exactly inverted, and on the most important focus target in the application.
// Verified against this repo's own tailwindcss 4.2.4, not assumed.
//
// box-shadow is out of the list for the same reason bp-tokens keeps it out of
// the tile's: on a D-pad the ring is the cursor, and a cross-dissolving ring
// leaves two half-strength rings on screen at once.
export const BP_ACTION_RING =
  "transition-[transform,background-color,border-color,color] duration-[var(--bp-dur-fast)] ease-[var(--bp-ease)] data-[bp-focus=true]:bg-[var(--color-ink)] data-[bp-focus=true]:text-[var(--color-canvas)] data-[bp-focus=true]:border-transparent data-[bp-focus=true]:[transform:scale(1.03)] motion-reduce:data-[bp-focus=true]:[transform:none]";
