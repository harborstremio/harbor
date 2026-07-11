import { Check, Copy, X } from "lucide-react";
import { useState } from "react";

export function ExportBlock({ text, onClose }: { text: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      return;
    }
  };
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-edge-soft bg-canvas/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-subtle">Theme code</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copy}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-ink px-3.5 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90"
          >
            {copied ? <Check size={12} strokeWidth={2.6} /> : <Copy size={12} strokeWidth={2.2} />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-subtle hover:text-ink"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      <pre className="max-h-[320px] overflow-auto rounded-lg bg-canvas px-3 py-2 font-mono text-[11px] leading-relaxed text-ink-muted">
        {text}
      </pre>
    </div>
  );
}
