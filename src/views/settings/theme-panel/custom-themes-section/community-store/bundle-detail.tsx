import { useEffect, useState } from "react";
import { useModalExit } from "@/components/modal-shell";
import { createPortal } from "react-dom";
import { Check, Flag, Package, Share2, Star, X } from "../../../icons";
import { useT } from "@/lib/i18n";
import { isBackKey } from "@/lib/keyboard-navigation/geometry";
import {
  getBundle,
  installBundle,
  rateBundle,
  reportBundle,
  type StoreBundle,
} from "@/lib/bundle-store";
import { fmtCount } from "./format";
import { BundleFit } from "./market/bundle-fit";
import { PackContents } from "./market/pack-contents";
import { MarketCta } from "./market/market-cta";
import { useAcquireState } from "./market/use-acquire";

const KIND_LABEL: Record<StoreBundle["kind"], string> = {
  badge: "Badge pack",
  award: "Award pack",
};

export function BundleDetail({ bundle, onClose }: { bundle: StoreBundle; onClose: () => void }) {
  const tr = useT();
  const { closing, close } = useModalExit(onClose);
  const [t, setT] = useState(bundle);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [myRating, setMyRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [copied, setCopied] = useState(false);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isBackKey(e)) {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [close]);

  const { state, run } = useAcquireState(async () => {
    setErrMsg(null);
    try {
      installBundle(t);
      const fresh = await getBundle(t.id).catch(() => null);
      if (fresh) setT(fresh);
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : tr("Install failed."));
      throw e;
    }
  });

  const rate = async (v: number) => {
    setMyRating(v);
    try {
      setT(await rateBundle(t.id, v));
    } catch {}
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(t.share);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const report = async () => {
    if (reported) return;
    try {
      await reportBundle(t.id);
      setReported(true);
    } catch {}
  };

  const shownStars = hover || myRating || Math.round(t.ratingAvg);

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
          className="absolute end-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white/90 backdrop-blur-md transition-colors hover:bg-black/65 hover:text-white"
        >
          <X size={20} />
        </button>

        <div className="min-h-0 overflow-y-auto [scrollbar-width:thin]">
          <div className="relative">
            <div className="aspect-video w-full overflow-hidden">
              <BundleFit bundle={t} size="hero" />
            </div>
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.92)_0%,rgba(0,0,0,0.52)_30%,rgba(0,0,0,0.1)_58%,transparent_80%)]" />
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-6">
              <span className="inline-flex h-[22px] w-fit items-center gap-1.5 rounded-full bg-white/12 px-2.5 text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px] text-white backdrop-blur-sm">
                <Package size={14} /> {tr(KIND_LABEL[t.kind])}
              </span>
              <h2 className="font-display text-[clamp(24px,3.4vw,34px)] font-medium leading-tight tracking-tight text-white [text-shadow:0_2px_20px_rgba(0,0,0,0.5)]">
                {t.name}
              </h2>
              <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[15.5px] leading-[22px] font-medium text-white/80">
                <span className="inline-flex items-center gap-1.5">
                  {t.authorAvatar && (
                    <img
                      src={t.authorAvatar}
                      alt=""
                      className="h-5 w-5 rounded-full object-cover ring-1 ring-white/25"
                    />
                  )}
                  {tr("by {author}", { author: t.author || tr("Anonymous") })}
                </span>
                <span className="text-white/40">·</span>
                <span className="tabular-nums">
                  {tr("{count} installs", { count: fmtCount(t.downloads) })}
                </span>
                <span className="text-white/40">·</span>
                <span className="tabular-nums">
                  {tr("{count} icons", { count: t.icons.length })}
                </span>
                {t.ratingCount > 0 && (
                  <>
                    <span className="text-white/40">·</span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Star size={15} className="fill-accent text-accent" />
                      {t.ratingAvg.toFixed(1)} ({t.ratingCount})
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-5 p-6">
            <div className="flex flex-wrap items-center gap-3">
              <MarketCta
                variant="acquire"
                size="lg"
                state={state}
                onClick={run}
                label={tr("Install pack")}
              />
              <MarketCta variant="ghost" size="lg" onClick={share}>
                {copied ? <Check size={16} /> : <Share2 size={16} />}
                {copied ? tr("Copied") : tr("Share")}
              </MarketCta>
              <button
                type="button"
                onClick={report}
                disabled={reported}
                title={tr("Report this pack")}
                className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-[15.5px] font-medium text-ink-subtle transition-colors hover:bg-raised hover:text-ink disabled:opacity-60"
              >
                <Flag size={16} strokeWidth={2.2} /> {reported ? tr("Reported") : tr("Report")}
              </button>
              <div
                className="ms-auto flex items-center gap-0.5"
                role="group"
                aria-label={tr("Rate this pack")}
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
            {state === "error" && errMsg && (
              <p className="max-w-[70ch] text-[15.5px] leading-[22px] text-danger">{errMsg}</p>
            )}

            {t.description && (
              <p className="max-w-[70ch] text-[15.5px] leading-[22px] text-ink-muted">{t.description}</p>
            )}

            <div className="h-px bg-edge-soft" />

            <PackContents bundle={t} variant="detail" />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
