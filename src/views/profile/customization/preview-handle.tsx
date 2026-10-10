import { ChevronUp } from "lucide-react";
import { useT } from "@/lib/i18n";

export function PreviewHandle({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  const t = useT();
  if (!visible) return null;
  return (
    <div className="animate-preview-in pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center pb-5">
      <button
        onClick={onClick}
        aria-label={t("Back to editing")}
        className="pointer-events-auto inline-flex min-h-11 flex-col items-center gap-1 rounded-xl bg-elevated/95 px-6 py-2.5 text-ink shadow-lg ring-1 ring-edge backdrop-blur transition-colors hover:bg-raised"
      >
        <span aria-hidden className="h-1 w-9 rounded-full bg-edge" />
        <span className="inline-flex items-center gap-1.5 text-[13px] font-medium">
          <ChevronUp size={15} /> {t("Back to editing")}
        </span>
      </button>
    </div>
  );
}
