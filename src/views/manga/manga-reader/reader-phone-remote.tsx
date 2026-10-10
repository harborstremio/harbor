import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { Check, Copy, Smartphone, X } from "lucide-react";
import { mangaRemoteUiUrl } from "@/lib/remote/protocol";
import { QR_DARK, QR_LIGHT, buildHandoffQr } from "@/lib/tv-handoff/handoff-qr";
import { Tooltip } from "@/views/detail/tooltip";
import { useT } from "@/lib/i18n";

export function PhoneRemoteButton() {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Tooltip label={t("Control from your phone")} side="bottom">
        <button
          type="button"
          onClick={() => setOpen(true)}
          onMouseDown={(e) => e.preventDefault()}
          aria-label={t("Control from your phone")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-muted transition duration-150 hover:bg-elevated hover:text-ink active:scale-90"
        >
          <Smartphone className="h-5 w-5" strokeWidth={2.2} />
        </button>
      </Tooltip>
      {open && <PhoneRemoteModal onClose={() => setOpen(false)} />}
    </>
  );
}

function Qr({ url }: { url: string }) {
  const qr = useMemo(() => buildHandoffQr(url), [url]);
  if (!qr) return null;
  return (
    <svg
      viewBox={qr.viewBox}
      shapeRendering="crispEdges"
      className="h-full w-full"
      role="img"
      aria-hidden
    >
      <rect width={qr.extent} height={qr.extent} rx={1.5} fill={QR_LIGHT} />
      <path d={qr.path} fill={QR_DARK} />
    </svg>
  );
}

function PhoneRemoteModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [lanIp, setLanIp] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
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
  }, []);

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

        {loading ? (
          <div className="mt-5 h-[52px] animate-pulse rounded-xl bg-elevated motion-reduce:animate-none" />
        ) : url ? (
          <div className="mt-5 flex flex-col items-center gap-3">
            <span className="block h-[160px] w-[160px] shrink-0 overflow-hidden rounded-xl border border-edge-soft bg-white p-1.5">
              <Qr url={url} />
            </span>
            <p className="text-center text-[12.5px] leading-relaxed text-ink-muted">
              {t("Scan with your phone camera, or type the address below.")}
            </p>
            <div className="flex w-full items-center gap-2 rounded-xl border border-edge-soft bg-canvas px-3.5 py-3">
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
