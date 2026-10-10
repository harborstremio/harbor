import { ArrowUpRight } from "lucide-react";
import elfLogo from "@/assets/elfhosted.svg";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { elfProductFor, elfProductUrl } from "@/lib/addons-store/elfhosted";

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
    <button
      type="button"
      onClick={() => openUrl(elfProductUrl(product.slug))}
      className="flex h-11 items-center gap-2 rounded-full border border-edge ps-2 pe-4 text-[13.5px] font-semibold text-ink transition-colors hover:bg-elevated"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-canvas ring-1 ring-edge-soft">
        <img src={elfLogo} alt="" draggable={false} className="h-[18px] w-[18px] object-contain" />
      </span>
      {t("Hosted elsewhere")}
      <ArrowUpRight size={13} strokeWidth={2.2} className="opacity-70" />
    </button>
  );
}
