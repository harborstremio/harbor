import { Cast, Loader2, Subtitles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { discoverCastDevices, type CastDeviceInfo } from "@/lib/cast";
import { useT } from "@/lib/i18n";
import { CastIcon } from "./cast-icon";
import { noteOverlayDismiss } from "@/lib/player/overlay-dismiss";

export function CastMenu({
  open,
  anchor,
  onClose,
  onPick,
  hasActiveSub,
  burnSubsOnTv,
  setBurnSubsOnTv,
}: {
  open: boolean;
  anchor: { right: number; bottom: number } | null;
  onClose: () => void;
  onPick: (device: CastDeviceInfo) => void;
  hasActiveSub: boolean;
  burnSubsOnTv: boolean;
  setBurnSubsOnTv: (next: boolean) => void;
}) {
  const t = useT();
  const [devices, setDevices] = useState<CastDeviceInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setDevices([]);
    void discoverCastDevices()
      .then((rows) => {
        if (cancelled) return;
        setDevices(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, scanCount]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      noteOverlayDismiss();
      if (!wrapRef.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={wrapRef}
      onMouseDown={(e) => e.stopPropagation()}
      className="animate-menu-pop fixed z-[140] w-[320px] rounded-md bg-elevated p-4 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]"
      style={{
        right: anchor ? window.innerWidth - anchor.right : 24,
        bottom: anchor ? window.innerHeight - anchor.bottom + 82 : 150,
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2 text-[12.5px] font-semibold text-ink">
          <Cast size={13} strokeWidth={2.4} />
          {t("Cast to TV or speaker")}
        </span>
        <button
          onClick={onClose}
          aria-label={t("Close")}
          className="flex h-6 w-6 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
        >
          <X size={13} />
        </button>
      </div>
      {hasActiveSub && (
        <>
          <button
            type="button"
            role="switch"
            aria-checked={burnSubsOnTv}
            onClick={() => setBurnSubsOnTv(!burnSubsOnTv)}
            className="group mb-2 flex w-full items-start gap-3 rounded-xl border border-edge-soft bg-canvas/40 px-3 py-2.5 text-start transition-colors hover:border-edge hover:bg-canvas/55"
          >
            <span
              className={`mt-0.5 flex h-[18px] w-8 shrink-0 items-center rounded-full px-[3px] transition-colors duration-200 ${
                burnSubsOnTv ? "bg-accent" : "bg-raised"
              }`}
            >
              <span
                className={`h-3 w-3 rounded-full bg-canvas shadow-sm transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  burnSubsOnTv ? "translate-x-[14px] rtl:-translate-x-[14px]" : "translate-x-0"
                }`}
              />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
                <Subtitles
                  size={12.5}
                  strokeWidth={2.4}
                  className={burnSubsOnTv ? "text-accent" : "text-ink-subtle"}
                />
                {t("Burn in subtitles")}
              </span>
              <span className="text-[11px] leading-snug text-ink-subtle">
                {burnSubsOnTv
                  ? t("Subtitles are baked into the picture so they always show. Re-encodes the video.")
                  : t("Subtitles may not appear on the TV.")}
              </span>
            </span>
          </button>
          <div className="mb-2 h-px bg-edge-soft" />
        </>
      )}
      {loading ? (
        <div className="flex items-center gap-2 px-1 py-3 text-[12.5px] text-ink-muted">
          <Loader2 size={13} strokeWidth={2.2} className="animate-spin" />
          {t("Scanning your network…")}
        </div>
      ) : devices.length === 0 ? (
        <div className="flex flex-col gap-2 px-1 py-3">
          <p className="text-[12.5px] text-ink-muted">
            {t("No Chromecast, DLNA, or Roku devices found. Make sure your TV is on, woken up, and on the same Wi-Fi.")}
          </p>
          <button
            onClick={() => setScanCount((c) => c + 1)}
            className="self-start rounded-md border border-edge-soft px-2 py-1 text-[11.5px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink"
          >
            {t("Scan again")}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {devices.map((d) => (
            <button
              key={d.id}
              onClick={() => onPick(d)}
              className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-start transition-colors hover:bg-canvas/65"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-canvas/55 p-1">
                <CastIcon device={d} size={28} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-1.5 truncate text-[13px] font-medium text-ink">
                  <span className="truncate">{d.name}</span>
                  {d.audio_only && (
                    <span className="shrink-0 rounded-md bg-accent/20 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.12em] text-accent">
                      {t("Audio")}
                    </span>
                  )}
                </span>
                <span className="truncate text-[11px] text-ink-subtle">
                  {d.kind === "dlna" ? d.model ?? t("DLNA TV") : d.model || `${d.host}:${d.port}`}
                </span>
              </div>
            </button>
          ))}
          <button
            onClick={() => setScanCount((c) => c + 1)}
            className="mt-1 self-start rounded-md px-2 py-1 text-[11px] font-medium text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
          >
            {t("Rescan")}
          </button>
        </div>
      )}
    </div>
  );
}
