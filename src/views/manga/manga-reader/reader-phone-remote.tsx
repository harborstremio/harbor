import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { Check, Copy, Smartphone, X } from "lucide-react";
import { useSettings } from "@/lib/settings";
import { mangaRemoteUiUrl } from "@/lib/remote/protocol";
import { useT } from "@/lib/i18n";
import { ReaderIconButton, READER_ICON_CLASS, READER_ICON_STROKE } from "./reader-icon-button";

export function PhoneRemoteButton() {
  const t = useT();
  const { settings, update } = useSettings();
  const [open, setOpen] = useState(false);
  const enabled = settings.serveWebUi || settings.remoteControlEnabled;
  return (
    <>
      <ReaderIconButton label={t("Control from your phone")} onClick={() => setOpen(true)}>
        <Smartphone className={READER_ICON_CLASS} strokeWidth={READER_ICON_STROKE} />
      </ReaderIconButton>
      {open && (
        <PhoneRemoteModal
          enabled={enabled}
          onEnable={() => update({ remoteControlEnabled: true })}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function PhoneRemoteModal({
  enabled,
  onEnable,
  onClose,
}: {
  enabled: boolean;
  onEnable: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const [lanIp, setLanIp] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let alive = true;
    invoke<string | null>("lan_ip")
      .then((ip) => {
        if (alive) {
          setLanIp(ip ?? null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [enabled]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const url = lanIp ? mangaRemoteUiUrl(lanIp) : null;
  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* noop */
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/72 px-4 backdrop-blur-md animate-in fade-in duration-200 motion-reduce:animate-none"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-edge bg-surface p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-elevated text-ink">
              <Smartphone size={18} />
            </span>
            <h2 className="text-[17px] font-bold text-ink">{t("Read from your phone")}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Close")}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-muted">
          {t(
            "Open this link on a phone on the same Wi-Fi to flip pages, zoom, and pick chapters with gestures. Keep this reader open.",
          )}
        </p>

        {!enabled ? (
          <div className="mt-5 rounded-xl border border-edge-soft bg-canvas px-3.5 py-3 text-[13px] leading-relaxed text-ink-muted">
            <p>{t("Turn on Remote Control to use your phone as a manga reader remote.")}</p>
            <button
              type="button"
              onClick={onEnable}
              className="mt-3 flex h-9 items-center rounded-lg bg-ink px-3 text-[12.5px] font-semibold text-canvas transition-all hover:opacity-90 active:scale-[0.97]"
            >
              {t("Enable Remote Control")}
            </button>
          </div>
        ) : loading ? (
          <div className="mt-5 h-[52px] animate-pulse rounded-xl bg-elevated motion-reduce:animate-none" />
        ) : url ? (
          <div className="mt-5 flex items-center gap-2 rounded-xl border border-edge-soft bg-canvas px-3.5 py-3">
            <span className="min-w-0 flex-1 truncate font-mono text-[14px] text-ink">{url}</span>
            <button
              type="button"
              onClick={copy}
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-ink px-2.5 text-[12.5px] font-semibold text-canvas transition-all hover:opacity-90 active:scale-[0.97]"
            >
              {copied ? <Check size={14} strokeWidth={2.6} /> : <Copy size={14} />}
              {copied ? t("Copied") : t("Copy")}
            </button>
          </div>
        ) : (
          <p className="mt-5 rounded-xl border border-edge-soft bg-canvas px-3.5 py-3 text-[13px] leading-relaxed text-ink-muted">
            {t(
              "Couldn't detect your Wi-Fi address. Connect this computer to Wi-Fi, or find the phone remote link under Settings, Playback.",
            )}
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}
