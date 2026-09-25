import { Check, Copy, Link, Share2, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";
import { copyText } from "@/components/player/copy-link-button";
import { useCollection } from "@/lib/collections";
import { setCollectionPublication } from "@/lib/collection-publication";
import { captureMembershipProfile } from "@/lib/membership-operations";
import { authToken } from "@/lib/theme-auth";
import { collectionCode, collectionShareUrl } from "@/lib/social/collections-sync";
import { useCurrentHandle } from "./community-share-button";

function CopyField({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon?: React.ReactNode;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    const ok = await copyText(value);
    if (!ok) {
      setError(t("Could not copy. Select and copy the text manually."));
      return;
    }
    setError("");
    setCopied(true);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-subtle">
        {icon}
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          value={value}
          readOnly
          spellCheck={false}
          onFocus={(e) => e.currentTarget.select()}
          className="h-11 w-full min-w-0 flex-1 rounded-xl border border-edge bg-canvas px-3.5 text-[14px] text-ink outline-none transition-colors focus:border-ink"
        />
        <button
          type="button"
          onClick={() => void copy()}
          aria-label={copied ? t("Copied") : t("Copy")}
          className={`flex h-11 shrink-0 items-center gap-1.5 rounded-xl border px-3.5 text-[13px] font-semibold transition-colors ${
            copied
              ? "border-success/40 bg-success/12 text-success"
              : "border-edge bg-raised text-ink hover:bg-elevated"
          }`}
        >
          {copied ? <Check size={16} strokeWidth={2.6} /> : <Copy size={16} strokeWidth={2} />}
          {copied ? t("Copied") : t("Copy")}
        </button>
      </div>
      <p className="text-[12.5px] leading-snug text-ink-muted">{helper}</p>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function CommunityShareModal({
  collectionId,
  onClose,
}: {
  collectionId: string;
  onClose: () => void;
}) {
  const t = useT();
  const handle = useCurrentHandle();
  const [profile] = useState(captureMembershipProfile);
  const [token] = useState(authToken);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const collection = useCollection(collectionId);
  const shared = collection?.shared === true;
  const isSaved = !!(collection?.sourceHandle && collection?.sourceId);
  const linkHandle = collection?.sourceHandle || handle || "";
  const linkId = collection?.sourceId || collectionId;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggleShared = async () => {
    if (busy) return;
    if (!profile || !token) {
      setError(t("Sign in and reopen the share dialog."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await setCollectionPublication({ collectionId, shared: !shared, profile, token });
    } catch (error) {
      setError(error instanceof Error ? t(error.message) : t("Could not publish the collection."));
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-[230] flex items-center justify-center bg-canvas/80"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-modal-in flex w-[min(92vw,440px)] flex-col gap-5 rounded-2xl border border-edge-soft bg-elevated p-7 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
            <Share2 size={18} strokeWidth={2} />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="font-display text-[20px] font-medium leading-tight tracking-tight text-ink">
              {t("Share collection")}
            </h2>
            {collection?.name && (
              <p className="truncate text-[13px] text-ink-muted">{collection.name}</p>
            )}
          </div>
        </div>

        {handle ? (
          <>
            <CopyField
              label={t("Link")}
              value={collectionShareUrl(linkHandle, linkId)}
              helper={t(
                "Anyone with the link can open this collection once your Harbor server is live.",
              )}
              icon={<Link size={12} strokeWidth={2} />}
            />

            <CopyField
              label={t("Code")}
              value={collectionCode(linkHandle, linkId)}
              helper={t("Paste this code into Harbor to open the collection.")}
            />

            {isSaved ? (
              <div className="flex items-start gap-2.5 border-t border-edge-soft pt-5 text-[12.5px] leading-snug text-ink-muted">
                <Users size={15} strokeWidth={2} className="mt-0.5 shrink-0" />
                <p>
                  {t(
                    "Saved from @{handle}. You can share their link, but only they can list it in the community.",
                    { handle: collection?.sourceHandle ?? "" },
                  )}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 border-t border-edge-soft pt-5">
                <button
                  type="button"
                  onClick={() => void toggleShared()}
                  disabled={busy}
                  aria-pressed={shared}
                  className={`flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-[14px] font-semibold transition-colors ${
                    shared
                      ? "border-accent/40 bg-accent/12 text-accent"
                      : "border-edge bg-raised text-ink hover:bg-elevated"
                  }`}
                >
                  {shared ? (
                    <Check size={16} strokeWidth={2.6} />
                  ) : (
                    <Users size={16} strokeWidth={2} />
                  )}
                  {busy
                    ? t("Saving…")
                    : shared
                      ? t("Shared to the community")
                      : t("Share to the community")}
                </button>
                {error && (
                  <p role="alert" className="text-xs text-danger">
                    {error}
                  </p>
                )}
                <p className="text-[12.5px] leading-snug text-ink-muted">
                  {t("Listed collections will appear in community browse when that rolls out.")}
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="rounded-xl border border-edge-soft bg-canvas px-4 py-6 text-center text-[13.5px] text-ink-muted">
            {t("Sign in to get a shareable link.")}
          </p>
        )}

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 items-center rounded-xl border border-edge bg-raised px-5 text-[14px] font-semibold text-ink transition-colors hover:bg-elevated"
          >
            {t("Done")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
