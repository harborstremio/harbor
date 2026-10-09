import { useT } from "@/lib/i18n";
import { PreviewShell } from "../preview-shell";

const TAIL_SEC = 180;

export function UpNextPreview({ leadSec }: { leadSec: number }) {
  const t = useT();
  const off = leadSec === 0;
  const auto = leadSec < 0;
  const shown = auto ? 60 : leadSec;
  const startPct = off ? 100 : Math.max(0, 100 - (shown / TAIL_SEC) * 100);

  let note: string;
  if (off) {
    note = t("No prompt. The episode plays out and stops.");
  } else if (auto) {
    note = t(
      "Harbor scales the prompt to the episode length, so a short episode does not ask this early. The bar shows the last three minutes.",
    );
  } else {
    const label =
      shown >= 120
        ? t("2 minutes")
        : shown >= 90
          ? t("90 seconds")
          : shown >= 60
            ? t("1 minute")
            : t("{n} seconds", { n: shown });
    note = t("The Up Next pill appears {lead} before the end. The bar shows the last three minutes.", {
      lead: label,
    });
  }

  return (
    <PreviewShell note={note}>
      <div aria-hidden className="w-[260px] max-w-full">
        <div className="relative h-[26px]">
          <span
            className="absolute flex h-[20px] w-[58px] items-center justify-center gap-[5px] rounded-full bg-elevated ring-1 ring-edge-soft"
            style={{
              insetInlineStart: `calc(${startPct}% - 29px)`,
              insetBlockStart: 0,
              opacity: off ? 0 : 1,
              transition: "inset-inline-start 300ms ease-in-out, opacity 300ms ease-in-out",
            }}
          >
            <span className="h-0 w-0 border-y-[4px] border-s-[6px] border-y-transparent border-s-accent" />
            <span className="h-[4px] w-[24px] rounded-full bg-ink-subtle/70" />
          </span>
        </div>
        <div className="relative mt-1.5 h-[10px] overflow-hidden rounded-full bg-raised">
          <span
            className="absolute inset-y-0 bg-accent/40"
            style={{
              insetInlineEnd: 0,
              inlineSize: `${100 - startPct}%`,
              transition: "inline-size 300ms ease-in-out",
            }}
          />
          <span
            className="absolute inset-y-0 w-[2px] bg-accent"
            style={{
              insetInlineStart: `calc(${startPct}% - 1px)`,
              opacity: off ? 0 : 1,
              transition: "inset-inline-start 300ms ease-in-out, opacity 300ms ease-in-out",
            }}
          />
        </div>
      </div>
    </PreviewShell>
  );
}
