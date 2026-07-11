import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";
import { ArrowLeft } from "lucide-react";

export function FloatingBack({ offsetLeft = 24, offsetTop = 90 }: { offsetLeft?: number; offsetTop?: number }) {
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
  const onClick = goBack;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("common.back")}
      style={{ position: "fixed", top: offsetTop, insetInlineStart: offsetLeft, zIndex: 70 }}
      className="flex h-10 items-center gap-2 rounded-full border border-edge-soft bg-canvas/90 ps-3 pe-5 text-[13.5px] font-medium text-ink-muted shadow-[0_10px_24px_-12px_rgba(0,0,0,0.6)] backdrop-blur-md transition-colors hover:bg-canvas hover:text-ink"
    >
      <ArrowLeft size={15} className="dir-icon" />
      {t("common.back")}
    </button>
  );
}
