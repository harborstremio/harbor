import { HardDrive, Loader2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useT } from "@/lib/i18n";
import { settingsAnchor } from "./shared";

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

  const load = useCallback(() => {
    void invoke<number>("temp_usage_bytes")
      .then((n) => setBytes(typeof n === "number" ? n : 0))
      .catch(() => setBytes(null));
  }, []);

  useEffect(load, [load]);

  const clear = async () => {
    setBusy(true);
    try {
      await invoke<number>("temp_clear");
      load();
    } catch {
      /* leave the figure as is */
    } finally {
      setBusy(false);
    }
  };

  if (bytes === null) return null;

  return (
    <section
      id={settingsAnchor("Temporary files")}
 className="scroll-mt-28 flex flex-col gap-4 rounded-md bg-elevated p-7"
    >
      <div className="flex items-start gap-3">
        <HardDrive size={20} className="mt-0.5 shrink-0 text-ink-subtle" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[15px] font-semibold text-ink">{t("Temporary files")}</span>
          <span className="text-[13px] leading-relaxed text-ink-subtle">
            {t(
              "Leftover installers from past updates, cached trailers, and casting scratch files. Harbor clears old ones on launch, keeping only the most recent installer.",
            )}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[22px] font-semibold tabular-nums text-ink">{formatBytes(bytes)}</span>
        <button
          type="button"
          onClick={() => void clear()}
          disabled={busy || bytes === 0}
          className="flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-semibold text-ink-muted ring-1 ring-edge-soft transition-colors hover:text-danger hover:ring-danger disabled:opacity-40 disabled:hover:text-ink-muted disabled:hover:ring-edge-soft"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
          {t("Clear now")}
        </button>
      </div>
    </section>
  );
}
