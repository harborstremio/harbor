import { useT } from "@/lib/i18n";
import { PreviewShell } from "../preview-shell";

export function VolumeBoostPreview({ max }: { max: number }) {
  const t = useT();
  const safe = max >= 1 ? max : 1;
  const normalPct = 100 / safe;
  const pct = Math.round(safe * 100);

  return (
    <PreviewShell
      note={
        safe <= 1
          ? t("The volume bar stops at 100 percent. No boost is available.")
          : t("The bar runs to {pct} percent. Everything past the mark is boost.", { pct })
      }
    >
      <div aria-hidden className="w-[260px] max-w-full">
        <div className="relative h-[12px] overflow-hidden rounded-full bg-raised">
          <span
            className="absolute inset-y-0 bg-accent/35"
            style={{
              insetInlineStart: 0,
              inlineSize: "100%",
            }}
          />
          <span
            className="absolute inset-y-0 rounded-full bg-accent"
            style={{
              insetInlineStart: 0,
              inlineSize: `${normalPct}%`,
              transition: "inline-size 300ms ease-in-out",
            }}
          />
          <span
            className="absolute inset-y-0 w-[2px] bg-canvas"
            style={{
              insetInlineStart: `calc(${normalPct}% - 1px)`,
              opacity: safe <= 1 ? 0 : 1,
              transition: "inset-inline-start 300ms ease-in-out, opacity 300ms ease-in-out",
            }}
          />
        </div>
      </div>
    </PreviewShell>
  );
}
