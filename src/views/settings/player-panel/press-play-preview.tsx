import { useT } from "@/lib/i18n";
import { PreviewScreen, PreviewShell } from "../preview-shell";

const FADE = "absolute inset-0 transition-opacity duration-300 ease-in-out";

export function PressPlayPreview({ instant }: { instant: boolean }) {
  const t = useT();

  return (
    <PreviewShell
      note={
        instant
          ? t("Play starts the best-ranked stream straight away.")
          : t("Play opens the stream list so you pick the release yourself.")
      }
    >
      <PreviewScreen>
        <span className={`${FADE} bg-raised ${instant ? "opacity-100" : "opacity-0"}`}>
          <span className="absolute inset-0 grid place-items-center">
            <span className="h-0 w-0 border-y-[9px] border-s-[14px] border-y-transparent border-s-ink-subtle" />
          </span>
          <span className="absolute inset-x-[8%] bottom-[12%] h-[4px] rounded-full bg-canvas/70">
            <span className="block h-full w-[38%] rounded-full bg-accent" />
          </span>
        </span>
        <span
          className={`${FADE} flex flex-col justify-center gap-[6px] px-[8%] ${
            instant ? "opacity-0" : "opacity-100"
          }`}
        >
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`flex h-[14%] items-center gap-[6px] rounded-[3px] px-[6px] ${
                i === 0 ? "bg-accent-soft" : "bg-elevated"
              }`}
            >
              <span
                className={`h-[4px] rounded-full ${i === 0 ? "w-[46%] bg-accent" : "w-[36%] bg-ink-subtle/70"}`}
              />
              <span className="h-[4px] w-[22%] rounded-full bg-ink-subtle/40" />
            </span>
          ))}
        </span>
      </PreviewScreen>
    </PreviewShell>
  );
}
