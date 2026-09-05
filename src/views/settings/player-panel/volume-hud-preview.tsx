import { useT } from "@/lib/i18n";
import { PreviewScreen, PreviewShell } from "../preview-shell";

export function VolumeHudPreview({ position }: { position: string }) {
  const t = useT();
  const spots: Record<string, { x: number; y: number; note: string }> = {
    center: { x: 50, y: 50, note: t("Right in the middle of the picture, hard to miss.") },
    top: { x: 50, y: 17, note: t("Centered along the top edge, clear of the subtitles.") },
    "top-left": { x: 27, y: 17, note: t("Tucked into the upper corner, clear of the subtitles.") },
    "top-right": { x: 73, y: 17, note: t("Tucked into the upper corner, clear of the subtitles.") },
  };
  const spot = spots[position] ?? spots.center;

  return (
    <PreviewShell note={spot.note}>
      <PreviewScreen>
        <span className="absolute inset-0 bg-raised" />
        <span
          className="absolute flex h-[17%] w-[46%] items-center gap-[5px] rounded-[4px] bg-elevated px-[6px]"
          style={{
            insetInlineStart: `${spot.x}%`,
            insetBlockStart: `${spot.y}%`,
            translate: "-50% -50%",
            transition:
              "inset-inline-start 300ms ease-in-out, inset-block-start 300ms ease-in-out",
          }}
        >
          <span className="h-0 w-0 shrink-0 border-y-[4px] border-s-[6px] border-y-transparent border-s-ink-subtle" />
          <span className="h-[4px] min-w-0 flex-1 rounded-full bg-raised">
            <span className="block h-full w-[62%] rounded-full bg-accent" />
          </span>
        </span>
      </PreviewScreen>
    </PreviewShell>
  );
}
