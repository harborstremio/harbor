import { downloadDir as systemDownloadDir } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { ChevronDown, FolderOpen, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { ToggleRow } from "@/views/settings/shared";

export function SaveLocationChip() {
  const t = useT();
  const { settings, update } = useSettings();
  const [systemDefault, setSystemDefault] = useState("");
  const [menuOpen, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    systemDownloadDir()
      .then((d) => {
        if (!cancelled) setSystemDefault(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const current = settings.downloadDir || systemDefault;
  const isCustom = !!settings.downloadDir;
  const folderName = current ? (current.split(/[\\/]/).filter(Boolean).pop() ?? current) : "";

  const pick = async () => {
    try {
      const picked = await open({ directory: true, defaultPath: current || undefined });
      if (typeof picked === "string") update({ downloadDir: picked });
    } catch {
      return;
    }
  };

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={menuOpen}
        title={current || undefined}
        className="flex h-9 items-center gap-2 rounded-lg border border-edge-soft bg-elevated/50 px-3 text-[12.5px] font-medium text-ink-muted transition duration-150 hover:border-edge hover:text-ink active:scale-[0.97]"
      >
        <FolderOpen size={14} strokeWidth={2.1} className="shrink-0 text-ink-subtle" />
        <span className="max-w-[160px] truncate">{folderName || t("Downloads folder")}</span>
        <ChevronDown
          size={13}
          strokeWidth={2.2}
          className={`shrink-0 text-ink-subtle transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`}
        />
      </button>
      {menuOpen && (
        <div className="animate-popover-in absolute end-0 top-[calc(100%+8px)] z-30 w-[400px] max-w-[calc(100vw-48px)] origin-top-right rounded-2xl border border-edge bg-elevated p-4 shadow-[0_24px_60px_-18px_rgba(0,0,0,0.7)]">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
              {isCustom ? t("Saving to") : t("Saving to system default")}
            </span>
            <button
              type="button"
              onClick={() => current && void revealItemInDir(current)}
              title={current ? t("{path} (open folder)", { path: current }) : undefined}
              className="truncate text-start font-mono text-[12.5px] text-ink-muted transition-colors hover:text-ink"
            >
              {current || t("Detecting...")}
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={pick}
              className="rounded-lg border border-edge-soft px-3.5 py-2 text-[12.5px] font-semibold text-ink-muted transition duration-150 hover:border-edge hover:text-ink active:scale-[0.97]"
            >
              {t("Change")}
            </button>
            {isCustom && (
              <button
                type="button"
                onClick={() => update({ downloadDir: "" })}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-medium text-ink-subtle transition duration-150 hover:bg-ink/10 hover:text-ink active:scale-[0.97]"
              >
                <RotateCcw size={13} strokeWidth={2.2} />
                {t("Reset to default")}
              </button>
            )}
          </div>
          <div className="mt-3 border-t border-edge-soft/60 pt-3">
            <ToggleRow
              label={t("Organize downloads into folders")}
              note={t("Create a folder by movie or series name")}
              value={settings.downloadCreateFolders}
              onChange={(v) => update({ downloadCreateFolders: v })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
