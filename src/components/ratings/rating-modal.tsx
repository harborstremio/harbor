import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, Trash2, X } from "lucide-react";
import { Poster } from "@/components/poster";
import { useT } from "@/lib/i18n";
import { authToken } from "@/lib/theme-auth";
import { useView } from "@/lib/view";
import { useRating } from "@/lib/ratings/store";
import { rate, unrate } from "@/lib/ratings/actions";
import type { RatingTarget } from "@/lib/ratings/types";
import { emitListToast } from "@/components/lists/list-toast";
import { RatingStars } from "./rating-stars";

const REVIEW_MAX = 4000;

function errorText(e: unknown, t: (s: string) => string, action: "save" | "remove"): string {
  const status = (e as { status?: number })?.status;
  const msg = (e as { message?: string })?.message;
  if (status === 401) return t("Sign in to rate");
  if (msg === "blocked_text") return t("Your review contains language that is not allowed");
  if (status === 429) return t("You are rating too fast, try again in a moment");
  if (status === undefined) return t("Couldn't reach Harbor, check your connection");
  if (status >= 500) return t("Harbor is having trouble, try again in a moment");
  return action === "remove" ? t("Could not remove your rating") : t("Could not save your rating");
}

export function RatingModal({ target, onClose }: { target: RatingTarget; onClose: () => void }) {
  const t = useT();
  const { openSettings } = useView();
  const signedIn = !!authToken();
  const existing = useRating(target.itemKey);
  const [selected, setSelected] = useState(existing?.score ?? 0);
  const [hover, setHover] = useState(0);
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState(!!existing?.review);
  const [draft, setDraft] = useState(existing?.review ?? "");
  const [spoiler, setSpoiler] = useState(existing?.spoiler ?? false);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => {
    if (reviewing) requestAnimationFrame(() => areaRef.current?.focus());
  }, [reviewing]);

  const display = hover || selected || 0;
  const dirty =
    selected !== (existing?.score ?? 0) ||
    (reviewing && (draft !== (existing?.review ?? "") || spoiler !== (existing?.spoiler ?? false)));

  const save = async () => {
    if (busy || !selected) return;
    setBusy(true);
    try {
      await rate(target, selected, {
        review: reviewing ? draft : existing?.review,
        spoiler: reviewing ? spoiler : existing?.spoiler,
      });
      emitListToast(t("Rating saved"));
      onClose();
    } catch (e) {
      emitListToast(errorText(e, t, "save"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await unrate(target.itemKey);
      emitListToast(t("Rating removed"));
      onClose();
    } catch (e) {
      emitListToast(errorText(e, t, "remove"));
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-[200] flex items-center justify-center bg-canvas/85 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t("Rate this")}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-modal-in relative flex w-full max-w-[420px] flex-col overflow-hidden rounded-3xl border border-edge-soft bg-surface shadow-[0_30px_120px_-30px_rgba(0,0,0,0.85)]"
      >
        <button
          onClick={onClose}
          aria-label={t("Close")}
          className="absolute end-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
        >
          <X size={16} strokeWidth={2} />
        </button>

        <div className="flex flex-col items-center gap-4 px-6 pb-6 pt-8">
          <div className="flex w-full items-center gap-3">
            <div className="w-12 shrink-0">
              <Poster
                src={target.poster}
                seed={target.title}
                ratio="portrait"
                lazy
                className="rounded-lg ring-1 ring-edge-soft"
              />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                {t("Your rating")}
              </div>
              <div className="line-clamp-2 text-[15px] font-semibold leading-tight text-ink">
                {target.title}
              </div>
            </div>
          </div>

          {!signedIn && (
            <>
              <div className="flex flex-col items-center gap-1.5 py-2 text-center">
                <div className="text-[15px] font-semibold text-ink">
                  {t("Ratings need a Harbor account")}
                </div>
                <div className="max-w-[300px] text-[13px] leading-relaxed text-ink-subtle">
                  {t(
                    "Your Harbor account is separate from your Stremio sign in. Create one free or sign in from Settings.",
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  openSettings("account");
                }}
                className="flex h-11 w-full items-center justify-center rounded-xl bg-ink text-[14px] font-semibold text-canvas transition-transform hover:scale-[1.01] active:scale-[0.98]"
              >
                {t("Open account settings")}
              </button>
            </>
          )}

          {signedIn && (
            <>
              <div className="flex flex-col items-center gap-2 py-1">
                <div className="flex h-12 items-end gap-1.5" onMouseLeave={() => setHover(0)}>
                  <span
                    key={display}
                    className="harbor-pop text-[40px] font-bold leading-none tabular-nums text-ink"
                  >
                    {display || "–"}
                  </span>
                  <span className="pb-1 text-[15px] font-medium text-ink-subtle">/10</span>
                </div>
                <RatingStars
                  value={selected}
                  size={30}
                  onChange={setSelected}
                  onHover={setHover}
                  ariaLabel={t("Your rating")}
                />
                <div className="h-4 text-[12px] text-ink-subtle">
                  {selected ? t("Tap a star to change, then save") : t("Tap a star to rate")}
                </div>
              </div>

              {!reviewing ? (
                <button
                  type="button"
                  onClick={() => setReviewing(true)}
                  className="text-[13px] font-medium text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
                >
                  {existing?.review ? t("Edit your review") : t("Add a review")}
                </button>
              ) : (
                <div className="flex w-full flex-col gap-2.5">
                  <textarea
                    ref={areaRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value.slice(0, REVIEW_MAX))}
                    placeholder={t("Share your thoughts (optional)")}
                    rows={4}
                    className="w-full resize-y rounded-xl bg-canvas/60 p-3 text-[14px] leading-relaxed text-ink outline-none ring-1 ring-edge-soft placeholder:text-ink-subtle focus-visible:ring-2 focus-visible:ring-ink/30"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSpoiler((v) => !v)}
                      aria-pressed={spoiler}
                      className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-medium ring-1 transition-colors ${
                        spoiler
                          ? "bg-ink/10 text-ink ring-ink/25"
                          : "text-ink-muted ring-edge-soft hover:bg-canvas/60"
                      }`}
                    >
                      <span
                        className={`grid h-3.5 w-3.5 place-items-center rounded-[4px] ring-1 ${spoiler ? "bg-ink ring-ink" : "ring-edge"}`}
                      >
                        {spoiler && <Check size={10} className="text-canvas" />}
                      </span>
                      {t("Contains spoilers")}
                    </button>
                    <span className="text-[11px] tabular-nums text-ink-subtle">
                      {draft.length}/{REVIEW_MAX}
                    </span>
                  </div>
                </div>
              )}

              <div className="mt-1 flex w-full items-center gap-2">
                {existing && (
                  <button
                    type="button"
                    onClick={remove}
                    disabled={busy}
                    aria-label={t("Remove rating")}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-ink-subtle ring-1 ring-edge-soft transition-colors hover:bg-elevated hover:text-danger disabled:opacity-40"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={save}
                  disabled={busy || !selected || !dirty}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-ink text-[14px] font-semibold text-canvas transition-transform hover:scale-[1.01] active:scale-[0.98] disabled:opacity-40"
                >
                  {busy && <Loader2 size={15} className="animate-spin" />}
                  {existing ? t("Save changes") : t("Save rating")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
