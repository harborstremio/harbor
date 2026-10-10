import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import {
  ChevronDown,
  Heart,
  Minus,
  Pause,
  Play,
  Rewind,
  FastForward,
  Square,
  X,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { isMusicLiked } from "@/lib/music/liked";
import { getMusicState, subscribeMusic } from "@/lib/music/player";
import { requestMusicExplore } from "@/lib/music/navigation";
import { useMusicAudioMeter } from "@/lib/music/audio-meter";
import {
  useMusicAppearance,
  useMusicArtworkColor,
  useMusicArtworkPalette,
} from "@/lib/music/appearance";
import { loadStoredSettings } from "@/lib/settings/load";
import { Dropdown } from "@/components/dropdown";
import {
  MUSIC_EQ_FREQUENCIES,
  musicVolumeCeiling,
  useMusicAudioSettings,
} from "@/lib/music/audio-settings";
import {
  MUSIC_EQ_PRESETS,
  matchEqPreset,
  matchPeqPreset,
  peqPresetFilters,
} from "@/lib/music/eq-presets";
import { sendDeckCommand, subscribeDeckState, type DeckSnapshot } from "@/lib/music/deck-sync";
import { clock, preciseClock, useDeckClock, useLiveAudio } from "./dj/deck-state";
import { readMode, readWave, writeMode, writeWave } from "./dj/deck-store";
import { composeEq, Fader, Hardware, Knob } from "./dj/controls";
import { Platter } from "./dj/platter";
import { Lcd } from "./dj/lcd";
import { LoopBay } from "./dj/loops";
import { DeckB } from "./dj/deck-b";
import { PadDeck } from "./dj/pad-modes";
import { DeckBrowser } from "./dj/sidebar";
import { DeckWaveform } from "./dj/waveform";
import { useDeckFx } from "./dj/use-deck-fx";
import { FxBay } from "./dj/fx-bay";
import "./dj-deck.css";

const ZONES = [
  { id: "low", label: "dj.low" },
  { id: "mid", label: "dj.mid" },
  { id: "high", label: "dj.high" },
] as const;
const SIZES = { ez: [960, 660], advanced: [1340, 1000] } as const;

function deckWindow() {
  try {
    return getCurrentWindow();
  } catch {
    return null;
  }
}

async function fitDeck(mode: "ez" | "advanced") {
  const win = deckWindow();
  if (!win) return;
  if (await win.isMaximized().catch(() => false)) return;
  const size = await win.innerSize().catch(() => null);
  const scale = await win.scaleFactor().catch(() => 1);
  if (!size) return;
  const [width, height] = SIZES[mode];
  const wide = size.width / scale;
  const tall = size.height / scale;
  if (wide >= width - 2 && tall >= height - 2) return;
  await win
    .setSize(new LogicalSize(Math.max(width, wide), Math.max(height, tall)))
    .catch(() => {});
}

async function toggleMax() {
  const win = deckWindow();
  if (!win) return;
  if (await win.isFullscreen().catch(() => false)) {
    await win.setFullscreen(false).catch(() => {});
    return;
  }
  await win.toggleMaximize().catch(async () => {
    const max = await win.isMaximized().catch(() => false);
    await (max ? win.unmaximize() : win.maximize()).catch(() => {});
  });
}

export function DjDeckApp() {
  const t = useT();
  const { settings, set, reset } = useLiveAudio();
  const presetId =
    settings.eqMode === "graphic"
      ? matchEqPreset(settings.eqBands)
      : matchPeqPreset(settings.peqFilters, MUSIC_EQ_FREQUENCIES);
  const applyPreset = useCallback(
    (id: string) => {
      const preset = MUSIC_EQ_PRESETS.find((item) => item.id === id);
      if (!preset) return;
      set(
        settings.eqMode === "graphic"
          ? { eqBands: [...preset.bands], eqEnabled: true }
          : {
              peqFilters: peqPresetFilters(preset, MUSIC_EQ_FREQUENCIES),
              eqEnabled: true,
            },
      );
    },
    [set, settings.eqMode],
  );
  const [state, setState] = useState(getMusicState);
  useMusicAudioSettings();
  const [mode, setMode] = useState<"ez" | "advanced">("ez");
  const [kills, setKills] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState(0);
  const [bpm, setBpm] = useState<number | null>(null);
  const [sampleGain, setSampleGain] = useState(0.85);
  const [wave, setWave] = useState(false);
  const [pitchDraft, setPitchDraft] = useState<number | null>(null);
  const [volumeDraft, setVolumeDraft] = useState<number | null>(null);
  const [nativeChrome] = useState(() => {
    try {
      return loadStoredSettings().useNativeTitleBar === true;
    } catch {
      return false;
    }
  });

  useEffect(() => subscribeMusic(() => setState(getMusicState())), []);
  useEffect(
    () =>
      subscribeDeckState((snapshot: DeckSnapshot) =>
        setState((current) => ({ ...current, ...snapshot })),
      ),
    [],
  );
  useEffect(() => {
    void deckWindow()?.setDecorations(nativeChrome).catch(() => {});
  }, [nativeChrome]);
  useEffect(() => {
    void readWave().then((saved) => setWave(saved === "on"));
  }, []);
  useEffect(() => {
    void readMode().then((saved) => {
      const next = saved === "advanced" ? "advanced" : "ez";
      setMode(next);
      void fitDeck(next);
    });
  }, []);

  const track = state.current;
  const playing = state.phase === "playing";
  const meter = useMusicAudioMeter(track, true);
  const appearance = useMusicAppearance();
  const artwork = useMusicArtworkColor(track?.artwork, appearance.artworkColors);
  const palette = useMusicArtworkPalette(track?.artwork, appearance.artworkColors);
  const readPosition = useDeckClock(state.currentTime, playing, settings.speed);
  const advanced = mode === "advanced";
  const liked = isMusicLiked(state.likedIds, track);

  const swap = useCallback((next: "ez" | "advanced") => {
    setMode(next);
    writeMode(next);
    const [width, height] = SIZES[next];
    const win = deckWindow();
    if (!win) return;
    void win
      .isMaximized()
      .then((max) => (max ? null : win.setSize(new LogicalSize(width, height))))
      .catch(() => {});
  }, []);

  const shapeEq = useCallback(
    (nextKills: Record<string, boolean>, nextFilter: number) => {
      setKills(nextKills);
      setFilter(nextFilter);
      set({ eqBands: composeEq(nextKills, nextFilter), eqEnabled: true, eqMode: "graphic" });
    },
    [set],
  );

  const fxDeck = useDeckFx({
    trackKey: track ? `${track.connectorId ?? ""}:${track.id}` : "",
    readPosition,
    bpm,
    armed: advanced,
  });

  const progress = state.duration > 0 ? state.currentTime / state.duration : 0;
  const upNext = useMemo(
    () => state.queue.slice(state.queueIndex + 1, state.queueIndex + (advanced ? 9 : 6)),
    [state.queue, state.queueIndex, advanced],
  );

  return (
    <main
      className="dj"
      data-mode={mode}
      data-playing={playing || undefined}
      data-art={artwork ? "" : undefined}
      style={
        artwork
          ? ({ "--dj-accent": artwork.color, "--dj-accent-ink": artwork.ink } as CSSProperties)
          : undefined
      }
    >
      {state.error && (
        <div className="dj-alert" role="alert">
          <span>{state.error}</span>
          <button type="button" onClick={() => sendDeckCommand({ kind: "retry" })}>
            {t("common.retry")}
          </button>
          <button
            type="button"
            className="dj-alert-close"
            onClick={() => sendDeckCommand({ kind: "dismissError" })}
            aria-label={t("music.error.dismiss")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      <header className="dj-top" data-tauri-drag-region={nativeChrome ? undefined : true}>
        <span className="dj-top-tools">
        <span className="dj-modes" role="group" aria-label={t("dj.mode.switch")}>
          <button type="button" data-on={!advanced || undefined} onClick={() => swap("ez")}>
            {t("dj.mode.ez")}
          </button>
          <button type="button" data-on={advanced || undefined} onClick={() => swap("advanced")}>
            {t("dj.mode.advanced")}
          </button>
        </span>

        <Dropdown
          size="sm"
          className="dj-preset"
          value={presetId}
          placeholder={t("dj.preset")}
          ariaLabel={t("dj.preset")}
          options={MUSIC_EQ_PRESETS.map((preset) => ({
            value: preset.id,
            label: t(preset.labelKey),
          }))}
          onChange={applyPreset}
        />

        {advanced && (
          <button
            type="button"
            className="dj-wavedrop-head"
            aria-expanded={wave}
            data-on={wave || undefined}
            onClick={() => {
              setWave(!wave);
              writeWave(!wave);
            }}
          >
            <ChevronDown size={13} aria-hidden="true" />
            <span>{t("dj.wave.title")}</span>
          </button>
        )}
        </span>
        <span className="dj-chrome" hidden={nativeChrome}>
          <button
            type="button"
            onClick={() => void deckWindow()?.minimize()}
            aria-label={t("dj.minimize")}
          >
            <Minus size={15} />
          </button>
          <button type="button" onClick={() => void toggleMax()} aria-label={t("dj.maximize")}>
            <Square size={12} />
          </button>
          <button
            type="button"
            className="dj-chrome-close"
            onClick={() => void deckWindow()?.close()}
            aria-label={t("dj.close")}
          >
            <X size={15} />
          </button>
        </span>
      </header>

      <section className="dj-stage">
        <div className="dj-turntable">
          <Platter
            artwork={track?.artwork}
            trackKey={track ? `${track.connectorId ?? ""}:${track.id}` : ""}
            playing={playing}
            progress={progress}
            readPosition={readPosition}
            duration={state.duration}
            speed={settings.speed}
            size={advanced ? "full" : "compact"}
          />
          <div className="dj-transport">
            <Hardware
              tone="steel"
              size="pad"
              label={t("dj.previous")}
              onClick={() => sendDeckCommand({ kind: "previous" })}
            >
              <Rewind size={18} fill="currentColor" />
            </Hardware>
            <Hardware
              tone="accent"
              size="pad"
              lit={playing}
              disabled={!track}
              label={t(playing ? "dj.pause" : "dj.play")}
              onClick={() => sendDeckCommand({ kind: "toggle" })}
            >
              {playing ? (
                <Pause size={22} fill="currentColor" />
              ) : (
                <Play size={22} fill="currentColor" />
              )}
            </Hardware>
            <Hardware
              tone="steel"
              size="pad"
              label={t("dj.next")}
              onClick={() => sendDeckCommand({ kind: "next" })}
            >
              <FastForward size={18} fill="currentColor" />
            </Hardware>
            <Hardware
              tone="amber"
              size="pad"
              label={t("dj.cue")}
              disabled={!track}
              onClick={() => sendDeckCommand({ kind: "seek", seconds: 0 })}
            >
              <b>{t("dj.cue")}</b>
            </Hardware>
          </div>
        </div>

        <div className="dj-console">
          <div className="dj-readout-row">
            <div className="dj-readout">
              <strong>{track ? track.title : t("dj.idle")}</strong>
              <span>{track?.artist ?? ""}</span>
            </div>
            <Hardware
              tone="red"
              lit={liked}
              disabled={!track}
              label={t(liked ? "music.unsaveTrack" : "music.saveTrack")}
              onClick={() => sendDeckCommand({ kind: "like" })}
            >
              <Heart size={18} fill={liked ? "currentColor" : "none"} aria-hidden="true" />
            </Hardware>
          </div>
          <Lcd
            spectrum={meter.data?.spectrumDb}
            playing={playing}
            loading={state.phase === "resolving"}
            rows={advanced ? 16 : 11}
            palette={palette}
          />
          <div className="dj-time">
            <em>{advanced ? preciseClock(state.currentTime) : clock(state.currentTime)}</em>
            <i>{settings.speed.toFixed(2)}x</i>
            <em>{clock(state.duration)}</em>
          </div>
          {advanced && (
            <LoopBay
              trackId={track?.id ?? ""}
              duration={state.duration}
              readPosition={readPosition}
              bpm={bpm}
              onBpm={setBpm}
            />
          )}
        </div>

        <div className="dj-mixer">
          <div className="dj-kills">
            {ZONES.map((zone) => (
              <Hardware
                key={zone.id}
                tone="red"
                lit={kills[zone.id]}
                label={t(zone.label)}
                onClick={() => shapeEq({ ...kills, [zone.id]: !kills[zone.id] }, filter)}
              />
            ))}
          </div>
          <div className="dj-knobs">
            <Knob
              label={t("dj.volume")}
              value={volumeDraft ?? state.volume}
              min={0}
              max={musicVolumeCeiling(state.current?.connectorId)}
              step={0.05}
              readout={(shown) => `${Math.round(shown * 100)}%`}
              onChange={(value) => {
                setVolumeDraft(value);
                sendDeckCommand({ kind: "volume", value });
              }}
              onSettle={() => setVolumeDraft(null)}
              onReset={() => {
                setVolumeDraft(null);
                sendDeckCommand({ kind: "volume", value: 0.82 });
              }}
              tone="amber"
            />
            <Knob
              label={t("dj.filter")}
              value={filter}
              min={-1}
              max={1}
              readout={
                Math.abs(filter) < 0.02
                  ? "0"
                  : `${filter > 0 ? "HP" : "LP"} ${Math.round(Math.abs(filter) * 100)}`
              }
              onChange={(value) => shapeEq(kills, value)}
              onReset={() => shapeEq(kills, 0)}
              tone="cyan"
            />
            {advanced && (
              <Knob
                label={t("dj.reverb")}
                value={settings.reverb}
                min={0}
                max={1}
                readout={`${Math.round(settings.reverb * 100)}%`}
                onChange={(reverb) => set({ reverb })}
                onReset={() => set({ reverb: 0 })}
                tone="amber"
              />
            )}
          </div>
          <div className="dj-faders">
            <Fader
              label={t("dj.tempo")}
              value={settings.speed}
              min={0.5}
              max={1.6}
              step={0.01}
              readout={`${settings.speed.toFixed(2)}x`}
              onChange={(speed) => set({ speed })}
              onReset={() => set({ speed: 1 })}
            />
            {advanced && (
              <Fader
                label={t("dj.pitch")}
                value={pitchDraft ?? settings.pitch}
                min={-12}
                max={12}
                step={0.5}
                readout={`${(pitchDraft ?? settings.pitch) > 0 ? "+" : ""}${(
                  pitchDraft ?? settings.pitch
                ).toFixed(1)}`}
                onChange={setPitchDraft}
                onCommit={(pitch) => {
                  setPitchDraft(null);
                  set({ pitch });
                }}
                onReset={() => {
                  setPitchDraft(null);
                  set({ pitch: 0 });
                }}
              />
            )}
          </div>
          <div className="dj-mixer-foot">
            <Hardware
              tone="cyan"
              lit={settings.keepPitch}
              label={t("dj.keylock")}
              onClick={() => set({ keepPitch: !settings.keepPitch })}
            />
            <Hardware tone="red" label={t("dj.reset")} onClick={reset} />
          </div>
        </div>
      </section>

      {advanced && wave && (
        <DeckWaveform
          trackKey={track ? `${track.connectorId ?? ""}:${track.id}` : ""}
          duration={state.duration}
          readPosition={readPosition}
          size="full"
          playing={playing}
          speed={settings.speed}
          onGrid={(grid) => setBpm(grid ? grid.bpm : null)}
        />
      )}

      {advanced && (
        <section className="dj-panels">
          <div className="dj-panel">
          <FxBay
            fx={fxDeck.fx}
            adjust={fxDeck.adjust}
            release={fxDeck.release}
            running={fxDeck.running}
            ready={fxDeck.ready}
            divisions={fxDeck.divisions}
            kinds={fxDeck.kinds}
          />
          </div>
          <div className="dj-panel">
          <DeckB next={state.queue[state.queueIndex + 1]} />
          </div>
          <div className="dj-panel dj-panel-wide">
          <PadDeck
            trackId={track?.id ?? ""}
            duration={state.duration}
            playing={playing}
            speed={settings.speed}
            bpm={bpm}
            readPosition={readPosition}
            gain={sampleGain}
            onGain={setSampleGain}
          />
          </div>
        </section>
      )}

      <section className="dj-queue" data-inline={advanced || undefined}>
        <h2>{t("dj.upNext")}</h2>
        {upNext.length === 0 ? (
          <p className="dj-queue-empty">
            <span>{t("dj.queueEmpty")}</span>
            {track && (
              <button
                type="button"
                className="dj-queue-more"
                onClick={() => requestMusicExplore({ kind: "similar", track })}
              >
                {t("dj.queueMore")}
              </button>
            )}
          </p>
        ) : (
          <ol>
            {upNext.map((item, index) => (
              <li key={`${item.id}:${index}`}>
                <span className="dj-queue-index">{String(index + 1).padStart(2, "0")}</span>
                {item.artwork ? (
                  <img className="dj-queue-art" src={item.artwork} alt="" draggable={false} />
                ) : (
                  <span className="dj-queue-art dj-queue-art-blank" aria-hidden="true" />
                )}
                <span className="dj-queue-copy">
                  <strong>{item.title}</strong>
                  <small>{item.artist}</small>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {advanced && (
        <DeckBrowser queue={state.queue} queueIndex={state.queueIndex} gain={sampleGain} />
      )}

      <span className="dj-grip" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </main>
  );
}
