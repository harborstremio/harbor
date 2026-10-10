import { useT } from "@/lib/i18n";
import { Hardware, Knob } from "./controls";
import { useDeckFx } from "./use-deck-fx";
import type { ReleaseKind } from "./release-fx";

const RELEASES: { kind: ReleaseKind; label: string; tone: "amber" | "red" }[] = [
  { kind: "echoOut", label: "dj.fx.echoOut", tone: "amber" },
  { kind: "brake", label: "dj.fx.brake", tone: "amber" },
  { kind: "spin", label: "dj.fx.spin", tone: "red" },
];

const BANK_LABELS: Record<string, string> = {
  echo: "dj.fx.echo",
  delay: "dj.fx.delay",
  spiral: "dj.fx.spiral",
  wide: "dj.fx.wide",
};

export function FxRack({
  trackKey,
  readPosition,
  bpm,
  armed,
}: {
  trackKey: string;
  readPosition: () => number;
  bpm: number | null;
  armed: boolean;
}) {
  const t = useT();
  const { fx, adjust, release, running, ready, divisions, kinds } = useDeckFx({
    trackKey,
    readPosition,
    bpm,
    armed,
  });
  const live = fx.kind !== "off";
  const tick = divisions.find((entry) => entry.beats === fx.beats)?.label ?? "";

  return (
    <div className="dj-bay">
      <div className="dj-bay-head">
        <span>{t("dj.fx.release")}</span>
        <span className="dj-bay-note">{ready ? "" : t("dj.fx.arming")}</span>
      </div>
      <div className="dj-bay-row">
        {RELEASES.map((item) => (
          <Hardware
            key={item.kind}
            tone={item.tone}
            label={t(item.label)}
            lit={running === item.kind}
            disabled={!ready || running !== null}
            onClick={() => release(item.kind)}
          />
        ))}
      </div>
      <div className="dj-bay-head">
        <span>{t("dj.fx.beat")}</span>
        <span className="dj-bay-note">{live ? `${t(BANK_LABELS[fx.kind])} ${tick}` : ""}</span>
      </div>
      <div className="dj-bay-row">
        {kinds.map((kind) => (
          <Hardware
            key={kind}
            tone="cyan"
            label={t(BANK_LABELS[kind])}
            lit={fx.kind === kind}
            onClick={() => adjust({ kind: fx.kind === kind ? "off" : kind })}
          />
        ))}
      </div>
      <div className="dj-fx-depth">
        <Knob
          label={t("dj.fx.depth")}
          value={fx.depth}
          min={0}
          max={1}
          readout={`${Math.round(fx.depth * 100)}%`}
          onChange={(depth) => adjust({ depth })}
          onReset={() => adjust({ depth: 0.5 })}
          tone="cyan"
        />
        <div className="dj-fx-bank" role="group" aria-label={t("dj.fx.beats")}>
          {divisions.map((entry) => (
            <Hardware
              key={entry.beats}
              tone="cyan"
              label={entry.label}
              lit={fx.beats === entry.beats}
              onClick={() => adjust({ beats: entry.beats })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
