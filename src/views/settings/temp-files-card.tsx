import { HardDrive, Loader2, Trash2 } from "./icons";
import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useT } from "@/lib/i18n";
import { Section } from "./shared";
import { ROW_ACTION_DANGER, SettingGroup, SettingRow } from "./kit";

function formatBytes(n: number): string {
  if (n <= 0) return "0 MB";
  const mb = n / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

export function TempFilesCard() {
  const t = useT();
  const [bytes, setBytes] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    void invoke<number>("temp_usage_bytes")
      .then((n) => setBytes(typeof n === "number" ? n : 0))
      .catch(() => setBytes(null));
  }, []);

  useEffect(load, [load]);

  const clear = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await invoke<number>("temp_clear");
      load();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  if (bytes === null) return null;

  return (
    <Section
      title={t("Temporary files")}
      subtitle={t(
        "Leftover installers from past updates, cached trailers, and casting scratch files. Harbor clears old ones on launch, keeping only the most recent installer.",
      )}
    >
      <SettingGroup>
        <SettingRow
          icon={<HardDrive size={18} strokeWidth={1.9} />}
          label={t("Space in use")}
          desc={t("Clearing these is always safe. Nothing you downloaded on purpose is removed.")}
        >
          <span className="shrink-0 text-[15.5px] tabular-nums text-ink-muted">
            {formatBytes(bytes)}
          </span>
          <button
            type="button"
            onClick={() => void clear()}
            disabled={busy || bytes === 0}
            className={ROW_ACTION_DANGER}
          >
            {busy ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Trash2 size={18} strokeWidth={1.9} />
            )}
            {t("Clear now")}
          </button>
        </SettingRow>
      </SettingGroup>
      {failed && <p role="alert" className="mt-3 text-[15px] text-danger">{t("Could not clear temporary files. Close any active downloads or playback and try again.")}</p>}
    </Section>
  );
}
