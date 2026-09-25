export type MenuPresentation = "baseline" | "popout";

export function resolveMenuPresentation(
  buildValue: string | undefined,
  development: boolean,
  requested?: string | null,
): MenuPresentation {
  if (development && (requested === "baseline" || requested === "popout")) return requested;
  return buildValue === "baseline" ? "baseline" : "popout";
}

// Comparison is a development-only URL override, never a persisted preference.
export const contextMenuPresentation = resolveMenuPresentation(
  import.meta.env?.VITE_CONTEXT_MENU_PRESENTATION,
  import.meta.env?.DEV === true,
  import.meta.env?.DEV && typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("menu-presentation")
    : undefined,
);
