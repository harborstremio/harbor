import { useT } from "@/lib/i18n";
import { PreviewShell } from "../preview-shell";

const CURVES: Record<string, number[]> = {
  off: [50, 50, 50, 50, 50, 50, 50],
  bass: [100, 92, 74, 52, 42, 40, 40],
  voice: [36, 40, 62, 90, 95, 70, 45],
  "bass-reduce": [20, 28, 42, 55, 55, 55, 55],
  night: [42, 46, 52, 58, 55, 48, 44],
};

export function AudioProfilePreview({ profile }: { profile: string }) {
  const t = useT();
  const curve = CURVES[profile] ?? CURVES.off;
  const notes: Record<string, string> = {
    off: t("No shaping. The track plays exactly as it was mixed."),
    bass: t("Low end lifted, for weight on speakers that do not have it."),
    voice: t("Mid range lifted, so dialogue sits forward of the music and effects."),
    "bass-reduce": t("Low end pulled back, kinder to small speakers and to the neighbours."),
    night: t("Everything pulled toward the middle, so nothing jolts you late at night."),
  };

  return (
    <PreviewShell note={notes[profile] ?? notes.off}>
      <div
        aria-hidden
        className="flex h-[76px] w-[260px] max-w-full items-end gap-[6px] rounded-md bg-canvas px-3 py-2.5 ring-1 ring-inset ring-edge-soft"
      >
        {curve.map((h, i) => (
          <span
            key={i}
            className="min-w-0 flex-1 rounded-t-[3px] bg-accent"
            style={{ height: `${h}%`, transition: "height 300ms ease-in-out" }}
          />
        ))}
      </div>
    </PreviewShell>
  );
}
