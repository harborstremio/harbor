import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "@/components/icons/music-icons";
import { useT } from "@/lib/i18n";
import { Dropdown } from "@/components/dropdown";
import type { MusicAudioSettingsValue } from "@/lib/music/audio-settings";
import {
  exportPeq,
  importPeq,
  MAX_PEQ_FILTERS,
  PEQ_TYPES,
  peqHeadroom,
  peqResponse,
  type PeqFilter,
  type PeqType,
} from "@/lib/music/parametric-eq";
import {
  loadListeningProfile,
  MAX_LISTENING_PROFILES,
  readListeningProfiles,
  writeListeningProfiles,
} from "@/lib/music/audio-profiles";

type Props = {
  draft: MusicAudioSettingsValue;
  applied: MusicAudioSettingsValue;
  update: (value: Partial<MusicAudioSettingsValue>) => void;
};

function NumericField({
  value,
  min,
  max,
  step,
  disabled,
  id,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  id?: string;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const number = Number(text);
    const next =
      text.trim() && Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : value;
    setText(String(next));
    onChange(next);
  };
  return (
    <input
      id={id}
      type="number"
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          commit();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          setText(String(value));
        }
      }}
    />
  );
}

export function ListeningProfiles({ draft, update }: Omit<Props, "applied">) {
  const t = useT();
  const [profiles, setProfiles] = useState(readListeningProfiles);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState("");
  const [error, setError] = useState(false);
  const persist = (next: typeof profiles) => {
    try {
      writeListeningProfiles(next);
      setProfiles(next);
      setError(false);
      return true;
    } catch {
      setError(true);
      return false;
    }
  };
  return (
    <section className="music-audio-section music-lab-profiles">
      <h3>{t("music.lab.profiles")}</h3>
      <p>{t("music.lab.profilesHelp")}</p>
      <div className="music-audio-row">
        <input
          aria-label={t("music.lab.profileName")}
          placeholder={t("music.lab.profileName")}
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="button"
          disabled={!name.trim() || profiles.length >= MAX_LISTENING_PROFILES}
          onClick={() => {
            const id = crypto.randomUUID();
            if (
              persist([...profiles, { id, name: name.trim(), settings: structuredClone(draft) }])
            ) {
              setSelected(id);
              setName("");
            }
          }}
        >
          {t("music.lab.saveProfile")}
        </button>
      </div>
      {profiles.length > 0 && (
        <div className="music-audio-row">
          <Dropdown
            value={selected}
            ariaLabel={t("music.lab.profiles")}
            onChange={setSelected}
            options={[
              { value: "", label: t("music.lab.selectProfile") },
              ...profiles.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
          <div className="music-lab-actions">
            <button
              type="button"
              disabled={!selected}
              onClick={() => {
                const profile = profiles.find((p) => p.id === selected);
                if (profile) update(loadListeningProfile(profile, draft));
              }}
            >
              {t("music.lab.loadProfile")}
            </button>
            <button
              type="button"
              disabled={!selected}
              aria-label={t("music.lab.delete")}
              onClick={() => {
                if (persist(profiles.filter((p) => p.id !== selected))) setSelected("");
              }}
            >
              <Trash2 size={17} />
            </button>
          </div>
        </div>
      )}
      {error && <p role="alert">{t("music.audio.saveError")}</p>}
    </section>
  );
}

function ResponseCurve({ draft, applied }: Pick<Props, "draft" | "applied">) {
  const t = useT();
  const rate = draft.sampleRate || 48000;
  const active = draft.eqEnabled && !draft.dspBypass;
  const path = (settings: MusicAudioSettingsValue) =>
    Array.from({ length: 361 }, (_, i) => {
      const gain =
        settings.eqEnabled && !settings.dspBypass && settings.eqMode === "parametric"
          ? peqResponse(settings.peqFilters, 20 * 1000 ** (i / 360), rate, settings.eqStrength)
          : 0;
      return `${i ? "L" : "M"}${48 + i * 1.95},${120 - Math.max(-24, Math.min(24, gain)) * 3.5}`;
    }).join(" ");
  const currentPath = useMemo(
    () => path(draft),
    [draft.peqFilters, draft.eqStrength, active, rate],
  );
  const appliedPath = useMemo(() => path(applied), [applied, rate]);
  return (
    <div className="music-lab-curve">
      <svg viewBox="0 0 800 255" role="img" aria-label={t("music.lab.response")}>
        {[-24, -12, 0, 12, 24].map((db) => (
          <g key={db}>
            <line
              x1="48"
              x2="750"
              y1={120 - db * 3.5}
              y2={120 - db * 3.5}
              className={db === 0 ? "music-eq-grid-zero" : "music-eq-grid"}
            />
            <text x="39" y={125 - db * 3.5} textAnchor="end">
              {db > 0 ? "+" : ""}
              {db}
            </text>
          </g>
        ))}
        {[20, 100, 1000, 10000, 20000].map((f) => {
          const x = 48 + (Math.log10(f / 20) / 3) * 702;
          return (
            <g key={f}>
              <line x1={x} x2={x} y1="36" y2="204" className="music-eq-grid" />
              <text x={x} y="235" textAnchor="middle">
                {f >= 1000 ? `${f / 1000}k` : f}
              </text>
            </g>
          );
        })}
        <path d={appliedPath} className="music-lab-applied" fill="none" />
        <path d={currentPath} className="music-eq-line" fill="none" />
      </svg>
      <p>{t("music.lab.curveHelp", { rate: String(rate / 1000) })}</p>
    </div>
  );
}

export function ParametricEditor({ draft, applied, update }: Props) {
  const t = useT();
  const [text, setText] = useState("");
  const [invalid, setInvalid] = useState(false);
  const headroom = useMemo(
    () => (draft.autoHeadroom ? peqHeadroom(draft.peqFilters, draft.eqStrength) : 0),
    [draft.peqFilters, draft.eqStrength, draft.autoHeadroom],
  );
  const edit = (index: number, partial: Partial<PeqFilter>) =>
    update({
      peqFilters: draft.peqFilters.map((f, i) => (i === index ? { ...f, ...partial } : f)),
    });
  return (
    <>
      <ResponseCurve draft={draft} applied={applied} />
      <div className="music-audio-row">
        <label htmlFor="music-correction-strength">{t("music.lab.strength")}</label>
        <output>{Math.round(draft.eqStrength * 100)}%</output>
      </div>
      <input
        id="music-correction-strength"
        className="harbor-slider"
        type="range"
        min="0"
        max="1"
        step=".01"
        value={draft.eqStrength}
        onChange={(e) => update({ eqStrength: Number(e.target.value) })}
      />
      <p>{t("music.lab.strengthHelp")}</p>
      {draft.peqFilters.length === 0 && (
        <p className="music-lab-empty">
          {t("Pick a preset above, or add a filter to start shaping the sound.")}
        </p>
      )}
      <div className="music-lab-filter-list">
        {draft.peqFilters.map((filter, index) => (
          <fieldset className="music-lab-filter" key={index}>
            <legend>
              {t("music.lab.filter")} {index + 1}
            </legend>
            <label className="music-audio-toggle">
              <input
                type="checkbox"
                checked={filter.enabled}
                onChange={(e) => edit(index, { enabled: e.target.checked })}
              />
              {t("music.lab.enabled")}
            </label>
            <Dropdown
              ariaLabel={`${t("music.lab.filter")} ${index + 1}`}
              value={filter.type}
              onChange={(value) => edit(index, { type: value as PeqType })}
              options={PEQ_TYPES.map((type) => ({ value: type, label: t(`music.lab.${type}`) }))}
            />
            <label>
              Hz
              <NumericField
                min={20}
                max={20000}
                step={1}
                value={filter.frequency}
                onChange={(frequency) => edit(index, { frequency })}
              />
            </label>
            <label>
              dB
              <NumericField
                min={-18}
                max={18}
                step={0.1}
                value={filter.gain}
                disabled={!["peak", "lowShelf", "highShelf"].includes(filter.type)}
                onChange={(gain) => edit(index, { gain })}
              />
            </label>
            <label>
              Q
              <NumericField
                min={0.1}
                max={12}
                step={0.01}
                value={filter.q}
                onChange={(q) => edit(index, { q })}
              />
            </label>
            <button
              type="button"
              aria-label={`${t("music.lab.delete")} ${index + 1}`}
              onClick={() => update({ peqFilters: draft.peqFilters.filter((_, i) => i !== index) })}
            >
              <Trash2 size={17} />
            </button>
          </fieldset>
        ))}
      </div>
      <div className="music-audio-row">
        <button
          type="button"
          disabled={draft.peqFilters.length >= MAX_PEQ_FILTERS}
          onClick={() =>
            update({
              peqFilters: [
                ...draft.peqFilters,
                { type: "peak", frequency: 1000, gain: 0, q: 0.7071, enabled: true },
              ],
            })
          }
        >
          <Plus size={17} />
          {t("music.lab.addFilter")}
        </button>
        <span dir="ltr">{draft.peqFilters.length} / 24</span>
      </div>
      <p>{t("music.lab.headroomHelp", { db: headroom.toFixed(1) })}</p>
      <details className="music-lab-import">
        <summary>{t("music.lab.importExport")}</summary>
        <p>{t("music.lab.importHelp")}</p>
        <textarea
          dir="ltr"
          aria-label={t("music.lab.correctionText")}
          value={text}
          maxLength={32768}
          spellCheck={false}
          onChange={(e) => {
            setText(e.target.value);
            setInvalid(false);
          }}
        />
        <div className="music-lab-actions">
          <button
            type="button"
            disabled={!text.trim()}
            onClick={() => {
              try {
                const result = importPeq(text);
                update({
                  peqFilters: result.filters,
                  preampDb: result.preampDb,
                  autoHeadroom: false,
                  eqEnabled: true,
                  eqStrength: 1,
                });
                setInvalid(false);
              } catch {
                setInvalid(true);
              }
            }}
          >
            {t("music.lab.import")}
          </button>
          <button
            type="button"
            disabled={!draft.peqFilters.length}
            onClick={() => {
              setText(
                exportPeq(
                  draft.peqFilters.map((f) => ({
                    ...f,
                    gain: f.gain * draft.eqStrength,
                    enabled: f.enabled && draft.eqStrength > 0,
                  })),
                  draft.preampDb - headroom,
                ),
              );
              setInvalid(false);
            }}
          >
            {t("music.lab.export")}
          </button>
        </div>
        {invalid && <p role="alert">{t("music.lab.importError")}</p>}
      </details>
    </>
  );
}

export function ListeningControls({ draft, update }: Omit<Props, "applied">) {
  const t = useT();
  return (
    <section className="music-audio-section">
      <div className="music-audio-row">
        <label htmlFor="music-preamp">{t("music.lab.preamp")}</label>
        <NumericField
          id="music-preamp"
          min={-60}
          max={12}
          step={0.1}
          value={draft.preampDb}
          onChange={(preampDb) => update({ preampDb })}
        />
      </div>
      <div className="music-audio-row">
        <label htmlFor="music-crossfeed">{t("music.lab.crossfeed")}</label>
        <output>{Math.round(draft.crossfeed * 100)}%</output>
      </div>
      <input
        id="music-crossfeed"
        className="harbor-slider"
        type="range"
        min="0"
        max="1"
        step=".01"
        value={draft.crossfeed}
        onChange={(e) => update({ crossfeed: Number(e.target.value) })}
      />
      <p>{t("music.lab.crossfeedHelp")}</p>
      <label className="music-audio-toggle">
        <input
          type="checkbox"
          checked={draft.dspBypass}
          onChange={(e) => update({ dspBypass: e.target.checked })}
        />
        {t("music.lab.bypass")}
      </label>
      <p>{t("music.lab.bypassHelp")}</p>
    </section>
  );
}

export function OutputControls({ draft, update }: Omit<Props, "applied">) {
  const t = useT();
  return (
    <>
      <label className="music-audio-toggle">
        <input
          type="checkbox"
          checked={draft.exclusive}
          onChange={(e) => update({ exclusive: e.target.checked })}
        />
        {t("music.lab.exclusive")}
      </label>
      <p>{t("music.lab.exclusiveHelp")}</p>
      <div className="music-audio-row">
        <label>{t("music.lab.sampleRate")}</label>
        <Dropdown
          value={String(draft.sampleRate)}
          ariaLabel={t("music.lab.sampleRate")}
          onChange={(value) => update({ sampleRate: Number(value) })}
          options={[
            { value: "0", label: t("music.lab.sourceRate") },
            ...[44100, 48000, 88200, 96000, 176400, 192000].map((rate) => ({
              value: String(rate),
              label: `${rate / 1000} kHz`,
            })),
          ]}
        />
      </div>
      <p>{t("music.lab.rateHelp")}</p>
    </>
  );
}
