import { ArrowLeft } from "lucide-react";
import { ThreeLiquidGlassSurface } from "@/components/ThreeLiquidGlassSurface";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";

export function FloatingBack({
  offsetLeft = 24,
  offsetTop = 90,
}: {
  offsetLeft?: number;
  offsetTop?: number;
}) {
  const { canGoBack, goBack, exitPlayback, topKind, chromeHidden } = useView();
  const t = useT();

  if (!canGoBack || chromeHidden) return null;

  const deep =
    topKind === "meta" ||
    topKind === "collection" ||
    topKind === "person" ||
    topKind === "filter" ||
    topKind === "award" ||
    topKind === "anime-award" ||
    topKind === "service" ||
    topKind === "addon-detail" ||
    topKind === "queue";

  if (!deep) return null;

  void exitPlayback;

  return (
    <div
      style={{
        position: "fixed",
        top: offsetTop,
        insetInlineStart: offsetLeft,
        zIndex: 70,
      }}
    >
      <ThreeLiquidGlassSurface
        radius="9999px"
        shaderRadius={0.28}
        intensity={0.1}
        refractionStrength={0.08}
        interactive={false}
        alwaysActive
        className="
          h-10
          w-fit
          shrink-0
          rounded-full
          border
          border-white/[0.10]
        "
        contentClassName="flex h-full w-full"
        style={{
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -1px 0 rgba(0,0,0,0.05)",
        }}
      >
        <button
          type="button"
          onClick={goBack}
          aria-label={t("common.back")}
          className="
            flex
            h-full
            w-full
            items-center
            gap-2
            rounded-full
            bg-transparent
            ps-3
            pe-5
            text-[13.5px]
            font-medium
            text-ink-muted
            outline-none
            transition-[color,transform]
            duration-150
            hover:text-ink
            active:scale-[0.97]
          "
        >
          <ArrowLeft size={15} className="dir-icon" />

          {t("common.back")}
        </button>
      </ThreeLiquidGlassSurface>
    </div>
  );
}
