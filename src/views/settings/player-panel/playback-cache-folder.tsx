import { useEffect, useState } from "react";
import { appCacheDir, join } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { FolderOpen, RotateCcw } from "../icons";
import { SettingRow } from "../kit";
import { SButton } from "../ui";

export function PlaybackCacheFolder() {
  const { settings, update } = useSettings();
  const t = useT();
  const [path, setPath] = useState("");
  const [error, setError] = useState("");
  const custom = settings.playbackCacheDir;
  useEffect(() => {
    let active = true;
    setPath("");
    void (async () => {
      const dir = custom
        ? await join(custom, "harbor-playback-cache")
        : await join(await appCacheDir(), "mpv-cache");
      if (active) setPath(dir);
    })().catch(() => {});
    return () => { active = false; };
  }, [custom]);

  const choose = async () => {
    setError("");
    try {
      const picked = await open({ directory: true, defaultPath: custom || undefined });
      if (typeof picked === "string") update({ playbackCacheDir: picked });
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <SettingRow
      wide
      icon={<FolderOpen size={18} />}
      label={t("Playback cache folder")}
      desc={t("Temporary video buffering, including debrid streams. Applies when playback restarts; existing files stay in their current folder.")}
    >
      <div className="flex min-w-0 flex-col gap-3">
        <span dir="ltr" className="break-all font-mono text-[15.5px] leading-[22px] text-ink-muted">
          {path || t("Default app cache folder")}
        </span>
        <span className="flex flex-wrap items-center gap-2.5">
          <SButton onClick={() => void choose()}>{t("Choose folder")}</SButton>
          {custom && (
            <SButton onClick={() => { setError(""); update({ playbackCacheDir: "" }); }}>
              <RotateCcw size={16} strokeWidth={2.2} />
              {t("Reset to default")}
            </SButton>
          )}
        </span>
        {error && <p role="alert" className="text-[15px] text-danger">{error}</p>}
      </div>
    </SettingRow>
  );
}
