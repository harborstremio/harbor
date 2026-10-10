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
      className="animate-in fade-in pointer-events-auto fixed inset-0 z-[170] flex items-center justify-center bg-black/60 backdrop-blur-sm duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="animate-modal-in flex w-full max-w-[420px] flex-col gap-4 rounded-lg border border-edge-soft bg-elevated p-4 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.75)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-[13px] font-semibold tracking-tight text-ink">{t("Add Custom Source")}</h2>
            <p className="text-[11.5px] leading-relaxed text-ink-subtle">
              {t("Provide a JSON link or paste it directly.")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
            aria-label={t("Cancel")}
          >
            <X size={15} />
          </button>
        </div>

        <div className="relative flex rounded-md bg-canvas p-0.5">
          <span
            aria-hidden
            className="harbor-seg-thumb absolute inset-y-0.5 w-[calc(50%-2px)] rounded-[6px] bg-raised ring-1 ring-edge"
            style={{
              left: mode === "url" ? "2px" : "calc(50% + 0px)",
              animation: `${mode === "url" ? "harbor-seg-a" : "harbor-seg-b"} 300ms ease-in-out`,
            }}
          />
          <button
            onClick={() => setMode("url")}
            className={`relative z-10 flex-1 rounded-[6px] py-2 text-[12.5px] font-medium transition-colors ${
              mode === "url" ? "text-ink" : "text-ink-muted hover:text-ink"
            }`}
          >
            {t("JSON URL")}
          </button>
          <button
            onClick={() => setMode("json")}
            className={`relative z-10 flex-1 rounded-[6px] py-2 text-[12.5px] font-medium transition-colors ${
              mode === "json" ? "text-ink" : "text-ink-muted hover:text-ink"
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
            className="h-10 w-full rounded-md bg-canvas px-3 text-[12.5px] text-ink ring-1 ring-inset ring-edge-soft transition-colors placeholder:text-ink-subtle focus:outline-none focus:ring-accent/50"
          />
        ) : (
          <textarea
            value={jsonText}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setJsonText(e.target.value)}
            placeholder='[ { "id": "...", "title": "Directors", "folders": [ ... ] } ]'
            className="h-36 w-full resize-none rounded-md bg-canvas p-3 font-mono text-[12px] leading-relaxed text-ink ring-1 ring-inset ring-edge-soft transition-colors placeholder:text-ink-subtle focus:outline-none focus:ring-accent/50"
          />
        )}

        {error && <p className="text-[11.5px] text-danger">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="harbor-press-pop inline-flex h-9 items-center justify-center rounded-md px-3.5 text-[12.5px] font-medium text-ink-muted transition-colors hover:bg-elevated hover:text-ink disabled:opacity-40"
          >
            {t("Cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="harbor-press-pop inline-flex h-9 items-center justify-center rounded-md bg-ink px-3.5 text-[12.5px] font-medium text-canvas transition-transform hover:scale-[1.01] disabled:opacity-40 disabled:hover:scale-100"
          >
            {loading ? t("Loading...") : t("Add Source")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
