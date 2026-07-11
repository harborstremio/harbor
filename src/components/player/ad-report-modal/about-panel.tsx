import { useT } from "@/lib/i18n";
import { ArrowLeft } from "lucide-react";

export function AboutPanel({ onBack }: { onBack: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] leading-relaxed text-ink-muted">
        {t(
          "Some copies of new releases have ads spliced into the video itself. This is experimental: the community marks where those ads are so others can skip them.",
        )}
      </p>
      <p className="text-[13px] leading-relaxed text-ink-muted">
        {t(
          "Your report is sent for review before it ever skips anything for anyone. Nothing about the video is uploaded, just the timestamps you mark. It is off by default and you can turn it off anytime in Settings.",
        )}
      </p>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex h-9 items-center gap-1.5 self-start rounded-lg border border-edge px-3 text-[13px] font-medium text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
      >
        <ArrowLeft size={14} strokeWidth={2} className="rtl:-scale-x-100" />
        {t("Back")}
      </button>
    </div>
  );
}
