/**
 * Every keyframe here resolves to its resting state, so the global
 * prefers-reduced-motion clamp in index.css (0.01ms, one iteration) lands the
 * end state instantly and nothing is carried by motion alone. The one
 * exception is `setup-depart`, whose end state is off-screen: it is gated in
 * JS by useReducedMotion and must never be applied from CSS alone.
 */
export const SETUP_MOTION_CSS = `
.setup-boat {
  position: relative;
  display: block;
  aspect-ratio: 700 / 642.88;
}
.setup-boat-part {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}
.setup-hoist-hull {
  animation: setup-hull-float 420ms var(--ease-out) both;
}
.setup-hoist-jib,
.setup-hoist-sail {
  transform-origin: 50% 100%;
}
.setup-hoist-jib {
  animation: setup-sail-hoist 460ms var(--ease-out) both;
}
.setup-hoist-sail {
  animation: setup-sail-hoist 500ms var(--ease-out) both;
}
.setup-lag-1 { animation-delay: 100ms; }
.setup-lag-2 { animation-delay: 210ms; }
@keyframes setup-hull-float {
  from { opacity: 0; transform: translate3d(0, 24%, 0); }
  to { opacity: 1; transform: none; }
}
@keyframes setup-sail-hoist {
  from { opacity: 0; transform: scaleY(0.06); }
  to { opacity: 1; transform: scaleY(1); }
}

.setup-seg-fill {
  display: block;
  height: 100%;
  width: 100%;
  transform-origin: left center;
  animation: setup-seg-fill 340ms var(--ease-out) both;
}
[dir="rtl"] .setup-seg-fill { transform-origin: right center; }
.setup-seg-lag-1 { animation-delay: 70ms; }
.setup-seg-lag-2 { animation-delay: 140ms; }
@keyframes setup-seg-fill {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}

/* The berth clips this. Tailwind's overflow-y-auto on the scroll body computes
   overflow-x to auto, so an unclipped departure would pan the whole page
   sideways on a phone. */
.setup-depart {
  --setup-sail-x: 160%;
  animation: setup-depart 720ms cubic-bezier(0.55, 0, 0.85, 0.4) 980ms both;
}
[dir="rtl"] .setup-depart { --setup-sail-x: -160%; }
@keyframes setup-depart {
  from { opacity: 1; transform: none; }
  to { opacity: 0; transform: translate3d(var(--setup-sail-x), -16%, 0) scale(0.9); }
}
.setup-land {
  animation: setup-land 340ms var(--ease-out) 760ms both;
}
.setup-land-late {
  animation: setup-land 320ms var(--ease-out) 1120ms both;
}
@keyframes setup-land {
  from { opacity: 0; transform: translate3d(0, 8px, 0); }
  to { opacity: 1; transform: none; }
}

@media (prefers-reduced-motion: reduce) {
  .setup-hoist-hull,
  .setup-hoist-jib,
  .setup-hoist-sail,
  .setup-seg-fill,
  .setup-land,
  .setup-land-late {
    animation: none;
  }
}
`;
