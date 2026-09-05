import { useT } from "@/lib/i18n";
import { PreviewShell } from "../preview-shell";

const RAMPS: Record<string, number[]> = {
  auto: [0, 2, 5, 10, 17, 28, 40, 56],
  oled: [0, 4, 9, 15, 22, 31, 42, 56],
  lcd: [0, 0, 1, 4, 12, 24, 39, 56],
};

export function DisplayPanelPreview({ panel }: { panel: string }) {
  const t = useT();
  const ramp = RAMPS[panel] ?? RAMPS.auto;
  const notes: Record<string, string> = {
    auto: t("Harbor reads your display and lands between the two."),
    oled: t("Deep shadows keep their steps, so dark scenes stay readable."),
    lcd: t("The darkest steps flatten together, which is how an LCD really behaves."),
  };

  return (
    <PreviewShell note={notes[panel] ?? notes.auto}>
      <div
        aria-hidden
        className="flex h-[52px] w-[260px] max-w-full overflow-hidden rounded-md ring-1 ring-inset ring-edge-soft"
      >
        {ramp.map((mix, i) => (
          <span
            key={i}
            className="h-full flex-1"
            style={{
              backgroundColor: `color-mix(in oklch, var(--color-ink) ${mix}%, var(--color-canvas))`,
              transition: "background-color 300ms ease-in-out",
            }}
          />
        ))}
      </div>
    </PreviewShell>
  );
}
