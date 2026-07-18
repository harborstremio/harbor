import { Check, ExternalLink, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { useMal } from "@/lib/mal/provider";

export function MalConnectModal({ onClose }: { onClose: () => void }) {
  const { connectState, beginConnect, submitCode, cancelConnect } = useMal();
  const t = useT();
  const [draftCode, setDraftCode] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    beginConnect();
  }, [beginConnect]);

  useEffect(() => {
    if (connectState.kind === "success") {
      const id = setTimeout(onClose, 1400);
      return () => clearTimeout(id);
    }
  }, [connectState.kind, onClose]);

  const onCancel = useCallback(() => {
    cancelConnect();
    onClose();
  }, [cancelConnect, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const verify = () => {
    if (draftCode.trim()) submitCode(draftCode);
  };

  const heading =
    connectState.kind === "success"
      ? t("Connected")
      : connectState.kind === "verifying"
        ? t("Verifying")
        : t("Authorize Harbor on MyAnimeList");

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[120] flex items-center justify-center bg-black/72 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="flex w-full max-w-[460px] flex-col gap-7 rounded-[24px] border border-edge-soft bg-elevated/95 px-9 py-9 shadow-[0_30px_80px_-25px_rgba(0,0,0,0.85)] animate-in zoom-in-95 fade-in duration-200">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.32em] text-ink-subtle">
              {t("Connect MyAnimeList")}
            </span>
            <h2 className="text-[20px] font-medium tracking-tight text-ink">{heading}</h2>
          </div>
          <button
            onClick={onCancel}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas/40 text-ink-subtle transition-colors hover:bg-canvas/60 hover:text-ink"
            aria-label={t("Cancel")}
          >
            <X size={16} />
          </button>
        </div>

        {connectState.kind === "idle" && (
          <p className="flex items-center gap-2 text-[12.5px] text-ink-subtle">
            <Loader2 size={13} className="animate-spin" />
            {t("Opening MyAnimeList...")}
          </p>
        )}

        {connectState.kind === "needs-code" && (
          <div className="flex flex-col gap-5">
            <p className="text-[13px] leading-relaxed text-ink-muted">
              {t(
                "A browser tab opened on MyAnimeList. Approve Harbor there, then copy the code or the page URL and paste it below.",
              )}
            </p>
            <textarea
              value={draftCode}
              onChange={(e) => setDraftCode(e.target.value)}
              placeholder={t("Paste the code or page URL")}
              autoFocus
              spellCheck={false}
              rows={3}
              className="resize-none rounded-xl border border-edge bg-elevated px-4 py-3 font-mono text-[12.5px] leading-relaxed text-ink outline-none placeholder:font-sans placeholder:text-ink-subtle/55 focus:border-ink"
            />
            <button
              onClick={verify}
              disabled={!draftCode.trim()}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-ink text-[13.5px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97] disabled:opacity-40 disabled:hover:scale-100"
            >
              {t("Connect")}
            </button>
            <button
              onClick={beginConnect}
              className="flex items-center gap-1.5 self-start text-[12.5px] text-ink-subtle transition-colors hover:text-ink"
            >
              {t("Open MyAnimeList again")}
              <ExternalLink size={12} strokeWidth={2.2} />
            </button>
          </div>
        )}

        {connectState.kind === "verifying" && (
          <p className="flex items-center gap-2 text-[12.5px] text-ink-subtle">
            <Loader2 size={13} className="animate-spin" />
            {t("Checking with MyAnimeList...")}
          </p>
        )}

        {connectState.kind === "success" && (
          <div className="flex items-center gap-3 rounded-xl bg-emerald-400/10 px-4 py-3 ring-1 ring-emerald-400/30">
            <Check size={16} strokeWidth={2.4} className="text-emerald-300" />
            <span className="text-[14px] text-ink">
              {connectState.session.userName
                ? t("Connected as {username}", { username: connectState.session.userName })
                : t("Connected to MyAnimeList")}
            </span>
          </div>
        )}

        {connectState.kind === "error" && (
          <div className="flex flex-col gap-3 rounded-xl border border-red-400/25 bg-red-400/8 p-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-[14px] font-medium text-ink">
                {t("Couldn't connect to MyAnimeList")}
              </span>
              <span className="text-[12.5px] text-ink-muted">{connectState.message}</span>
            </div>
            <button
              onClick={beginConnect}
              className="self-start rounded-lg bg-ink px-3.5 py-1.5 text-[12.5px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97]"
            >
              {t("Try again")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
