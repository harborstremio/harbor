import { useT } from "@/lib/i18n";
import type { MusicFx, MusicFxKind } from "@/lib/music/fx";
import type { ReleaseKind } from "./release-fx";
import { Hardware, Knob } from "./controls";

const RELEASES: { kind: ReleaseKind; label: string; tone: "amber" | "red" | "cyan" }[] = [
  { kind: "echoOut", label: "dj.fx.echoOut", tone: "amber" },
  { kind: "brake", label: "dj.fx.brake", tone: "red" },
  { kind: "spin", label: "dj.fx.spin", tone: "cyan" },
];

export function FxBay({
  fx,
  adjust,
  release,
  running,
  ready,
  divisions,
  kinds,
}: {
  fx: MusicFx;
  adjust: (patch: Partial<MusicFx>) => void;
  release: (kind: ReleaseKind) => void;
  running: ReleaseKind | null;
  ready: boolean;
  divisions: { beats: number; label: string }[];
  kinds: MusicFxKind[];
}) {
  const t = useT();
  const on = fx.kind !== "off";

  return (
    <div className="dj-bay dj-fx">
      <div className="dj-bay-head">
        <span>{t("dj.fx.title")}</span>
        <span className="dj-bay-note">
          {running ? t(`dj.fx.${running}`) : ready ? t("dj.fx.armed") : t("dj.fx.hint")}
        </span>
      </div>

      <div className="dj-bay-row">
        {kinds.map((kind) => (
          <Hardware
            key={kind}
            tone="cyan"
            lit={fx.kind === kind}
            size="key"
            label={t(`dj.fx.${kind}`)}
            onClick={() => adjust({ kind: fx.kind === kind ? "off" : kind })}
          />
        ))}
      </div>

      <div className="dj-strip" role="group" aria-label={t("dj.fx.title")}>
        {divisions.map((division) => (
          <Hardware
            key={division.beats}
            tone="steel"
            lit={on && Math.abs(fx.beats - division.beats) < 0.0001}
            size="chip"
            label={division.label}
            onClick={() => adjust({ beats: division.beats })}
          />
        ))}
      </div>

      <div className="dj-fx-foot">
        <Knob
          label={t("dj.fx.depth")}
          value={fx.depth}
          min={0}
          max={1}
          step={0.01}
          readout={`${Math.round(fx.depth * 100)}%`}
          onChange={(depth) => adjust({ depth })}
          onReset={() => adjust({ depth: 0.5 })}
          tone="cyan"
          size="sm"
        />
        <div className="dj-fx-releases">
          {RELEASES.map((item) => (
            <Hardware
              key={item.kind}
              tone={item.tone}
              lit={running === item.kind}
              size="pad"
              disabled={!ready || running !== null}
              label={t(item.label)}
              onClick={() => release(item.kind)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
