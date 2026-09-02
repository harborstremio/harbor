import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useT } from "@/lib/i18n";

export function EditFolderImagesModal({
  isOpen,
  onClose,
  initialCover,
  initialGif,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialCover: string | null;
  initialGif: string | null;
  onSave: (cover: string, gif: string) => void;
}) {
  const t = useT();
  const [cover, setCover] = useState(initialCover || "");
  const [gif, setGif] = useState(initialGif || "");

  useEffect(() => {
    if (isOpen) {
      setCover(initialCover || "");
      setGif(initialGif || "");
    }
  }, [isOpen, initialCover, initialGif]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="pointer-events-auto fixed inset-0 z-[170] flex items-center justify-center bg-black/72 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-[420px] flex-col gap-6 rounded-3xl border border-edge-soft bg-elevated/95 px-8 py-8 shadow-[0_30px_80px_-25px_rgba(0,0,0,0.85)] animate-in zoom-in-95 fade-in duration-200">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-[19px] font-medium tracking-tight text-ink">{t("Edit Folder Images")}</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas/40 text-ink-subtle transition-colors hover:bg-canvas/60 hover:text-ink"
            aria-label={t("Cancel")}
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-muted">{t("Cover Image URL")}</label>
            <input
              type="text"
              className="w-full rounded-lg border border-edge-soft bg-canvas/60 px-4 py-2.5 text-[14px] text-ink outline-none transition-colors focus:border-accent"
              value={cover}
              onChange={(e) => setCover(e.target.value)}
              placeholder="https://example.com/image.png"
              dir="ltr"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-muted">{t("Focus GIF URL")}</label>
            <input
              type="text"
              className="w-full rounded-lg border border-edge-soft bg-canvas/60 px-4 py-2.5 text-[14px] text-ink outline-none transition-colors focus:border-accent"
              value={gif}
              onChange={(e) => setGif(e.target.value)}
              placeholder="https://example.com/animation.gif"
              dir="ltr"
            />
          </div>

          <div className="mt-2 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="rounded-full border border-edge bg-transparent px-5 py-2 text-[13px] font-semibold text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
            >
              {t("Cancel")}
            </button>
            <button
              onClick={() => {
                onSave(cover.trim(), gif.trim());
                onClose();
              }}
              className="rounded-full bg-accent px-5 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {t("Save")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
