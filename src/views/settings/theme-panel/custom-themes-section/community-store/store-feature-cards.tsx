import { ShieldCheck, Upload } from "../../../icons";
import { useT } from "@/lib/i18n";

export function StoreFeatureCards({ onShare }: { onShare: () => void }) {
  const t = useT();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-3 rounded-md bg-surface p-5 ring-1 ring-edge-soft">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-elevated text-ink-muted">
          <ShieldCheck size={22} />
        </span>
        <div className="flex flex-col gap-1">
          <h3 className="text-[16.5px] font-semibold leading-[24px] tracking-[-0.1px] text-ink">
            {t("Safe by design")}
          </h3>
          <p className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-muted">
            {t(
              "Every theme is sandboxed, scanned, and reviewed before it reaches the library, so you can try any look without a second thought.",
            )}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-3 rounded-md bg-surface p-5 ring-1 ring-edge-soft">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-elevated text-ink-muted">
          <Upload size={22} />
        </span>
        <div className="flex flex-col gap-1">
          <h3 className="text-[16.5px] font-semibold leading-[24px] tracking-[-0.1px] text-ink">
            {t("Publish your own")}
          </h3>
          <p className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-muted">
            {t(
              "Made a look you love? Share it with the community in a couple of clicks and watch the downloads roll in.",
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onShare}
          className="mt-1 inline-flex h-11 w-fit items-center gap-2 rounded-md bg-ink px-5 text-[15.5px] font-semibold text-canvas transition-[opacity,transform] hover:opacity-90 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:active:scale-100"
        >
          <Upload size={16} strokeWidth={2.2} /> {t("Share a theme")}
        </button>
      </div>
    </div>
  );
}
