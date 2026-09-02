import { downloadDir } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { FolderOpen, RotateCcw } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { ToggleRow } from "@/views/settings/shared";

export function DownloadsSection() {
  const { settings, update } = useSettings();
  const t = useT();
  const [systemDefault, setSystemDefault] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    downloadDir()
      .then((d) => {
        if (!cancelled) setSystemDefault(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const pickFolder = async (kind: "video" | "ebook") => {
    const current =
      kind === "ebook"
        ? settings.ebookDownloadDir || settings.downloadDir || systemDefault
        : settings.downloadDir || systemDefault;
    try {
      const picked = await open({
        directory: true,
        defaultPath: current || undefined,
      });
      if (typeof picked === "string") {
        if (kind === "ebook") update({ ebookDownloadDir: picked });
        else update({ downloadDir: picked });
      }
    } catch {
      return;
    }
  };

  const revealCurrent = async (current: string) => {
    if (!current) return;
    try {
      await revealItemInDir(current);
    } catch {
      return;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <DownloadLocation
        title={t("Movies & TV")}
        current={settings.downloadDir || systemDefault}
        custom={!!settings.downloadDir}
        onChoose={() => void pickFolder("video")}
        onReset={() => update({ downloadDir: "" })}
        onReveal={() => void revealCurrent(settings.downloadDir || systemDefault)}
      >
        <ToggleRow
          label={t("Create folders for movies and shows")}
          note={t("Organize downloads into folders by movie or series name")}
          value={settings.downloadCreateFolders}
          onChange={(v) => update({ downloadCreateFolders: v })}
        />
      </DownloadLocation>
      <DownloadLocation
        title={t("eBooks")}
        current={settings.ebookDownloadDir || settings.downloadDir || systemDefault}
        custom={!!settings.ebookDownloadDir}
        onChoose={() => void pickFolder("ebook")}
        onReset={() => update({ ebookDownloadDir: "" })}
        onReveal={() =>
          void revealCurrent(settings.ebookDownloadDir || settings.downloadDir || systemDefault)
        }
      >
        <ToggleRow
          label={t("Create folders for eBooks")}
          note={t("Store each title in its own folder with its EPUB or PDF")}
          value={settings.ebookDownloadCreateFolders}
          onChange={(value) => update({ ebookDownloadCreateFolders: value })}
        />
      </DownloadLocation>
    </div>
  );
}

function DownloadLocation({
  title,
  current,
  custom,
  onChoose,
  onReset,
  onReveal,
  children,
}: {
  title: string;
  current: string;
  custom: boolean;
  onChoose: () => void;
  onReset: () => void;
  onReveal: () => void;
  children: ReactNode;
}) {
  const t = useT();
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-[12px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
        {title}
      </h3>
      {children}
      <div className="flex items-center justify-between gap-3 rounded-md bg-canvas px-4 py-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
            {custom ? t("Custom location") : t("Default location")}
          </span>
          <span className="truncate font-mono text-[13px] text-ink" title={current}>
            {current || t("Detecting...")}
          </span>
        </div>
        {current && (
          <button
            type="button"
            onClick={onReveal}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-medium text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
          >
            <FolderOpen size={14} strokeWidth={2.2} />
            {t("Open")}
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onChoose}
          className="flex h-10 items-center gap-2 rounded-md bg-ink px-4 text-[13px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97]"
        >
          {t("Choose folder")}
        </button>
        {custom && (
          <button
            type="button"
            onClick={onReset}
            className="flex h-10 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-medium text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
          >
            <RotateCcw size={14} strokeWidth={2.2} />
            {t("Reset to default")}
          </button>
        )}
      </div>
    </section>
  );
}
