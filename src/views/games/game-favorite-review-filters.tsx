import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, X } from "lucide-react";
import { AnchoredMenu } from "@/components/anchored-menu";
import { useT, useUiLanguage } from "@/lib/i18n";
import { useSectionBack } from "@/lib/section-back";
import { useExitPresence } from "@/lib/use-exit-presence";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { isBackKey } from "@/lib/keyboard-navigation/geometry";
import { DEFAULT_FAVORITE_REVIEWS, FAVORITE_POSITIVE_SCORES, FAVORITE_REVIEW_COUNTS, type FavoriteReviewFilters } from "@/lib/games/favorites-data";
import { GameMark } from "./game-ui";
import "./game-catalog-filters.css";
import "./game-favorite-review-filters.css";

export function GameFavoriteReviewFilters({ value, onChange, active }: {
  value: FavoriteReviewFilters; onChange: (value: FavoriteReviewFilters) => void; active: boolean;
}) {
  const t = useT(), language = useUiLanguage(), id = useId();
  const anchor = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false), [width, setWidth] = useState(() => Math.min(320, window.innerWidth - 16));
  const reduced = useReducedMotion(), { mounted, closing } = useExitPresence(open && active, reduced ? 0 : 160);
  const count = Number(value.minCount > 0) + Number(value.minPositive > 0);
  const close = () => { setOpen(false); if (active) anchor.current?.focus({ preventScroll: true }); };
  useSectionBack(close, open && active, true);
  useEffect(() => { if (!active) setOpen(false); }, [active]);
  useEffect(() => {
    if (!open || !active || !mounted || closing) return;
    setWidth(Math.min(320, window.innerWidth - 16));
    menu.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus({ preventScroll: true });
  }, [open, active, mounted, closing]);
  const onKeyDown = (event: KeyboardEvent) => {
    if (isBackKey(event.nativeEvent)) { event.preventDefault(); event.stopPropagation(); close(); }
  };
  return <>
    <button ref={anchor} className="games-button games-filter-trigger games-favorite-review-trigger" aria-haspopup="dialog" aria-expanded={open && active} aria-controls={mounted ? id : undefined} onClick={() => open ? close() : setOpen(true)}>
      <GameMark kind="filter" size={17}/>{t("games.favorites.reviewFilters")}
      {count > 0 && <span className="games-filter-count">{count}</span>}<ChevronDown size={15} className="games-filter-chevron"/>
    </button>
    <AnchoredMenu anchorRef={anchor} open={mounted} onClose={close} width={width}>
      <div ref={menu} id={id} role="dialog" aria-label={t("games.favorites.reviewFilters")} className="games-filter-popout games-favorite-review-menu" data-closing={closing || undefined} inert={!open || !active} onKeyDown={onKeyDown} onBlur={event => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node) && event.relatedTarget !== anchor.current) setOpen(false);
      }}>
        <div className="games-filter-popout-heading"><strong>{t("games.favorites.reviewFilters")}</strong><button className="games-filter-dismiss" aria-label={t("common.close")} onClick={close}><X size={16}/></button></div>
        <div className="games-favorite-review-fields">
          {(["minCount", "minPositive"] as const).map(field => <fieldset key={field}>
            <legend>{t(field === "minCount" ? "games.favorites.minimumReviews" : "games.favorites.minimumPositive")}</legend>
            <div role="radiogroup" aria-label={t(field === "minCount" ? "games.favorites.minimumReviews" : "games.favorites.minimumPositive")} onKeyDown={event => {
              const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
              if (!keys.includes(event.key)) return;
              event.preventDefault(); event.stopPropagation();
              const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="radio"]')];
              const current = buttons.indexOf(event.target as HTMLButtonElement), rtl = getComputedStyle(event.currentTarget).direction === "rtl";
              const forward = event.key === "ArrowDown" || event.key === (rtl ? "ArrowLeft" : "ArrowRight");
              const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (current + (forward ? 1 : -1) + buttons.length) % buttons.length;
              buttons[next]?.focus(); buttons[next]?.click();
            }}>
              {(field === "minCount" ? FAVORITE_REVIEW_COUNTS : FAVORITE_POSITIVE_SCORES).map(amount => <button key={amount} role="radio" aria-checked={value[field] === amount} tabIndex={value[field] === amount ? 0 : -1} title={amount ? (field === "minCount" ? `${amount.toLocaleString(language)}+` : `${amount}%+`) : undefined} onClick={() => onChange({ ...value, [field]: amount })}>
                {amount === 0 ? t("games.favorites.any") : <bdi>{field === "minCount" ? `${Intl.NumberFormat(language, { notation: "compact", maximumFractionDigits: 0 }).format(amount)}+` : `${amount}%+`}</bdi>}
              </button>)}
            </div>
          </fieldset>)}
        </div>
        <button className="games-filter-reset" disabled={!count} onClick={() => onChange(DEFAULT_FAVORITE_REVIEWS)}>{t("games.favorites.clearReviews")}</button>
      </div>
    </AnchoredMenu>
  </>;
}
