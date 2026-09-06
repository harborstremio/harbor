import { useEffect, useMemo, useState } from "react";
import { useModalExit } from "@/components/modal-shell";
import { createPortal } from "react-dom";
import { ArrowDownToLine, Check, RefreshCw, Share2, Star, X } from "../../../icons";
import { useT } from "@/lib/i18n";
import { isBackKey, isEditable } from "@/lib/keyboard-navigation/geometry";
import { downloadTheme, rateTheme, type StoreTheme } from "@/lib/theme-store";
import { FeaturedBadge } from "@/views/profile/profile-bits";
import { subscribeOpenProfile } from "@/lib/social/open-profile";
import { ThemeAuthorButton } from "../theme-author-button";
import { fmtCount } from "./format";
import { CommentsSection } from "./comments/comments-section";
import { Fit } from "./market/fit";
import { PaletteSeam } from "./market/palette-seam";
import { MarketCta } from "./market/market-cta";
import { useAcquireState } from "./market/use-acquire";
import { tokensFromStoreTheme } from "./market/fit-palette";

export function ThemeDetail({ theme, onClose }: { theme: StoreTheme; onClose: () => void }) {
  const tr = useT();
  const { closing, close } = useModalExit(onClose);
  const [t, setT] = useState(theme);
  const [myRating, setMyRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [copied, setCopied] = useState(false);
  const tokens = useMemo(() => tokensFromStoreTheme(t), [t]);
  const { state, run } = useAcquireState(() =>
    downloadTheme(t.id, t.cover ?? t.screenshots[0] ?? null, t.versionsCount).then(() => {}),
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isBackKey(e) && !isEditable(e.target instanceof HTMLElement ? e.target : null)) {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [close]);

  useEffect(() => subscribeOpenProfile(close), [close]);

  const rate = async (v: number) => {
    setMyRating(v);
    try {
      setT(await rateTheme(t.id, v));
    } catch {
      /* ignore */
    }
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(t.share);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const shownStars = hover || myRating || Math.round(t.ratingAvg);
  const authorName = t.author || tr("Anonymous");
  const authorMarker = "\uFFFC";
  const [authorPrefix, authorSuffix = ""] = tr("by {author}", {
    author: authorMarker,
  }).split(authorMarker);

  return createPortal(
    <div
      className={`${closing ? "animate-scrim-out" : "animate-scrim-in"} fixed inset-0 z-[244] flex items-center justify-center p-4 sm:p-6`}
    >
      <button
        data-tv-skip
        aria-label={tr("Close")}
        onClick={close}
        className="absolute inset-0 cursor-default bg-canvas/75 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`modal-panel ${closing ? "animate-dialog-out" : "animate-dialog-in"} relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-md bg-elevated ring-1 ring-edge-soft harbor-float`}
      >
        <button
          onClick={close}
          aria-label={tr("Close")}
          className="absolute end-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink-muted ring-1 ring-edge-soft transition-colors hover:bg-raised hover:text-ink"
        >
          <X size={20} />
        </button>

        <div className="min-h-0 overflow-y-auto [scrollbar-width:thin]">
          <div className="grid gap-6 p-6 pb-0 sm:grid-cols-[1.15fr_1fr]">
            <div className="relative aspect-[16/10] overflow-hidden rounded-md bg-elevated ring-1 ring-edge-soft">
              <Fit kind="theme" tokens={tokens} cover={t.cover} size="hero" />
              <div className="absolute inset-x-0 bottom-0">
                <PaletteSeam swatch={t.swatch} />
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pe-8">
                <FeaturedBadge />
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[15.5px] leading-[22px] font-medium text-ink-subtle">
                  {t.ratingCount > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Star size={16} className="fill-accent text-accent" />
                      <span className="tabular-nums text-ink">{t.ratingAvg.toFixed(1)}</span>
                      <span className="tabular-nums">({t.ratingCount})</span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <ArrowDownToLine size={15} strokeWidth={2.2} />
                    {fmtCount(t.downloads)}
                  </span>
                  {t.authorHandle ? (
                    <span>
                      {authorPrefix}
                      <ThemeAuthorButton handle={t.authorHandle} name={authorName} />
                      {authorSuffix}
                    </span>
                  ) : (
                    <span>{tr("by {author}", { author: authorName })}</span>
                  )}
                </div>
              </div>

              <h2 className="font-display text-[clamp(24px,3vw,34px)] font-medium leading-tight tracking-tight text-ink">
                {t.name}
              </h2>

              {t.blurb && (
                <p className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-muted">{t.blurb}</p>
              )}

              <PaletteSeam swatch={t.swatch} labeled />

              <div className="flex flex-wrap items-center gap-2.5">
                <MarketCta
                  variant="acquire"
                  size="md"
                  state={state}
                  onClick={run}
                  label={tr("Get theme")}
                />
                <MarketCta variant="ghost" size="md" onClick={share}>
                  {copied ? <Check size={16} /> : <Share2 size={16} />}
                  {copied ? tr("Copied") : tr("Share")}
                </MarketCta>
              </div>

              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className="text-[15.5px] leading-[22px] font-medium text-ink-subtle">
                  {tr("Rate this theme")}
                </span>
                <div
                  className="flex items-center gap-0.5"
                  role="group"
                  aria-label={tr("Rate this theme")}
                  onMouseLeave={() => setHover(0)}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => rate(n)}
                      onMouseEnter={() => setHover(n)}
                      aria-label={tr("Rate {count} stars", { count: n })}
                      className="grid h-11 w-11 place-items-center rounded-full transition-transform hover:scale-110 active:scale-95 motion-reduce:transform-none"
                    >
                      <Star
                        size={22}
                        className={n <= shownStars ? "fill-accent text-accent" : "text-ink-subtle"}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5 p-6">
            {t.hasPendingUpdate && (
              <div className="flex max-w-[70ch] items-start gap-2.5 rounded-md bg-surface px-3.5 py-3 text-[15.5px] leading-[22px] text-ink-muted ring-1 ring-edge-soft">
                <RefreshCw size={18} className="mt-0.5 shrink-0 text-ink-subtle" />
                <span>
                  <span className="font-semibold text-ink">{tr("Update queued.")}</span>{" "}
                  {tr(
                    "The author submitted a new version that's in review. You're seeing the current published version until it's approved.",
                  )}
                </span>
              </div>
            )}

            {t.screenshots.length > 0 && (
              <div className="flex flex-col gap-2.5">
                {t.screenshots.map((s, i) => (
                  <img
                    key={i}
                    src={s}
                    alt=""
                    loading="lazy"
                    className="w-full rounded-md ring-1 ring-edge-soft"
                  />
                ))}
              </div>
            )}

            <div className="h-px bg-edge-soft" />

            <CommentsSection themeId={t.id} />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
