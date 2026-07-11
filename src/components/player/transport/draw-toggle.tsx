import { useT } from "@/lib/i18n";
import { Eraser, Eye, EyeOff, Pencil } from "lucide-react";

import { BigButton } from "./big-button";

export function DrawToggle({
  active,
  hideOthers,
  onToggle,
  onToggleHideOthers,
  onClear,
}: {
  active: boolean;
  hideOthers: boolean;
  onToggle: () => void;
  onToggleHideOthers: () => void;
  onClear: () => void;
}) {
  const t = useT();
  return (
    <div className="flex items-center">
      <BigButton
        onClick={onToggle}
        ariaLabel={active ? t("Stop drawing") : t("Draw on screen")}
        tooltip={active ? t("Stop drawing") : t("Draw")}
        active={active}
      >
        <Pencil size={22} strokeWidth={2} />
      </BigButton>
      {active && (
        <>
          <BigButton onClick={onClear} ariaLabel={t("Clear drawings")} tooltip={t("Clear drawings")}>
            <Eraser size={22} strokeWidth={2} />
          </BigButton>
          <BigButton
            onClick={onToggleHideOthers}
            ariaLabel={hideOthers ? t("Show others' drawings") : t("Hide others' drawings")}
            tooltip={hideOthers ? t("Show others' drawings") : t("Hide others' drawings")}
            active={hideOthers}
          >
            {hideOthers ? <EyeOff size={22} strokeWidth={2} /> : <Eye size={22} strokeWidth={2} />}
          </BigButton>
        </>
      )}
    </div>
  );
}
