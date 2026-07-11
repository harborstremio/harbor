import { useT } from "@/lib/i18n";
import { HelpCircle } from "lucide-react";
import { useState } from "react";

export function CachedTip() {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-1.5 self-start">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 self-start text-[11.5px] font-medium text-ink-subtle/70 transition-colors hover:text-ink-muted"
      >
        <HelpCircle size={12} strokeWidth={2} />
        {t("Says “cached” but won’t play?")}
      </button>
      {open && (
        <p className="max-w-lg rounded-lg bg-elevated/60 px-3 py-2 text-[11.5px] leading-relaxed text-ink-subtle ring-1 ring-edge-soft/50">
          {t(
            "“Cached” just means your addon thinks that file is already saved on your debrid, ready to play instantly. That flag isn’t always right: sometimes the file isn’t actually there yet. When that happens the source won’t start, or it plays a short broken clip. It’s not a Harbor problem: pick another source, or give it a minute to finish caching and try again.",
          )}
        </p>
      )}
    </div>
  );
}
