import { useState } from "react";
import { useSubTabs } from "./sub-tabs";
import { fillStyle, SliderReset } from "@/components/slider";
import { DEFAULT } from "@/lib/settings/defaults";
import { Gamepad2 } from "./icons";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { useGamepads } from "@/lib/gamepad/store";
import { ROW_DESC, Section, ToggleRow } from "./shared";
import { SettingGroup, SettingRow } from "./kit";
import { ButtonGlyph, type GlyphKind } from "./controllers-panel/button-glyphs";
import { ControllerPreview } from "./controllers-panel/controller-preview";
import { CursorSection } from "./controllers-panel/cursor-section";

type MapRow = { glyph: GlyphKind; action: string };

const BROWSE_MAP: MapRow[] = [
  { glyph: "dpad", action: "Move focus" },
  { glyph: "south", action: "Select" },
  { glyph: "east", action: "Back" },
  { glyph: "center", action: "Home" },
];

const PLAYER_MAP: MapRow[] = [
  { glyph: "south", action: "Play or pause" },
  { glyph: "west", action: "Subtitles" },
  { glyph: "north", action: "Stats overlay" },
  { glyph: "bumpers", action: "Previous or next episode" },
  { glyph: "triggers", action: "Seek back or forward" },
  { glyph: "dpadVertical", action: "Volume up or down" },
  { glyph: "east", action: "Exit player" },
];

type Tab = "setup" | "mapping";

export function ControllersPanel() {
  const [tab, setTab] = useState<Tab>("setup");
  const t = useT();
  const { settings, update } = useSettings();
  const gamepads = useGamepads();
  const enabled = settings.controllerSupportEnabled;

  useSubTabs(
    [
      { id: "setup", label: t("Setup") },
      { id: "mapping", label: t("Buttons & sticks") },
    ],
    tab,
    (id) => setTab(id as Tab),
  );

  return (
    <div key={tab} className="harbor-cascade flex flex-col gap-10">
      {tab === "setup" && (
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

          {enabled && <CursorSection />}

          <Section
            title={t("Connected controllers")}
            subtitle={t(
              "Controllers Harbor can see right now. Connect one over USB or Bluetooth and it shows up here.",
            )}
          >
            {gamepads.length === 0 ? (
              <div className="flex items-start gap-2.5 rounded-[10px] bg-elevated px-4 py-3">
                <Gamepad2
                  size={18}
                  strokeWidth={1.9}
                  className="mt-[3px] shrink-0 text-ink-subtle"
                />
                <p className={`max-w-[66ch] ${ROW_DESC}`}>
                  {t("No controllers detected. Connect one over USB or Bluetooth.")}
                </p>
              </div>
            ) : (
              gamepads.map((pad) => (
                <SettingRow
                  key={pad.id}
                  label={pad.name}
                  icon={<Gamepad2 size={20} strokeWidth={1.9} />}
                >
                  <span className="flex items-center gap-2 text-[15.5px] leading-[22px] text-ink-muted">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-success" />
                    {t("Connected")}
                  </span>
                </SettingRow>
              ))
            )}
          </Section>
        </>
      )}
      {tab === "mapping" && (
        <>
          <Section
            title={t("Button map")}
            subtitle={t(
              "How the buttons map in each context. Xbox glyphs are listed first, PlayStation second. The layout is fixed and cannot be changed.",
            )}
          >
            <MapGroup heading={t("Browsing")} rows={BROWSE_MAP} />
            <MapGroup heading={t("In the player")} rows={PLAYER_MAP} />
          </Section>

          <Section
            title={t("Stick and timing")}
            subtitle={t(
              "Fine-tune how far you push the stick before it registers and how quickly held directions repeat.",
            )}
          >
            <SliderRow
              label={t("Deadzone")}
              sub={t(
                "How far you push the stick before Harbor reacts. Raise it if the focus drifts on its own.",
              )}
              min={0.05}
              max={0.6}
              step={0.05}
              value={settings.controllerDeadzone}
              display={`${Math.round(settings.controllerDeadzone * 100)}%`}
              resetTo={DEFAULT.controllerDeadzone}
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
              resetTo={DEFAULT.controllerRepeatMs}
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
              resetTo={DEFAULT.controllerInitialDelayMs}
              onChange={(v) => update({ controllerInitialDelayMs: v })}
            />
          </Section>
        </>
      )}
    </div>
  );
}

function MapGroup({ heading, rows }: { heading: string; rows: MapRow[] }) {
  const t = useT();
  return (
    <SettingGroup label={heading}>
      {rows.map((row) => (
        <SettingRow key={row.glyph + row.action} label={t(row.action)}>
          <span className="flex shrink-0 items-center gap-2.5 text-ink">
            <ButtonGlyph kind={row.glyph} pad="xbox" />
            <span className="h-5 w-px shrink-0 bg-edge-soft" />
            <ButtonGlyph kind={row.glyph} pad="ps" />
          </span>
        </SettingRow>
      ))}
    </SettingGroup>
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
  resetTo,
  onChange,
}: {
  label: string;
  sub: string;
  min: number;
  max: number;
  step: number;
  value: number;
  display: string;
  resetTo?: number;
  onChange: (v: number) => void;
}) {
  return (
    <SettingRow wide label={label} desc={sub}>
      <div className="flex h-11 w-full max-w-[520px] items-center gap-4">
        <input
          type="range"
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="harbor-slider min-w-0 flex-1"
          style={fillStyle(value, min, max, step)}
        />
        <span className="w-[64px] shrink-0 text-end text-[15.5px] font-medium tabular-nums text-ink">
          {display}
        </span>
        {resetTo !== undefined && (
          <SliderReset show={value !== resetTo} onReset={() => onChange(resetTo)} />
        )}
      </div>
    </SettingRow>
  );
}
