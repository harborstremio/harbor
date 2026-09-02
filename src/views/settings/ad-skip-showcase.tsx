import { AdSkipIcon } from "@/components/icons/adskip-icon";
import { useT } from "@/lib/i18n";

export function AdSkipShowcase() {
  const t = useT();
  return (
    <div className="flex flex-col gap-2.5 rounded-md bg-canvas/40 p-3.5 ring-1 ring-edge-soft">
      <div className="relative aspect-[16/7] w-full overflow-hidden rounded-md bg-raised">
        <span className="absolute start-2.5 top-2.5 rounded-md bg-accent px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-canvas">
          {t("Ad")}
        </span>
        <span className="harbor-adskip-pill absolute bottom-2.5 end-2.5 flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-1.5 text-[10.5px] font-semibold text-canvas">
          <AdSkipIcon className="h-3 w-3" />
          {t("Skip injected ad")}
        </span>
      </div>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-canvas">
        <span className="h-full w-[34%] bg-ink-subtle" />
        <span className="h-full w-[22%] bg-accent" />
        <span className="h-full flex-1 bg-ink-subtle/40" />
      </div>
      <div className="flex items-center justify-between text-[10px] font-medium text-ink-subtle">
        <span>{t("Episode")}</span>
        <span className="text-accent">{t("Injected ad")}</span>
        <span>{t("Episode continues")}</span>
      </div>
    </div>
  );
}
