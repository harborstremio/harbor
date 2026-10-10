import { NavArrow } from "@/components/nav-arrow";
import { useT } from "@/lib/i18n";
import type { ReaderNavPos } from "./reader-types";

const SIZE = "h-12 w-12";

export function ReaderNav({
  pos,
  onPrev,
  onNext,
}: {
  pos: ReaderNavPos;
  onPrev: () => void;
  onNext: () => void;
}) {
  const t = useT();
  if (pos === "sides") {
    return (
      <>
        <NavArrow dir="left" onClick={onPrev} label={t("Previous page")} className={`fixed start-3 top-1/2 z-[90] -translate-y-1/2 ${SIZE}`} />
        <NavArrow dir="right" onClick={onNext} label={t("Next page")} className={`fixed end-3 top-1/2 z-[90] -translate-y-1/2 ${SIZE}`} />
      </>
    );
  }
  if (pos === "bottom") {
    return (
      <div className="fixed inset-x-0 bottom-28 z-[90] flex justify-center gap-4">
        <NavArrow dir="left" onClick={onPrev} label={t("Previous page")} className={SIZE} />
        <NavArrow dir="right" onClick={onNext} label={t("Next page")} className={SIZE} />
      </div>
    );
  }
  const side = pos === "stack-bl" ? "start-6" : "end-6";
  return (
    <div className={`fixed bottom-40 z-[90] flex flex-col gap-1 ${side}`}>
      <NavArrow dir="up" onClick={onPrev} label={t("Previous page")} className={SIZE} />
      <NavArrow dir="down" onClick={onNext} label={t("Next page")} className={SIZE} />
    </div>
  );
}
