import { useT } from "@/lib/i18n";
import { useActiveKid } from "@/lib/profiles";
import { useView } from "@/lib/view";
import { ArrowLeft } from "lucide-react";

export function BackChrome() {
  const { canGoBack, goBack, topKind, chromeHidden } = useView();
  const kid = useActiveKid();
  const t = useT();
  if (!canGoBack || chromeHidden) return null;
  if (topKind === "picker") return null;
  if (kid) {
    return (
      <button
        onClick={goBack}
        className="flex h-12 shrink-0 items-center gap-2 rounded-full bg-white/90 ps-4 pe-6 text-[16px] font-extrabold text-[#0e3a43] shadow-[0_10px_24px_-10px_rgba(20,60,70,0.5)] backdrop-blur-md transition-transform duration-200 hover:scale-[1.05] active:scale-[0.97]"
      >
        <ArrowLeft size={22} strokeWidth={2.8} className="dir-icon" />
        {t("common.back")}
      </button>
    );
  }
  return (
    <button
      onClick={goBack}
      className="flex h-10 shrink-0 items-center gap-2 rounded-full border border-edge-soft/60 bg-canvas/85 ps-3 pe-5 text-[13.5px] font-medium text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
    >
      <ArrowLeft size={15} className="dir-icon" />
      {t("common.back")}
    </button>
  );
}
