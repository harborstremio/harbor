import { useEffect, useMemo, useState } from "react";
import { useModalExit } from "@/components/modal-shell";
import { createPortal } from "react-dom";
import { ArrowDownToLine, Check, RefreshCw, Share2, Star, X } from "lucide-react";
import { downloadTheme, rateTheme, type StoreTheme } from "@/lib/theme-store";
import { FeaturedBadge } from "@/views/profile/profile-bits";
import { UserHoverCard } from "@/views/profile/user-hover-card";
import { subscribeOpenProfile } from "@/lib/social/open-profile";
import { fmtCount } from "./format";
import { CommentsSection } from "./comments/comments-section";
import { Fit } from "./market/fit";
import { PaletteSeam } from "./market/palette-seam";
import { MarketCta } from "./market/market-cta";
import { useAcquireState } from "./market/use-acquire";
import { tokensFromStoreTheme } from "./market/fit-palette";

export function ThemeDetail({ theme, onClose }: { theme: StoreTheme; onClose: () => void }) {
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
      if (e.key === "Escape") {
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

  return createPortal(
    <div className={`${closing ? "animate-scrim-out" : "animate-scrim-in"} fixed inset-0 z-[244] flex items-center justify-center p-4 sm:p-6`}>
      <button aria-label="Close" onClick={close} className="absolute inset-0 cursor-default bg-canvas/75 backdrop-blur-sm" />
      <div className={`modal-panel ${closing ? "animate-dialog-out" : "animate-dialog-in"} relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-md bg-elevated ring-1 ring-edge-soft harbor-float`}>
        <button
          onClick={close}
          aria-label="Close"
          className="absolute end-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-surface text-ink-muted ring-1 ring-edge-soft transition-colors hover:bg-raised hover:text-ink"
        >
          <X size={18} />
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
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] font-medium text-ink-subtle">
                  {t.ratingCount > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Star size={14} className="fill-accent text-accent" />
                      <span className="tabular-nums text-ink">{t.ratingAvg.toFixed(1)}</span>
                      <span className="tabular-nums">({t.ratingCount})</span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <ArrowDownToLine size={12} strokeWidth={2.2} />
                    {fmtCount(t.downloads)}
                  </span>
                  {t.authorHandle ? (
                    <UserHoverCard handle={t.authorHandle}>
                      <span className="cursor-pointer transition-colors hover:text-ink">
                        by {t.author || "Anonymous"}
                      </span>
                    </UserHoverCard>
                  ) : (
                    <span>by {t.author || "Anonymous"}</span>
                  )}
                </div>
              </div>

              <h2 className="font-display text-[clamp(24px,3vw,34px)] font-medium leading-tight tracking-tight text-ink">
                {t.name}
              </h2>

              {t.blurb && <p className="text-[13.5px] leading-relaxed text-ink-muted">{t.blurb}</p>}

              <PaletteSeam swatch={t.swatch} labeled />

              <div className="flex flex-wrap items-center gap-2.5">
                <MarketCta variant="acquire" size="md" state={state} onClick={run} label="Get theme" />
                <MarketCta variant="ghost" size="md" onClick={share}>
                  {copied ? <Check size={16} /> : <Share2 size={16} />}
                  {copied ? "Copied" : "Share"}
                </MarketCta>
              </div>

              <div className="flex items-center gap-2.5">
                <span className="text-[12.5px] font-medium text-ink-subtle">Rate this theme</span>
                <div className="flex items-center gap-0.5" role="group" aria-label="Rate this theme" onMouseLeave={() => setHover(0)}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => rate(n)}
                      onMouseEnter={() => setHover(n)}
                      aria-label={`Rate ${n} stars`}
                      className="p-0.5 transition-transform hover:scale-110 active:scale-95 motion-reduce:transform-none"
                    >
                      <Star size={20} className={n <= shownStars ? "fill-accent text-accent" : "text-ink-subtle"} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5 p-6">
            {t.hasPendingUpdate && (
              <div className="flex items-start gap-2.5 rounded-md bg-surface px-3.5 py-3 text-[12.5px] leading-relaxed text-ink-muted ring-1 ring-edge-soft">
                <RefreshCw size={16} className="mt-0.5 shrink-0 text-ink-subtle" />
                <span>
                  <span className="font-semibold text-ink">Update queued.</span> The author submitted a new version
                  that's in review. You're seeing the current published version until it's approved.
                </span>
              </div>
            )}

            {t.screenshots.length > 0 && (
              <div className="flex flex-col gap-2.5">
                {t.screenshots.map((s, i) => (
                  <img key={i} src={s} alt="" loading="lazy" className="w-full rounded-md ring-1 ring-edge-soft" />
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
