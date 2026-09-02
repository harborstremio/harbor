import { t } from "@/lib/i18n";

function htmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export type Recipe = { title: string; lang: "css" | "html" | "js"; code: string; why: string };

export const RECIPES: Recipe[] = [
  {
    title: "Bell + account menu in your custom chrome",
    lang: "html",
    get code() {
      return `<div style="display:flex; align-items:center; gap:6px; margin-inline-start:auto;">
  <button data-harbor-notifications aria-label="${htmlAttribute(t("Notifications"))}"
          style="position:relative; display:grid; place-items:center;
                 width:38px; height:38px; border:0; border-radius:999px;
                 background:transparent; color:var(--color-ink-muted); cursor:pointer;">
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
    </svg>
    <span data-harbor-unread data-empty
          style="position:absolute; top:2px; right:2px; min-width:15px; height:15px;
                 padding:0 3px; display:flex; align-items:center; justify-content:center;
                 border-radius:999px; background:var(--color-accent);
                 color:var(--color-canvas); font:700 9px var(--font-sans);"></span>
  </button>
  <button data-harbor-account aria-label="${htmlAttribute(t("Account"))}"
          style="display:grid; place-items:center; width:38px; height:38px; border:0;
                 border-radius:999px; background:transparent;
                 color:var(--color-ink-muted); cursor:pointer;">
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="8" r="5"></circle><path d="M20 21a8 8 0 0 0-16 0"></path>
    </svg>
  </button>
</div>
<style>[data-harbor-unread][data-empty] { display: none; }</style>`;
    },
    why: "Drop this in any custom top bar or sidebar. The attributes do everything: the bell opens the real notification center, the badge stays live, and the account button opens Harbor's real dropdown (profiles, View my profile, Notifications, sign in/out) anchored under it. Zero JS, and new menu items appear in your theme automatically with every Harbor update.",
  },
  {
    title: "Tint the cinema badge",
    lang: "css",
    code: `.harbor-cinema-badge {
  color: #ff6b35;
  border-color: rgba(255, 107, 53, 0.4);
}`,
    why: "Recolor an accent-flavored badge without touching the global accent.",
  },
  {
    title: "Solid black search backdrop",
    lang: "css",
    code: `.harbor-search-backdrop {
  background: #000 !important;
  backdrop-filter: blur(28px);
}`,
    why: "Replace the default frosted backdrop for maximum focus.",
  },
  {
    title: "Accent glow on poster cards",
    lang: "css",
    code: `html[data-theme-card="custom"] .pick-card:hover {
  box-shadow:
    0 0 0 2px var(--color-accent),
    0 18px 40px -10px var(--color-accent-soft);
}`,
    why: "Fires only when the theme picks the Custom card style.",
  },
  {
    title: "Custom sidebar (replaces built-in chrome)",
    lang: "html",
    code: `<aside style="pointer-events:auto; position:fixed; inset:0 auto 0 0;
              width:220px; display:flex; flex-direction:column; gap:18px;
              padding:26px 16px; background:var(--color-surface);
              border-right:1px solid var(--color-edge); z-index:60;">
  <div style="font:600 26px var(--font-display); color:var(--color-ink);">Harbor</div>
  <button onclick="window.harbor.navigate('home')">Home</button>
  <button onclick="window.harbor.navigate('movies')">Movies</button>
  <button onclick="window.harbor.navigate('shows')">Shows</button>
  <button onclick="window.harbor.navigate('settings')">Settings</button>
</aside>`,
    why: "Set layout to Custom. Your HTML becomes the chrome, wired with window.harbor.navigate().",
  },
  {
    title: "Shift content over for your sidebar",
    lang: "css",
    code: `html[data-theme-layout="custom"]:not([data-chrome-hidden]) main {
  padding-left: 244px !important;
}`,
    why: "Keep content from sliding under a fixed custom sidebar, and skip the shift during playback.",
  },
  {
    title: "Highlight the active nav item",
    lang: "css",
    code: `[data-harbor-nav][data-active] {
  background: var(--color-raised);
  color: var(--color-ink);
}`,
    why: "Builder-generated nav buttons get data-active on the current view automatically.",
  },
  {
    title: "Corner watermark",
    lang: "html",
    code: `<div style="position:fixed; bottom:10px; right:12px; z-index:90;
            font:500 11px var(--font-sans); color:var(--color-ink-subtle);
            opacity:0.6; letter-spacing:0.08em; text-transform:uppercase;">
  Built with my theme
</div>`,
    why: "Token references mean the watermark adapts to your palette.",
  },
  {
    title: "React to view changes in JS",
    lang: "js",
    code: `window.addEventListener('harbor:scroll-top', (e) => {
  console.info('now viewing', e.detail.view);
});`,
    why: "Harbor dispatches lifecycle events on window. Listen from your theme JS.",
  },
];

export type FullExample = { title: string; desc: string; code: string };

export const FULL_EXAMPLES: FullExample[] = [
  {
    title: "Neon Noir (drop-in .harborstyle)",
    desc: "A complete dark theme with a purple accent. Save it as neon-noir.harborstyle and import it.",
    code: `# Harbor Style
name: Neon Noir
blurb: Purple neon on near-black.
layout: sidebar
card: flat
button: glossy
font: plus-jakarta
bokeh: false
swatch: #0a0a0f, #15151f, #a06bff

@tokens
--color-canvas: #0a0a0f
--color-surface: #15151f
--color-elevated: #1d1d2b
--color-raised: #272739
--color-ink: #f3f1fb
--color-ink-muted: #a9a6c4
--color-ink-subtle: #6c6a85
--color-edge: #3a3a55a0
--color-edge-soft: #3a3a554d
--color-accent: #a06bff
--color-accent-soft: #a06bff2e
--color-danger: #ff5c7a

@css
.pick-card:hover { box-shadow: 0 0 0 2px var(--color-accent); }`,
  },
  {
    title: "Custom chrome theme (full sidebar)",
    desc: "A theme that hides built-in chrome and ships its own sidebar.",
    code: `# Harbor Style
name: My Rail
blurb: My own navigation.
layout: custom
card: flat
button: flat
font: sentient-switzer
swatch: #101418, #171c22, #5ad1c8

@tokens
--color-canvas: #101418
--color-surface: #171c22
--color-elevated: #1f262e
--color-raised: #29323b
--color-ink: #eef3f5
--color-ink-muted: #a3b0b8
--color-ink-subtle: #66747d
--color-edge: #2f3a43a0
--color-edge-soft: #2f3a434d
--color-accent: #5ad1c8
--color-accent-soft: #5ad1c82e
--color-danger: #ef5a6a

@css
html[data-theme-layout="custom"]:not([data-chrome-hidden]) main { padding-left: 240px !important; }
.rail { pointer-events:auto; position:fixed; inset:0 auto 0 0; width:220px; display:flex; flex-direction:column; gap:6px; padding:24px 14px; background:var(--color-surface); border-right:1px solid var(--color-edge); z-index:60; }
.rail button { text-align:left; padding:12px 14px; border:0; border-radius:12px; background:transparent; color:var(--color-ink-muted); font:500 15px var(--font-sans); cursor:pointer; }
.rail button:hover { background:var(--color-raised); color:var(--color-ink); }

@html
<aside class="rail">
  <div style="font:600 26px var(--font-display); color:var(--color-ink); padding:2px 10px;">Harbor</div>
  <button onclick="window.harbor.navigate('home')">Home</button>
  <button onclick="window.harbor.navigate('movies')">Movies</button>
  <button onclick="window.harbor.navigate('shows')">Shows</button>
  <button onclick="window.harbor.navigate('live')">Live TV</button>
  <button onclick="window.harbor.navigate('settings')">Settings</button>
</aside>`,
  },
];
