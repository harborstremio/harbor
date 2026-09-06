import { useT } from "@/lib/i18n";
import { PreviewScreen, PreviewShell } from "../preview-shell";
import filmStill from "@/assets/settings-preview/steamboat-willie.webp";
import { Play } from "@/components/icons/play-filled";

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
          <img src={filmStill} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
          <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/10" />
          <span className="absolute inset-0 grid place-items-center">
            <Play size={24} className="text-white" />
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
          {["1080p", "720p", "480p"].map((quality, i) => (
            <span
              key={i}
              className={`flex h-[23%] items-center justify-between gap-2 rounded-[4px] px-2 ${
                i === 0 ? "bg-accent-soft" : "bg-elevated"
              }`}
            >
              <span className="text-[11px] font-medium text-ink">Steamboat Willie</span>
              <span className="text-[10px] tabular-nums text-ink-muted">{quality}</span>
            </span>
          ))}
        </span>
      </PreviewScreen>
    </PreviewShell>
  );
}
