import { useState } from "react";
import { createPortal } from "react-dom";
import { Check, Download, Loader2, Share2, Star, X } from "lucide-react";
import { downloadTheme, rateTheme, type StoreTheme } from "@/lib/theme-store";

export function CommunityDetail({ theme, onClose }: { theme: StoreTheme; onClose: () => void }) {
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

  return createPortal(
    <div className="fixed inset-0 z-[230] flex items-center justify-center p-6">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-canvas/70 backdrop-blur-sm"
      />
      <div className="modal-panel relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-edge-soft bg-elevated shadow-[0_30px_90px_-30px_rgba(0,0,0,0.8)]">
        <button
          onClick={onClose}
          className="absolute end-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-canvas/80 text-ink-muted backdrop-blur-md transition-colors hover:text-ink"
        >
          <X size={16} />
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
              <p className="text-[13px] text-ink-subtle">
                by {t.author} · {t.downloads} downloads · {t.ratingAvg || "-"}/5 ({t.ratingCount})
              </p>
            </div>
            {t.blurb && <p className="text-[14px] leading-relaxed text-ink-muted">{t.blurb}</p>}

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={download}
                disabled={downloading || done}
                className={`flex h-11 items-center gap-2 rounded-xl px-5 text-[14px] font-semibold transition-colors disabled:opacity-90 ${
                  done ? "bg-emerald-400 text-black" : "bg-ink text-canvas hover:opacity-90"
                }`}
              >
                {downloading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : done ? (
                  <Check key="done" size={16} className="harbor-pop" />
                ) : (
                  <Download size={16} />
                )}
                {done ? "Added to library" : downloading ? "Downloading…" : "Download"}
              </button>
              <button
                onClick={share}
                className="flex h-11 items-center gap-2 rounded-xl border border-edge-soft px-4 text-[13.5px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink"
              >
                {copied ? <Check size={15} /> : <Share2 size={15} />} {copied ? "Copied" : "Share"}
              </button>
              <div
                className="ms-auto flex items-center gap-0.5"
                role="group"
                aria-label="Rate this theme"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => rate(n)}
                    aria-label={`Rate ${n} stars`}
                    className="p-0.5"
                  >
                    <Star
                      size={20}
                      className={
                        n <= shownRating ? "fill-amber-300 text-amber-300" : "text-ink-subtle"
                      }
                    />
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-[12.5px] text-danger">{error}</p>}

            {t.screenshots.length > 0 && (
              <div className="flex flex-col gap-2.5">
                {t.screenshots.map((s, i) => (
                  <img
                    key={i}
                    src={s}
                    alt=""
                    loading="lazy"
                    className="w-full rounded-xl border border-edge-soft"
                  />
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
