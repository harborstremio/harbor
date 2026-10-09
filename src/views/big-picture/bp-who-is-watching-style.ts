/**
 * Scoped to [data-bp-who] and rendered inside the surface, the same way
 * mobile-whos-watching carries its own choreography. It is not folded into
 * bp-tokens because nothing outside this surface should ever match it.
 *
 * The ring geometry is copied from the [data-bp-tile] rule in bp-tokens on
 * purpose. On a D-pad the ring is the cursor, and a cursor that changes weight
 * between surfaces reads as two different apps.
 */
export const BP_WHO_CSS = `
[data-bp-who] {
  transition-property: opacity;
  transition-duration: var(--bp-dur);
  transition-timing-function: var(--bp-ease-in);
}

[data-bp-who][data-bp-who-exiting="true"] {
  opacity: 0;
  pointer-events: none;
}

[data-bp-who-tile] {
  transition-property: transform, opacity, filter;
  transition-duration: var(--bp-focus-dur), var(--bp-dur-slow), var(--bp-dur-slow);
  transition-timing-function: var(--bp-ease);
  transition-delay: 0ms;
}

[data-bp-who-face] {
  transition-property: box-shadow;
  transition-duration: var(--bp-dur-fast);
  transition-timing-function: var(--bp-ease);
  box-shadow:
    0 0 0 2px color-mix(in oklab, var(--bp-who-color) 62%, transparent),
    0 26px 60px -26px rgba(0, 0, 0, 0.9);
}

[data-bp-who-tile][data-bp-focus="true"] {
  transform: scale(var(--bp-focus-lift));
  transition-delay: var(--bp-focus-dwell), 0ms, 0ms;
}

[data-bp-who-tile][data-bp-focus="true"] [data-bp-who-face] {
  box-shadow:
    0 0 0 2px var(--bp-void),
    0 0 0 4px var(--bp-focus-stroke),
    0 30px 70px -24px rgba(0, 0, 0, 0.92);
}

[data-bp-who-name] {
  color: color-mix(in oklab, var(--color-ink) 60%, transparent);
  transition-property: color;
  transition-duration: var(--bp-dur-fast);
  transition-timing-function: var(--bp-ease);
}

[data-bp-who-tile][data-bp-focus="true"] [data-bp-who-name],
[data-bp-who-tile][data-bp-who-active="true"] [data-bp-who-name] {
  color: var(--color-ink);
}

[data-bp-who-tile][data-bp-who-unavailable="true"] [data-bp-who-face] {
  filter: grayscale(1);
  opacity: 0.5;
}

[data-bp-who-tile][data-bp-who-state="chosen"] {
  transform: scale(1.14);
  z-index: 2;
}

[data-bp-who-tile][data-bp-who-state="dimmed"] {
  transform: scale(0.9);
  opacity: 0;
  filter: blur(2px);
}

@keyframes bp-who-shake {
  0%, 100% { translate: 0 0; }
  18% { translate: -11px 0; }
  38% { translate: 9px 0; }
  58% { translate: -6px 0; }
  78% { translate: 3px 0; }
}

[data-bp-who-shake="true"] {
  animation: bp-who-shake 380ms var(--bp-ease) both;
}

/* The blanket reduced-motion rule in bp-tokens already flattens every duration
   above to 1ms, which is the correct hard cut for travel. The shake is replaced
   by a timed opacity blink in the component rather than here, because a 1ms
   shake is a flicker rather than an answer. */
@media (prefers-reduced-motion: reduce) {
  [data-bp-who-shake="true"] {
    animation: none;
  }

  /* The blanket rule only forces transition-duration to 1ms, it does not remove a
     transform, so the tiles still jumped size on focus. bp-tokens drops the focus
     scale outright for [data-bp-tile] and [data-bp-key], including the PIN pad keys
     in this same feature, and the roster was the one surface that ignored the
     setting. Depth here comes from the ring alone. */
  [data-bp-who-tile][data-bp-focus="true"],
  [data-bp-who-tile][data-bp-who-state="chosen"] {
    transform: none;
  }

  [data-bp-who-tile][data-bp-who-state="dimmed"] {
    transform: none;
    filter: none;
  }
}
`;
