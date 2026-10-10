import { MusicGlyph } from "@/components/icons/music-glyph";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { AnchoredMenu } from "@/components/anchored-menu";
import { useT } from "@/lib/i18n";
import "./music-dock-overflow.css";

export type MusicDockAction = {
  id: string;
  label: string;
  icon: ReactNode;
  run: () => void;
  /** Rendered pressed, for the toggles that have a state worth showing. */
  active?: boolean;
  disabled?: boolean;
};

/**
 * The dock used to solve a narrow window by hiding controls outright, and the clock went
 * first because it sat on the highest breakpoint. Nothing is dropped now: the secondary
 * controls collapse in here and keep their labels, which they never had as bare icons.
 */
export function MusicDockOverflow({
  actions,
  title,
  className = "",
}: {
  actions: MusicDockAction[];
  title: string;
  className?: string;
}) {
  const t = useT();
  const anchor = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  const bind = useCallback((node: HTMLDivElement | null) => {
    menu.current = node;
    node?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }, []);

  const close = useCallback(() => {
    if (menu.current?.contains(document.activeElement)) anchor.current?.focus();
    setOpen(false);
  }, []);

  const usable = actions.filter((action) => !action.disabled);
  if (usable.length === 0) return null;

  return (
    <>
      <button
        ref={anchor}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("music.card.moreActions", { title })}
        data-music-tooltip=""
        className={className}
      >
        <MusicGlyph name="more" size={18} aria-hidden="true" />
      </button>
      <AnchoredMenu anchorRef={anchor} open={open} onClose={close} width={232}>
        <div
          role="menu"
          ref={bind}
          className="music-dock-overflow-menu animate-menu-in-up"
          onKeyDown={(event) => {
            const buttons = [
              ...(menu.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []),
            ];
            const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
            if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
              event.preventDefault();
              event.stopPropagation();
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? buttons.length - 1
                    : (at + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
              buttons[next]?.focus();
            } else if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              close();
            } else if (event.key === "Tab") {
              close();
            }
          }}
        >
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              role="menuitem"
              disabled={action.disabled}
              aria-pressed={action.active}
              onClick={() => {
                close();
                action.run();
              }}
            >
              <span aria-hidden="true">{action.icon}</span>
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </AnchoredMenu>
    </>
  );
}
