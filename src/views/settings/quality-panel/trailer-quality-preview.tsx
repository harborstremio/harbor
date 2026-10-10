import { useT } from "@/lib/i18n";
import { PreviewScreen, PreviewShell } from "../preview-shell";

const FRAMES: Array<{ id: string; w: number }> = [
  { id: "360p", w: 17 },
  { id: "720p", w: 33 },
  { id: "1080p", w: 50 },
  { id: "best", w: 100 },
];

export function TrailerQualityPreview({ quality }: { quality: string }) {
  const t = useT();
  const notes: Record<string, string> = {
    auto: t("Harbor picks the size your connection can keep up with."),
    "360p": t("640 × 360. Fastest to start, softest picture."),
    "720p": t("1280 × 720."),
    "1080p": t("1920 × 1080. This is what the Watch Trailer button targets."),
    best: t("Up to 3840 × 2160 when the source has it. Takes a beat longer to start."),
  };

  return (
    <PreviewShell note={notes[quality] ?? notes.auto}>
      <PreviewScreen>
        {FRAMES.map((f) => {
          const on = f.id === quality;
          return (
            <span
              key={f.id}
              className="absolute bottom-0 aspect-video rounded-[3px]"
              style={{
                insetInlineStart: 0,
                inlineSize: `${f.w}%`,
                backgroundColor: on
                  ? "color-mix(in oklch, var(--color-accent) 22%, transparent)"
                  : "transparent",
                boxShadow: `inset 0 0 0 1px ${on ? "var(--color-accent)" : "var(--color-edge-soft)"}`,
                transition: "background-color 300ms ease-in-out, box-shadow 300ms ease-in-out",
              }}
            />
          );
        })}
      </PreviewScreen>
    </PreviewShell>
  );
}
