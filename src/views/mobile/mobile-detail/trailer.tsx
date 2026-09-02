import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { prefersReducedMotion } from "./data";

export function MobileTrailerOverlay({
  id,
  title,
  onClose,
}: {
  id: string;
  title: string;
  onClose: () => void;
}) {
  const t = useT();
  const [reduced] = useState(prefersReducedMotion);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const params = new URLSearchParams({
    autoplay: "1",
    modestbranding: "1",
    rel: "0",
    iv_load_policy: "3",
    playsinline: "1",
    fs: "1",
  });
  const proto = typeof window !== "undefined" ? (window.location?.protocol ?? "") : "";
  if (/^https?:$/.test(proto) && window.location?.origin) {
    params.set("origin", window.location.origin);
  }

  const node = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("{title} trailer", { title })}
      onClick={onClose}
      className={`fixed inset-0 z-[120] flex items-center justify-center bg-black/90 px-4 ${
        reduced ? "" : "md-sheet-fade"
      }`}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t("Close trailer")}
        className="absolute end-4 grid h-11 w-11 place-items-center rounded-full bg-canvas/90 text-ink shadow-[0_8px_22px_-8px_rgba(0,0,0,0.6)] transition-transform active:scale-95 motion-reduce:transition-none"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
      >
        <X size={19} strokeWidth={2.4} />
      </button>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative aspect-video w-full max-w-[720px] overflow-hidden rounded-2xl bg-black shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] ${
          reduced ? "" : "md-zoom-in"
        }`}
      >
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`}
          title={t("{title} trailer", { title })}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
    </div>
  );
  return typeof document !== "undefined" ? createPortal(node, document.body) : node;
}
