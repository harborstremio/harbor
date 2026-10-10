import { useEffect, useRef } from "react";
import { Menu } from "lucide-react";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useT } from "@/lib/i18n";
import { useSectionBack } from "@/lib/section-back";
import "./game-harbor-menu.css";

/** Reveals the shell's existing theme navigation instead of mounting a second copy. */
export function GameHarborMenu({ active, open, setOpen }: { active: boolean; open: boolean; setOpen?: (open: boolean) => void }) {
  const t = useT();
  const trigger = useRef<HTMLButtonElement>(null);
  const dismiss = () => {
    setOpen?.(false);
    requestAnimationFrame(() => {
      const sidebar = trigger.current?.closest(".games-library-sidebar");
      const target = sidebar?.classList.contains("is-collapsed") ? sidebar.querySelector<HTMLButtonElement>(".games-library-collapse") : trigger.current;
      target?.focus({ preventScroll: true });
    });
  };
  useSectionBack(dismiss, active && open, true);
  useEffect(() => {
    if (!active || !open) return;
    let settle: number | undefined;
    const focusNavigation = () => {
        const visible = (element: HTMLElement) => !element.closest('[inert], [aria-hidden="true"]') && !!element.getClientRects().length && getComputedStyle(element).visibility === "visible";
        const selected = [...document.querySelectorAll<HTMLElement>('[data-harbor-native-backdrop] [data-harbor-nav="games"], #harbor-custom-overlay [data-harbor-nav="games"]')].find(visible);
        const selectedTarget = selected?.matches("button, a, [tabindex]") ? selected : selected?.querySelector<HTMLElement>("button, a, [tabindex]");
        const target = selectedTarget ?? [...document.querySelectorAll<HTMLElement>('[data-tv-top-chrome] button[aria-haspopup="menu"]')].find(visible) ?? [...document.querySelectorAll<HTMLElement>('[data-tv-top-chrome] button, .harbor-minui-shell button')].find(visible);
        // The shell stays mounted: keep its exact scroll, even when Games is offscreen.
        // Prefer a visible navigation item so keyboard focus is never hidden in the list.
        const inViewport = (element: HTMLElement) => {
          const bounds = element.getBoundingClientRect();
          let top = 0, bottom = innerHeight;
          for (let parent = element.parentElement; parent; parent = parent.parentElement) {
            if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(parent).overflowY)) {
              const clip = parent.getBoundingClientRect(); top = Math.max(top, clip.top); bottom = Math.min(bottom, clip.bottom);
            }
          }
          return bounds.top >= top && bounds.bottom <= bottom;
        };
        const focusTarget = target && inViewport(target) ? target : [...document.querySelectorAll<HTMLElement>('[data-harbor-native-backdrop] [data-harbor-nav], #harbor-custom-overlay [data-harbor-nav]')]
          .map(element => element.matches("button, a, [tabindex]") ? element : element.querySelector<HTMLElement>("button, a, [tabindex]"))
          .find((element): element is HTMLElement => !!element && visible(element) && inViewport(element));
        focusTarget?.focus({ preventScroll: true });
        return !!focusTarget && document.activeElement === focusTarget;
    };
    // Allow overflow measurement and the theme's visibility transition to settle.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        if (!focusNavigation()) settle = window.setTimeout(focusNavigation, 170);
      });
    });
    const outside = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-harbor-native-backdrop] > aside, [data-tv-top-chrome], .harbor-minui-shell, #harbor-custom-overlay, .games-library-home, [data-dropdown-menu], [role="menu"], [role="dialog"]')) return;
      // Let the same click operate the page or music controls; don't steal its focus.
      setOpen?.(false);
    };
    document.addEventListener("click", outside);
    return () => { cancelAnimationFrame(frame); window.clearTimeout(settle); document.removeEventListener("click", outside); };
  }, [active, open, setOpen]);
  return <HoverTooltip label={t("games.sidebar.menu")} side="bottom">
    <button ref={trigger} type="button" className="games-library-home" aria-label={t("games.sidebar.menu")} aria-expanded={open && active} onClick={() => setOpen?.(!open)}>
      <Menu size={25} strokeWidth={1.8} aria-hidden="true" />
    </button>
  </HoverTooltip>;
}
