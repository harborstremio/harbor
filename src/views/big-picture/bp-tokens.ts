export const BP_TOKENS = `
[data-bp-root] {
  --bp-void: color-mix(in oklab, var(--color-canvas) 78%, #000 22%);
  --bp-page: var(--color-canvas);
  --bp-panel: color-mix(in oklab, var(--color-surface) 88%, #000 12%);
  --bp-panel-2: color-mix(in oklab, var(--color-elevated) 92%, #000 8%);
  --bp-glass: color-mix(in oklab, var(--color-ink) 7%, transparent);
  --bp-edge: color-mix(in oklab, var(--color-ink) 11%, transparent);
  --bp-edge-2: color-mix(in oklab, var(--color-ink) 18%, transparent);
  --bp-on: color-mix(in oklab, var(--color-ink) 22%, var(--bp-void));

  --bp-plate-lo: color-mix(in oklab, var(--color-ink) 7%, transparent);
  --bp-plate-hi: color-mix(in oklab, var(--color-ink) 11%, transparent);

  --bp-touch: var(--color-accent);
  --bp-focus-stroke: color-mix(in oklab, var(--color-ink) 86%, transparent);
  --bp-focus-face: color-mix(in oklab, var(--color-ink) 22%, var(--bp-panel-2));
  --bp-live: #4ade80;

  --bp-scrim-up: linear-gradient(
    0deg,
    var(--bp-void) 0%,
    color-mix(in oklab, var(--bp-void) 88%, transparent) 18%,
    color-mix(in oklab, var(--bp-void) 62%, transparent) 34%,
    color-mix(in oklab, var(--bp-void) 30%, transparent) 52%,
    color-mix(in oklab, var(--bp-void) 10%, transparent) 68%,
    transparent 82%
  );
  --bp-scrim-side: linear-gradient(
    100deg,
    color-mix(in oklab, var(--bp-void) 82%, transparent) 0%,
    color-mix(in oklab, var(--bp-void) 52%, transparent) 30%,
    color-mix(in oklab, var(--bp-void) 16%, transparent) 52%,
    transparent 70%
  );

  --bp-r-xs: 8px;
  --bp-r-sm: 10px;
  --bp-r-md: 16px;
  --bp-r-lg: 24px;

  --bp-dur-fast: 160ms;
  --bp-dur: 260ms;
  --bp-dur-slow: 420ms;
  --bp-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --bp-ease-in: cubic-bezier(0.5, 0, 0.75, 0);

  --bp-overscan: 0;
  --bp-safe-x: calc(var(--bp-overscan) * 100vw);
  --bp-safe-y: calc(var(--bp-overscan) * 100vh);
  /* max, never safe-x + gutter. A crop the panel eats is invisible margin that
     is already there, so summing them charges twice and put the home rows 177px
     in on a Fire TV. The second term only wins past 4.2 percent overscan, where
     the crop would otherwise start eating content. */
  --bp-gutter: max(clamp(56px, 7.5vw, 110px), calc(var(--bp-safe-x) + clamp(10px, 0.9vw, 20px)));
  --bp-row-gap: clamp(20px, 2.6vh, 40px);

  /* Row/detail heading fonts and the horizontal track gaps, lifted out of their
     Tailwind classes so the non-TV upscale block below can raise each in one
     place while the 607px television keeps the authored floor. The base value
     here IS the floor, so a surface that never takes the upscale (the TV, or a
     short desktop window) resolves exactly what it did before. --bp-detail-gap-tight
     is shared by BP_DETAIL_TRACK_TIGHT and BpEpisodeSpacer's manual width calc, so
     one definition keeps the virtualised episode strip aligned with its cells. */
  --bp-row-title: clamp(19px, 2.6vh, 32px);
  --bp-detail-heading: clamp(14px, 2.05vh, 26px);
  --bp-track-gap: clamp(21px, 1.9vw, 32px);
  --bp-detail-gap: clamp(16px, 1.35vw, 30px);
  --bp-detail-gap-tight: clamp(9px, 0.85vw, 17px);

  /* The detail hero action row. The Resume/Play pill height and the icon-button
     box are inline styles reading these; a stylesheet cannot reach an inline
     style, so the token is the only way the non-TV upscale can raise them while
     the 607px television keeps this authored floor. */
  --bp-action-h: 47px;
  --bp-action-box: 44px;

  /* The bar's real height, and the offset a page needs to clear it. Every page
     used to carry its own clamp guessing at this, tuned by eye at 1920x1080,
     and the guesses drifted: at the 607px tall TV canvas the commonest one
     resolved to 66px under an 84px bar, so page titles rendered behind the nav.
     A full-bleed hero deliberately runs under the bar and must NOT use these. */
  --bp-bar-h: calc(clamp(72px, 9vh, 112px) + var(--bp-safe-y, 0px));
  --bp-page-top: calc(var(--bp-bar-h) + clamp(10px, 1.4vh, 24px));

  /* The hint bar's real height, and the bottom twin of --bp-bar-h. The same
     clamp was written out three times, in bp-hint-bar, bp-guide-portal and
     bp-queue-stage, which is exactly the drift the comment above records: the
     bar owns the last 52px of a 641px television panel and anything that guesses
     at it lays out under Menu / OK / Back.
     This bar is HARBOR's, bp-hint-bar.tsx mounted from bp-shell. It is not a
     Fire TV system overlay and it is not removable by the platform, so the only
     way a card clears it is for the layout above to reserve it. */
  --bp-hint-h: calc(clamp(52px, 6.4vh, 74px) + var(--bp-safe-y, 0px));

  /* How much of its hero box Home hands back. Zero everywhere by default, so the
     whole hero clamp still lives once in bp-spotlight and this is a subtraction
     rather than a second height competing with it.
     Home is the only surface whose hero never collapses: shows and movies pass
     expanded={activeRow === 0} and drop to 140px the moment you leave row 0, so
     Home alone spends page-top plus a full 268px hero above the rail forever.
     The row header that replaced the lead tile then added its own block on top of
     that, and at 1140x641 the focused poster's ring finished at 614.5 on a panel
     whose last 52px belong to --bp-hint-h: 25.5px inside the bar.
     The ceiling on this number is 22px, not taste. The hero copy is bottom
     anchored under justify-end, so the slack being spent is dead band at the TOP
     of the box, and a hero whose facts line wraps to two rows overflows upward
     into it. At 22 that worst case still clears the nav by 0.8px; at 26 it
     renders 3px behind it.
     NEEDS AN EYE at 1140x641. This is an apparent size across a room, so push it
     live and go bigger or smaller rather than deriving it again. */
  --bp-hero-give: 0px;

  /* A television lays out on 1080x607, and at that height 500 of Big Picture's
     677 clamps resolve to their px floor rather than their vh term. The floor
     scale IS the ten-foot design. It holds together because the floors sit at
     an even multiple of the authored vh value: median 1.22x overall, 1.37x for
     sizes, 1.21x for fonts, 1.18x for spacing.
     So do not "correct" a single floor down to its vh value. That element then
     renders at 1.0x beside neighbours at 1.2x and reads undersized, which is
     exactly how the bp-connect title shipped wrong the first time. Judge a new
     floor against the norm for its kind, never against its own vh term.
     Measured, not guessed: tools/clamp-audit.py re-derives all of it from the
     built CSS after a vite build, and flags whatever drifts off the norm.
     No backticks in here, the whole sheet is a template literal. */

  --bp-focus-lift: 1.03;
  --bp-focus-lift-wide: 1.03;
  /* The grow waits, so scanning stays calm and a card that grows is a card you
     chose. This was plumbed into both rules below and left at 0ms, so every
     tile started inflating on the frame focus landed and a run down a row of ten
     pumped ten cards. It is also free at worst and a win at best: Android
     autorepeats at about 90ms, so a dwell at or above that means a card scanned
     past during a hold never starts its grow at all.
     NEEDS AN EYE. 60 to 90ms is the band; below the repeat interval some grows
     still start mid-hold, above it none do, and which of those looks right is a
     look rather than a calculation. */
  --bp-focus-dwell: 70ms;
  --bp-focus-dur: 190ms;
  /* The press. Down is fast and shallow, the release rides the normal grow back
     out. On a stick the detail route is a lazy chunk that can take hundreds of
     milliseconds to mount, so a press with no acknowledgement reads as a dropped
     press and the viewer presses again. */
  --bp-press: 0.965;
  --bp-press-dur: 90ms;

  /* Every fade a focus change starts, on one dial. Split out of --bp-dur so a
     television can take these to zero without touching the 260ms that a hundred
     unrelated things use. Desktop resolves it to exactly --bp-dur. */
  --bp-focus-fade: var(--bp-dur);

  /* The portal sits on document.body, so it inherits the minui theme override
     that paints service logos black. Big Picture is always dark. */
  --service-logo-filter: brightness(0) invert(1);
}

[dir="rtl"] [data-bp-root] {
  --bp-scrim-side: linear-gradient(
    260deg,
    color-mix(in oklab, var(--bp-void) 82%, transparent) 0%,
    color-mix(in oklab, var(--bp-void) 52%, transparent) 30%,
    color-mix(in oklab, var(--bp-void) 16%, transparent) 52%,
    transparent 70%
  );
}

/* Television only, and Home only. A desktop Big Picture window at 1080 finishes
   the same focused poster 77px above the hint bar, so it has nothing to hand
   back, and shows and movies sit 24px higher at the top than Home does: giving
   them the same 22px would put their hero logo behind the nav. Scoped to the one
   element that carries the problem, and inherited from there by the hero. */
[data-bp-root][data-bp-tv] [data-bp-home-hero],
[data-bp-root][data-bp-tv] [data-bp-page-hero] {
  --bp-hero-give: 56px;
}

/* ==========================================================================
   NON-TV UPSCALE. Desktop and Steam Deck read Big Picture ~1.25x larger than
   the authored ten-foot floor, while the 1080x607 Android television is left
   exactly as it was.

   Two guards, and each excludes that television on its own, so it can never take
   a rule in this block: it carries [data-bp-tv] (so :not([data-bp-tv]) fails)
   AND it is 607px tall (so min-height:800px fails). The height guard also spares
   a short desktop window, which falls back to the floor rather than inheriting a
   raised one. Every value here is the element's OWN authored clamp multiplied by
   --bp-up, so the clamp-audit norms are untouched and there is exactly ONE dial:
   change --bp-up and the whole non-TV surface rescales. Card, grid, portrait and
   continue-watching widths are inline styles a stylesheet cannot reach; they read
   the same var through bpBoxCss / bp-grid, and their art buckets read BP_UP in
   bp-art. Keep that number in step with --bp-up here. No backticks below, the
   whole sheet is a template literal. */
@media (min-height: 800px) {
  [data-bp-root]:not([data-bp-tv]) {
    --bp-up: 1.3;

    /* Chrome heights, row rhythm and the hoisted heading/gap tokens, each the
       base clamp times the dial. --bp-safe-y is overscan and must not scale, so
       it stays outside the multiply. */
    --bp-bar-h: calc(clamp(84px, 10.5vh, 128px) + var(--bp-safe-y, 0px));
    --bp-page-top: calc(var(--bp-bar-h) + clamp(10px, 1.4vh, 24px));
    --bp-hint-h: calc(clamp(52px, 6.4vh, 74px) + var(--bp-safe-y, 0px));
    --bp-row-gap: clamp(20px, 2.6vh, 40px);
    --bp-row-title: calc(clamp(19px, 2.6vh, 32px) * var(--bp-up));
    --bp-detail-heading: calc(clamp(14px, 2.05vh, 26px) * var(--bp-up));
    --bp-track-gap: calc(clamp(21px, 1.9vw, 32px) * var(--bp-up));
    --bp-detail-gap: calc(clamp(16px, 1.35vw, 30px) * var(--bp-up));
    --bp-detail-gap-tight: calc(clamp(9px, 0.85vw, 17px) * var(--bp-up));
    --bp-action-h: calc(47px * var(--bp-up));
    --bp-action-box: calc(44px * var(--bp-up));
  }

  /* Hero. Movies, shows and the anime hero keep the base fill. The anime hero in
     particular packs a logo, a facts line, two action buttons and the
     availability line, which measured about 383px and overflows UPWARD past a
     shorter box under justify-end, putting its logo behind the nav. Copy is
     bottom anchored, so --bp-hero-give is a no-op off the television either way. */
  [data-bp-root]:not([data-bp-tv]) [data-bp-hero-box] {
    height: calc(clamp(300px, 42vh, 430px) - var(--bp-hero-give, 0px));
  }

  /* Home alone caps the hero short. Home is the one surface whose hero never
     collapses off row 0, so its first rail otherwise parks its 2:3 posters under
     --bp-hint-h with their titles cut. Its spotlight carries only logo, facts and
     overview, which fits the shorter box with room to spare. Do NOT widen this to
     the bare [data-bp-hero-box] rule above or the taller anime hero clips. */
  [data-bp-root]:not([data-bp-tv]) [data-bp-home-hero] [data-bp-hero-box] {
    height: calc(clamp(260px, 34vh, 380px) - var(--bp-hero-give, 0px));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-tab-icon] > * {
    height: calc(26px * var(--bp-up));
    width: calc(26px * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-hero-title] {
    font-size: calc(clamp(30px, 4.7vh, 44px) * var(--bp-up));
    max-width: calc(min(36vw, 410px) * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-hero-logo] {
    max-height: clamp(104px, 16.2vh, 188px);
    max-width: min(32vw, 380px);
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-hero-mark] {
    height: calc(clamp(19px, 3.2vh, 29px) * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-hero-meta] {
    font-size: calc(clamp(13.4px, 1.45vh, 17px) * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-hero-desc] {
    font-size: calc(clamp(14.2px, 1.7vh, 20px) * var(--bp-up));
    max-width: calc(min(36vw, 410px) * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-hero-desc-anime] {
    font-size: calc(clamp(15px, 1.7vh, 26px) * var(--bp-up));
    max-width: calc(min(36vw, 410px) * var(--bp-up));
  }

  /* The anime hero logo is the page's subject and gets its own size, larger than
     the spotlight logo home wanted kept small. Its own attribute rather than
     --bp-up on the shared [data-bp-hero-logo] so the two move independently. The
     607px television keeps the base LOGO_BOX from bp-anime-hero untouched. */
  [data-bp-root]:not([data-bp-tv]) [data-bp-anime-logo] {
    max-height: clamp(104px, 17vh, 220px);
    max-width: min(40vw, 480px);
  }

  /* The anime hero facts are fixed px baked at the television floor, not clamps,
     so they scale with a literal multiply. The MAL mark and the Sub/Dub check
     ride inside them. */
  [data-bp-root]:not([data-bp-tv]) [data-bp-anime-facts] {
    height: calc(20px * var(--bp-up));
    font-size: calc(13.4px * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-anime-facts] svg {
    height: calc(13px * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-anime-pill-top] {
    height: calc(20px * var(--bp-up));
    font-size: calc(9.8px * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-anime-pill-grey] {
    height: calc(19px * var(--bp-up));
    font-size: calc(10.7px * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-anime-avail] {
    font-size: calc(12.5px * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-anime-avail] svg {
    height: calc(13px * var(--bp-up));
    width: calc(13px * var(--bp-up));
  }

  /* Detail hero. The page subject and its controls were baked at the television
     floor and never took the desktop scale: the logo capped at a 160px ceiling,
     the facts line and synopsis at fixed px, the Resume/Play pill and its icon
     buttons at 47/44px. The logo gets its own subject-size clamp; the facts line
     reuses [data-bp-hero-meta] because it is the same role as the spotlight, not
     a mistake. The award mark is MetaAwardsCorner, shared with other heroes, so
     its base sizes must not move: it is scaled in place on the detail instance
     alone, from its own bottom-end corner so the anchor does not shift. */
  [data-bp-root]:not([data-bp-tv]) [data-bp-detail-logo] {
    max-height: clamp(120px, 18vh, 196px);
    max-width: min(32vw, 420px);
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-detail-tagline] {
    font-size: calc(13.4px * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-detail-synopsis] {
    font-size: calc(clamp(13px, 1.85vh, 22px) * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-detail-awards] > div {
    transform: scale(var(--bp-up));
    transform-origin: 100% 100%;
  }
  [dir="rtl"] [data-bp-root]:not([data-bp-tv]) [data-bp-detail-awards] > div {
    transform-origin: 0% 100%;
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-action-primary] {
    font-size: calc(13.4px * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-action-primary] svg {
    width: calc(14px * var(--bp-up));
    height: calc(14px * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-action-icon] svg {
    width: calc(20px * var(--bp-up));
    height: calc(20px * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-action-icon] img {
    width: calc(20px * var(--bp-up));
    height: calc(20px * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-action-icon] > span {
    font-size: calc(13.4px * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-action-hint] {
    font-size: calc(12.5px * var(--bp-up));
  }

  /* Home rails. Card widths already track --bp-up through bpBoxCss; these are the
     texts that ride inside or beside them. */
  [data-bp-root]:not([data-bp-tv]) [data-bp-row-see-all] {
    font-size: calc(clamp(15px, 1.9vh, 22px) * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-tile-title] {
    font-size: calc(clamp(10.5px, 1.4vh, 16px) * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-cw-pad] {
    padding: calc(clamp(11px, 1.3vw, 20px) * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-cw-title] {
    font-size: calc(clamp(14px, 1.98vh, 23px) * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-cw-logo] {
    max-height: calc(clamp(24px, 3.8vh, 52px) * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-cw-pill] {
    font-size: calc(clamp(10.5px, 1.4vh, 16px) * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-result-title] {
    font-size: calc(clamp(13px, 1.85vh, 22px) * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-result-logo] {
    max-height: calc(clamp(26px, 3.4vh, 48px) * var(--bp-up));
  }

  /* Detail, person and collection. The cells grow through bpBoxCss, so their
     inner text moves with them, and the headers sit beside a portrait or poster
     that has already grown. */
  [data-bp-root]:not([data-bp-tv]) [data-bp-cell-name] {
    font-size: calc(clamp(11.5px, 1.55vh, 17.5px) * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-cell-sub] {
    font-size: calc(clamp(10px, 1.3vh, 14.5px) * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-cell-meta] {
    font-size: calc(clamp(12px, 1.6vh, 18px) * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-cell-rank] {
    font-size: calc(clamp(9.5px, 1.2vh, 13px) * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-eyebrow] {
    font-size: calc(clamp(11px, 1.5vh, 17px) * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-person-name] {
    font-size: calc(clamp(26px, 4.6vh, 64px) * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-person-facts] {
    font-size: calc(clamp(12px, 1.7vh, 20px) * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-person-bio] {
    font-size: calc(clamp(13px, 1.85vh, 22px) * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-coll-title] {
    font-size: calc(clamp(24px, 4.4vh, 54px) * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-coll-meta] {
    font-size: calc(clamp(11.5px, 1.55vh, 18px) * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-coll-overview] {
    font-size: calc(clamp(12.5px, 1.75vh, 20px) * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-filter-chip] {
    height: calc(clamp(44px, 4.8vh, 58px) * var(--bp-up));
    font-size: calc(clamp(12.5px, 1.78vh, 20px) * var(--bp-up));
  }

  /* Top bar and hint bar, so the chrome keeps pace with the content. The tab
     rules are scoped under [data-bp-top-bar] so the shared [data-bp-chip] accent
     fill on see-alls and filter chips is not caught. The brand mark and wordmark
     are reached structurally because HarborMark forwards only className: the
     first child of the brand column is the mark, the second is the wordmark. */
  [data-bp-root]:not([data-bp-tv]) [data-bp-top-bar] .col-start-1 > :first-child {
    height: calc(clamp(28px, 3.4vh, 44px) * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-top-bar] .col-start-1 > svg:first-child {
    width: calc(clamp(28px, 3.4vh, 44px) * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-top-bar] .col-start-1 > :nth-child(2) {
    height: calc(clamp(22px, 2.7vh, 36px) * var(--bp-up));
    font-size: calc(clamp(24px, 3vh, 40px) * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-clock] {
    font-size: calc(clamp(14px, 1.9vh, 22px) * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-top-bar] [data-bp-chip] {
    height: calc(clamp(44px, 5vh, 58px) * var(--bp-up));
    font-size: calc(clamp(15px, 1.6vh, 17px) * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-tab-icon] {
    height: calc(26px * var(--bp-up));
    width: calc(26px * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-tab-icon] > svg {
    height: 100%;
    width: 100%;
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-hint-chip] {
    height: calc(clamp(22px, 2.5vh, 28px) * var(--bp-up));
    min-width: calc(clamp(22px, 2.5vh, 28px) * var(--bp-up));
    font-size: calc(clamp(13.4px, 1.5vh, 18px) * var(--bp-up));
  }
  [data-bp-root]:not([data-bp-tv]) [data-bp-hint-label] {
    font-size: calc(clamp(13.4px, 1.5vh, 18px) * var(--bp-up));
  }
}


[data-bp-root] [data-bp-row] {
  padding: 0 var(--bp-gutter);
  margin: 0 calc(var(--bp-gutter) * -1);
  position: relative;
  z-index: 0;
}

/* Off-screen rows stay cheap. The focused row must stay uncontained so the
   card bloom can bleed over the row beneath it instead of being clipped.

   Keyed on an attribute the ring writes to its own row ancestors in
   applyBpFocus, never on :has([data-bp-focus="true"]). Chromium answers a
   :has() by re-checking every candidate subtree whenever the tested attribute
   changes anywhere in the document, so with twenty rows and 240 tiles a single
   focus move invalidated style for the whole rail. Held direction keys then
   spent more time in style recalc than in moving, and the app stopped
   answering until the key came up. Whoever writes data-bp-focus must keep
   data-bp-row-focus in step, which is why only applyBpFocus sets either. */
[data-bp-root] [data-bp-row]:not([data-bp-row-focus]) {
  content-visibility: auto;
  contain-intrinsic-size: auto 340px;
}

[data-bp-root] [data-bp-row][data-bp-row-focus] {
  z-index: 3;
}

[data-bp-root] [data-bp-focus="true"] {
  outline: none;
}

/* The card grows upward out of the row into the padding the track already
   reserves, so the row's baseline never moves under the eye.

   Longhands, never the transition shorthand: this rule outranks every Tailwind
   transition-* utility on the same element, and a shorthand here resets
   transition-property to transform alone. That silently killed the brand-fill
   fade on the service tile and the panel fade on the label tile. */
[data-bp-root] [data-bp-tile] {
  transition-property: transform, background-color;
  transition-duration: var(--bp-focus-dur), var(--bp-dur-fast);
  transition-timing-function: var(--bp-ease);
  transition-delay: 0ms;
  transform-origin: 50% 100%;
}

/* box-shadow is deliberately outside the transition list: on a D-pad the ring
   is the cursor, and a cross-dissolving ring leaves two half-strength rings on
   screen at once. The dwell delay lives here so only the grow-in waits. */
/* will-change belongs to the focused tile alone. It used to sit on every tile,
   which promoted 262 layers on home and overran the stick's GPU budget: average
   frame during a row scroll measured 125ms with it, 92ms without, worst frame
   308ms against 154ms. One promoted layer is a hint, 262 is a denial of service. */
[data-bp-root] [data-bp-tile][data-bp-focus="true"] {
  transform: scale(var(--bp-focus-lift));
  /* No will-change. It was here to hint the grow, but bp-ring-motion collapses
     --bp-focus-dur to 0ms during a held key, so there is no animation left to
     hint and all the hint does at eleven presses a second is promote a
     compositing layer and destroy it again: two compositor passes per press,
     two rasters of a fresh layer whose bounds are inflated by the shadow, and a
     repaint of the hole left in the rail's own layer. Removing it from all 262
     tiles was already measured as a large win; this is the same argument for
     the one tile that kept it. */
  transition-delay: var(--bp-focus-dwell), 0ms;
  /* A drawn stroke around the card was the cheap tell. The reference tier reads
     focus as the card coming FORWARD, not as a box painted round it: lift,
     a deeper contact shadow, and a brighter face. The 6px of ring also inflated
     the raster bounds of the one promoted layer on screen, so losing it is not
     only a look. */
  box-shadow:
    0 0 0 2px var(--bp-void),
    0 0 0 4px var(--bp-focus-stroke),
    0 24px 56px -22px rgba(0, 0, 0, 0.92);
  z-index: 5;
}

/* Identical specificity to the rule above, so it only wins by coming after it. */
[data-bp-root] [data-bp-tile="wide"][data-bp-focus="true"] {
  transform: scale(var(--bp-focus-lift-wide));
}

/* The bloom is sampled off the poster and lands a few hundred ms after the ring
   has already arrived, so it needs a fade the ring must not get. It gets one
   safely: at the instant focus flips there is no --bp-art-glow on the element
   yet, so this rule is not matching and the ring is still instant. */
[data-bp-root] [data-bp-tile][data-bp-focus="true"][style*="--bp-art-glow"] {
  transition-property: transform, background-color, box-shadow;
  transition-duration: var(--bp-focus-dur), var(--bp-dur-fast), var(--bp-dur);
  transition-delay: var(--bp-focus-dwell), 0ms, 0ms;
  box-shadow:
    0 0 0 2px var(--bp-void),
    0 0 0 4px var(--bp-focus-stroke),
    0 24px 56px -22px rgba(0, 0, 0, 0.92),
    0 12px 20px -6px rgba(var(--bp-art-glow) / 0.62),
    0 24px 38px -16px rgba(var(--bp-art-glow) / 0.5);
}

/* Press feedback. Nothing in Big Picture had any: OK produced a sound and then
   a route change, and nothing on screen acknowledged the press. On a stick the
   detail route is a lazy chunk, so a press with no answer reads as a dropped
   press and the viewer presses again.

   Keyed on an attribute rather than on :active, because a D-pad never produces
   :active and the CSS pseudo-class cannot see a remote press at all. It must
   also NOT be carried on an inherited custom property on [data-bp-root]:
   bp-ring-motion measured changing one of those at 104.8ms median on a Stick 4K
   Max. An attribute on the pressed element is a one-element invalidation.

   Scoped to the FOCUSED tile so the lift it multiplies is always applied. Match
   it on an unfocused tile and 1.06 x 0.965 reads as a card growing on press.

   Placed after the art-glow rule because it ties on specificity at 0-4-0 and
   only order separates them: this must win the transform.

   transform only, one element, and only ever the element already under the ring,
   so it adds at most one live transition and only once scanning has stopped. */
[data-bp-root] [data-bp-tile][data-bp-focus="true"][data-bp-press="true"] {
  transform: scale(calc(var(--bp-focus-lift) * var(--bp-press)));
  transition-duration: var(--bp-press-dur);
  transition-timing-function: var(--bp-ease-in);
  transition-delay: 0ms;
}

[data-bp-root] [data-bp-tile="wide"][data-bp-focus="true"][data-bp-press="true"] {
  transform: scale(calc(var(--bp-focus-lift-wide) * var(--bp-press)));
}

/* No glow. A 30px spread behind a wide card does not follow its radius, so it
   read as a rectangular halo bleeding out of the rounded corners. The filled
   background is already the loudest thing on the screen. */
[data-bp-root] [data-bp-chip][data-bp-focus="true"] {
  background: var(--color-ink);
  color: var(--color-canvas);
  /* The fill is the whole affordance, so the resting outline has to go with it.
     An unselected chip carries border-[var(--bp-edge)] from bp-library-chips,
     nothing here used to clear it, and the focused chip painted as an amber
     plate with a grey ring still drawn around its edge. The owner called that
     out by name: a filled control does not also get an outline. */
  border-color: transparent;
}

[data-bp-root] [data-bp-key][data-bp-focus="true"] {
  background: var(--color-ink);
  color: var(--color-canvas);
  transform: scale(1.12);
  box-shadow: 0 10px 26px -8px rgba(0, 0, 0, 0.8);
}

[data-bp-root] [data-bp-top-bar] nav[data-bp-row]:not([data-bp-row-focus]) [data-bp-chip] {
  color: color-mix(in oklab, var(--color-ink) 46%, transparent);
}

[data-bp-root] [data-bp-top-bar] nav[data-bp-row]:not([data-bp-row-focus]) [data-bp-chip][data-bp-tab-on="true"] {
  background: color-mix(in oklab, var(--color-ink) 8%, transparent);
}

/* ANDROID TV ONLY, and it is all or nothing.

   data-bp-tv is written once at mount in bp-shell and never changes, which is
   the only safe way to key motion off state here: bp-ring-motion records that
   CHANGING an inherited custom property on this root measured 104.8ms median on
   a Fire TV Stick 4K Max. One computed once costs nothing.

   Motion on that WebView is priced by the NUMBER of live offscreen passes, not
   by their size, and it saturates. Measured three ways on the device: with one
   render surface per backdrop-filter, zero blurred elements is 21ms a frame,
   one is 23ms, EIGHT is 65ms and 131 is also 65ms (bp-card-marks.tsx); one
   10x10px transform animation took MessageChannel throughput from 19025 ticks
   to 4104 and thirty-two cost almost nothing more (bp-decor-motion.ts); and
   rendering 28x fewer pixels moved issue-draw-commands by 2% (tv-bench-history).

   Past that cliff a partial cut reads as a null, which is what removing the
   card scale alone (+0%) and the focus ring paint (-4%) each measured under the
   navigation workload. So restoring ONE of these durations does not give back a
   fifth of the win. It puts the whole screen back on the slow path and reads as
   a mysterious global regression rather than as a local change.

   NOT here on purpose: the tile grow and the rail slide. Both are transforms,
   removing the card scale entirely already measured +0%, and they are the two
   motions the ten-foot design is actually made of. */

/* The rail's own row fade, 140ms out and 320ms in across a full-width subtree
   of ten tiles: one offscreen pass per VERTICAL press, none at idle, because
   group opacity is a pass only while it is strictly between 0 and 1. On the
   attribute rather than the class so home, anime, shows, movies and discover,
   which each spell the same fade themselves, get it from one rule.

   The duration is zeroed on television, which is where this became a design
   bug rather than only a perf win: at 0ms the departing row does not fade, it
   is DELETED in frame one, and the rail then glides 240ms into the hole it left.
   The eye reads that as content vanishing followed by a shuffle rather than as
   a shelf scrolling. So the row above is no longer sent to opacity 0 at all: it
   travels out under the rail's own overflow-hidden clip, which is where it was
   already going, and the physical travel the 240ms slide already pays for is
   what the viewer sees.

   Opacity 1 rather than dropping the property, so the platform split stays in
   ONE rule instead of five components disagreeing. Do NOT park it at a partial
   value to "dim" the row: group opacity is an offscreen pass only while it is
   strictly between 0 and 1, so 0.35 is a permanent pass PER ROW and lands
   straight on the eight-element cliff. */
[data-bp-root][data-bp-tv] [data-bp-rail-row] {
  transition-duration: 0ms;
  opacity: 1;
}

/* bp-enter and bp-fade finished 420ms after Big Picture opened and have held
   this layer promoted ever since: fill-mode both leaves Blink's
   HasCurrentOpacityAnimation set, which is kOpacityAnimation, so the whole
   surface renders into an offscreen texture on every damaged frame. The census
   reports it on a SETTLED home as "div.fixed z-900 ActiveTransformAnimation,
   ActiveOpacityAnimation". Dropping the forwards half is a visual no-op, both
   keyframes end on exactly the element's own base style. */
[data-bp-root][data-bp-tv],
[data-bp-root][data-bp-tv] > main {
  animation-fill-mode: backwards;
}

[data-bp-root] .harbor-shimmer::after {
  content: none;
}

[data-bp-root] .harbor-shimmer {
  background-color: var(--bp-plate-lo);
  animation: bp-plate 2000ms var(--bp-ease) infinite alternate;
}

[data-bp-root] [data-bp-plate] {
  background-color: var(--bp-plate-lo);
  animation: bp-plate 2000ms var(--bp-ease) var(--bp-plate-delay, 0ms) infinite alternate;
}

@keyframes bp-plate {
  to { background-color: var(--bp-plate-hi); }
}

@keyframes bp-rise {
  from { opacity: 0; transform: translate3d(0, 14px, 0); }
  to { opacity: 1; transform: none; }
}

@keyframes bp-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes bp-enter {
  from { opacity: 0; transform: scale(1.035); }
  to { opacity: 1; transform: none; }
}

@keyframes bp-done-deal {
  from { opacity: 0; transform: translate3d(0, 26px, 0) rotate(0deg) scale(0.92); }
  to { opacity: 1; }
}

@keyframes bp-done-check {
  from { stroke-dashoffset: 1; }
  to { stroke-dashoffset: 0; }
}

@keyframes bp-step-in {
  from { opacity: 0; transform: translate3d(3.5%, 0, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}

@keyframes bp-code-in {
  from { opacity: 0; transform: scale(0.94); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes bp-hero-land {
  from { opacity: 0; transform: translate3d(5.5%, 0, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}

@keyframes bp-mosaic-drift {
  from { transform: translate3d(0, 0, 0); }
  to { transform: translate3d(0, -50%, 0); }
}

@keyframes bp-drift {
  from { transform: scale(1.06) translate3d(0, 0, 0); }
  to { transform: scale(1.14) translate3d(-1.4%, -1%, 0); }
}

@keyframes bp-kenburns {
  0% { transform: scale(1.005) translate3d(0, 0, 0); }
  72% { transform: scale(1.075) translate3d(-1.1%, -0.7%, 0); }
  100% { transform: scale(1) translate3d(0, 0, 0); }
}

@keyframes bp-intro-bed {
  from { opacity: 0; transform: scale(1.08); }
  to { opacity: 0.5; transform: scale(1); }
}

@keyframes bp-intro-mark {
  0% { opacity: 0; transform: translate3d(0, 22px, 0) scale(0.94); letter-spacing: 0.04em; }
  100% { opacity: 1; transform: none; letter-spacing: -0.02em; }
}

@keyframes bp-intro-spinner-in {
  from { opacity: 0; transform: translate3d(0, 10px, 0); }
  to { opacity: 1; transform: none; }
}

@keyframes bp-intro-spin {
  to { transform: rotate(360deg); }
}

@keyframes bp-intro-dash {
  0% { stroke-dasharray: 1, 126; stroke-dashoffset: 0; }
  50% { stroke-dasharray: 90, 126; stroke-dashoffset: -22; }
  100% { stroke-dasharray: 1, 126; stroke-dashoffset: -125; }
}

@keyframes bp-intro-out {
  0% { opacity: 1; transform: scale(1); filter: blur(0px); }
  100% { opacity: 0; transform: scale(1.06); filter: blur(10px); }
}

@keyframes bp-slide-in {
  from { opacity: 0; transform: translate3d(24px, 0, 0); }
  to { opacity: 1; transform: none; }
}

[dir="rtl"] [data-bp-root] [role="dialog"] {
  animation-name: bp-slide-in-rtl;
}

@keyframes bp-slide-in-rtl {
  from { opacity: 0; transform: translate3d(-24px, 0, 0); }
  to { opacity: 1; transform: none; }
}

@keyframes bp-stagger {
  from { opacity: 0; transform: translate3d(0, 26px, 0); }
  to { opacity: 1; transform: none; }
}

@media (prefers-reduced-motion: reduce) {
  /* The press pair is named explicitly. Those rules carry an extra attribute,
     so at 0-4-0 they outrank a bare 0-3-0 reset even from inside this block,
     and reduced motion would still have got a 3.5 percent jump on every OK. */
  [data-bp-root] [data-bp-tile][data-bp-focus="true"],
  [data-bp-root] [data-bp-key][data-bp-focus="true"],
  [data-bp-root] [data-bp-tile][data-bp-focus="true"][data-bp-press="true"],
  [data-bp-root] [data-bp-tile="wide"][data-bp-focus="true"][data-bp-press="true"] {
    transform: none;
  }
  [data-bp-root] * {
    transition-duration: 1ms !important;
    animation-duration: 1ms !important;
    /* For a finite animation 1ms means "skip to the end", which is right. For
       an INFINITE one it means a thousand cycles a second, so the setting that
       was asked to remove motion produced worse motion than it removed. Every
       [animation:...] in the tree carries its own motion-reduce guard except
       the boot splash columns, which are inline and linear infinite; this makes
       any future unguarded loop fail safe rather than fail fast. */
    animation-iteration-count: 1 !important;
  }
  [data-bp-root] [data-bp-plate],
  [data-bp-root] .harbor-shimmer {
    animation: none;
  }
  /* Reduced motion replaces travel with a cross-fade, so the blanket 1ms above
     must not flatten the fades themselves into hard cuts. */
  [data-bp-root] [data-bp-xfade] {
    transition-duration: 320ms !important;
  }
}
`;

export const BP_STYLE_ID = "harbor-big-picture-tokens";

export function ensureBigPictureTokens(): void {
  if (typeof document === "undefined") return;
  const existing = document.getElementById(BP_STYLE_ID);
  if (existing) {
    if (existing.textContent !== BP_TOKENS) existing.textContent = BP_TOKENS;
    return;
  }
  const el = document.createElement("style");
  el.id = BP_STYLE_ID;
  el.textContent = BP_TOKENS;
  document.head.appendChild(el);
}
