import { useEffect, useId, useRef, useState } from "react";
import { GamesIcon } from "@/components/icons/games-icon";
import { pushBackHandler } from "@/lib/back-intercept";
import { useT } from "@/lib/i18n";
import { useOnboarding } from "@/lib/onboarding";
import { useSettings } from "@/lib/settings";
import "./game-dock-welcome.css";

const KEY = "games-quick-library-intro";

/** A one-time invitation. The preview never changes the saved preference. */
export function GameDockWelcome({ eligible }: { eligible: boolean }) {
  const t = useT(), { settings, update } = useSettings(), { isDismissed, dismiss } = useOnboarding();
  const seen = isDismissed(KEY), [open, setOpen] = useState(false), id = useId();
  const root = useRef<HTMLElement>(null), accept = useRef<HTMLButtonElement>(null), origin = useRef<HTMLElement | null>(null);
  const close = () => {
    if (root.current?.contains(document.activeElement)) {
      const target = origin.current?.isConnected && origin.current !== document.body ? origin.current : document.querySelector<HTMLElement>('[data-harbor-nav="games"]');
      requestAnimationFrame(() => target?.focus({ preventScroll: true }));
    }
    setOpen(false);
  };
  useEffect(() => {
    if (!eligible || settings.showQuickGameLibrary) {
      setOpen(false);
      // An existing opt-in must not become a new invitation after disabling it.
      if (eligible && settings.showQuickGameLibrary && !seen) dismiss(KEY);
      return;
    }
    if (seen) return;
    const timer = window.setTimeout(() => {
      origin.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setOpen(true);
      dismiss(KEY);
    }, 1400);
    return () => clearTimeout(timer);
  }, [eligible, settings.showQuickGameLibrary, seen, dismiss]);
  useEffect(() => {
    if (!open || !eligible) return;
    const unback = pushBackHandler(() => { close(); return true; });
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) close(); };
    document.addEventListener("pointerdown", outside, true);
    return () => { unback(); document.removeEventListener("pointerdown", outside, true); };
  }, [open, eligible]);
  if (!open || !eligible || settings.showQuickGameLibrary) return null;
  return <aside ref={root} className="game-library-dock game-dock-welcome" aria-labelledby={`${id}-title`}>
    <button className="game-dock-edge" aria-label={t("games.dock.welcomeTitle")} aria-controls={`${id}-prompt`} onClick={() => requestAnimationFrame(() => accept.current?.focus({ preventScroll: true }))} />
    <section id={`${id}-prompt`} className="game-dock-invitation" aria-labelledby={`${id}-title`}>
      <div className="game-dock-invitation-heading"><GamesIcon size={21} /><strong id={`${id}-title`}>{t("games.dock.welcomeTitle")}</strong></div>
      <p aria-live="polite">{t("games.dock.welcomeNote")}</p>
      <div className="game-dock-invitation-actions">
        <button ref={accept} onClick={() => { close(); update({ showQuickGameLibrary: true }); }}>{t("games.dock.welcomeEnable")}</button>
        <button onClick={close}>{t("games.dock.welcomeDismiss")}</button>
      </div>
    </section>
  </aside>;
}
