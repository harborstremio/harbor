import { createPortal } from "react-dom";
import { useEffect } from "react";
import { FileJson, FolderInput, FolderPlus, Images, ShieldCheck, X } from "lucide-react";
import { useT } from "@/lib/i18n";

export function AvatarPackHelp({ onClose }: { onClose: () => void }) {
  const t = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const steps = [
    { icon: FolderPlus, title: t("Import images"), body: t("Pick one or many images. They collect in an Uploads set in your library. PNG, JPG, WebP, and GIF all work.") },
    { icon: FolderInput, title: t("Import a folder, keep your sets"), body: t("Label the subfolders inside the folder you pick, and each one becomes its own set (like Heroes or Cats). Loose images in the folder go to Uploads.") },
    { icon: FileJson, title: t("Import or export a .json pack"), body: t("A pack file lists your images with names and sets. Point items at files next to the JSON, at http links, or inline them as data URIs. Hover a set you imported and press Export to write one out.") },
    { icon: Images, title: t("Square looks best"), body: t("Avatars display as squares, so square images fill the tile cleanly. Others are center-cropped.") },
    { icon: ShieldCheck, title: t("You own the content"), body: t("Nothing is uploaded and nothing ships with Harbor. Everything stays on this device and you are responsible for the images you add.") },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[310] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 animate-in fade-in bg-black/60 duration-150" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex w-full max-w-[440px] animate-in fade-in zoom-in-95 flex-col overflow-hidden rounded-[16px] border border-edge bg-surface shadow-[0_24px_70px_-20px_rgba(0,0,0,0.85)] duration-150"
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="font-display text-[18px] font-semibold tracking-tight text-ink">
              {t("About avatar packs")}
            </h2>
            <p className="text-[12px] text-ink-subtle">{t("Bring your own avatars into the library.")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-ink-muted transition-colors hover:bg-elevated hover:text-ink active:scale-95 motion-reduce:active:scale-100"
          >
            <X size={17} strokeWidth={2.2} />
          </button>
        </div>
        <div className="flex flex-col gap-2.5 px-6 pb-4">
          {steps.map((s, i) => (
            <div key={i} className="flex items-start gap-3 rounded-[11px] border border-edge-soft bg-canvas/40 px-3.5 py-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-elevated text-ink-muted">
                <s.icon size={16} strokeWidth={2} />
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] font-semibold text-ink">{s.title}</span>
                <span className="text-[12px] leading-relaxed text-ink-muted">{s.body}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-edge-soft px-6 py-3">
          <p className="text-[11.5px] leading-relaxed text-ink-subtle">
            {t("Full pack format reference: docs/avatar-packs.md in the Harbor repository.")}
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
