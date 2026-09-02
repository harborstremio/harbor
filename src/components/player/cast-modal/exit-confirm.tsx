import { Check } from "lucide-react";
import { useState } from "react";
import { useT } from "@/lib/i18n";

export const SKIP_EXIT_CONFIRM_KEY = "harbor.player.skipExitConfirm";

export function ExitConfirm({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: (remember: boolean) => void;
}) {
  const t = useT();
  const [remember, setRemember] = useState(false);

  return (
    <div className="w-full max-w-sm rounded-2xl bg-neutral-900/90 p-6 ring-1 ring-white/12 shadow-[0_32px_90px_-24px_rgba(0,0,0,0.9)] backdrop-blur-2xl animate-in zoom-in-95 fade-in duration-150">
      <h3 className="text-[17px] font-semibold text-white">{t("Exit this video?")}</h3>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/60">
        {t("You'll leave the player and open the full details page.")}
      </p>

      <button
        type="button"
        onClick={() => setRemember((v) => !v)}
        className="group mt-5 flex items-center gap-2.5"
      >
        <span
          className={`flex h-[18px] w-[18px] items-center justify-center rounded-sm ring-1 transition-colors ${
            remember ? "bg-white ring-white" : "bg-white/5 ring-white/25 group-hover:ring-white/45"
          }`}
        >
          {remember && <Check size={13} strokeWidth={3.2} className="text-black" />}
        </span>
        <span className="text-[13px] text-white/70">{t("Don't ask me again")}</span>
      </button>

      <div className="mt-6 flex gap-2.5">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-full bg-white/10 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-white/15"
        >
          {t("Keep watching")}
        </button>
        <button
          type="button"
          onClick={() => onConfirm(remember)}
          className="flex-1 rounded-full bg-white py-2.5 text-[13.5px] font-semibold text-black transition-transform hover:scale-[1.03]"
        >
          {t("Exit")}
        </button>
      </div>
    </div>
  );
}
