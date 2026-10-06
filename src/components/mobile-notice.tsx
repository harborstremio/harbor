import { HarborMark } from "@/components/icons/harbor-mark";
import { useT } from "@/lib/i18n";

export function MobileNotice() {
  const t = useT();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-7 bg-canvas px-8 text-center">
      <div className="flex items-center gap-3 text-ink">
        <HarborMark className="h-9 w-9" />
        <span className="font-display text-[36px] font-semibold leading-none tracking-tight">
          Media Vision
        </span>
      </div>
      <div className="flex max-w-md flex-col gap-3.5">
        <h1 className="text-[19px] font-semibold tracking-tight text-ink">
          {t("Built for desktop resolutions")}
        </h1>
        <p className="text-[14.5px] leading-relaxed text-ink-muted">
          {t(
            "This instance of JL Media Vision is made for desktop. Our standalone apps for phones and TVs are coming soon.",
          )}
        </p>
        <p className="text-[14.5px] leading-relaxed text-ink-muted">
          {t("For now, please open this site on a desktop.")}
        </p>
      </div>
    </div>
  );
}
