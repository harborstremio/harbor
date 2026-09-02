import { Check, RotateCcw } from "lucide-react";
import { PencilOutlineIcon } from "@/components/icons/pencil-outline";
import { useT } from "@/lib/i18n";

type Props = {
  editMode: boolean;
  hasChanges: boolean;
  onToggleEdit: () => void;
  onReset: () => void;
  kids?: boolean;
};

function BarButtons({ editMode, hasChanges, onToggleEdit, onReset, kids }: Props) {
  const t = useT();
  return (
    <>
      {editMode && hasChanges && (
        kids ? (
          <button
            onClick={onReset}
            className="flex h-12 items-center gap-2 rounded-full bg-amber-400 px-5 text-[15px] font-extrabold text-[#0e3a43] shadow-[0_8px_20px_-8px_rgba(180,120,0,0.5)] transition-transform hover:scale-105 active:scale-95"
          >
            <RotateCcw size={20} strokeWidth={2.6} />
            {t("Undo All")}
          </button>
        ) : (
          <button
            onClick={onReset}
            className="flex h-8 items-center gap-1.5 rounded-md border border-edge-soft/40 bg-canvas/80 px-2.5 text-[12px] font-medium text-ink-muted backdrop-blur-md transition-colors hover:bg-canvas hover:text-ink"
          >
            <RotateCcw size={12} strokeWidth={2.2} />
            {t("Reset")}
          </button>
        )
      )}
      {kids ? (
        editMode ? (
          <button
            onClick={onToggleEdit}
            className="flex h-12 items-center gap-2 rounded-full bg-[#1f8f88] px-6 text-[16px] font-extrabold text-white shadow-[0_8px_22px_-10px_rgba(20,90,90,0.6)] transition-transform hover:scale-105 active:scale-95"
          >
            <Check size={22} strokeWidth={2.8} />
            {t("All Done")}
          </button>
        ) : (
          <button
            onClick={onToggleEdit}
            className="relative inline-flex transition-transform duration-200 hover:scale-[1.05] active:scale-[0.96]"
          >
            <img
              src="/kids/buttonkids2.svg"
              alt=""
              draggable={false}
              className="block h-10 w-auto select-none"
            />
            <span className="absolute inset-0 flex items-center justify-center gap-1.5 pe-1 text-[13px] font-semibold text-[#36254d]">
              <PencilOutlineIcon size={13} />
              {t("Customize page")}
            </span>
          </button>
        )
      ) : (
        <button
          onClick={onToggleEdit}
          className={`flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-medium backdrop-blur-md transition-colors ${
            editMode
              ? "border-ink bg-ink text-canvas hover:opacity-90"
              : "border-edge-soft/40 bg-canvas/80 text-ink-muted hover:bg-canvas hover:text-ink"
          }`}
        >
          <PencilOutlineIcon size={12} />
          {editMode ? t("Done editing") : t("Customize page")}
        </button>
      )}
    </>
  );
}

export function CatalogCustomizeBar(props: Props) {
  return (
    <>
      <div className="flex items-center justify-end gap-2">
        <BarButtons {...props} />
      </div>
      {props.editMode && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-edge-soft bg-canvas/95 px-3 py-2 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.75)] backdrop-blur-md">
            <BarButtons {...props} />
          </div>
        </div>
      )}
    </>
  );
}
