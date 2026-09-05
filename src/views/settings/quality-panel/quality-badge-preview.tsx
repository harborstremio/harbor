import { useT } from "@/lib/i18n";
import { PreviewShell } from "../preview-shell";

const FADE = "absolute inset-0 transition-opacity duration-300 ease-in-out";
const CHIP =
  "inline-flex h-[26px] shrink-0 items-center rounded-[6px] border border-edge-soft px-2 text-[15.5px] leading-[20px] text-ink-muted";

export function QualityBadgePreview({ style }: { style: string }) {
  const t = useT();
  const bar = style !== "chips";

  return (
    <PreviewShell
      note={
        bar
          ? t("An accent line down the side, with each line revealed as it arrives.")
          : t("Small outlined pills that slide in under the title.")
      }
    >
      <div
        aria-hidden
        className="w-[260px] max-w-full overflow-hidden rounded-md bg-canvas p-4 ring-1 ring-inset ring-edge-soft"
      >
        <span className="block truncate text-[16.5px] font-semibold leading-[24px] text-ink">
          The Godfather
        </span>
        <div className="relative mt-2 h-[60px]">
          <div className={`${FADE} flex items-start gap-2.5 ${bar ? "opacity-100" : "opacity-0"}`}>
            <span className="mt-[3px] h-[38px] w-[3px] shrink-0 rounded-full bg-accent" />
            <span className="flex min-w-0 flex-col text-[15.5px] leading-[19px] text-ink-muted">
              <span className="truncate">4K · Dolby Vision</span>
              <span className="truncate">TrueHD 7.1</span>
            </span>
          </div>
          <div
            className={`${FADE} flex flex-wrap content-start items-start gap-2 ${
              bar ? "opacity-0" : "opacity-100"
            }`}
          >
            <span className={CHIP}>4K</span>
            <span className={CHIP}>Dolby Vision</span>
            <span className={CHIP}>TrueHD 7.1</span>
          </div>
        </div>
      </div>
    </PreviewShell>
  );
}
