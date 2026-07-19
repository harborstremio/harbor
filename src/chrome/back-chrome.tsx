import { ArrowLeft } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useActiveKid } from "@/lib/profiles";
import { useView } from "@/lib/view";
import { ThreeLiquidGlassSurface } from "@/components/ThreeLiquidGlassSurface";

export function BackChrome() {
  const { canGoBack, goBack, topKind, chromeHidden } = useView();
  const kid = useActiveKid();
  const t = useT();

  if (!canGoBack || chromeHidden) return null;
  if (topKind === "picker") return null;

  return (
    <ThreeLiquidGlassSurface
      radius="9999px"
      shaderRadius={1}
      intensity={kid ? 0.86 : 0.76}
      className={`
        shrink-0 rounded-full
        border border-white/[0.10]
        ${kid ? "h-12" : "h-10"}
      `}
      contentClassName="h-full w-full"
      style={{
        background: "transparent",
        boxShadow: "none",
      }}
    >
      <button
        type="button"
        onClick={goBack}
        aria-label={t("common.back")}
        className={`
          flex h-full w-full
          shrink-0 items-center gap-2
          rounded-full bg-transparent
          outline-none
          transition-[color,transform] duration-150
          active:scale-[0.97]
          ${
            kid
              ? "ps-4 pe-6 text-[16px] font-extrabold text-[#0e3a43]"
              : "ps-3 pe-5 text-[13.5px] font-medium text-ink-muted hover:text-ink"
          }
        `}
      >
        <ArrowLeft size={kid ? 22 : 15} strokeWidth={kid ? 2.8 : 2} className="dir-icon shrink-0" />

        {t("common.back")}
      </button>
    </ThreeLiquidGlassSurface>
  );
}
