export const THEME_BEHAVIORS = [
  { id: "sidebar", label: "Sidebar" },
  { id: "topdock", label: "Top dock" },
  { id: "rail", label: "Side rail" },
  { id: "stremio", label: "Stremio rail" },
  { id: "minui", label: "Floating dock" },
  { id: "cinematic", label: "Cinematic" },
  { id: "custom", label: "Custom" },
] as const;

export type ThemeBehavior = (typeof THEME_BEHAVIORS)[number]["id"];

const SIDEBAR_LAYOUTS = new Set(["sidebar", "dracula", "nord", "forest", "royal"]);

export function themeBehavior(layout: string | null | undefined): ThemeBehavior | null {
  if (!layout) return null;
  if (SIDEBAR_LAYOUTS.has(layout)) return "sidebar";
  return THEME_BEHAVIORS.some((behavior) => behavior.id === layout)
    ? (layout as ThemeBehavior)
    : null;
}

export function matchesThemeBehavior(
  layout: string | null | undefined,
  selected: ThemeBehavior | null,
): boolean {
  return selected === null || themeBehavior(layout) === selected;
}
