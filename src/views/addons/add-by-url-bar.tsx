import { useT } from "@/lib/i18n";
import { Link } from "lucide-react";
import { useState } from "react";

export function AddByUrlBar({
  onSubmit,
  compact = false,
}: {
  onSubmit: (raw: string) => Promise<void>;
  compact?: boolean;
}) {
  const t = useT();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);
  const submit = async () => {
    const v = value.trim();
    if (!v || busy) return;
    setBusy(true);
    try {
      await onSubmit(v);
      setValue("");
    } finally {
      setBusy(false);
    }
  };
  const heightClass = compact ? "h-10" : "h-14";
  const fontSizeClass = compact ? "text-[13px]" : "text-[15.5px]";
  const radius = compact ? "rounded-full" : "rounded-xl";
  const btnText = compact ? "text-[12.5px]" : "text-[14.5px]";
  const btnPad = compact ? "px-4" : "px-6";
  const placeholder = compact
    ? t("Paste manifest URL or stremio:// link")
    : t("Install from URL: paste any manifest or stremio:// link");
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div
        className={`flex ${heightClass} min-w-0 flex-1 items-center gap-3 ${radius} border bg-elevated/40 px-4 transition-colors ${
          focused ? "border-ink-subtle" : "border-edge-soft/70"
        }`}
      >
        <Link size={compact ? 14 : 18} strokeWidth={2} className="shrink-0 text-ink-subtle" />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text").trim();
            if (text) {
              e.preventDefault();
              setValue(text);
            }
          }}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          className={`h-full min-w-0 flex-1 bg-transparent ${fontSizeClass} text-ink placeholder:text-ink-subtle outline-none`}
        />
      </div>
      {value.trim().length > 0 && (
        <button
          onClick={() => void submit()}
          disabled={!value.trim() || busy}
          className={`flex ${heightClass} items-center gap-1.5 ${radius} bg-ink ${btnPad} ${btnText} font-semibold text-canvas transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40`}
        >
          {busy ? t("Installing…") : t("Install")}
        </button>
      )}
    </div>
  );
}
