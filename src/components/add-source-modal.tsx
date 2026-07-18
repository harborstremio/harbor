import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { parseSourceRows, type SourceRow } from "@/lib/custom-sources";

export function AddSourceModal({
  isOpen,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rows: SourceRow[]) => void;
}) {
  const t = useT();
  const [mode, setMode] = useState<"url" | "json">("url");
  const [url, setUrl] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [isOpen, onClose]);

  const handleSave = async () => {
    setError("");
    setLoading(true);
    let rows: SourceRow[] = [];

    try {
      if (mode === "url") {
        if (!url.trim()) throw new Error(t("URL cannot be empty"));
        const res = await fetch(url.trim());
        if (!res.ok) throw new Error(t("Failed to fetch JSON"));
        const text = await res.text();
        rows = parseSourceRows(text);
      } else {
        if (!jsonText.trim()) throw new Error(t("JSON cannot be empty"));
        rows = parseSourceRows(jsonText);
      }

      if (rows.length === 0) {
        throw new Error(t("Invalid SourceRow JSON format"));
      }
      onSave(rows);
      onClose();
    } catch (err: any) {
      setError(err.message || t("An error occurred"));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="pointer-events-auto fixed inset-0 z-[120] flex items-center justify-center bg-black/72 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-[420px] flex-col gap-6 rounded-[24px] border border-edge-soft bg-elevated/95 px-8 py-8 shadow-[0_30px_80px_-25px_rgba(0,0,0,0.85)] animate-in zoom-in-95 fade-in duration-200">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-[19px] font-medium tracking-tight text-ink">
              {t("Add Custom Source")}
            </h2>
            <p className="text-[12.5px] leading-relaxed text-ink-muted">
              {t("Provide a JSON link or paste it directly.")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas/40 text-ink-subtle transition-colors hover:bg-canvas/60 hover:text-ink"
            aria-label={t("Cancel")}
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex gap-2 rounded-lg bg-surface-muted p-1">
          <button
            onClick={() => setMode("url")}
            className={`flex-1 rounded-md py-1.5 text-[13px] font-medium transition-colors ${
              mode === "url" ? "bg-surface text-ink shadow-sm" : "text-ink-subtle hover:text-ink"
            }`}
          >
            {t("JSON URL")}
          </button>
          <button
            onClick={() => setMode("json")}
            className={`flex-1 rounded-md py-1.5 text-[13px] font-medium transition-colors ${
              mode === "json" ? "bg-surface text-ink shadow-sm" : "text-ink-subtle hover:text-ink"
            }`}
          >
            {t("Paste JSON")}
          </button>
        </div>

        {mode === "url" ? (
          <input
            value={url}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
            placeholder="https://example.com/sources.json"
            autoFocus
            className="w-full rounded-lg border border-edge-soft bg-canvas/60 px-4 py-2.5 text-[14px] text-ink outline-none transition-colors focus:border-accent"
          />
        ) : (
          <textarea
            value={jsonText}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setJsonText(e.target.value)}
            placeholder='[ { "id": "...", "title": "Directors", "folders": [ ... ] } ]'
            className="h-48 w-full resize-none rounded-lg border border-edge-soft bg-canvas/60 p-3 text-sm font-mono text-ink outline-none transition-colors focus:border-accent"
          />
        )}

        {error && <p className="text-[12.5px] font-medium text-red-400">{error}</p>}

        <div className="mt-2 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-full border border-edge bg-transparent px-5 py-2 text-[13px] font-semibold text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
          >
            {t("Cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="rounded-full bg-accent px-5 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? t("Loading...") : t("Add Source")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
