import { X } from "lucide-react";
import { useT } from "@/lib/i18n";

export function AdReportFirstTip({ onDismiss }: { onDismiss: () => void }) {
  const t = useT();
  return (
    <div className="pointer-events-auto absolute bottom-full end-0 mb-2 w-56 rounded-xl border border-white/15 bg-black/85 p-3 text-white shadow-[0_18px_50px_-15px_rgba(0,0,0,0.85)] backdrop-blur-md animate-in fade-in slide-in-from-bottom-1 duration-200">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] leading-snug text-white/85">
          {t("See an injected ad? Report it")}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("Dismiss")}
          className="-me-1 -mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X size={12} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}
