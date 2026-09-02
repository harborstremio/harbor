import { fillStyle } from "@/components/slider";
import { Dropdown } from "@/components/dropdown";
import { Hourglass, Moon, Play, Sparkles, Text, Type, Volume1, Volume2, Waves, ZoomIn } from "lucide-react";
import type { ReactNode } from "react";
import { useSampleArtwork } from "@/lib/sample-artwork";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { Section, ToggleRow } from "../shared";
import { SettingGroup, SettingRow, Nested } from "../kit";
import { PosterCardSection } from "./display/poster-card-section";
import { SFX } from "@/lib/sfx";

export function AmbienceSection() {
  const t = useT();
  const { settings, update } = useSettings();
  const soundEffectsEnabled = settings.soundTheme !== "none";
  return (
    <>
      <Section
        title={t("Screensaver")}
        subtitle={t("When Harbor sits idle in the foreground, it drifts through cinematic backdrops with a clock and what's trending. Any movement or key brings you back. Off by default.")}
      >
        <SettingGroup>
          <ToggleRow
            label={t("Ambient screensaver")}
            sub={t("Drift through cinematic backdrops while Harbor sits idle.")}
            value={settings.screensaver}
            onChange={(v) => update({ screensaver: v })}
            leading={<RowIcon on={settings.screensaver}><Moon size={16} strokeWidth={2.2} /></RowIcon>}
          />
          {settings.screensaver && (
            <Nested>
              <SettingRow
                icon={<Hourglass size={16} strokeWidth={1.9} />}
                label={t("Start after")}
                desc={t("How long Harbor waits before drifting off.")}
              >
                <Picker
                  value={String(settings.screensaverDelayMin)}
                  options={[
                    { value: "1", label: t("1 min") },
                    { value: "3", label: t("3 min") },
                    { value: "5", label: t("5 min") },
                    { value: "10", label: t("10 min") },
                    { value: "15", label: t("15 min") },
                  ]}
                  onChange={(v) => update({ screensaverDelayMin: Number(v) })}
                />
              </SettingRow>
            </Nested>
          )}
        </SettingGroup>
      </Section>

      <Section
        title={t("Sound effects")}
        subtitle={t("Subtle audio feedback as you navigate and click. Off by default; pick a style to turn it on.")}
      >
        <SettingGroup>
          <SettingRow
            icon={<Volume2 size={16} strokeWidth={1.9} />}
            label={t("Sound style")}
            desc={t("Pick a style to turn interface sounds on.")}
          >
            <Picker
              value={settings.soundTheme}
              options={[
                { value: "none", label: t("Off") },
                { value: "glass", label: t("Glass") },
                { value: "modern", label: t("Modern") },
                { value: "retro", label: t("Retro") },
                { value: "cinematic", label: t("Cinematic") },
              ]}
              onChange={(v) => update({ soundTheme: v as "none" | "glass" | "modern" | "retro" | "cinematic" })}
            />
          </SettingRow>

          {soundEffectsEnabled && (
            <Nested>
              <SliderRow
                label={t("Sound effects volume")}
                desc={t("How loud the interface sounds are.")}
                icon={<Volume1 size={16} strokeWidth={1.9} />}
                value={settings.sfxVolume ?? 50}
                min={0}
                max={100}
                step={5}
                readout={`${settings.sfxVolume ?? 50}%`}
                onChange={(volume) => {
                  update({ sfxVolume: volume });
                  SFX.setVolume(volume / 100);
                  SFX.click();
                }}
              />

              <ToggleRow
                label={t("Player volume sounds")}
                sub={t("Play a short sound when changing the player volume. Off by default.")}
                value={settings.playerVolumeSfx}
                onChange={(value) => update({ playerVolumeSfx: value })}
                leading={<RowIcon on={settings.playerVolumeSfx}><Play size={16} strokeWidth={2.2} /></RowIcon>}
              />
            </Nested>
          )}
        </SettingGroup>
      </Section>
    </>
  );
}

export function DisplaySection() {
  const t = useT();
  const { settings, update } = useSettings();
  const glassBlur = Number.isFinite(settings.defaultLiquidGlassBlur) ? settings.defaultLiquidGlassBlur : 2;
  const glassTint = Number.isFinite(settings.defaultLiquidGlassTint) ? settings.defaultLiquidGlassTint : 40;
  const { poster: previewPoster } = useSampleArtwork();
  return (
    <>
      <PosterCardSection previewPoster={previewPoster} />
      <Section
        title={t("Title text")}
        subtitle={t("Resize the row titles on Home and the title shown in the player, without scaling the rest of the interface. You can also lead the player title with the series name instead of the episode.")}
      >
        <SettingGroup>
          <SizeSlider
            label={t("Row titles")}
            desc={t("Headings above every row on Home.")}
            icon={<Type size={16} strokeWidth={1.9} />}
            value={settings.rowTitleScale}
            onChange={(v) => update({ rowTitleScale: v })}
          />
          <SizeSlider
            label={t("Player title")}
            desc={t("The title shown at the top of the player.")}
            icon={<Text size={16} strokeWidth={1.9} />}
            value={settings.playerTitleScale}
            onChange={(v) => update({ playerTitleScale: v })}
          />
          <ToggleRow
            label={t("Show series name first in the player")}
            sub={t("Lead with the show name instead of the episode title at the top of the player.")}
            value={settings.playerTitleSeriesFirst}
            onChange={(v) => update({ playerTitleSeriesFirst: v })}
          />
        </SettingGroup>
      </Section>

      <Section
        title={t("Accessibility")}
        subtitle={t("Make everything bigger and easier to read: sidebar, menus, popups, every page.")}
      >
        <SettingGroup>
          <SliderRow
            label={t("Interface scale")}
            desc={t("Scales the whole interface live as you drag.")}
            tip={t("Make everything bigger and easier to read: sidebar, menus, popups, every page. The whole interface scales live as you drag, so you can see the change right here. Great on 4K and ultrawide monitors, or whenever the text feels small.")}
            icon={<ZoomIn size={16} strokeWidth={1.9} />}
            value={settings.uiScale}
            min={0.8}
            max={1.6}
            step={0.05}
            readout={`${Math.round(settings.uiScale * 100)}%`}
            resetTo={1}
            onChange={(uiScale) => update({ uiScale })}
          />
        </SettingGroup>
      </Section>

      <Section
        title={t("Liquid Glass")}
        subtitle={t("Frosted, refractive surfaces on Harbor's floating controls.")}
      >
        <SettingGroup>
          <ToggleRow
            label={t("Use liquid glass")}
            newId="theme:liquid-glass"
            sub={t("Use liquid glass for the search pill and row scroll arrows. The appearance settings below are shared by glass surfaces across Harbor.")}
            value={settings.liquidGlass}
            onChange={(v) => update({ liquidGlass: v })}
            leading={<RowIcon on={settings.liquidGlass}><Waves size={16} strokeWidth={2.2} /></RowIcon>}
          />
          {settings.liquidGlass && (
            <Nested>
              <ToggleRow
                label={t("Enhanced liquid glass")}
                sub={t("A richer glass treatment. May look better while using more graphics resources.")}
                value={settings.experimentalLiquidGlassEnabled}
                onChange={(v) => update({ experimentalLiquidGlassEnabled: v })}
                leading={
                  <RowIcon on={settings.experimentalLiquidGlassEnabled}>
                    <Sparkles size={16} strokeWidth={2.2} />
                  </RowIcon>
                }
              />
              {settings.experimentalLiquidGlassEnabled ? (
                <SliderRow
                  label={t("Glass opacity")}
                  desc={t("How solid the enhanced glass looks.")}
                  value={settings.experimentalLiquidGlassOpacity}
                  min={5}
                  max={100}
                  step={5}
                  readout={`${settings.experimentalLiquidGlassOpacity}%`}
                  onChange={(experimentalLiquidGlassOpacity) => update({ experimentalLiquidGlassOpacity })}
                />
              ) : (
                <>
                  <SliderRow
                    label={t("Glass blur")}
                    desc={t("How much the surface blurs what is behind it.")}
                    value={glassBlur}
                    min={0}
                    max={8}
                    step={0.5}
                    readout={`${glassBlur}px`}
                    onChange={(defaultLiquidGlassBlur) => update({ defaultLiquidGlassBlur })}
                  />
                  <SliderRow
                    label={t("Glass tint")}
                    desc={t("How much theme color the surface carries.")}
                    value={glassTint}
                    min={0}
                    max={100}
                    step={5}
                    readout={`${glassTint}%`}
                    onChange={(defaultLiquidGlassTint) => update({ defaultLiquidGlassTint })}
                  />
                </>
              )}
            </Nested>
          )}
        </SettingGroup>
      </Section>


    </>
  );
}

export { Nested } from "../kit";

export function RowIcon({ on, children }: { on?: boolean; children: ReactNode }) {
  return (
    <span
      className={`flex h-9 w-9 items-center justify-center rounded-md ${
        on ? "bg-accent text-canvas" : "bg-raised text-ink-subtle"
      }`}
    >
      {children}
    </span>
  );
}

export function Picker<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <Dropdown
      size="sm"
      value={value}
      onChange={(v) => onChange(v as T)}
      options={options.map((o) => ({ value: o.value, label: o.label }))}
      className="w-[200px] shrink-0"
    />
  );
}

export function SliderRow({
  label,
  desc,
  tip,
  icon,
  value,
  min,
  max,
  step,
  readout,
  resetTo,
  onChange,
}: {
  label: string;
  desc?: string;
  tip?: string;
  icon?: ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  readout: string;
  resetTo?: number;
  onChange: (v: number) => void;
}) {
  const t = useT();
  return (
    <SettingRow wide label={label} desc={desc} tip={tip} icon={icon}>
      <div className="flex w-full items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="harbor-slider min-w-0 flex-1"
          style={fillStyle(value, min, max)}
        />
        <span className="w-16 shrink-0 text-end text-[15px] font-semibold tabular-nums text-ink">
          {readout}
        </span>
        {resetTo !== undefined && value !== resetTo && (
          <button
            type="button"
            onClick={() => onChange(resetTo)}
            className="harbor-press-pop h-8 shrink-0 rounded-md bg-canvas px-3 text-[12.5px] font-semibold text-ink-subtle transition-colors hover:text-ink"
          >
            {t("Reset")}
          </button>
        )}
      </div>
    </SettingRow>
  );
}

function SizeSlider({
  label,
  desc,
  icon,
  value,
  onChange,
}: {
  label: string;
  desc?: string;
  icon?: ReactNode;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <SliderRow
      label={label}
      desc={desc}
      icon={icon}
      value={value}
      min={0.8}
      max={1.6}
      step={0.05}
      readout={`${Math.round(value * 100)}%`}
      resetTo={1}
      onChange={onChange}
    />
  );
}
