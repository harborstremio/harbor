import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { NavChevron } from "@/components/nav-arrow";
import { useT, useUiLanguage } from "@/lib/i18n";
import { useSectionBack } from "@/lib/section-back";
import { useGameScreenshot } from "@/hooks/use-game-screenshot";
import "./game-screenshot-viewer.css";

export function GameScreenshotViewer({ screenshots, index, select, onClose }: {
  screenshots: string[]; index: number; select: (index: number) => void; onClose: () => void;
}) {
  const t = useT(), language = useUiLanguage(), title = useId(), root = useRef<HTMLDivElement>(null);
  const { closing, close } = useModalExit(onClose), wheelAt = useRef(0);
  const current = Math.max(0, Math.min(index, screenshots.length - 1)), count = screenshots.length;
  const move = (delta: number) => { if (count > 1 && !closing) select((current + delta + count) % count); };
  useSectionBack(close, true);
  useEffect(() => {
    const origin = document.activeElement as HTMLElement | null;
    const backdrop = root.current?.closest('[role="dialog"]')?.parentElement;
    const background = [...document.body.children].filter((node): node is HTMLElement => node instanceof HTMLElement && node !== backdrop);
    const previous = background.map(node => node.inert);
    background.forEach(node => { node.inert = true; });
    root.current?.querySelector<HTMLButtonElement>("[data-tv-modal-close]")?.focus({ preventScroll: true });
    return () => {
      background.forEach((node, index) => { node.inert = previous[index]; });
      if (origin?.isConnected) origin.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    if (root.current && !root.current.contains(document.activeElement)) root.current.querySelector<HTMLButtonElement>("[data-tv-modal-close]")?.focus({ preventScroll: true });
  }, [current]);
  return <ModalShell closing={closing} onDismiss={close} labelledBy={title} width={10000} backdropClassName="games-screenshot-backdrop">
    <div ref={root} className="games-screenshot-viewer" data-local-keyboard inert={closing || undefined}
      onKeyDown={event => {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        const buttons = [...root.current!.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
        if (event.key === "Tab") {
          const target = event.shiftKey ? buttons.at(-1) : buttons[0];
          if (document.activeElement === (event.shiftKey ? buttons[0] : buttons.at(-1))) { event.preventDefault(); target?.focus(); }
          return;
        }
        const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") move((event.key === "ArrowRight") !== rtl ? 1 : -1);
        else if (event.key === "Home") select(0);
        else if (event.key === "End") select(count - 1);
        else if (event.key === "ArrowUp" || event.key === "ArrowDown") { const focused = buttons.indexOf(document.activeElement as HTMLButtonElement); buttons[(focused + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus(); }
        else return;
        event.preventDefault(); event.stopPropagation();
      }}
      onWheel={event => {
        if (event.ctrlKey || Math.abs(event.deltaY) < 8) return;
        event.stopPropagation();
        const now = performance.now();
        if (now - wheelAt.current > 250) { wheelAt.current = now; move(event.deltaY > 0 ? 1 : -1); }
      }} onContextMenu={event => { event.preventDefault(); close(); }}>
      <header><h2 id={title}>{t("games.gallery.images")}</h2><button data-tv-modal-close onClick={close} aria-label={t("common.close")}><X size={26}/></button></header>
      <div className="games-screenshot-image" onDoubleClick={close}>
        {screenshots[current] && <ScreenshotImage key={screenshots[current]} src={screenshots[current]} alt={`${t("games.gallery.images")} · ${new Intl.NumberFormat(language).format(current + 1)}`}/>}
      </div>
      {count > 1 && <><button className="games-screenshot-previous" onClick={() => move(-1)} aria-label={t("common.previous")}><NavChevron dir="left" size={34}/></button><button className="games-screenshot-next" onClick={() => move(1)} aria-label={t("common.next")}><NavChevron dir="right" size={34}/></button></>}
      <footer aria-live="polite" aria-atomic="true"><bdi>{new Intl.NumberFormat(language).format(current + 1)} / {new Intl.NumberFormat(language).format(count)}</bdi></footer>
    </div>
  </ModalShell>;
}

function ScreenshotImage({ src, alt }: { src: string; alt: string }) {
  const t = useT(), image = useGameScreenshot(src);
  return image.failed ? <div className="games-screenshot-error" role="alert"><p>{t("games.gallery.imageUnavailable")}</p><button onClick={event => { event.currentTarget.closest(".games-screenshot-viewer")?.querySelector<HTMLButtonElement>("[data-tv-modal-close]")?.focus({ preventScroll: true }); void image.retry(); }}>{t("common.retry")}</button></div> : <img key={image.attempt} src={image.url || undefined} alt={image.url ? alt : ""} data-screenshot-source={src} aria-busy={!image.url} decoding="async" onError={image.fail}/>;
}
