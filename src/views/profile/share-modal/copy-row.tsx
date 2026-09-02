import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { useT } from "@/lib/i18n";

export function CopyRow({
  label,
  value,
  primary,
}: {
  label: string;
  value: string;
  primary?: boolean;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12px] font-medium text-ink-subtle">{label}</span>
      <div className="flex items-stretch gap-2">
        <input
          readOnly
          value={value}
          onFocus={(ev) => ev.currentTarget.select()}
          spellCheck={false}
          className={`min-w-0 flex-1 rounded-md bg-elevated px-3 text-ink outline-none ring-1 ring-edge-soft ${
            primary ? "min-h-11 text-[14px]" : "min-h-9 text-[13px]"
          }`}
        />
        <button
          type="button"
          onClick={() => void copy()}
          aria-label={t("Copy {label}", { label })}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium ring-1 transition-colors ${
            primary ? "min-h-11" : "min-h-9"
          } ${copied ? "bg-accent/15 text-accent ring-accent/40" : "bg-elevated text-ink ring-edge-soft hover:bg-raised"}`}
        >
          {copied ? <Check size={15} strokeWidth={2.6} /> : <Copy size={15} />}
          {copied ? t("Copied") : t("Copy")}
        </button>
      </div>
    </div>
  );
}
