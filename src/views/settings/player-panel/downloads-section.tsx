import { downloadDir } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { FolderOpen, RotateCcw } from "../icons";
import { useEffect, useState, type ReactNode } from "react";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { SettingGroup, SettingRow } from "../kit";
import { SButton } from "../ui";
import { ToggleRow } from "@/views/settings/shared";
import { BADGE_BASE } from "./choice";

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
    <div className="flex flex-col gap-5">
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
          sub={t(
            "Files land in a folder named after the movie or series instead of loose in the download folder.",
          )}
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
          sub={t("Each title gets its own folder holding its EPUB or PDF.")}
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
    <SettingGroup label={title}>
      {children}
      <SettingRow
        wide
        label={
          <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
            <span className="min-w-0">{t("Download folder")}</span>
            <span className={`${BADGE_BASE} bg-elevated text-ink-subtle`}>
              {custom ? t("Custom") : t("Default")}
            </span>
          </span>
        }
        desc={
          <span className="block break-all font-mono text-[15.5px] leading-[22px] text-ink">
            {current || t("Detecting...")}
          </span>
        }
      >
        <span className="flex flex-wrap items-center gap-2.5">
          <SButton onClick={onChoose}>{t("Choose folder")}</SButton>
          {current && (
            <SButton onClick={onReveal}>
              <FolderOpen size={16} strokeWidth={2.2} />
              {t("Open")}
            </SButton>
          )}
          {custom && (
            <SButton onClick={onReset}>
              <RotateCcw size={16} strokeWidth={2.2} />
              {t("Reset to default")}
            </SButton>
          )}
        </span>
      </SettingRow>
    </SettingGroup>
  );
}
