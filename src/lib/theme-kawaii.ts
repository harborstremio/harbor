export const kawaiiCss = `@import url("https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;500;700;900&family=M+PLUS+Rounded+1c:wght@400;500;700;800&display=swap");

html, body {
  font-family: "Zen Maru Gothic", "M PLUS Rounded 1c", ui-rounded, system-ui, sans-serif !important;
}

header.fixed.top-0.h-20.items-center.px-4 {
  height: auto !important;
  min-height: 0 !important;
  padding: 0 !important;
  margin: 0 !important;
  background: #ffffff !important;
  border: 0 !important;
  border-bottom: 2px solid #f7dfe4 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

header.fixed.top-0.h-20.items-center.px-4::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  height: 10px;
  pointer-events: none;
  background-repeat: repeat-x;
  background-size: 16px 16px;
  background-image:
    radial-gradient(circle at 8px 0, #ffffff 7px, transparent 7.5px),
    radial-gradient(circle at 8px 0, #f7dfe4 8.5px, transparent 9px);
}

header.fixed.top-0.h-20.items-center.px-4 > div {
  height: auto !important;
  min-height: 0 !important;
  width: 100% !important;
  padding-block: 6px !important;
  padding-inline: 18px !important;
  gap: 12px !important;
  background: transparent !important;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

header.fixed.top-0.h-20.items-center.px-4 > div > button {
  color: #f090ae !important;
  gap: 8px !important;
}

header.fixed.top-0.h-20.items-center.px-4 > div > div.w-px {
  background: #f7dfe4 !important;
}

header.fixed.top-0.h-20.items-center.px-4 > div > div[data-tauri-drag-region] button.rounded-full {
  height: auto !important;
  min-height: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  padding-block: 4px !important;
  padding-inline: 6px !important;
  font-size: 12px !important;
  font-weight: 700 !important;
  line-height: 1.5 !important;
  letter-spacing: 0.02em !important;
  color: #b9917f !important;
  transition: color 180ms ease-in-out, transform 180ms ease-in-out;
}

header.fixed.top-0.h-20.items-center.px-4 > div > div[data-tauri-drag-region] button.rounded-full:hover {
  color: #e58aa6 !important;
  transform: translateY(-1px);
}

header.fixed.top-0.h-20.items-center.px-4 > div > div[data-tauri-drag-region] button.rounded-full.text-ink {
  color: #e58aa6 !important;
}

header.fixed.top-0.h-20.items-center.px-4 > div > div[data-tauri-drag-region] button.rounded-full > span[aria-hidden]:not([data-topdock-icon]) {
  display: none !important;
}

header.fixed.top-0.h-20.items-center.px-4 > div > div[data-tauri-drag-region] > div.relative > div {
  border-radius: 8px !important;
  background: #ffffff !important;
  border: 2px solid #d9ac8e !important;
  box-shadow: 10px 10px 0 rgba(226, 203, 183, 0.45) !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  transform-origin: 12% 0%;
  animation: kw-navbar-menu 280ms ease-in-out both;
}

header.fixed.top-0.h-20.items-center.px-4 > div > div[data-tauri-drag-region] > div.relative > div button {
  border-radius: 6px !important;
  font-size: 12px !important;
  font-weight: 700 !important;
  color: #b9917f !important;
  transition: color 160ms ease-in-out, background-color 160ms ease-in-out;
}

header.fixed.top-0.h-20.items-center.px-4 > div > div[data-tauri-drag-region] > div.relative > div button:hover {
  background: #fdefe0 !important;
  color: #e58aa6 !important;
}

header.fixed.top-0.h-20.items-center.px-4 > div > div.ms-2 > button,
header.fixed.top-0.h-20.items-center.px-4 > div > div.ms-2 > div > button {
  color: #b9917f !important;
  transition: color 160ms ease-in-out, background-color 160ms ease-in-out;
}

header.fixed.top-0.h-20.items-center.px-4 > div > div.ms-2 > button:hover,
header.fixed.top-0.h-20.items-center.px-4 > div > div.ms-2 > div > button:hover {
  background: #fdeef3 !important;
  color: #e58aa6 !important;
}

@keyframes kw-navbar-menu {
  from { opacity: 0; transform: scale(0.9, 0.82) translateY(-6px); }
  50% { opacity: 1; transform: scale(1.03, 1.06) translateY(1px); }
  75% { transform: scale(0.99, 0.97) translateY(0); }
  to { opacity: 1; transform: scale(1, 1) translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  header.fixed.top-0.h-20.items-center.px-4 > div > div[data-tauri-drag-region] button.rounded-full:hover { transform: none; }
  header.fixed.top-0.h-20.items-center.px-4 > div > div[data-tauri-drag-region] > div.relative > div { animation: none; }
}

:root {
  color-scheme: light;
  --color-canvas: #fdf6ee;
  --color-surface: #fbeee0;
  --color-elevated: #f6e3d0;
  --color-raised: #f0d7bf;
  --color-ink: #3b2a1c;
  --color-ink-muted: #6b5340;
  --color-ink-subtle: #8a7360;
  --color-edge: rgba(156, 126, 96, 0.55);
  --color-edge-soft: rgba(156, 126, 96, 0.28);
  --color-accent: #b4506e;
  --color-accent-soft: rgba(180, 80, 110, 0.18);
  --color-danger: #b23b34;
  --color-success: #2f7d4f;
  --kw-gingham-pink: #fbd8e2;
  --kw-apron: #fdf6ee;
  --kw-stripe-a: #fdefe0;
  --kw-stripe-b: #fbe6d3;
  --kw-ledge: #c9a986;
  --kw-frill: #ffffff;
}

html:not([data-mpv-embed="1"]):not([data-big-picture="true"]):not([data-player-chrome-mounted]) #root {
  background: transparent !important;
}

html:not([data-mpv-embed="1"]):not([data-big-picture="true"]):not([data-player-chrome-mounted]) main:not(.fixed):not([data-live-page]) {
  margin: 0 !important;
  padding: 70px 12px 40px !important;
  background-color: #fdefe0 !important;
  background-image: none !important;
}

html:not([data-mpv-embed="1"]):not([data-big-picture="true"]):not([data-player-chrome-mounted]) main:not(.fixed):not([data-live-page]) > :nth-child(1 of :not([class~="fixed"])) ~ *:not([class~="fixed"]), html:not([data-mpv-embed="1"]):not([data-big-picture="true"]):not([data-player-chrome-mounted]) main:not(.fixed):not([data-live-page]) > :nth-child(1 of :not([class~="fixed"])) {
  padding-inline: 20px;
}

html:not([data-mpv-embed="1"]):not([data-big-picture="true"]):not([data-player-chrome-mounted]) main:not(.fixed):not([data-live-page]) > :nth-child(1 of :not([class~="fixed"])) {
  padding-top: 0;
}

html:not([data-mpv-embed="1"]):not([data-big-picture="true"]):not([data-player-chrome-mounted]) main:not(.fixed):not([data-live-page]) > :nth-child(1 of :not([class~="fixed"])):has(> :first-child:not([class*="-mx-"]):not([class*="absolute"])) {
  padding-top: 30px;
}

html:not([data-mpv-embed="1"]):not([data-big-picture="true"]):not([data-player-chrome-mounted]) main:not(.fixed):not([data-live-page]) > :nth-last-child(1 of :not([class~="fixed"])) {
  padding-bottom: 44px;
}

html:not([data-mpv-embed="1"]):not([data-big-picture="true"]):not([data-player-chrome-mounted]) main:not(.fixed):not([data-live-page]) > :nth-child(1 of :not([class~="fixed"])):nth-last-child(1 of :not([class~="fixed"])) {
  min-height: 100%;
}

html:not([data-mpv-embed="1"]):not([data-big-picture="true"]):not([data-player-chrome-mounted]) main:not(.fixed)[data-live-page] {
  margin: 0 !important;
  background-color: rgba(253, 246, 238, 0.93) !important;
}

html::before {
  content: "";
  position: fixed;
  pointer-events: none;
}

html::before {
  inset: 0;
  z-index: -4;
  background-color: var(--kw-gingham-pink);
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.35) 50%, transparent 50%),
    linear-gradient(90deg, rgba(255, 255, 255, 0.35) 50%, transparent 50%);
  background-size: 60px 60px;
}

@media (min-width: 1024px) {
  html:not([data-mpv-embed="1"]):not([data-big-picture="true"]):not([data-player-chrome-mounted]) main:not(.fixed):not([data-live-page]) {
    padding-inline: 36px !important;
    scrollbar-gutter: stable !important;
    background-color: transparent !important;
    background-image:
      linear-gradient(
        90deg,
        #e3c9ae 0 2px,
        #fdefe0 2px calc(100% - 2px),
        #e3c9ae calc(100% - 2px)
      ),
      linear-gradient(rgba(226, 203, 183, 0.45), rgba(226, 203, 183, 0.45)) !important;
    background-size: calc(100% - 76px) 100%, calc(100% - 76px) 100% !important;
    background-position: 34px 0, 44px 10px !important;
    background-repeat: no-repeat, no-repeat !important;
  }

  html:not([data-mpv-embed="1"]):not([data-big-picture="true"]):not([data-player-chrome-mounted]) main:not(.fixed):not([data-live-page]) > :nth-child(1 of :not([class~="fixed"])) ~ *:not([class~="fixed"]), html:not([data-mpv-embed="1"]):not([data-big-picture="true"]):not([data-player-chrome-mounted]) main:not(.fixed):not([data-live-page]) > :nth-child(1 of :not([class~="fixed"])) {
    padding-inline: 48px;
  }

  html:not([data-mpv-embed="1"]):not([data-big-picture="true"]):not([data-player-chrome-mounted]) main:not(.fixed):not([data-live-page]) > :nth-child(1 of :not([class~="fixed"])) {
    overflow: clip;
  }

  html:not([data-mpv-embed="1"]):not([data-big-picture="true"]):not([data-player-chrome-mounted]) main:not(.fixed):not([data-live-page])::-webkit-scrollbar {
    width: 8px !important;
  }

  html:not([data-mpv-embed="1"]):not([data-big-picture="true"]):not([data-player-chrome-mounted]) main:not(.fixed):not([data-live-page]) {
    padding-bottom: 0 !important;
  }

  html:not([data-mpv-embed="1"]):not([data-big-picture="true"]):not([data-player-chrome-mounted]) main:not(.fixed):not([data-live-page]) > :nth-last-child(1 of :not([class~="fixed"])) {
    padding-bottom: 56px;
    border-bottom: 2px solid #e3c9ae;
    border-end-start-radius: 14px;
    border-end-end-radius: 14px;
  }

}

html[data-mpv-embed="1"]::before,
html[data-mpv-embed="1"]::after,
html[data-mpv-embed="1"] body::before,
html[data-mpv-embed="1"] body::after,
html[data-big-picture="true"]::before,
html[data-big-picture="true"]::after,
html[data-big-picture="true"] body::before,
html[data-big-picture="true"] body::after,
html[data-player-chrome-mounted]::before,
html[data-player-chrome-mounted]::after,
html[data-player-chrome-mounted] body::before,
html[data-player-chrome-mounted] body::after {
  display: none !important;
}

html[data-chrome-hidden]::after,
html[data-chrome-hidden] body::after {
  display: none !important;
}

[data-harbor-sidebar] {
  background-color: var(--kw-stripe-a) !important;
  background-image: repeating-linear-gradient(90deg, var(--kw-stripe-a) 0 24px, var(--kw-stripe-b) 24px 48px) !important;
  border-inline-end: 2px solid #e3c9ae !important;
}

nav[data-harbor-sidebar][data-tv-scroll-focus]::after {
  display: none !important;
}

[data-harbor-sidebar]::after {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  inset-inline-end: -8px;
  width: 8px;
  background-image: radial-gradient(circle at 0 8px, var(--kw-frill) 7px, transparent 7.5px);
  background-size: 16px 16px;
  background-repeat: repeat-y;
  pointer-events: none;
}

.harbor-row-track:not(.pt-14) {
  margin-top: 0;
  padding-block: 8px;
  margin-bottom: -8px;
  background-color: #fdf6ec;
  background-image: none;
  border-radius: 8px;
  box-shadow: inset 0 0 0 2px #e6d2bd;
}

[data-ebook-page] .harbor-row-track {
  background: none !important;
  box-shadow: none !important;
  border-radius: 0 !important;
}

:root {
  --kw-dot: #e0c3ae;
  --kw-dot-on: #b98a6c;
  --kw-pink-hot: #f090ae;
  --kw-pink-hot-drop: #cf6b8c;
  --kw-ink-drop: #8a6249;
}

:is(button, a):is(.bg-accent, .bg-ink):not([role="switch"]):not(.h-1\\.5):not(.size-1\\.5):not(.h-3):not(.h-2):not(.w-\\[3px\\]) {
  --kw-btn: var(--kw-cocoa-mid);
  --kw-btn-drop: var(--kw-cocoa-drop);
  background: var(--kw-btn) !important;
  background-image: none !important;
  color: #ffffff !important;
  font-weight: 700 !important;
  border: 0 !important;
  border-radius: 30px !important;
  box-shadow: 0 4px 0 var(--kw-btn-drop) !important;
  text-shadow: none !important;
  transition: transform 130ms ease-in-out, box-shadow 130ms ease-in-out,
    background-color 130ms ease-in-out !important;
}

:is(button, a).bg-ink:not([role="switch"]):not(.h-1\\.5):not(.size-1\\.5):not(.h-3):not(.h-2):not(.w-\\[3px\\]) {
  --kw-btn: var(--kw-tan-deep);
  --kw-btn-drop: var(--kw-ink-drop);
}

:is(button, a):is(.bg-accent, .bg-ink):not([role="switch"]):not(.h-1\\.5):not(.size-1\\.5):not(.h-3):not(.h-2):not(.w-\\[3px\\]):hover:not(:disabled) {
  background: color-mix(in srgb, var(--kw-btn) 88%, #ffffff) !important;
  opacity: 1 !important;
}

:is(button, a):is(.bg-accent, .bg-ink):not([role="switch"]):not(.h-1\\.5):not(.size-1\\.5):not(.h-3):not(.h-2):not(.w-\\[3px\\]):active:not(:disabled) {
  transform: translateY(3px) !important;
  box-shadow: 0 1px 0 var(--kw-btn-drop) !important;
}

:is(button, a):is(.bg-accent, .bg-ink):not([role="switch"]):not(.h-1\\.5):not(.size-1\\.5):not(.h-3):not(.h-2):not(.w-\\[3px\\]):disabled {
  box-shadow: 0 2px 0 var(--kw-btn-drop) !important;
}

:is(button, a):is(.bg-accent, .bg-ink):not([role="switch"]):not(.h-1\\.5):not(.size-1\\.5):not(.h-3):not(.h-2):not(.w-\\[3px\\]):focus-visible {
  outline: 3px solid var(--kw-pink) !important;
  outline-offset: 3px !important;
}

:is(button, a).bg-raised:not([role="switch"]) {
  background: #ffffff !important;
  color: var(--kw-tan-deep) !important;
  font-weight: 700 !important;
  border-radius: 8px !important;
  box-shadow: 0 3px 0 var(--kw-cream-deep) !important;
  transition: transform 130ms ease-in-out, box-shadow 130ms ease-in-out,
    color 130ms ease-in-out !important;
}

:is(button, a).bg-raised:not([role="switch"]):hover:not(:disabled) {
  color: var(--kw-pink-deep) !important;
  box-shadow: 0 3px 0 var(--kw-pink-line) !important;
}

:is(button, a).bg-raised:not([role="switch"]):active:not(:disabled) {
  transform: translateY(2px) !important;
  box-shadow: 0 1px 0 var(--kw-cream-deep) !important;
}

.harbor-seg-thumb {
  background: #ffffff !important;
  border-radius: 6px !important;
  box-shadow: 0 2px 0 var(--kw-cream-deep) !important;
  transition: left 300ms ease-in-out !important;
}

.harbor-seg-thumb ~ button.text-canvas {
  color: var(--kw-tan-deep) !important;
}

[data-ebook-page] .harbor-poster,
[data-ebook-page] .your-card {
  border-color: transparent !important;
  background-color: transparent !important;
  box-shadow: 0 3px 10px rgba(190, 160, 140, 0.28) !important;
}

.ebook-library-hero .ebook-hero-library-photo,
.ebook-library-hero .ebook-hero-paper-shape,
.ebook-library-hero::after {
  display: none !important;
}

.ebook-library-hero {
  min-height: 0 !important;
  padding: 22px 48px 8px !important;
}

.ebook-library-hero .ebook-hero-paper {
  width: 100% !important;
  min-height: 0 !important;
  padding: 42px clamp(28px, 4vw, 56px) !important;
  border: 2px solid #e3c9ae !important;
  border-radius: 6px !important;
  background: repeating-linear-gradient(90deg, #fdefe0 0 24px, #fbe6d3 24px 48px) !important;
  box-shadow: 10px 10px 0 rgba(226, 203, 183, 0.45) !important;
}

.ebook-library-hero .ebook-hero-book-object {
  filter: drop-shadow(6px 8px 0 rgba(226, 203, 183, 0.5)) !important;
}

main:not(.fixed):not([data-live-page]) > .harbor-bleed-stremio:not([class~="absolute"]),
main:not(.fixed):not([data-live-page]) > .harbor-hero-bleed:not([class~="absolute"]) {
  width: auto !important;
  margin-top: -70px !important;
  margin-right: 0 !important;
  margin-left: 0 !important;
  padding-inline: 0 !important;
  border-radius: 0 !important;
}

[class~="bg-canvas/55"] {
  border-color: #e3c9ae !important;
  background-color: #fdf6ec !important;
  color: #7a5c4f !important;
  box-shadow: 2px 2px 0 rgba(226, 203, 183, 0.5) !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

[class~="bg-canvas/55"]:hover {
  background-color: #ffffff !important;
}

[class~="text-ink/80"] {
  color: #7a5c4f !important;
}

[class~="group/card"][class~="rounded-2xl"] {
  border: 2px solid #e3c9ae !important;
  border-radius: 6px !important;
  background: #fdf6ec !important;
  box-shadow: 4px 4px 0 rgba(226, 203, 183, 0.5) !important;
}

[class~="group/card"][class~="rounded-2xl"]:hover {
  transform: translateY(-2px) !important;
  box-shadow: 6px 7px 0 rgba(226, 203, 183, 0.55) !important;
}

[class~="group/card"][class~="rounded-2xl"] > [aria-hidden] {
  display: none !important;
}

[class~="group/card"][class~="rounded-2xl"] > span {
  border: 1.5px solid #e3c9ae !important;
  background: #fdf6ec !important;
  color: #7a5c4f !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  text-shadow: none !important;
}

[class~="group/card"][class~="rounded-2xl"] > h3 {
  inset-inline: 0 !important;
  bottom: 0 !important;
  padding: 9px 12px 10px !important;
  border-top: 2px solid #e3c9ae !important;
  background: #fdf6ec !important;
  color: #7a5c4f !important;
  filter: none !important;
  font-size: 15px !important;
  text-shadow: none !important;
}

.harbor-float {
  box-shadow: 6px 6px 0 rgba(226, 203, 183, 0.45) !important;
}

.harbor-search-backdrop {
  background-color: #fdefe0 !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

.harbor-search-backdrop::before {
  position: absolute;
  z-index: 0;
  content: "";
  animation: kw-search-stripe 24s linear infinite;
  background-image: repeating-linear-gradient(90deg, #fdefe0 0 24px, #fbe6d3 24px 48px);
  inset: 0 -48px 0 0;
  pointer-events: none;
}

@keyframes kw-search-stripe {
  from {
    transform: translate3d(0, 0, 0);
  }
  to {
    transform: translate3d(48px, 0, 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .harbor-search-backdrop::before {
    animation: none;
  }
}

.harbor-search-pill {
  background: #ffffff !important;
  background-image: none !important;
  border: 2px solid var(--kw-pink-line) !important;
  border-radius: 30px !important;
  box-shadow: 0 3px 0 var(--kw-pink-line) !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  opacity: 1 !important;
  transition: transform 140ms ease-in-out, box-shadow 140ms ease-in-out,
    border-color 140ms ease-in-out !important;
}

.harbor-search-pill:hover {
  background: #ffffff !important;
  border-color: var(--kw-pink) !important;
  box-shadow: 0 3px 0 var(--kw-pink) !important;
}

.harbor-search-pill:active {
  transform: translateY(2px) !important;
  box-shadow: 0 1px 0 var(--kw-pink) !important;
}

.harbor-search-pill span {
  color: var(--kw-tan-deep) !important;
  font-weight: 500;
}

.harbor-search-pill svg {
  color: var(--kw-pink-deep) !important;
}

.harbor-search-pill kbd {
  background: var(--kw-cream) !important;
  border: 2px solid var(--kw-cream-deep) !important;
  border-radius: 6px !important;
  color: var(--kw-tan-deep) !important;
  box-shadow: 0 2px 0 var(--kw-cream-deep) !important;
}

input:not(.bg-transparent):not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="color"]):not([type="file"]),
textarea:not(.bg-transparent),
select {
  background: #ffffff !important;
  background-image: none !important;
  border: 2px solid var(--kw-pink-line) !important;
  border-radius: 8px !important;
  color: var(--kw-cocoa) !important;
  font-family: inherit;
  font-weight: 500;
  box-shadow: 0 2px 0 var(--kw-cream-deep) !important;
  transition: border-color 150ms ease-in-out, box-shadow 150ms ease-in-out !important;
}

input:not(.bg-transparent):not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="color"]):not([type="file"]):focus,
input:not(.bg-transparent):not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="color"]):not([type="file"]):focus-visible,
textarea:not(.bg-transparent):focus,
textarea:not(.bg-transparent):focus-visible,
select:focus,
select:focus-visible {
  outline: none !important;
  border-color: var(--kw-pink) !important;
  box-shadow: 0 3px 0 var(--kw-pink-soft) !important;
}

input::placeholder,
textarea::placeholder {
  color: var(--kw-tan) !important;
  opacity: 1;
}

input[type="checkbox"],
input[type="radio"] {
  accent-color: var(--kw-pink-hot);
}

.harbor-slider::-webkit-slider-runnable-track {
  height: 6px;
  border-radius: 4px;
  background: linear-gradient(
    to right,
    var(--kw-pink) 0 var(--fill, 0%),
    var(--kw-cream-deep) var(--fill, 0%) 100%
  ) !important;
  box-shadow: inset 0 0 0 2px rgba(226, 203, 183, 0.55);
}

[dir="rtl"] .harbor-slider::-webkit-slider-runnable-track {
  background: linear-gradient(
    to left,
    var(--kw-pink) 0 var(--fill, 0%),
    var(--kw-cream-deep) var(--fill, 0%) 100%
  ) !important;
}

.harbor-slider::-moz-range-track {
  height: 6px;
  border-radius: 4px;
  background: var(--kw-cream-deep) !important;
}

.harbor-slider::-moz-range-progress {
  height: 6px;
  border-radius: 4px;
  background: var(--kw-pink) !important;
}

.harbor-slider::-webkit-slider-thumb {
  background: var(--kw-pink-hot) !important;
  border: 2px solid #ffffff !important;
  border-radius: 50% !important;
  box-shadow: 0 2px 0 var(--kw-pink-hot-drop) !important;
  transition: transform 180ms ease-in-out !important;
}

.harbor-slider::-moz-range-thumb {
  background: var(--kw-pink-hot) !important;
  border: 2px solid #ffffff !important;
  border-radius: 50% !important;
  box-shadow: 0 2px 0 var(--kw-pink-hot-drop) !important;
  transition: transform 180ms ease-in-out !important;
}

.harbor-slider:focus-visible::-webkit-slider-thumb {
  box-shadow: 0 2px 0 var(--kw-pink-hot-drop), 0 0 0 4px var(--kw-pink-soft) !important;
}

[role="switch"]:not(.hset-row), .hset-switch {
  background: var(--kw-cream-deep) !important;
  background-image: none !important;
  border-radius: 999px !important;
  box-shadow: inset 0 0 0 2px var(--kw-pink-line) !important;
  transition: background-color 220ms ease-in-out, box-shadow 220ms ease-in-out !important;
}

[role="switch"][aria-checked="true"]:not(.hset-row), .hset-row[aria-checked="true"] .hset-switch {
  background: var(--kw-pink) !important;
  box-shadow: inset 0 0 0 2px var(--kw-pink-deep) !important;
}

[role="switch"]:not(.hset-row) > span, .hset-switch > span {
  background: #ffffff !important;
  border-radius: 50% !important;
  box-shadow: 0 2px 0 rgba(169, 125, 99, 0.45) !important;
  transition-timing-function: ease-in-out !important;
  transition-duration: 220ms !important;
}

[role="switch"][aria-checked="true"]:not(.hset-row) > span, .hset-row[aria-checked="true"] .hset-switch > span {
  box-shadow: 0 2px 0 var(--kw-pink-hot-drop) !important;
}

[role="switch"]:not(.hset-row):focus-visible, .hset-row:focus-visible .hset-switch {
  outline: 3px solid var(--kw-pink) !important;
  outline-offset: 3px !important;
}

button.h-1\\.5.rounded-full {
  background: var(--kw-dot) !important;
  box-shadow: none !important;
  transition: width 220ms ease-in-out, background-color 220ms ease-in-out !important;
}

button.h-1\\.5.rounded-full:hover {
  background: var(--kw-tan) !important;
}

button.h-1\\.5.rounded-full:is(.bg-ink, .bg-accent) {
  background: var(--kw-dot-on) !important;
  animation: kw-dot-on 320ms ease-in-out both;
}

button.group\\/edge > span {
  background: var(--kw-pink-hot) !important;
  color: #ffffff !important;
  border: 3px solid #ffffff !important;
  border-radius: 50% !important;
  padding: 10px !important;
  box-shadow: 0 3px 0 var(--kw-pink-hot-drop) !important;
  filter: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  transition-timing-function: ease-in-out !important;
  transition-duration: 260ms !important;
}

button.group\\/edge > span > svg {
  width: 20px !important;
  height: 20px !important;
}

button.group\\/edge:hover > span {
  background: var(--kw-pink-deep) !important;
  transform: none !important;
}

button.group\\/edge:active > span {
  transform: translateY(2px) !important;
  box-shadow: 0 1px 0 var(--kw-pink-hot-drop) !important;
}

@keyframes kw-dot-on {
  from { transform: scale(0.72, 1.16); }
  50% { transform: scale(1.09, 0.88); }
  75% { transform: scale(0.96, 1.06); }
  to { transform: scale(1, 1); }
}

@media (prefers-reduced-motion: reduce) {
  button.h-1\\.5.rounded-full:is(.bg-ink, .bg-accent) { animation: none; }
  :is(button, a):is(.bg-accent, .bg-ink):not([role="switch"]):not(.h-1\\.5):not(.size-1\\.5):not(.h-3):not(.h-2):not(.w-\\[3px\\]):active:not(:disabled) {
    transform: none !important;
  }
  :is(button, a).bg-raised:not([role="switch"]):active:not(:disabled) { transform: none !important; }
  .harbor-seg-thumb { transition: none !important; }
  .harbor-search-pill:active { transform: none !important; }
  button.group\\/edge:active > span { transform: none !important; }
}

.harbor-poster,
.your-card {
  border-radius: 6px !important;
  border: 3px solid #ffffff !important;
  background-color: #ffffff !important;
  box-shadow: 0 3px 8px rgba(190, 160, 140, 0.3) !important;
  transform-origin: center bottom;
  transition: transform 260ms ease-in-out, box-shadow 260ms ease-in-out;
}

.harbor-shimmer {
  background: #fbe6d3 !important;
}

@keyframes kw-card-rise {
  0% { transform: translateY(0) scale(1, 1); box-shadow: 0 3px 8px rgba(190, 160, 140, 0.3); }
  50% { transform: translateY(-9px) scale(0.985, 1.022); box-shadow: 0 13px 18px rgba(190, 160, 140, 0.42); }
  75% { transform: translateY(-3px) scale(1.012, 0.99); box-shadow: 0 6px 12px rgba(190, 160, 140, 0.38); }
  100% { transform: translateY(-5px) scale(1, 1); box-shadow: 0 9px 16px rgba(190, 160, 140, 0.42); }
}

.group:not([data-no-card-ring]):hover .harbor-poster,
.group:not([data-no-card-ring]):focus-visible .harbor-poster {
  animation: kw-card-rise 420ms ease-in-out forwards;
}

.harbor-expanding-card-scope .group:hover .harbor-poster,
.harbor-expanding-card-scope .group:focus-visible .harbor-poster {
  animation: none;
}

[data-focused-card]:is(:focus-visible, [data-tv-focused="true"]) .harbor-poster,
button.group:focus-visible .harbor-poster {
  border-color: #f0a0b8 !important;
  box-shadow: 0 0 0 3px rgba(240, 160, 184, 0.6), 0 8px 14px rgba(190, 160, 140, 0.42) !important;
}

button.group:not([data-no-card-ring]):hover .harbor-card-ring::after {
  box-shadow: inset 0 0 0 2px rgba(240, 160, 184, 0.9) !important;
}

:root {
  --service-logo-filter: brightness(0) opacity(0.74);
}

.harbor-service-tile {
  border-radius: 12px !important;
  border: 2px solid #e8cfb4 !important;
  background-color: #fffaf3 !important;
  box-shadow: 0 3px 0 rgba(217, 172, 142, 0.38) !important;
  transform-origin: center bottom;
  transition: transform 260ms ease-in-out, box-shadow 260ms ease-in-out;
}

.harbor-service-tile:hover {
  border-color: #e2a3ba !important;
  background-color: #fffdf9 !important;
  box-shadow: 0 5px 0 rgba(226, 163, 186, 0.42) !important;
}

.harbor-service-tile:hover {
  animation: kw-card-rise 420ms ease-in-out forwards;
}

.modal-panel,
.harbor-vs-panel,
.animate-dialog-in,
.animate-dialog-out,
.animate-panel-in,
.animate-popover-in:not([class*="rounded-full"]):not([class*="pointer-events-none"]),
[role="menu"][class*="bg-"]:not([class*="bp-"]):not([class*="rounded-full"]),
[role="listbox"][class*="absolute"],
[role="dialog"][class*="bg-"]:not([class*="inset-0"]):not([class*="h-full"]):not([class*="bp-"]):not([class*="rounded-full"]),
.fixed.bg-elevated:not(button):not([class*="inset-0"]):not([class*="rounded-full"]):not([class*="pointer-events-none"]):not([class*="rotate-"]),
.absolute.bg-elevated:not(button):not([class*="inset-0"]):not([class*="rounded-full"]):not([class*="pointer-events-none"]):not([class*="rotate-"]),
.fixed.bg-surface:not(button):not([class*="inset-0"]):not([class*="rounded-full"]):not([class*="pointer-events-none"]):not([class*="rotate-"]),
.absolute.bg-surface:not(button):not([class*="inset-0"]):not([class*="rounded-full"]):not([class*="pointer-events-none"]):not([class*="rotate-"]) {
  --color-canvas: #fdf6ee;
  --color-surface: #fffdf9;
  --color-elevated: #fdf3e9;
  --color-raised: #fbe6d3;
  --color-ink: #7a5c4f;
  --color-ink-muted: #9c7c68;
  --color-ink-subtle: #a9846a;
  --color-edge: rgba(217, 172, 142, 0.6);
  --color-edge-soft: rgba(217, 172, 142, 0.32);
  color: #7a5c4f;
  background-color: #fdf6ec !important;
  border: 2px solid #e3c9ae !important;
  border-radius: 6px !important;
  box-shadow: 10px 10px 0 rgba(226, 203, 183, 0.45) !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

[dir="rtl"] .modal-panel,
[dir="rtl"] .harbor-vs-panel,
[dir="rtl"] .animate-dialog-in,
[dir="rtl"] .animate-dialog-out,
[dir="rtl"] .animate-panel-in,
[dir="rtl"] .animate-popover-in:not([class*="rounded-full"]):not([class*="pointer-events-none"]),
[dir="rtl"] [role="menu"][class*="bg-"]:not([class*="bp-"]):not([class*="rounded-full"]),
[dir="rtl"] [role="listbox"][class*="absolute"],
[dir="rtl"] [role="dialog"][class*="bg-"]:not([class*="inset-0"]):not([class*="h-full"]):not([class*="bp-"]):not([class*="rounded-full"]) {
  box-shadow: -10px 10px 0 rgba(226, 203, 183, 0.45) !important;
}


.modal-panel .text-white:not([class*="bg-"]),
.animate-dialog-in .text-white:not([class*="bg-"]),
.animate-dialog-out .text-white:not([class*="bg-"]),
.animate-panel-in .text-white:not([class*="bg-"]),
.animate-popover-in .text-white:not([class*="bg-"]),
[role="menu"] .text-white:not([class*="bg-"]),
[role="listbox"] .text-white:not([class*="bg-"]),
[role="dialog"] .text-white:not([class*="bg-"]):not([class*="bp-"]) {
  color: #7a5c4f !important;
}

.modal-panel [class*="border-white/1"],
.modal-panel [class*="border-white/2"],
.animate-dialog-in [class*="border-white/1"],
.animate-dialog-in [class*="border-white/2"],
.animate-popover-in [class*="border-white/1"],
.animate-popover-in [class*="border-white/2"],
[role="menu"] [class*="border-white/1"],
[role="menu"] [class*="border-white/2"],
[role="listbox"] [class*="border-white/1"],
[role="listbox"] [class*="border-white/2"] {
  border-color: rgba(217, 172, 142, 0.6) !important;
}

.modal-panel [class*="ring-white/1"],
.modal-panel [class*="ring-white/2"],
.animate-dialog-in [class*="ring-white/1"],
.animate-dialog-in [class*="ring-white/2"],
.animate-popover-in [class*="ring-white/1"],
.animate-popover-in [class*="ring-white/2"],
[role="menu"] [class*="ring-white/1"],
[role="menu"] [class*="ring-white/2"],
[role="listbox"] [class*="ring-white/1"],
[role="listbox"] [class*="ring-white/2"] {
  --tw-ring-color: rgba(217, 172, 142, 0.55) !important;
}

.modal-panel [class*="bg-white/1"],
.modal-panel [class*="bg-white/2"],
.animate-dialog-in [class*="bg-white/1"],
.animate-dialog-in [class*="bg-white/2"],
.animate-popover-in [class*="bg-white/1"],
.animate-popover-in [class*="bg-white/2"],
[role="menu"] [class*="bg-white/1"],
[role="menu"] [class*="bg-white/2"],
[role="listbox"] [class*="bg-white/1"],
[role="listbox"] [class*="bg-white/2"] {
  background-color: rgba(251, 230, 211, 0.7) !important;
}

.rounded-t-2xl.bg-elevated,
.rounded-t-2xl.bg-surface {
  position: relative;
  --color-ink: #7a5c4f;
  --color-ink-muted: #9c7c68;
  --color-ink-subtle: #a9846a;
  --color-raised: #fbe6d3;
  --color-edge: rgba(217, 172, 142, 0.6);
  --color-edge-soft: rgba(217, 172, 142, 0.32);
  color: #7a5c4f;
  background-color: #fdf6ec !important;
  border-top: 2px solid #e3c9ae !important;
  border-radius: 8px 8px 0 0 !important;
}

.rounded-t-2xl.bg-elevated .text-white:not([class*="bg-"]),
.rounded-t-2xl.bg-surface .text-white:not([class*="bg-"]) {
  color: #7a5c4f !important;
}

.rounded-t-2xl.bg-elevated::before,
.rounded-t-2xl.bg-surface::before {
  content: "";
  position: absolute;
  inset-inline: 0;
  top: -7px;
  height: 8px;
  background: radial-gradient(circle at 8px 8px, #fdf6ec 7px, transparent 7.5px) repeat-x;
  background-size: 16px 16px;
  pointer-events: none;
}

@keyframes kw-panel-pop {
  0% { opacity: 0; transform: translateY(-10px) scale(0.94, 0.9); }
  40% { opacity: 1; }
  50% { transform: translateY(0) scale(1.02, 1.055); }
  75% { transform: translateY(1px) scale(0.996, 0.98); }
  100% { opacity: 1; transform: translateY(0) scale(1, 1); }
}

.animate-popover-in {
  animation: kw-panel-pop 300ms ease-in-out backwards !important;
}

h2[class*="font-display"]:not([class*="clamp"]):not([class*="bg-clip"]),
h2[class*="font-medium"][class*="tracking-tight"]:not([class*="clamp"]):not([class*="bg-clip"]) {
  color: #a97d63 !important;
  font-weight: 800 !important;
  padding-bottom: 12px;
  background-image: linear-gradient(#d9ac8e, #d9ac8e);
  background-repeat: no-repeat;
  background-size: 64px 6px;
  background-position: left bottom;
}

:has(> h3.truncate.font-medium.tracking-tight:not([class*="text-white"])) {
  width: fit-content;
  max-width: 100%;
  padding: 2px;
  background-color: #d9ac8e;
  clip-path: polygon(0 0, 100% 0, calc(100% - 15px) 50%, 100% 100%, 0 100%);
  animation: kw-tag-set 340ms ease-in-out both;
}

h3.truncate.font-medium.tracking-tight:not([class*="text-white"]) {
  width: fit-content !important;
  max-width: 100% !important;
  padding: 5px 30px 6px 15px !important;
  background-color: #fdf3e2;
  clip-path: polygon(0 0, 100% 0, calc(100% - 14px) 50%, 100% 100%, 0 100%);
  color: #a97d63 !important;
  font-weight: 800 !important;
}

@keyframes kw-tag-set {
  from { transform: translateY(-5px) scale(1.06, 0.9); }
  50% { transform: translateY(1px) scale(0.97, 1.05); }
  75% { transform: translateY(0) scale(1.02, 0.99); }
  to { transform: translateY(0) scale(1, 1); }
}

[dir="rtl"] h2[class*="font-display"]:not([class*="clamp"]):not([class*="bg-clip"]),
[dir="rtl"] h2[class*="font-medium"][class*="tracking-tight"]:not([class*="clamp"]):not([class*="bg-clip"]) {
  background-position: right bottom;
}

@media (prefers-reduced-motion: reduce) {
  :has(> h3.truncate.font-medium.tracking-tight:not([class*="text-white"])) {
    animation: none;
  }
  .harbor-poster,
  .harbor-service-tile {
    transition: none;
    transform: none;
  }
  .group:not([data-no-card-ring]):hover .harbor-poster,
  .group:not([data-no-card-ring]):focus-visible .harbor-poster,
  .harbor-service-tile:hover {
    animation: none !important;
  }
  .animate-popover-in {
    animation: none !important;
  }
}

:root {
  --kw-ease: ease-in-out;
  --kw-dur-tap: 120ms;
  --kw-dur-hop: 340ms;
  --kw-dur-menu: 300ms;
  --kw-dur-dialog: 420ms;
  --kw-dur-bob: 4200ms;
}

@keyframes kw-menu-in {
  0% { opacity: 0; transform: translateY(-8px) scale(0.93, 0.89); }
  40% { opacity: 1; }
  50% { transform: translateY(2px) scale(1.035, 1.065); }
  75% { transform: translateY(-1px) scale(0.99, 0.982); }
  100% { opacity: 1; transform: translateY(0) scale(1, 1); }
}

@keyframes kw-dialog-in {
  0% { opacity: 0; transform: translateY(18px) scale(0.90, 0.94); }
  42% { opacity: 1; }
  50% { transform: translateY(-7px) scale(1.03, 1.07); }
  75% { transform: translateY(3px) scale(1.012, 0.984); }
  100% { opacity: 1; transform: translateY(0) scale(1, 1); }
}

@keyframes kw-toast-in {
  0% { opacity: 0; transform: translateY(20px) scale(0.92, 0.96); }
  38% { opacity: 1; }
  50% { transform: translateY(-7px) scale(1.045, 1.085); }
  75% { transform: translateY(3px) scale(0.988, 0.976); }
  100% { opacity: 1; transform: translateY(0) scale(1, 1); }
}

@keyframes kw-nav-hop {
  0% { transform: translateY(0) scale(1, 1); }
  50% { transform: translateY(-5px) scale(0.955, 1.085); }
  75% { transform: translateY(2px) scale(1.055, 0.945); }
  100% { transform: translateY(0) scale(1, 1); }
}

@keyframes kw-arrow-pop {
  0% { transform: translateY(0) scale(1, 1); }
  50% { transform: translateY(-2px) scale(1.14, 1.04); }
  75% { transform: translateY(1px) scale(0.965, 1.035); }
  100% { transform: translateY(0) scale(1, 1); }
}

@keyframes kw-tile-hop {
  0% { transform: translateY(0) scale(1, 1); }
  50% { transform: translateY(-4px) scale(1.045, 1.07); }
  75% { transform: translateY(1px) scale(0.99, 0.978); }
  100% { transform: translateY(0) scale(1, 1); }
}

@keyframes kw-cascade-in {
  0% { opacity: 0; transform: translateY(9px) scale(0.96, 0.93); }
  50% { opacity: 1; transform: translateY(-3px) scale(1.015, 1.03); }
  75% { transform: translateY(1px) scale(0.997, 0.992); }
  100% { opacity: 1; transform: translateY(0) scale(1, 1); }
}

@keyframes kw-bob-unused {
  0% { transform: translateY(0) rotate(0deg) scale(1, 1); }
  28% { transform: translateY(-3px) rotate(-3deg) scale(0.982, 1.032); }
  55% { transform: translateY(2px) rotate(2deg) scale(1.028, 0.976); }
  80% { transform: translateY(-1px) rotate(-0.8deg) scale(0.994, 1.01); }
  100% { transform: translateY(0) rotate(0deg) scale(1, 1); }
}

.animate-popover-in,
.animate-panel-in,
.animate-preview-in {
  animation: kw-menu-in var(--kw-dur-menu) var(--kw-ease) backwards !important;
  transform-origin: top center;
}

.animate-dialog-in {
  animation: kw-dialog-in var(--kw-dur-dialog) var(--kw-ease) backwards !important;
  transform-origin: center center;
}

.harbor-together-pill.animate-popover-in,
.animate-popover-in.fixed.bottom-6 {
  animation: kw-toast-in var(--kw-dur-dialog) var(--kw-ease) backwards !important;
  transform-origin: center bottom;
}

.harbor-cascade > * {
  animation-name: kw-cascade-in !important;
  animation-duration: 260ms !important;
  animation-timing-function: var(--kw-ease) !important;
  animation-fill-mode: backwards !important;
}

[data-harbor-nav] {
  transition:
    color var(--kw-dur-hop) var(--kw-ease),
    background-color var(--kw-dur-hop) var(--kw-ease),
    box-shadow var(--kw-dur-hop) var(--kw-ease) !important;
}

[data-harbor-nav]:hover {
  animation: kw-nav-hop var(--kw-dur-hop) var(--kw-ease);
}

button.group .harbor-poster,
button.group .your-card {
  transition:
    transform 210ms var(--kw-ease),
    box-shadow 210ms var(--kw-ease) !important;
  transform-origin: center bottom;
}

button.group:hover .harbor-poster,
button.group:hover .your-card {
  transform: translateY(-5px) scale(1.022, 1.042);
}

button.group:active .harbor-poster,
button.group:active .your-card {
  transform: translateY(1px) scale(1.012, 0.978);
}

.harbor-service-tile {
  transition:
    background-color 180ms var(--kw-ease),
    box-shadow 180ms var(--kw-ease) !important;
}

.harbor-service-tile:hover {
  animation: kw-tile-hop 360ms var(--kw-ease);
}

button.bg-accent:not([role="option"]):not([role="menuitem"]):not([role="tab"]):not([aria-pressed]):not([aria-selected]),
button.bg-ink:not([role="option"]):not([role="menuitem"]):not([role="tab"]):not([aria-pressed]):not([aria-selected]) {
  transition:
    transform var(--kw-dur-tap) var(--kw-ease),
    box-shadow var(--kw-dur-tap) var(--kw-ease) !important;
  transform-origin: center bottom;
}

button.bg-accent:not([role="option"]):not([role="menuitem"]):not([role="tab"]):not([aria-pressed]):not([aria-selected]):hover {
  transform: translateY(-2px) scale(1.008, 1.028);
  box-shadow: 0 6px 0 var(--kw-cocoa-drop) !important;
}

button.bg-accent:not([role="option"]):not([role="menuitem"]):not([role="tab"]):not([aria-pressed]):not([aria-selected]):active {
  transform: translateY(4px) scale(1.032, 0.938);
  box-shadow: 0 0 0 var(--kw-cocoa-drop) !important;
}

button.bg-ink:not([role="option"]):not([role="menuitem"]):not([role="tab"]):not([aria-pressed]):not([aria-selected]):hover {
  transform: translateY(-2px) scale(1.008, 1.028);
  box-shadow: 0 6px 0 #8a6249 !important;
}

button.bg-ink:not([role="option"]):not([role="menuitem"]):not([role="tab"]):not([aria-pressed]):not([aria-selected]):active {
  transform: translateY(4px) scale(1.032, 0.938);
  box-shadow: 0 0 0 #8a6249 !important;
}

button[class*="group/edge"] > span {
  transition:
    opacity 320ms var(--kw-ease),
    transform 320ms var(--kw-ease),
    background-color 320ms var(--kw-ease) !important;
}

button[class*="group/edge"]:hover > span {
  animation: kw-arrow-pop 360ms var(--kw-ease);
}

button[class*="group/edge"]:active > span {
  transform: scale(0.9, 0.94);
}

input,
textarea,
select {
  transition:
    border-color 200ms var(--kw-ease),
    box-shadow 200ms var(--kw-ease) !important;
}

@media (prefers-reduced-motion: reduce) {
  .animate-popover-in,
  .animate-panel-in,
  .animate-preview-in,
  .animate-dialog-in,
  .harbor-together-pill.animate-popover-in,
  .animate-popover-in.fixed.bottom-6,
  .harbor-cascade > *,
  [data-harbor-nav]:hover,
  .harbor-service-tile:hover,
  button[class*="group/edge"]:hover > span {
    animation: none !important;
  }

  button.group:hover .harbor-poster,
  button.group:hover .your-card,
  button.group:active .harbor-poster,
  button.group:active .your-card,
  button.bg-accent:not([role="option"]):not([role="menuitem"]):not([role="tab"]):not([aria-pressed]):not([aria-selected]):hover,
  button.bg-accent:not([role="option"]):not([role="menuitem"]):not([role="tab"]):not([aria-pressed]):not([aria-selected]):active,
  button.bg-ink:not([role="option"]):not([role="menuitem"]):not([role="tab"]):not([aria-pressed]):not([aria-selected]):hover,
  button.bg-ink:not([role="option"]):not([role="menuitem"]):not([role="tab"]):not([aria-pressed]):not([aria-selected]):active,
  button[class*="group/edge"]:active > span {
    transform: none !important;
  }

  .animate-popover-in,
  .animate-panel-in,
  .animate-preview-in,
  .animate-dialog-in,
  .harbor-cascade > * {
    opacity: 1 !important;
  }

  button.group .harbor-poster,
  button.group .your-card,
  button.bg-accent:not([role="option"]):not([role="menuitem"]):not([role="tab"]):not([aria-pressed]):not([aria-selected]),
  button.bg-ink:not([role="option"]):not([role="menuitem"]):not([role="tab"]):not([aria-pressed]):not([aria-selected]),
  .harbor-service-tile,
  button[class*="group/edge"] > span,
  [data-harbor-nav],
  input,
  textarea,
  select {
    transition-duration: 1ms !important;
  }
}

:root {
  --kw-pink: #f0a0b8;
  --kw-pink-deep: #e58aa6;
  --kw-pink-soft: #fbd8e2;
  --kw-pink-line: #f7dfe4;
  --kw-cream: #fdefe0;
  --kw-cream-deep: #fbe6d3;
  --kw-tan: #d9ac8e;
  --kw-tan-deep: #a97d63;
  --kw-cocoa: #7a5c4f;
  --kw-cocoa-mid: #8f5f5f;
  --kw-cocoa-drop: #6f4747;
  --color-canvas: #fdefe0;
  --color-surface: #ffffff;
  --color-elevated: #ffffff;
  --color-raised: #fdeef3;
  --color-ink: #7a5c4f;
  --color-ink-muted: #a5867a;
  --color-ink-subtle: #b9917f;
  --color-edge: rgba(217, 172, 142, 0.55);
  --color-edge-soft: rgba(247, 223, 228, 0.9);
  --color-accent: #f0a0b8;
  --color-accent-soft: rgba(240, 160, 184, 0.2);
  --color-danger: #e2607a;
  --poster-radius: 8px;
}

.rounded-full.bg-elevated,
.harbor-profile-dropdown .rounded-full {
  box-shadow: none !important;
}

[data-topdock-label] {
  display: none !important;
}

[data-topdock-icon] {
  display: inline-flex !important;
  width: 22px;
  height: 22px;
  align-items: center;
  justify-content: center;
}

[data-topdock-icon] svg {
  width: 100%;
  height: 100%;
}

header [data-harbor-nav] {
  padding-inline: 10px !important;
}

[class*="z-[180]"].fixed.inset-0 {
  background-color: var(--kw-pink-soft) !important;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.4) 50%, transparent 50%),
    linear-gradient(90deg, rgba(255, 255, 255, 0.4) 50%, transparent 50%) !important;
  background-size: 60px 60px !important;
  backdrop-filter: none !important;
}

[class*="z-[180]"].fixed.inset-0 h1,
[class*="z-[180]"].fixed.inset-0 h2 {
  color: var(--kw-cocoa) !important;
}

[class*="z-[180]"].fixed.inset-0 p {
  color: var(--kw-tan-deep) !important;
}

[class*="z-[180]"].fixed.inset-0 .rounded-full > img,
[class*="z-[180]"].fixed.inset-0 img.rounded-full {
  border-radius: 999px !important;
}

.rounded-full.bg-elevated,
.harbor-profile-dropdown .rounded-full.bg-elevated,
[class*="z-[180]"] .rounded-full.bg-elevated {
  background: var(--kw-pink-soft) !important;
  box-shadow: 0 3px 0 rgba(214, 150, 170, 0.45) !important;
  border: 3px solid #ffffff !important;
}


[class*="z-[180]"].fixed.inset-0 > div {
  position: relative;
  padding: 64px 56px 48px !important;
  border-radius: 10px !important;
  background: #fdf6ec !important;
  border: 3px solid var(--kw-tan) !important;
  box-shadow: 12px 12px 0 rgba(226, 203, 183, 0.5) !important;
  overflow: visible !important;
}

[class*="z-[180]"].fixed.inset-0 > div::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 30px;
  border-radius: 7px 7px 0 0;
  background-color: var(--kw-pink-soft);
  background-image:
    radial-gradient(circle at 8px 30px, #fdf6ec 8px, transparent 8.5px),
    radial-gradient(circle at 8px 30px, #ffffff 10px, transparent 10.5px);
  background-size: 16px 16px;
  background-repeat: repeat-x;
  background-position: 0 100%;
  pointer-events: none;
}


[class*="z-[180]"].fixed.inset-0 h1 {
  font-size: 34px !important;
  font-weight: 800 !important;
  color: var(--kw-tan-deep) !important;
}

[class*="z-[180]"].fixed.inset-0 h1::after {
  content: "";
  display: block;
  width: 120px;
  height: 6px;
  margin: 12px auto 0;
  border-radius: 4px;
  background: var(--kw-tan);
}

[class*="z-[180]"].fixed.inset-0 .rounded-full.bg-elevated {
  transition: transform 200ms ease-in-out, box-shadow 200ms ease-in-out;
}

[class*="z-[180]"] [class*="cursor-pointer"]:hover .rounded-full.bg-elevated,
[class*="z-[180]"] button:hover .rounded-full.bg-elevated {
  transform: translateY(-4px);
  box-shadow: 0 7px 0 rgba(214, 150, 170, 0.5) !important;
}

@keyframes kw-bunny-bob {
  from, to { transform: scale(1, 1) rotate(0deg); }
  50% { transform: scale(0.97, 1.04) rotate(-1.5deg); }
  75% { transform: scale(1.02, 0.98) rotate(0.6deg); }
}

@media (prefers-reduced-motion: reduce) {
  [class*="z-[180]"].fixed.inset-0 > div::after { animation: none; }
  [class*="z-[180]"] button:hover .rounded-full.bg-elevated { transform: none; }
}


[class*="z-[180]"].fixed.inset-0 > div {
  padding-bottom: 74px !important;
}


.harbor-hero-stage [class*="bg-gradient-to-r"][class*="from-canvas"] {
  background-image: linear-gradient(
    to right,
    rgba(253, 239, 224, 0.96) 0%,
    rgba(253, 239, 224, 0.9) 32%,
    rgba(253, 239, 224, 0.38) 50%,
    rgba(253, 239, 224, 0) 66%
  ) !important;
}

.harbor-hero-stage [class*="bg-gradient-to-t"][class*="from-canvas"] {
  background-image: linear-gradient(
    to top,
    rgba(253, 239, 224, 0.9) 0%,
    rgba(253, 239, 224, 0.42) 42%,
    rgba(253, 239, 224, 0) 100%
  ) !important;
}

[data-ebook-page] .harbor-poster,
[data-ebook-page] .group:hover .harbor-poster,
[data-ebook-page] .group:focus-visible .harbor-poster,
[data-ebook-page] button.group:hover .harbor-poster,
[data-ebook-page] button.group:active .harbor-poster {
  animation: none !important;
  transform: none !important;
  transition: none !important;
}

.harbor-bleed-stremio.pointer-events-none[aria-hidden] {
  background-color: #fdefe0 !important;
  background-blend-mode: multiply !important;
  background-repeat: no-repeat !important;
  background-position: 0 0 !important;
  background-size: 100% 168px !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  filter: none !important;
}

.harbor-bleed-stremio.pointer-events-none[aria-hidden]::after {
  content: "";
  position: absolute;
  inset: auto 0 0 0;
  height: 10px;
  border-top: 2px solid #e3c9ae;
  background: repeating-linear-gradient(90deg, #fdefe0 0 24px, #fbe6d3 24px 48px);
}

[class*="z-[200]"][role="dialog"].fixed.inset-0 button.h-10.w-10.rounded-full > img,
[class*="z-[300]"].animate-ai-entrance.fixed button > img {
  content: normal !important;
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
  filter: none !important;
  mix-blend-mode: normal !important;
  object-fit: contain !important;
  background-color: #ffffff !important;
  background-image: none !important;
  border: 0 !important;
  padding: 0 !important;
  box-shadow: 0 0 0 2px #e3c9ae !important;
}

[class*="z-[200]"][role="dialog"].fixed.inset-0 button.h-10.w-10.rounded-full:has(> img) {
  background: #fdf6ec !important;
  border: 2px solid #e3c9ae !important;
  box-shadow: 3px 3px 0 rgba(226, 203, 183, 0.45) !important;
  transition: border-color 140ms ease-in-out, box-shadow 140ms ease-in-out !important;
}

[class*="z-[200]"][role="dialog"].fixed.inset-0 button.h-10.w-10.rounded-full:has(> img):hover {
  border-color: #f0a0b8 !important;
  box-shadow: 3px 3px 0 rgba(240, 160, 184, 0.45) !important;
}

[class*="z-[200]"][role="dialog"].fixed.inset-0 button.h-10.w-10.rounded-full[class~="bg-accent/15"] {
  background: #fdefe0 !important;
  border-color: #f0a0b8 !important;
  box-shadow: 3px 3px 0 rgba(240, 160, 184, 0.5) !important;
}

[class*="z-[300]"].animate-ai-entrance.fixed {
  background: #fdf6ec !important;
  border: 2px solid #e3c9ae !important;
  border-radius: 6px !important;
  box-shadow: 6px 6px 0 rgba(226, 203, 183, 0.45) !important;
  color: #7a5c4f !important;
}

[class*="z-[300]"].animate-ai-entrance.fixed button:hover {
  background: #fdefe0 !important;
}

[class*="z-[300]"].animate-ai-entrance.fixed button[class~="bg-ink/10"] {
  background: #fdefe0 !important;
  box-shadow: inset 3px 0 0 #f0a0b8 !important;
}

main:not(.fixed):not([data-live-page]) > :nth-child(1 of :not([class~="fixed"])):has(.harbor-anime-hero) {
  overflow: visible !important;
}

.harbor-anime-hero .absolute.inset-0.z-0.overflow-hidden {
  right: 0 !important;
}

.harbor-anime-hero [class*="end-[-3rem]"] {
  inset-inline-end: -48px !important;
}

.harbor-anime-hero h1,
.harbor-anime-hero .font-display {
  text-shadow: 0 1px 0 #fdefe0, 0 0 18px #fdefe0 !important;
}

.harbor-anime-hero p {
  color: #6b4f43 !important;
  text-shadow: 0 1px 0 #fdefe0, 0 0 12px #fdefe0, 0 0 22px #fdefe0 !important;
}

main:not(.fixed):not([data-live-page]) .flex.flex-col.gap-12 > .relative:has(> * > .cursor-grab.rounded-2xl),
main:not(.fixed):not([data-live-page]) .flex.flex-col.gap-12 > .relative:has(.cursor-grab.rounded-2xl) {
  margin-left: -48px !important;
  margin-right: -48px !important;
}

[class~="blur-2xl"].absolute.inset-0.scale-105.object-cover {
  display: none !important;
}

.harbor-picker-backdrop {
  display: none !important;
}

main:not(.fixed):not([data-live-page]):has(> :nth-child(1 of :not([class~="fixed"])) > .harbor-bleed-stremio:not([class~="absolute"])) {
  padding-top: 0 !important;
}

main:not(.fixed):not([data-live-page]) .harbor-bleed-stremio[class~="absolute"],
main:not(.fixed):not([data-live-page]) .harbor-hero-bleed[class~="absolute"] {
  overflow: visible !important;
  left: 0 !important;
  right: 0 !important;
  border-radius: 0 !important;
}

main:not(.fixed):not([data-live-page]) .harbor-bleed-stremio[class~="absolute"] > img,
main:not(.fixed):not([data-live-page]) .harbor-hero-bleed[class~="absolute"] > img {
  margin-top: -70px !important;
  height: calc(100% + 70px) !important;
}

main:not(.fixed):not([data-live-page]) .harbor-bleed-stremio[class~="absolute"] > [class~="absolute"],
main:not(.fixed):not([data-live-page]) .harbor-hero-bleed[class~="absolute"] > [class~="absolute"] {
  top: -70px !important;
}

main:not(.fixed):not([data-live-page]) > .harbor-bleed-stremio[class~="absolute"],
main:not(.fixed):not([data-live-page]) > .harbor-hero-bleed[class~="absolute"] {
  margin-top: 0 !important;
  top: 0 !important;
  padding-inline: 0 !important;
  left: 36px !important;
  right: 36px !important;
}

main:not(.fixed):not([data-live-page]) > .harbor-bleed-stremio[class~="absolute"] > img,
main:not(.fixed):not([data-live-page]) > .harbor-hero-bleed[class~="absolute"] > img {
  margin-top: 0 !important;
  height: 100% !important;
}

main:not(.fixed):not([data-live-page]) > .harbor-bleed-stremio[class~="absolute"] > [class~="absolute"],
main:not(.fixed):not([data-live-page]) > .harbor-hero-bleed[class~="absolute"] > [class~="absolute"] {
  top: 0 !important;
}

main:not(.fixed):not([data-live-page]) > :nth-child(1 of :not([class~="fixed"])) > .harbor-bleed-stremio:not([class~="absolute"]),
main:not(.fixed):not([data-live-page]) > :nth-child(1 of :not([class~="fixed"])) > .harbor-hero-bleed:not([class~="absolute"]) {
  width: auto !important;
  margin-inline: -48px !important;
  padding-inline: 0 !important;
  border-radius: 0 !important;
}

main:not(.fixed):not([data-live-page]) > :nth-child(1 of :not([class~="fixed"])):has(> .harbor-people-hero) {
  padding-top: 0 !important;
  overflow: visible !important;
}

main:not(.fixed):not([data-live-page]) > :nth-child(1 of :not([class~="fixed"])) > .harbor-people-hero {
  width: auto !important;
  margin-top: -70px !important;
  margin-inline: -20px !important;
  padding-inline: 0 !important;
  border-radius: 0 !important;
}

main:not(.fixed):not([data-live-page]) > :nth-child(1 of :not([class~="fixed"])):has(> :nth-child(1 of :not([class~="absolute"])) [class*="cursor-grab"]) {
  margin-top: -70px !important;
  padding-top: 70px !important;
}

main:not(.fixed):not([data-live-page]) .flex.flex-col.gap-12 > :nth-child(1 of :not([class~="absolute"])):has([class*="cursor-grab"]) {
  margin-top: -70px !important;
}

main:not(.fixed):not([data-live-page]) .flex.flex-col.gap-12 > :nth-child(1 of :not([class~="absolute"])) [class*="cursor-grab"],
main:not(.fixed):not([data-live-page]) .flex.flex-col.gap-12 > :nth-child(1 of :not([class~="absolute"])) [class*="cursor-grab"] .harbor-hero-stage {
  border-radius: 0 !important;
}

main:not(.fixed):not([data-live-page]) [class*="cursor-grab"] .harbor-hero-stage > img {
  inset: 0 !important;
  width: 100% !important;
  height: 100% !important;
  border-radius: 0 !important;
}

main:not(.fixed):not([data-live-page]) [class*="cursor-grab"] .harbor-hero-content {
  padding-inline: calc(3.5rem + 48px) !important;
}

main:not(.fixed):not([data-live-page]) .flex.flex-col.gap-12 > :nth-child(1 of :not([class~="absolute"])) [class*="cursor-grab"] .harbor-hero-content {
  padding-top: calc(3.5rem + 70px) !important;
}

.harbor-awards-corner span {
  color: #4a3228 !important;
  text-shadow: 0 1px 0 rgba(253, 239, 224, 0.9), 0 0 12px rgba(253, 239, 224, 0.85) !important;
}

.harbor-awards-corner > span:last-child,
.harbor-awards-corner svg {
  color: #5c4034 !important;
}

main:not(.fixed):not([data-live-page]) .harbor-hero-stage,
main:not(.fixed):not([data-live-page]) .harbor-hero-stage * {
  filter: none !important;
}

main:not(.fixed):not([data-live-page]) .flex.flex-col.gap-12 .cursor-grab.rounded-2xl,
main:not(.fixed):not([data-live-page]) .flex.flex-col.gap-12 .cursor-grab.rounded-2xl .harbor-hero-stage {
  box-shadow: none !important;
}

main:not(.fixed):not([data-live-page]) div:has(> .group.relative > [class~="top-full"]),
main:not(.fixed):not([data-live-page]) > :nth-child(1 of :not([class~="fixed"])):has(.group.relative > [class~="top-full"]) {
  overflow: visible !important;
}


.harbor-queue-head h1 {
  letter-spacing: 0.02em !important;
}

.harbor-queue-head span {
  color: #c0a091 !important;
  letter-spacing: 0.24em !important;
}

.harbor-feed-hero {
  background: #ffffff !important;
  border: 1px solid rgba(240, 144, 174, 0.34) !important;
  border-radius: 22px !important;
  box-shadow: 0 16px 38px -20px rgba(184, 142, 132, 0.55) !important;
}

.harbor-feed-scrim-b {
  background: linear-gradient(
    to top,
    #ffffff 0%,
    rgba(255, 255, 255, 0.97) 16%,
    rgba(255, 255, 255, 0.84) 32%,
    rgba(255, 255, 255, 0.5) 50%,
    rgba(255, 255, 255, 0.16) 64%,
    rgba(255, 255, 255, 0) 76%
  ) !important;
}

.harbor-feed-scrim-s {
  width: 66% !important;
  background-image: linear-gradient(
    to right,
    #ffffff 0%,
    rgba(255, 255, 255, 0.9) 26%,
    rgba(255, 255, 255, 0.55) 46%,
    rgba(255, 255, 255, 0) 78%
  ) !important;
}

.harbor-feed-pos {
  color: #b59486 !important;
  letter-spacing: 0.26em !important;
}

.harbor-feed-info {
  color: #8a6a5b !important;
  background: #ffffff !important;
  border: 1px solid rgba(240, 144, 174, 0.36) !important;
  border-radius: 50% !important;
  box-shadow: 0 4px 12px -6px rgba(184, 142, 132, 0.7) !important;
}

.harbor-feed-info > span[aria-hidden] {
  filter: none !important;
}

.harbor-feed-info > span[aria-hidden]:first-child {
  background: rgba(240, 144, 174, 0.16) !important;
}

.harbor-feed-tag {
  background: #f090ae !important;
  color: #ffffff !important;
  letter-spacing: 0.2em !important;
  font-weight: 700 !important;
  padding: 5px 14px !important;
  box-shadow: 0 4px 12px -7px rgba(224, 143, 163, 0.9) !important;
}

.harbor-feed-tag-alt {
  background: #fdeef3 !important;
  border-color: rgba(240, 144, 174, 0.5) !important;
  color: #8a6a5b !important;
  letter-spacing: 0.2em !important;
  padding: 5px 14px !important;
}

.harbor-feed-title {
  color: #6b5852 !important;
  filter: none !important;
  text-shadow: none !important;
  letter-spacing: 0.01em !important;
}

.harbor-feed-meta,
.harbor-feed-meta span {
  color: #9c7f72 !important;
}

.harbor-feed-desc {
  color: #8a6a5b !important;
}

.harbor-feed-cta {
  background: #f090ae !important;
  color: #ffffff !important;
  font-weight: 700 !important;
  letter-spacing: 0.09em !important;
  border-radius: 999px !important;
  padding-inline: 30px !important;
  box-shadow: 0 10px 22px -12px rgba(224, 143, 163, 0.95) !important;
}

.harbor-feed-cta:hover {
  background: #e8809f !important;
  box-shadow: 0 14px 26px -12px rgba(224, 143, 163, 0.95) !important;
}

.harbor-feed-chip {
  background: #ffffff !important;
  border-color: rgba(240, 144, 174, 0.42) !important;
  color: #7d5c4e !important;
  letter-spacing: 0.05em !important;
  border-radius: 999px !important;
}

.harbor-feed-chip:hover {
  background: #fdeef3 !important;
  border-color: rgba(240, 144, 174, 0.75) !important;
  color: #6b5852 !important;
}

.harbor-feed-chip[class~="text-accent"] {
  background: #f090ae !important;
  border-color: #f090ae !important;
  color: #ffffff !important;
}

.harbor-queue-arrow {
  height: 54px !important;
  width: 54px !important;
  color: #7d5c4e !important;
  background: #ffffff !important;
  border: 1px solid rgba(240, 144, 174, 0.4) !important;
  border-radius: 50% !important;
  filter: none !important;
  box-shadow: 0 8px 20px -10px rgba(184, 142, 132, 0.85) !important;
}

.harbor-queue-arrow:hover {
  background: #fdeef3 !important;
  color: #6b5852 !important;
}

.harbor-queue-arrow svg {
  height: 26px !important;
  width: 26px !important;
}

.harbor-queue-striplabel {
  color: #b59486 !important;
  letter-spacing: 0.28em !important;
}

.harbor-queue-tile {
  border-radius: 14px !important;
  box-shadow: 0 8px 20px -14px rgba(184, 142, 132, 0.8) !important;
}

.harbor-queue-tile > * {
  border-radius: 14px !important;
}



.harbor-spot-card {
  border: 1px solid rgba(240, 144, 174, 0.36) !important;
  border-radius: 18px !important;
  box-shadow: 0 12px 28px -18px rgba(184, 142, 132, 0.7) !important;
}

.harbor-spot-card:hover {
  border-color: rgba(240, 144, 174, 0.66) !important;
  box-shadow: 0 18px 34px -18px rgba(184, 142, 132, 0.85) !important;
}

.harbor-spot-scrim {
  background: linear-gradient(
    to top,
    #fdefe0 0%,
    rgba(253, 239, 224, 0.94) 22%,
    rgba(253, 239, 224, 0.72) 40%,
    rgba(253, 239, 224, 0.28) 58%,
    rgba(253, 239, 224, 0) 76%
  ) !important;
}

.harbor-spot-sub {
  color: #cf6386 !important;
  letter-spacing: 0.24em !important;
}

.harbor-spot-name {
  color: #6b5852 !important;
  filter: none !important;
  text-shadow: 0 1px 8px #fdefe0, 0 0 4px #fdefe0 !important;
}


.harbor-connecting {
  background-color: var(--kw-gingham-pink) !important;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.35) 50%, transparent 50%),
    linear-gradient(90deg, rgba(255, 255, 255, 0.35) 50%, transparent 50%) !important;
  background-size: 60px 60px !important;
}

.harbor-connecting-art,
.harbor-connecting-veil {
  display: none !important;
}

.harbor-connecting-body {
  position: absolute !important;
  top: 50% !important;
  left: 50% !important;
  transform: translate(-50%, -50%) !important;
  height: auto !important;
  width: min(560px, calc(100vw - 96px)) !important;
  gap: 20px !important;
  padding: 38px 40px 34px !important;
  background: #fdf6ec !important;
  border: 2px solid #e3c9ae !important;
  border-radius: 26px !important;
  box-shadow: 0 26px 54px -26px rgba(150, 108, 96, 0.55) !important;
}

.harbor-connecting-body img {
  background: none !important;
  padding: 0 !important;
  max-height: 116px !important;
  filter: drop-shadow(0 1px 1px rgba(107, 88, 82, 0.75)) drop-shadow(0 0 7px rgba(107, 88, 82, 0.45)) !important;
}

.harbor-connecting-body .font-display {
  color: #6b5852 !important;
  filter: none !important;
  text-shadow: none !important;
  font-size: 40px !important;
}

.harbor-connecting-body p {
  color: #8a6a5b !important;
}

.harbor-connecting-body p[class*="amber"] {
  color: #b26a2e !important;
}

.harbor-connecting-body [class*="bg-white/"] {
  background-color: rgba(199, 150, 130, 0.55) !important;
}

.harbor-connecting-body .harbor-loader-cap {
  color: #8a6a5b !important;
  letter-spacing: 0.28em !important;
}

.harbor-connecting-btn {
  background: #f090ae !important;
  color: #ffffff !important;
  font-weight: 700 !important;
  letter-spacing: 0.08em !important;
  box-shadow: 0 10px 22px -12px rgba(224, 143, 163, 0.95) !important;
}

.harbor-connecting-btn:hover {
  background: #e8809f !important;
}

.harbor-connecting-btn2 {
  background: #fdf6ec !important;
  color: #7d5c4e !important;
  font-weight: 700 !important;
  letter-spacing: 0.08em !important;
  box-shadow: inset 0 0 0 2px #e3c9ae !important;
}

.harbor-connecting-btn2:hover {
  background: #fdeef3 !important;
  color: #6b5852 !important;
}


.harbor-service-glow {
  display: none;
}
`;
