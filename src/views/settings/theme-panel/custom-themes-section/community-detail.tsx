import { useEffect, useState } from "react";
import { useEscape, useModalExit } from "@/components/modal-shell";
import { createPortal } from "react-dom";
import { Check, Download, Loader2, Share2, Star, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { downloadTheme, rateTheme, type StoreTheme } from "@/lib/theme-store";
import { subscribeOpenProfile } from "@/lib/social/open-profile";
import { ThemeAuthorButton } from "./theme-author-button";

export function CommunityDetail({ theme, onClose }: { theme: StoreTheme; onClose: () => void }) {
  const tr = useT();
  const { closing, close } = useModalExit(onClose);
  useEscape(close);
  useEffect(() => subscribeOpenProfile(close), [close]);
  const [t, setT] = useState(theme);
  const [downloading, setDownloading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myRating, setMyRating] = useState(0);
  const [copied, setCopied] = useState(false);

  const download = async () => {
    setDownloading(true);
    setError(null);
    try {
      await downloadTheme(t.id, t.cover ?? t.screenshots[0] ?? null);
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDownloading(false);
    }
  };

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
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const shownRating = myRating || Math.round(t.ratingAvg);
  const authorName = t.author || tr("Anonymous");
  const authorMarker = "\uFFFC";
  const [authorPrefix, authorSuffix = ""] = tr("by {author}", {
    author: authorMarker,
  }).split(authorMarker);

  return createPortal(
    <div
      className={`${closing ? "animate-scrim-out" : "animate-scrim-in"} fixed inset-0 z-[244] flex items-center justify-center p-6`}
    >
      <button
        aria-label={tr("Close")}
        onClick={close}
        className="absolute inset-0 cursor-default bg-canvas/70 backdrop-blur-sm"
      />
      <div
        className={`modal-panel ${closing ? "animate-dialog-out" : "animate-dialog-in"} relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-md bg-elevated harbor-float`}
      >
        <button
          aria-label={tr("Close")}
          onClick={close}
          className="absolute end-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-canvas/80 text-ink-muted backdrop-blur-md transition-colors hover:text-ink"
        >
          <X size={18} />
        </button>
        <div className="overflow-y-auto [scrollbar-width:thin]">
          {t.cover && <img src={t.cover} alt="" className="aspect-video w-full object-cover" />}
          <div className="flex flex-col gap-4 p-6">
            <div>
              <div className="flex items-center gap-1.5">
                {t.swatch.map((c, i) => (
                  <span key={i} className="h-4 w-4 rounded" style={{ background: c }} />
                ))}
              </div>
              <h2 className="mt-2 font-display text-[26px] font-medium leading-tight text-ink">
                {t.name}
              </h2>
              <p className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-subtle">
                {t.authorHandle ? (
                  <>
                    {authorPrefix}
                    <ThemeAuthorButton handle={t.authorHandle} name={authorName} />
                    {authorSuffix}
                  </>
                ) : (
                  tr("by {author}", { author: authorName })
                )}{" "}
                ·{" "}
                {t.downloads === 1
                  ? tr("1 download")
                  : tr("{count} downloads", { count: t.downloads })}{" "}
                · {tr("{rating}/5 ({count})", { rating: t.ratingAvg || "-", count: t.ratingCount })}
              </p>
            </div>
            {t.blurb && (
              <p className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-muted">{t.blurb}</p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={download}
                disabled={downloading || done}
                className={`flex h-11 items-center gap-2 rounded-md px-5 text-[15.5px] font-semibold transition-colors disabled:opacity-90 ${
                  done ? "bg-success text-canvas" : "bg-ink text-canvas hover:opacity-90"
                }`}
              >
                {downloading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : done ? (
                  <Check key="done" size={18} className="harbor-pop" />
                ) : (
                  <Download size={18} />
                )}
                {done ? tr("Added to library") : downloading ? tr("Downloading…") : tr("Download")}
              </button>
              <button
                onClick={share}
                className="flex h-11 items-center gap-2 rounded-md px-4 text-[15.5px] font-medium text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
              >
                {copied ? <Check size={18} /> : <Share2 size={18} />}{" "}
                {copied ? tr("Copied") : tr("Share")}
              </button>
              <div
                className="ms-auto flex items-center gap-0.5"
                role="group"
                aria-label={tr("Rate this theme")}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => rate(n)}
                    aria-label={tr("Rate {count} stars", { count: n })}
                    className="grid h-11 w-11 place-items-center"
                  >
                    <Star
                      size={20}
                      className={
                        n <= shownRating ? "fill-accent text-accent" : "text-ink-subtle"
                      }
                    />
                  </button>
                ))}
              </div>
            </div>
            {error && (
              <p className="max-w-[66ch] text-[15.5px] leading-[22px] text-danger">{error}</p>
            )}

            {t.screenshots.length > 0 && (
              <div className="flex flex-col gap-2.5">
                {t.screenshots.map((s, i) => (
                  <img key={i} src={s} alt="" loading="lazy" className="w-full rounded-md" />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
