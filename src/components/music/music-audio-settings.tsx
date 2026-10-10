import { useEffect, useRef, useState } from "react";
import { MusicServiceLogo } from "./music-service-logo";
import { musicSourceName } from "@/lib/music/recovery";
import {
  PLAYABLE_MUSIC_SOURCES,
  musicHealthSnapshot,
  preferredMusicSource,
  setPreferredMusicSource,
} from "@/lib/music/sources";
import { ArrowLeft, Disc3, Plus, RefreshCw, X } from "@/components/icons/music-icons";
import { UiIcon } from "@/components/ui-icon";
import { useSettings } from "@/lib/settings";
import { useMusicAppearance } from "@/lib/music/appearance";
import { openDjDeck } from "@/lib/music/dj-deck";
import djDeckPreview from "@/assets/settings-preview/dj-deck.png";
import { useT } from "@/lib/i18n";
import {
  loadMusicAudioDevices,
  MUSIC_EQ_FREQUENCIES,
  normalizeMusicAudio,
  saveMusicAudioSettings,
  useMusicAudioSettings,
  type MusicAudioDevice,
  type MusicAudioSettingsValue,
} from "@/lib/music/audio-settings";
import { Dropdown } from "@/components/dropdown";
import { MusicBroadcast } from "./music-broadcast";
import { MusicEqCurve } from "./music-eq-curve";
import {
  MUSIC_EQ_PRESETS,
  matchEqPreset,
  matchPeqPreset,
  peqPresetFilters,
} from "@/lib/music/eq-presets";
import {
  ListeningControls,
  ListeningProfiles,
  OutputControls,
  ParametricEditor,
} from "./music-listening-lab";
import { MusicDockParts } from "./music-dock-parts";
import { MusicMikuSettings } from "./music-miku-settings";
import { MusicGifSettings } from "./music-gif-settings";
import { useMusicPlayer } from "@/lib/music/player";
import { useMusicAudioMeter } from "@/lib/music/audio-meter";
import { MusicSignalDetails } from "./music-signal-details";
import "./music-audio-settings.css";

function PreferredSourceRow() {
  const t = useT();
  const [value, setValue] = useState(preferredMusicSource);
  const [available, setAvailable] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    void musicHealthSnapshot()
      .then((rows) => {
        if (!alive) return;
        setAvailable(rows.filter((row) => row.health !== "offline").map((row) => row.id));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const ids = PLAYABLE_MUSIC_SOURCES.filter(
    (id) => available.length === 0 || available.includes(id),
  );
  return (
    <section className="music-audio-section">
      <div className="music-audio-row">
        <label>{t("music.audio.preferredSource")}</label>
      </div>
      <Dropdown
        value={value}
        ariaLabel={t("music.audio.preferredSource")}
        className="music-audio-output"
        onChange={(next) => {
          setValue(next);
          setPreferredMusicSource(next);
        }}
        options={ids.map((id) => ({
          value: id,
          label: musicSourceName({ connectorId: id } as Parameters<typeof musicSourceName>[0]),
          left: <MusicServiceLogo source={id} size={18} />,
        }))}
      />
      <p>{t("music.audio.preferredSourceHint")}</p>
    </section>
  );
}

export function MusicAudioSettings({
  onBack,
  connectorId,
}: {
  onBack?: () => void;
  connectorId?: string | null;
}) {
  const t = useT();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  const state = useMusicAudioSettings();
  const player = useMusicPlayer();
  const appearance = useMusicAppearance();
  const dockCompanion =
    Boolean(player.current) &&
    (appearance.mikuVisualizer || (appearance.gifVisualizer && Boolean(appearance.gifId)));
  const [showSignal, setShowSignal] = useState(false);
  const meter = useMusicAudioMeter(player.current, showSignal);
  const [draft, setDraft] = useState(state.settings);
  const [devices, setDevices] = useState<MusicAudioDevice[]>([]);
  const [scanning, setScanning] = useState(true);
  const [deviceFailed, setDeviceFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setDraft(state.settings);
  }, [state.settings]);
  useEffect(() => {
    let cancelled = false;
    setScanning(true);
    setDeviceFailed(false);
    loadMusicAudioDevices()
      .then(
        (result) => {
          if (!cancelled) setDevices(result);
        },
        () => {
          if (!cancelled) setDeviceFailed(true);
        },
      )
      .finally(() => {
        if (!cancelled) setScanning(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);
  const update = (value: Partial<MusicAudioSettingsValue>) => {
    setSaved(false);
    setDraft((current) => normalizeMusicAudio({ ...current, ...value }));
  };
  const live = (value: Partial<MusicAudioSettingsValue>) => {
    setDraft((current) => normalizeMusicAudio({ ...current, ...value }));
    void saveMusicAudioSettings(normalizeMusicAudio({ ...state.settings, ...value })).catch(
      () => {},
    );
  };
  const missing =
    draft.device !== "auto" && !devices.some((device) => device.name === draft.device);
  const dirty = JSON.stringify(draft) !== JSON.stringify(state.settings);
  return (
    <section className="music-audio-settings" aria-labelledby="music-audio-heading">
      {onBack && (
        <button className="music-audio-back" data-music-inner-back onClick={onBack}>
          <ArrowLeft size={17} />
          {t("Back")}
        </button>
      )}
      <header>
        <h2 id="music-audio-heading" tabIndex={-1} ref={heading}>
          {t("music.audio.title")}
        </h2>
        <p>{t("music.audio.scope")}</p>
      </header>
      {connectorId === "spotify" && <p className="music-audio-note">{t("music.audio.spotify")}</p>}
      {player.current && (
        <details
          className="music-lab-import"
          onToggle={(event) => setShowSignal(event.currentTarget.open)}
        >
          <summary>{t("music.quality.title")}</summary>
          {showSignal && (
            <MusicSignalDetails
              track={player.current}
              audioSettings={state.settings}
              meter={meter}
              outputLabel={
                devices.find((device) => device.name === state.settings.device)?.description
              }
            />
          )}
        </details>
      )}
      <fieldset disabled={!state.ready || state.saving}>
        <PreferredSourceRow />
        <ListeningProfiles draft={draft} update={update} />
        <section className="music-audio-section">
          <div className="music-audio-row">
            <label>{t("music.audio.output")}</label>
            <button
              type="button"
              onClick={() => setRefresh((value) => value + 1)}
              disabled={scanning}
              aria-label={t("music.audio.refresh")}
            >
              <RefreshCw size={16} />
              {t("music.audio.refresh")}
            </button>
          </div>
          <Dropdown
            value={draft.device}
            ariaLabel={t("music.audio.output")}
            className="music-audio-output"
            onChange={(device) => update({ device })}
            options={[
              { value: "auto", label: t("music.audio.system") },
              ...(missing ? [{ value: draft.device, label: t("music.audio.missing") }] : []),
              ...devices
                .filter((device) => device.name !== "auto")
                .map((device) => ({
                  value: device.name,
                  label: device.description || device.name,
                })),
            ]}
          />
          <p>{t("music.audio.detect")}</p>
          <label htmlFor="music-equipment-label">{t("music.audio.equipment")}</label>
          <input
            id="music-equipment-label"
            type="text"
            maxLength={100}
            value={draft.equipmentLabel}
            onChange={(event) => {
              setSaved(false);
              setDraft((current) => ({ ...current, equipmentLabel: event.target.value }));
            }}
          />
          <p>{t("music.audio.equipmentHelp")}</p>
          <OutputControls draft={draft} update={update} />
          {deviceFailed && <p role="status">{t("music.audio.deviceError")}</p>}
          {missing && !scanning && !deviceFailed && (
            <p role="status">{t("music.audio.missingHelp")}</p>
          )}
        </section>
        <SpeedSection draft={draft} live={live} />
        <MusicBroadcast />
        <section className="music-audio-section music-deck-preview">
          <div className="music-deck-preview-copy">
            <div className="music-audio-row">
              <span className="music-audio-title">{t("dj.title")}</span>
            </div>
            <p>{t("dj.blurb")}</p>
            <button
              type="button"
              className="music-speed-chip-add"
              onClick={() => void openDjDeck().catch(() => {})}
            >
              <Disc3 size={14} />
              {t("dj.open")}
            </button>
          </div>
          <img
            className="music-deck-preview-image"
            src={djDeckPreview}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        </section>
        <section className="music-audio-section">
          <div className="music-audio-row">
            <label className="music-audio-toggle">
              <input
                type="checkbox"
                checked={draft.eqEnabled}
                onChange={(event) => update({ eqEnabled: event.target.checked })}
              />
              {t("music.lab.equalizer")}
            </label>
            <button
              type="button"
              onClick={() =>
                update(
                  draft.eqMode === "graphic" ? { eqBands: Array(10).fill(0) } : { peqFilters: [] },
                )
              }
            >
              {t("music.audio.reset")}
            </button>
          </div>
          <p>{t("music.audio.eqHelp")}</p>
          <div className="music-audio-row music-eq-modes">
            <span className="music-eq-mode-field">
              <label>{t("music.lab.mode")}</label>
              <Dropdown
                value={draft.eqMode}
                ariaLabel={t("music.lab.mode")}
                onChange={(value) => update({ eqMode: value as MusicAudioSettingsValue["eqMode"] })}
                options={[
                  { value: "graphic", label: t("music.audio.equalizer") },
                  { value: "parametric", label: t("music.lab.parametric") },
                ]}
              />
            </span>
            <span className="music-eq-mode-field">
              <label>{t("music.audio.presets")}</label>
              {draft.eqMode === "parametric" ? (
                <Dropdown
                  value={matchPeqPreset(draft.peqFilters, MUSIC_EQ_FREQUENCIES)}
                  ariaLabel={t("music.audio.presets")}
                  onChange={(value) => {
                    const preset = MUSIC_EQ_PRESETS.find((item) => item.id === value);
                    if (preset)
                      update({
                        peqFilters: peqPresetFilters(preset, MUSIC_EQ_FREQUENCIES),
                        eqEnabled: true,
                      });
                  }}
                  options={[
                    ...(matchPeqPreset(draft.peqFilters, MUSIC_EQ_FREQUENCIES) === "custom"
                      ? [{ value: "custom", label: t("music.eq.preset.custom") }]
                      : []),
                    ...MUSIC_EQ_PRESETS.map((preset) => ({
                      value: preset.id,
                      label: t(preset.labelKey),
                    })),
                  ]}
                />
              ) : (
                <Dropdown
                  value={matchEqPreset(draft.eqBands)}
                  ariaLabel={t("music.audio.presets")}
                  onChange={(value) => {
                    const preset = MUSIC_EQ_PRESETS.find((item) => item.id === value);
                    if (preset) update({ eqBands: [...preset.bands], eqEnabled: true });
                  }}
                  options={[
                    ...(matchEqPreset(draft.eqBands) === "custom"
                      ? [{ value: "custom", label: t("music.eq.preset.custom") }]
                      : []),
                    ...MUSIC_EQ_PRESETS.map((preset) => ({
                      value: preset.id,
                      label: t(preset.labelKey),
                    })),
                  ]}
                />
              )}
            </span>
          </div>
          {draft.eqMode === "parametric" ? (
            <ParametricEditor draft={draft} applied={state.settings} update={update} />
          ) : (
            <>
              <MusicEqCurve
                bands={draft.eqBands}
                disabled={!draft.eqEnabled}
                onChange={(bands) => update({ eqBands: bands })}
              />
              <div className="music-audio-bands">
                {MUSIC_EQ_FREQUENCIES.map((frequency, index) => (
                  <label key={frequency}>
                    <span dir="ltr">
                      {frequency >= 1000 ? `${frequency / 1000}k` : frequency} Hz
                    </span>
                    <input
                      type="range"
                      min={-12}
                      max={12}
                      step={0.5}
                      value={draft.eqBands[index]}
                      disabled={!draft.eqEnabled}
                      aria-label={t("music.audio.band", { frequency })}
                      aria-valuetext={`${draft.eqBands[index]} dB`}
                      onChange={(event) =>
                        update({
                          eqBands: draft.eqBands.map((gain, i) =>
                            i === index ? Number(event.target.value) : gain,
                          ),
                        })
                      }
                    />
                    <output dir="ltr">
                      {draft.eqBands[index] > 0 ? "+" : ""}
                      {draft.eqBands[index]} dB
                    </output>
                  </label>
                ))}
              </div>
            </>
          )}
          <label className="music-audio-toggle">
            <input
              type="checkbox"
              checked={draft.autoHeadroom}
              disabled={!draft.eqEnabled}
              onChange={(event) => update({ autoHeadroom: event.target.checked })}
            />
            {t("music.audio.headroom")}
          </label>
          {draft.eqMode === "graphic" && <p>{t("music.audio.headroomHelp")}</p>}
        </section>
        <section className="music-audio-section">
          <div className="music-audio-row">
            <label htmlFor="music-balance">{t("music.audio.balance")}</label>
            <output>
              {draft.balance === 0
                ? t("music.audio.center")
                : `${t(draft.balance < 0 ? "music.audio.left" : "music.audio.right")} ${Math.round(Math.abs(draft.balance) * 100)}%`}
            </output>
          </div>
          <input
            id="music-balance"
            className="harbor-slider"
            type="range"
            min={-1}
            max={1}
            step={0.05}
            value={draft.balance}
            onChange={(event) => update({ balance: Number(event.target.value) })}
          />
          <p>{t("music.audio.balanceHelp")}</p>
        </section>
        <section className="music-audio-section">
          <div className="music-audio-row">
            <label>{t("music.audio.replayGain")}</label>
            <Dropdown
              value={draft.replayGain}
              ariaLabel={t("music.audio.replayGain")}
              onChange={(value) =>
                update({ replayGain: value as MusicAudioSettingsValue["replayGain"] })
              }
              options={[
                { value: "off", label: t("music.audio.replayOff") },
                { value: "track", label: t("music.audio.replayTrack") },
                { value: "album", label: t("music.audio.replayAlbum") },
              ]}
            />
          </div>
          <p>{t("music.audio.replayHelp")}</p>
        </section>
        <section className="music-audio-section">
          <label className="music-audio-toggle">
            <input
              type="checkbox"
              checked={draft.boostEnabled}
              onChange={(event) => update({ boostEnabled: event.target.checked })}
            />
            {t("music.audio.boost")}
          </label>
          <div className="music-audio-row">
            <label>{t("music.audio.ceiling")}</label>
            <fieldset disabled={!draft.boostEnabled}>
              <Dropdown
                value={String(draft.volumeLimit)}
                ariaLabel={t("music.audio.ceiling")}
                onChange={(value) => update({ volumeLimit: Number(value) })}
                options={[1, 1.5, 2, 3, 4, 5].map((value) => ({
                  value: String(value),
                  label: `${value * 100}%`,
                }))}
              />
            </fieldset>
          </div>
          <p>{t("music.audio.boostHelp")}</p>
        </section>
        <ListeningControls draft={draft} update={update} />
        <MusicDockParts />
        <footer data-dirty={dirty || undefined} data-companion={dockCompanion || undefined}>
          <button
            type="button"
            className="music-audio-apply"
            disabled={!dirty || (missing && draft.device !== state.settings.device)}
            onClick={() => {
              setSaved(false);
              void saveMusicAudioSettings(draft)
                .then(() => setSaved(true))
                .catch(() => {});
            }}
          >
            {t(state.saving ? "music.audio.saving" : "music.audio.apply")}
          </button>
          <span role="status">
            {state.error ? t("music.audio.saveError") : saved ? t("music.audio.saved") : ""}
          </span>
        </footer>
      </fieldset>
      <MusicMikuSettings />
      <MusicGifSettings />
    </section>
  );
}

const SPEED_PRESETS = [
  { id: "normal", icon: "speed-normal", label: "music.speed.normal", speed: 1, reverb: 0, pitch: 0 },
  { id: "nightcore", icon: "speed-nightcore", label: "music.speed.nightcore", speed: 1.25, reverb: 0, pitch: 0 },
  { id: "slowed", icon: "speed-slowed", label: "music.speed.slowed", speed: 0.85, reverb: 0, pitch: 0 },
  { id: "reverb", icon: "speed-reverb", label: "music.speed.slowedReverb", speed: 0.8, reverb: 0.6, pitch: 0 },
  { id: "daycore", icon: "speed-daycore", label: "music.speed.daycore", speed: 0.75, reverb: 0.3, pitch: 0 },
] as const;

function SpeedSlider({
  label,
  value,
  min,
  max,
  step,
  readout,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  readout: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="music-speed-slider">
      <span className="music-speed-slider-name">{label}</span>
      <input
        className="harbor-slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="music-speed-slider-value">{readout}</span>
    </label>
  );
}

function SpeedSection({
  draft,
  live,
}: {
  draft: MusicAudioSettingsValue;
  live: (value: Partial<MusicAudioSettingsValue>) => void;
}) {
  const t = useT();
  const { settings, update } = useSettings();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const saved = settings.musicSpeedPresets;
  const matches = (preset: { speed: number; pitch: number; reverb: number; keepPitch: boolean }) =>
    Math.abs(preset.speed - draft.speed) < 0.001 &&
    Math.abs(preset.reverb - draft.reverb) < 0.001 &&
    Math.abs(preset.pitch - draft.pitch) < 0.001 &&
    preset.keepPitch === draft.keepPitch;
  const activeSaved = saved.find(matches);
  const saveCurrent = () => {
    const label = name.trim();
    if (!label) return;
    update({
      musicSpeedPresets: [
        ...saved.filter((preset) => preset.name !== label),
        {
          id: `${Date.now()}`,
          name: label,
          speed: draft.speed,
          pitch: draft.pitch,
          reverb: draft.reverb,
          keepPitch: draft.keepPitch,
        },
      ],
    });
    setName("");
    setNaming(false);
  };
  const active = SPEED_PRESETS.find(
    (preset) =>
      Math.abs(preset.speed - draft.speed) < 0.001 &&
      Math.abs(preset.reverb - draft.reverb) < 0.001 &&
      Math.abs(preset.pitch - draft.pitch) < 0.001 &&
      !draft.keepPitch,
  );
  const touched =
    Math.abs(draft.speed - 1) > 0.001 ||
    Math.abs(draft.reverb) > 0.001 ||
    Math.abs(draft.pitch) > 0.001 ||
    draft.keepPitch;
  const semitones = `${draft.pitch > 0 ? "+" : ""}${draft.pitch.toFixed(1)}`;
  return (
    <section className="music-audio-section">
      <div className="music-audio-row">
        <span className="music-audio-title">{t("music.speed.title")}</span>
        {touched && (
          <button
            type="button"
            className="music-speed-reset"
            onClick={() => live({ speed: 1, reverb: 0, pitch: 0, keepPitch: false })}
          >
            {t("music.speed.reset")}
          </button>
        )}
      </div>
      <p>{t("music.speed.help")}</p>
      <div className="music-speed-presets">
        {SPEED_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            aria-pressed={active?.id === preset.id}
            onClick={() =>
              live({
                speed: preset.speed,
                reverb: preset.reverb,
                pitch: preset.pitch,
                keepPitch: false,
              })
            }
          >
            <UiIcon name={preset.icon} className="music-speed-glyph" />
            <span>{t(preset.label)}</span>
          </button>
        ))}
      </div>
      <div className="music-speed-dials">
        <SpeedSlider
          label={t("music.speed.speed")}
          value={draft.speed}
          min={0.5}
          max={1.6}
          step={0.01}
          readout={`${draft.speed.toFixed(2)}×`}
          onChange={(speed) => live({ speed })}
        />
        <SpeedSlider
          label={t("music.speed.pitch")}
          value={draft.pitch}
          min={-12}
          max={12}
          step={0.5}
          readout={`${semitones} st`}
          onChange={(pitch) => live({ pitch })}
        />
        <SpeedSlider
          label={t("music.speed.reverb")}
          value={draft.reverb}
          min={0}
          max={1}
          step={0.01}
          readout={`${Math.round(draft.reverb * 100)}%`}
          onChange={(reverb) => live({ reverb })}
        />
      </div>
      <div className="music-speed-key">
        <label className="music-audio-toggle">
          <input
            type="checkbox"
            checked={draft.keepPitch}
            onChange={(event) => live({ keepPitch: event.target.checked })}
          />
          {t("music.speed.keepPitch")}
        </label>
        <p>{t("music.speed.keepPitchHelp")}</p>
      </div>

      {(saved.length > 0 || touched) && (
        <div className="music-speed-saved">
          {saved.map((preset) => (
            <span
              key={preset.id}
              className="music-speed-chip"
              data-active={activeSaved?.id === preset.id || undefined}
            >
              <button type="button" onClick={() => live(preset)}>
                {preset.name}
              </button>
              <button
                type="button"
                className="music-speed-chip-x"
                aria-label={t("music.speed.forget", { name: preset.name })}
                onClick={() =>
                  update({
                    musicSpeedPresets: saved.filter((entry) => entry.id !== preset.id),
                  })
                }
              >
                <X size={13} />
              </button>
            </span>
          ))}
          {touched &&
            (naming ? (
              <span className="music-speed-naming">
                <input
                  autoFocus
                  value={name}
                  maxLength={32}
                  placeholder={t("music.speed.namePlaceholder")}
                  aria-label={t("music.speed.namePlaceholder")}
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") saveCurrent();
                    if (event.key === "Escape") setNaming(false);
                  }}
                />
                <button type="button" onClick={saveCurrent} disabled={!name.trim()}>
                  {t("music.speed.save")}
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="music-speed-chip-add"
                onClick={() => setNaming(true)}
              >
                <Plus size={13} />
                {t("music.speed.saveCurrent")}
              </button>
            ))}
        </div>
      )}
    </section>
  );
}
