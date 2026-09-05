import { Check, Copy, X } from "lucide-react";
import { useState } from "react";
import { useT } from "@/lib/i18n";
import { ROW_ACTION, ROW_ACTION_PRIMARY } from "../../kit";

export function ExportBlock({ text, onClose }: { text: string; onClose: () => void }) {
  const t = useT();
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
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <span className="harbor-settings-label">{t("Theme code")}</span>
        <div className="flex items-center gap-2.5">
          <button type="button" onClick={copy} className={ROW_ACTION_PRIMARY}>
            {copied ? <Check size={18} strokeWidth={2.6} /> : <Copy size={18} strokeWidth={2.2} />}
            {copied ? t("Copied") : t("Copy")}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Close")}
            className={`${ROW_ACTION} w-11 justify-center px-0`}
          >
            <X size={18} />
          </button>
        </div>
      </div>
      <pre className="max-h-[320px] overflow-auto rounded-md bg-canvas px-3.5 py-3 font-mono text-[15.5px] leading-[22px] text-ink-muted">
        {text}
      </pre>
    </div>
  );
}
