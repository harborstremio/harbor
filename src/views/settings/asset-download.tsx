import { useCallback, useEffect, useRef, useState } from "react";
import { saveTextFileWithPath } from "@/lib/download-text";
import { useT } from "@/lib/i18n";

type DownloadStatus = {
  id: string;
  phase: "loading" | "saving" | "saved" | "downloaded" | "error";
  message: string;
};

export function useAssetDownload() {
  const t = useT();
  const [status, setStatus] = useState<DownloadStatus | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const save = useCallback(async (
    id: string,
    filename: string,
    prepare: () => Promise<string>,
    extensions: string[],
    label: string,
  ) => {
    if (busy.current) return;
    busy.current = true;
    let prepared = false;
    setStatus({ id, phase: "loading", message: t("Preparing {name}…", { name: filename }) });
    try {
      const text = await prepare();
      if (!mounted.current) return;
      prepared = true;
      setStatus({ id, phase: "saving", message: t("Saving {name}…", { name: filename }) });
      const result = await saveTextFileWithPath(filename, text, extensions, label, { nativeFailure: "throw" });
      if (!mounted.current) return;
      if (!result.saved) {
        setStatus(null);
        return;
      }
      setStatus({
        id,
        phase: result.path ? "saved" : "downloaded",
        message: result.path
          ? t("Saved {name}.", { name: filename })
          : t("Download started for {name}.", { name: filename }),
      });
    } catch {
      if (mounted.current) {
        setStatus({
          id,
          phase: "error",
          message: prepared
            ? t("Could not save {name}. Try again and choose a writable folder.", { name: filename })
            : t("Could not load {name}. Try again.", { name: filename }),
        });
      }
    } finally {
      busy.current = false;
    }
  }, [t]);

  const pendingId = status?.phase === "loading" || status?.phase === "saving" ? status.id : null;
  const savedId = status?.phase === "saved" || status?.phase === "downloaded" ? status.id : null;
  return { status, pendingId, savedId, save };
}

export type AssetDownload = ReturnType<typeof useAssetDownload>;

export function AssetDownloadFeedback({ status }: { status: DownloadStatus | null }) {
  return (
    <p role="status" aria-live="polite" aria-atomic="true" className={status ? `mt-2 text-[15.5px] leading-[22px] ${status.phase === "error" ? "text-danger" : "text-ink-muted"}` : "sr-only"}>
      {status?.message}
    </p>
  );
}
