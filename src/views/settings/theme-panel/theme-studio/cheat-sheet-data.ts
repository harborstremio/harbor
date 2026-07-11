export type TokenRow = {
  name: string;
  type: "color" | "font" | "easing";
  defaultValue: string;
  desc: string;
};

export const COLOR_TOKENS: TokenRow[] = [
  {
    name: "--color-canvas",
    type: "color",
    defaultValue: "oklch(0.18 0.004 260)",
    desc: "Page background. Everything sits on this.",
  },
  {
    name: "--color-surface",
    type: "color",
    defaultValue: "oklch(0.22 0.004 260)",
    desc: "Cards, panels, search input, modal bodies.",
  },
  {
    name: "--color-elevated",
    type: "color",
    defaultValue: "oklch(0.27 0.004 260)",
    desc: "Modals, dropdowns, popovers, settings nav.",
  },
  {
    name: "--color-raised",
    type: "color",
    defaultValue: "oklch(0.32 0.004 260)",
    desc: "Hover states, pressed surfaces, pill backgrounds.",
  },
  {
    name: "--color-ink",
    type: "color",
    defaultValue: "oklch(0.97 0.003 260)",
    desc: "Primary text and icons. Maximum contrast.",
  },
  {
    name: "--color-ink-muted",
    type: "color",
    defaultValue: "oklch(0.72 0.003 260)",
    desc: "Secondary text, inactive nav items, blurbs.",
  },
  {
    name: "--color-ink-subtle",
    type: "color",
    defaultValue: "oklch(0.50 0.003 260)",
    desc: "Captions, eyebrow labels, hints, dim metadata.",
  },
  {
    name: "--color-edge",
    type: "color",
    defaultValue: "oklch(0.36 0.004 260 / 0.55)",
    desc: "Strong borders and dividers. Includes alpha.",
  },
  {
    name: "--color-edge-soft",
    type: "color",
    defaultValue: "oklch(0.36 0.004 260 / 0.25)",
    desc: "Soft borders. Used for low-emphasis containers.",
  },
  {
    name: "--color-accent",
    type: "color",
    defaultValue: "oklch(0.78 0.13 60)",
    desc: "Brand color. Active states, focus rings, buttons.",
  },
  {
    name: "--color-accent-soft",
    type: "color",
    defaultValue: "oklch(0.78 0.13 60 / 0.18)",
    desc: "Accent tints, hover backgrounds, glow effects.",
  },
  {
    name: "--color-danger",
    type: "color",
    defaultValue: "oklch(0.55 0.18 25)",
    desc: "Errors, destructive actions, delete buttons.",
  },
];

export const FONT_TOKENS: TokenRow[] = [
  {
    name: "--font-display",
    type: "font",
    defaultValue: '"Sentient", "Georgia", serif',
    desc: "Hero titles, section headers, wordmark.",
  },
  {
    name: "--font-sans",
    type: "font",
    defaultValue: '"Switzer", "Inter", system-ui, sans-serif',
    desc: "Body text. Everything that isn't a heading.",
  },
  {
    name: "--font-mono",
    type: "font",
    defaultValue: '"JetBrains Mono", ui-monospace, monospace',
    desc: "Code blocks, token values, debug output.",
  },
];

export const EASING_TOKENS: TokenRow[] = [
  {
    name: "--ease-out",
    type: "easing",
    defaultValue: "cubic-bezier(0.16, 1, 0.3, 1)",
    desc: "Main entrance curve. Pages, modals, drawers.",
  },
  {
    name: "--ease-in-out",
    type: "easing",
    defaultValue: "cubic-bezier(0.65, 0, 0.35, 1)",
    desc: "Continuous loops, breathing animations.",
  },
];

export type QuickStep = { step: string; detail: string };

export const QUICKSTART: QuickStep[] = [
  { step: "Start from a theme", detail: "Open the Theme Studio. Begin from a built-in look or from scratch." },
  {
    step: "Set colors and fonts",
    detail: "The Look tab drives the 12 color tokens and the type pairing. The live sample updates instantly.",
  },
  {
    step: "Choose a layout",
    detail: "The Layout tab picks where navigation lives. Custom hides built-in chrome and your own HTML takes over.",
  },
  {
    step: "Build custom chrome visually",
    detail: "On Custom, the builder makes a sidebar or top bar with no code. Wire items to window.harbor.navigate().",
  },
  {
    step: "Go deeper with code",
    detail:
      "Open the code editor for raw CSS, HTML and JS layered over the whole app. Everything below is fair to target.",
  },
  {
    step: "Save or export",
    detail: "Save adds it to Your themes. Export writes a .harborstyle file you can share with anyone.",
  },
];

export type HarborApi = { call: string; desc: string };

export const WINDOW_HARBOR: HarborApi[] = [
  {
    call: "window.harbor.navigate(view)",
    desc: "Switch the app to a view. Pass a view id below, e.g. window.harbor.navigate('movies').",
  },
  { call: "window.harbor.back()", desc: "Go back one step, same as the back button." },
];

export type DataAttr = {
  attr: string;
  values: string[];
  desc: string;
  example: string;
};

export const ROOT_DATA_ATTRS: DataAttr[] = [
  {
    attr: "data-theme-layout",
    values: ["sidebar", "topdock", "rail", "stremio", "minui", "dracula", "nord", "forest", "royal", "custom"],
    desc: "Which chrome layout is active. On custom, no built-in chrome renders and your HTML overlay is the chrome.",
    example: 'html[data-theme-layout="custom"] main { padding: 0; }',
  },
  {
    attr: "data-theme-card",
    values: ["flat", "glass", "stremio", "minui", "crunch", "noir", "custom"],
    desc: "Card surface treatment. Target custom to style cards your own way.",
    example: 'html[data-theme-card="custom"] .pick-card { border-radius: 0; }',
  },
  {
    attr: "data-theme-button",
    values: ["flat", "glossy", "minui", "crunch", "noir", "custom"],
    desc: "Button surface treatment. Glossy adds an inset highlight gradient.",
    example: 'html[data-theme-button="custom"] .bg-accent { background: red; }',
  },
  {
    attr: "data-theme-bokeh",
    values: ["on", "off"],
    desc: "Whether floating bokeh orbs render over the canvas.",
    example: 'html[data-theme-bokeh="on"] .bokeh-orb { display: block; }',
  },
  {
    attr: "data-chrome-hidden",
    values: ["present", "absent"],
    desc: "Present on <html> while the player, play picker, or immersive Live TV is active. Use it to hide custom chrome during playback.",
    example: "html[data-chrome-hidden] .my-sidebar { display: none !important; }",
  },
];

export type Utility = { class: string; mapsTo: string };

export const TAILWIND_UTILITIES: Utility[] = [
  { class: "bg-canvas", mapsTo: "background: var(--color-canvas)" },
  { class: "bg-surface", mapsTo: "background: var(--color-surface)" },
  { class: "bg-elevated", mapsTo: "background: var(--color-elevated)" },
  { class: "bg-raised", mapsTo: "background: var(--color-raised)" },
  { class: "bg-accent", mapsTo: "background: var(--color-accent)" },
  { class: "bg-accent-soft", mapsTo: "background: var(--color-accent-soft)" },
  { class: "bg-ink", mapsTo: "background: var(--color-ink)" },
  { class: "bg-danger", mapsTo: "background: var(--color-danger)" },
  { class: "text-ink", mapsTo: "color: var(--color-ink)" },
  { class: "text-ink-muted", mapsTo: "color: var(--color-ink-muted)" },
  { class: "text-ink-subtle", mapsTo: "color: var(--color-ink-subtle)" },
  { class: "text-accent", mapsTo: "color: var(--color-accent)" },
  { class: "text-canvas", mapsTo: "color: var(--color-canvas)" },
  { class: "border-edge", mapsTo: "border-color: var(--color-edge)" },
  { class: "border-edge-soft", mapsTo: "border-color: var(--color-edge-soft)" },
  { class: "border-accent", mapsTo: "border-color: var(--color-accent)" },
  { class: "font-display", mapsTo: "font-family: var(--font-display)" },
  { class: "font-sans", mapsTo: "font-family: var(--font-sans)" },
  { class: "font-mono", mapsTo: "font-family: var(--font-mono)" },
];

export type HookSelector = { selector: string; where: string; tip?: string };

export const STABLE_SELECTORS: HookSelector[] = [
  { selector: ".pick-card", where: "Portrait poster cards in every rail." },
  { selector: ".harbor-cinema-badge", where: "In-cinema chip on hero + detail." },
  { selector: ".harbor-chat-toast", where: "Together chat bubble. Floating bottom-right." },
  { selector: ".harbor-together-pill", where: "Together status pill. Top bar / floating dock." },
  {
    selector: ".harbor-search-backdrop",
    where: "Full-screen backdrop behind the search overlay.",
    tip: "Override to change blur amount or tint.",
  },
  { selector: ".harbor-minui-shell", where: "The floating dock container (Floating dock layout)." },
  {
    selector: ".glass-card",
    where: "Cards that opt into the glass treatment.",
    tip: "Active only when data-theme-card is glass.",
  },
  { selector: ".modal-panel", where: "Modal bodies (auth, profile picker, together, etc.)." },
  { selector: "[data-harbor-player]", where: "The video player root. Player surfaces scope to this." },
  {
    selector: "[data-harbor-nav]",
    where: "Nav buttons in builder-generated custom chrome.",
    tip: "Gets [data-active] on the current view. Style the active item.",
  },
  { selector: "[data-tauri-drag-region]", where: "Window-drag areas. Keep one if you replace the title bar." },
  { selector: "main", where: "The scrolling content area. Add padding for custom chrome." },
];

export type Layer = { name: string; z: number; what: string };

export const Z_INDEX_MAP: Layer[] = [
  { name: "Topbar", z: 55, what: "Search + profile cluster (when applicable)." },
  { name: "Page chrome (sidebar / dock / rail)", z: 60, what: "All built-in nav chrome lives here." },
  { name: "Floating back pill", z: 70, what: "Back button for detail / picker pages." },
  { name: "Together cursors + chat", z: 80, what: "Live presence overlays." },
  { name: "Studio preview HTML overlay", z: 59, what: "Your @html, only while the studio is open." },
  { name: "Custom HTML overlay (your @html)", z: 100, what: "Pointer-events: none by default in the live app." },
  { name: "Modal stack (auth, profiles, etc.)", z: 150, what: "Standard modals." },
  { name: "Search overlay", z: 200, what: "Full-screen search." },
  { name: "Theme studio shell", z: 210, what: "The studio dock." },
  { name: "Cheat sheet", z: 220, what: "This window." },
  { name: "Code editor (full screen)", z: 230, what: "The expanded code editor." },
];

export type WindowEvent = { name: string; payload?: string; when: string };

export const WINDOW_EVENTS: WindowEvent[] = [
  { name: "harbor:immersive", payload: "CustomEvent<boolean>", when: "Live TV enters or exits immersive mode." },
  { name: "harbor:reset-row-scrolls", payload: "CustomEvent<{ prefix }>", when: "View change. Reset rail scrollers." },
  { name: "harbor:scroll-top", payload: "CustomEvent<{ view }>", when: "View change. Scroll main to the top." },
  { name: "harbor:open-theme-editor", when: "The active-theme banner asks to open the color editor." },
  { name: "harbor:error", payload: "CustomEvent<{ message }>", when: "An application-level error surfaced." },
];

export type ViewName = { id: string; label: string };

export const VIEW_NAMES: ViewName[] = [
  { id: "home", label: "Home" },
  { id: "discover", label: "Discover" },
  { id: "movies", label: "Movies" },
  { id: "shows", label: "Shows" },
  { id: "anime", label: "Anime" },
  { id: "live", label: "Live TV" },
  { id: "calendar", label: "Calendar" },
  { id: "library", label: "My Library" },
  { id: "settings", label: "Settings" },
];

export type FormatField = { key: string; example: string; desc: string };

export const FORMAT_FIELDS: FormatField[] = [
  { key: "name", example: "name: Midnight", desc: "Required. Shown in the theme picker." },
  { key: "blurb", example: "blurb: Neon on black.", desc: "One-line description." },
  { key: "layout", example: "layout: custom", desc: "sidebar, topdock, rail, stremio, minui, or custom." },
  { key: "card", example: "card: flat", desc: "flat, glass, stremio, minui, crunch, noir, or custom." },
  { key: "button", example: "button: flat", desc: "flat, glossy, minui, crunch, noir, or custom." },
  { key: "font", example: "font: sentient-switzer", desc: "A font-pair id (see Typography in the studio)." },
  { key: "bokeh", example: "bokeh: false", desc: "true or false. Floating orbs over the canvas." },
  { key: "swatch", example: "swatch: #0a0d14, #181d28, #7b5cff", desc: "Three hex colors for the picker preview." },
  {
    key: "@tokens",
    example: "@tokens\n--color-canvas: #0a0d14",
    desc: "Required block. The 12 color variables, one per line.",
  },
  { key: "@css", example: "@css\n.pick-card { border-radius: 0; }", desc: "Raw CSS layered over the whole app." },
  { key: "@html", example: "@html\n<aside>...</aside>", desc: "Raw HTML overlay. Your chrome when layout is custom." },
  { key: "@js", example: "@js\nconsole.info('loaded')", desc: "Runs once when the theme loads." },
];

export function tokensCssBlock(): string {
  const lines = COLOR_TOKENS.map((t) => `  ${t.name}: ${t.defaultValue};`);
  return `:root {\n${lines.join("\n")}\n}`;
}
