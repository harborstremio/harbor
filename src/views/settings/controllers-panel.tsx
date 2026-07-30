import { Gamepad2 } from "lucide-react";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { useGamepads } from "@/lib/gamepad/store";
import { Section, ToggleRow } from "./shared";
import { ControllerPreview } from "./controllers-panel/controller-preview";

const BROWSE_MAP: Array<{ control: string; action: string }> = [
  { control: "D-pad", action: "Move focus" },
  { control: "A / Cross", action: "Select" },
  { control: "B / Circle", action: "Back" },
  { control: "Menu / Options", action: "Home" },
];

const PLAYER_MAP: Array<{ control: string; action: string }> = [
  { control: "A / Cross", action: "Play or pause" },
  { control: "X / Square", action: "Subtitles" },
  { control: "Y / Triangle", action: "Stats overlay" },
  { control: "Bumpers (LB / RB)", action: "Previous or next episode" },
  { control: "Triggers (LT / RT)", action: "Seek back or forward" },
  { control: "D-pad up / down", action: "Volume up or down" },
  { control: "B / Circle", action: "Exit player" },
];

export function ControllersPanel() {
  const t = useT();
  const { settings, update } = useSettings();
  const gamepads = useGamepads();
  const enabled = settings.controllerSupportEnabled;

  return (
    <>
      <Section
        title={t("Controller support")}
        subtitle={t(
          "Use a game controller to browse Harbor and control playback. Works with Xbox, PlayStation, and most USB or Bluetooth gamepads.",
        )}
      >
        <ToggleRow
          label={t("Enable controller")}
          sub={t(
            "When on, a connected controller moves focus around Harbor and drives the player. Turn it off to ignore all controllers.",
          )}
          value={enabled}
          onChange={(v) => update({ controllerSupportEnabled: v })}
        />
        {enabled && (
          <ToggleRow
            label={t("Keep controlling Harbor in the background")}
            sub={t(
              "Off by default, so your controller only drives Harbor while it is the focused window. Leave it off if you play games with the same controller.",
            )}
            value={settings.controllerBackgroundInput}
            onChange={(v) => update({ controllerBackgroundInput: v })}
          />
        )}
      </Section>

      <ControllerPreview enabled={enabled} />

      <Section
        title={t("Connected controllers")}
        subtitle={t(
          "Controllers Harbor can see right now. Connect one over USB or Bluetooth and it shows up here.",
        )}
      >
        {gamepads.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-edge-soft bg-canvas/40 px-4 py-4 text-[13px] text-ink-subtle">
            <Gamepad2 size={18} strokeWidth={1.8} className="shrink-0 text-ink-subtle" />
            {t("No controllers detected. Connect one over USB or Bluetooth.")}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {gamepads.map((pad) => (
              <div
                key={pad.id}
                className="flex items-center gap-3 rounded-xl border border-edge-soft bg-canvas/40 px-4 py-3"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-elevated text-ink ring-1 ring-edge-soft">
                  <Gamepad2 size={17} strokeWidth={1.9} />
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">{pad.name}</span>
                <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-accent">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  {t("Connected")}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section
        title={t("Button map")}
        subtitle={t("How the buttons map in each context. This is a reference; the layout is fixed.")}
      >
        <div className="flex flex-col gap-6">
          <MapGroup heading={t("Browsing")} rows={BROWSE_MAP} />
          <MapGroup heading={t("In the player")} rows={PLAYER_MAP} />
        </div>
      </Section>

      <Section
        title={t("Stick and timing")}
        subtitle={t(
          "Fine-tune how far you push the stick before it registers and how quickly held directions repeat.",
        )}
      >
        <SliderRow
          label={t("Deadzone")}
          sub={t("How far you push the stick before Harbor reacts. Raise it if the focus drifts on its own.")}
          min={0.05}
          max={0.6}
          step={0.05}
          value={settings.controllerDeadzone}
          display={`${Math.round(settings.controllerDeadzone * 100)}%`}
          onChange={(v) => update({ controllerDeadzone: v })}
        />
        <SliderRow
          label={t("Repeat speed")}
          sub={t("How fast a held direction keeps moving the focus.")}
          min={80}
          max={400}
          step={10}
          value={settings.controllerRepeatMs}
          display={t("{n} ms", { n: settings.controllerRepeatMs })}
          onChange={(v) => update({ controllerRepeatMs: v })}
        />
        <SliderRow
          label={t("Initial delay")}
          sub={t("How long you hold a direction before it starts repeating.")}
          min={200}
          max={700}
          step={20}
          value={settings.controllerInitialDelayMs}
          display={t("{n} ms", { n: settings.controllerInitialDelayMs })}
          onChange={(v) => update({ controllerInitialDelayMs: v })}
        />
      </Section>
    </>
  );
}

function MapGroup({ heading, rows }: { heading: string; rows: Array<{ control: string; action: string }> }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-1.5">
      <h4 className="px-1 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">{heading}</h4>
      {rows.map((row) => (
        <div
          key={row.control + row.action}
          className="flex items-center gap-4 rounded-xl border border-edge-soft bg-canvas/40 px-4 py-3"
        >
          <span className="min-w-0 flex-1 text-[14px] font-medium text-ink">{t(row.action)}</span>
          <span className="flex h-8 shrink-0 items-center justify-center rounded-lg border border-edge bg-elevated px-3 text-[12.5px] font-semibold text-ink">
            {t(row.control)}
          </span>
        </div>
      ))}
    </div>
  );
}

function SliderRow({
  label,
  sub,
  min,
  max,
  step,
  value,
  display,
  onChange,
}: {
  label: string;
  sub: string;
  min: number;
  max: number;
  step: number;
  value: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-edge-soft bg-canvas/40 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[14px] font-medium text-ink">{label}</span>
          <span className="text-[12.5px] text-ink-subtle">{sub}</span>
        </div>
        <span className="shrink-0 tabular-nums text-[13px] font-semibold text-ink">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1 w-full appearance-none rounded-full bg-edge-soft accent-ink"
      />
    </div>
  );
}
