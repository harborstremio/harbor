import { FileArchive, Folder, FolderOpen, Image as ImageIcon, X } from "lucide-react";
import { createPortal } from "react-dom";
import type { ComponentType } from "react";
import { useT } from "@/lib/i18n";

type IconType = ComponentType<{ size?: number; className?: string }>;

function TreeRow({
  depth,
  icon: Icon,
  label,
  hint,
  accent,
}: {
  depth: number;
  icon: IconType;
  label: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 py-[3px]" style={{ paddingInlineStart: depth * 22 }}>
      <Icon size={16} className={accent ? "text-accent" : "text-ink-subtle"} />
      <span className={`text-[13.5px] ${accent ? "font-semibold text-ink" : "text-ink-muted"}`}>{label}</span>
      {hint && <span className="text-[11.5px] text-ink-subtle">{hint}</span>}
    </div>
  );
}

export function LocalFolderTutorial({ onClose, onChoose }: { onClose: () => void; onChoose: () => void }) {
  const t = useT();
  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-[80] grid place-items-center bg-black/60 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-modal-in flex w-full max-w-md flex-col gap-5 rounded-2xl border border-edge bg-surface p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-display text-[21px] font-medium tracking-tight text-ink">
            {t("Add a local folder")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Close")}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-edge-soft text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
          >
            <X size={18} strokeWidth={2.2} />
          </button>
        </div>

        <p className="text-[14px] leading-relaxed text-ink-muted">
          {t(
            "Pick one folder. Each subfolder inside is one manga, so name it exactly like the title. In each, add chapter folders of images or .cbz / .zip files. A cover.jpg sets a custom cover.",
          )}
        </p>

        <div className="rounded-xl bg-canvas p-4 ring-1 ring-edge-soft">
          <TreeRow depth={0} icon={FolderOpen} label="My Manga" hint={t("the folder you pick")} />
          <TreeRow depth={1} icon={Folder} label="One Piece" hint={t("← name it like the manga")} accent />
          <TreeRow depth={2} icon={Folder} label="Chapter 1" />
          <TreeRow depth={3} icon={ImageIcon} label="001.jpg" />
          <TreeRow depth={3} icon={ImageIcon} label="002.jpg" />
          <TreeRow depth={2} icon={FileArchive} label="Chapter 2.cbz" hint={t("← folder or .cbz / .zip")} />
          <TreeRow depth={1} icon={Folder} label="Berserk" accent />
          <TreeRow depth={2} icon={ImageIcon} label="cover.jpg" hint={t("optional cover")} />
        </div>

        <ol className="flex flex-col gap-2.5">
          {[
            t("Make one folder for your library."),
            t("Inside it, one folder per manga, named like the title."),
            t("Add chapter folders of images, or .cbz / .zip files."),
          ].map((step, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/15 text-[12px] font-bold text-accent">
                {i + 1}
              </span>
              <span className="text-[13.5px] text-ink-muted">{step}</span>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={() => {
            onClose();
            onChoose();
          }}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-accent text-[15px] font-semibold text-canvas transition-all hover:opacity-90 active:scale-[0.98]"
        >
          <FolderOpen size={18} />
          {t("Choose folder")}
        </button>
      </div>
    </div>,
    document.body,
  );
}
