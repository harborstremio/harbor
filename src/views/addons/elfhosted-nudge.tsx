import { ArrowUpRight } from "lucide-react";
import elfLogo from "@/assets/elfhosted.svg";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { ELF_BUNDLE, elfProductFor, elfProductUrl } from "@/lib/addons-store/elfhosted";

export function ElfHostedAction({
  addonId,
  addonName,
  transportUrl,
}: {
  addonId?: string | null;
  addonName?: string | null;
  transportUrl?: string | null;
}) {
  const t = useT();
  const product = elfProductFor({ id: addonId, name: addonName, url: transportUrl });
  if (!product) return null;

  return (
    <div className="group/elf relative inline-flex">
      <button
        type="button"
        onClick={() => openUrl(elfProductUrl(product.slug))}
        className="flex h-11 items-center gap-2 rounded-full border border-accent/40 bg-accent-soft ps-2 pe-4 text-[13.5px] font-semibold text-accent transition-colors hover:border-accent hover:bg-accent-soft/80"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-canvas ring-1 ring-edge-soft">
          <img src={elfLogo} alt="" draggable={false} className="h-[18px] w-[18px] object-contain" />
        </span>
        {t("Get your own")}
        <span className="text-[12px] font-medium opacity-70">
          {t("Trial for ${n}", { n: String(ELF_BUNDLE.trialUsd) })}
        </span>
        <ArrowUpRight size={13} strokeWidth={2.2} className="opacity-70" />
      </button>

      <div
        role="tooltip"
        className="pointer-events-none absolute top-[calc(100%+10px)] z-40 w-[290px] translate-y-1 rounded-2xl border border-edge bg-elevated/95 p-3.5 opacity-0 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.75)] backdrop-blur-xl transition-all duration-150 group-hover/elf:translate-y-0 group-hover/elf:opacity-100 start-0"
      >
        <div className="flex items-center gap-2">
          <img src={elfLogo} alt="" draggable={false} className="h-4 w-4 shrink-0 object-contain" />
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-subtle">
            {t("ElfHosted")}
          </span>
        </div>
        <p className="mt-2 text-[13px] font-semibold leading-snug text-ink">
          {t("Your own private {name}, bundled with Debridge", { name: product.label })}
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
          {t("Debridge is the part that finds you a working file. A TorBox and a Usenet account come with it, so you do not need to buy a debrid service separately. Already have Real-Debrid or AllDebrid? Plug it in instead.")}
        </p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">
          {t("No Docker, no server, nothing to configure.")}
        </p>
        <div className="mt-2.5 flex items-center gap-1.5 border-t border-edge-soft pt-2.5">
          <span className="text-[12px] font-semibold text-accent">
            {t("${n} for {days} days", {
              n: String(ELF_BUNDLE.trialUsd),
              days: String(ELF_BUNDLE.trialDays),
            })}
          </span>
          <span className="text-[11.5px] text-ink-subtle">{t("cancel anytime")}</span>
        </div>
      </div>
    </div>
  );
}
