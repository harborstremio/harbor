import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useSectionBackActive } from "@/lib/section-back";
import { useView } from "@/lib/view";
import { BACK_SHAPE, BACK_SKIN } from "./back-affordance";

const DEEP_KINDS = new Set([
  "meta",
  "collection",
  "addon-collection",
  "person",
  "filter",
  "award",
  "anime-award",
  "curated-list",
  "service",
  "addon-detail",
  "queue",
  "groups",
  "group",
  "list",
  "downloads",
]);

/** The inline back controls defer to this one, so both read the same condition. */
export function useFloatingBackShown(): boolean {
  const { canGoBack, topKind, chromeHidden } = useView();
  const sectionBack = useSectionBackActive();
  return canGoBack && !chromeHidden && (sectionBack || DEEP_KINDS.has(topKind));
}

export function FloatingBack({
  offsetLeft = 24,
  offsetTop = 90,
}: {
  offsetLeft?: number;
  offsetTop?: number;
}) {
  const { goBack } = useView();
  const t = useT();
  const shown = useFloatingBackShown();

  useEffect(() => {
    if (!shown) return;
    const root = document.documentElement;
    root.style.setProperty("--harbor-floating-back-space", `${offsetTop + 56}px`);
    return () => {
      root.style.removeProperty("--harbor-floating-back-space");
    };
  }, [shown, offsetTop]);

  if (!shown) return null;

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label={t("common.back")}
      data-floating-back
      style={{ position: "fixed", top: offsetTop, insetInlineStart: offsetLeft, zIndex: 70 }}
      className={`${BACK_SHAPE} ${BACK_SKIN}`}
    >
      <ArrowLeft size={15} className="dir-icon" />
      {t("common.back")}
    </button>
  );
}
