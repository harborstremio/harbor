import { Info } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { MusicAudioSettingsValue } from "@/lib/music/audio-settings";
import { musicMeterFraction, type MusicAudioMeterState } from "@/lib/music/audio-meter";
import { MUSIC_QUALITY_LABELS, musicSampleRateLabel, musicTrackQuality } from "@/lib/music/quality";
import type { MusicTrack } from "@/lib/music/types";
import { MusicQualityGlyph } from "./music-quality-badge";
import "./music-signal.css";

export function MusicLevelMeter({ meter }: { meter: MusicAudioMeterState }) {
  const t = useT();
  const data = meter.data;
  const available = meter.status === "ready" && !!data?.channels.length;
  return (
    <div className="music-level-meter" aria-label={t("music.quality.levels")}>
      <div className="music-signal-caption">
        <span>{t("music.quality.levels")}</span>
        <span>
          {available
            ? "dBFS"
            : t(meter.status === "loading" ? "common.loading" : "music.quality.unavailable")}
        </span>
      </div>
      {available && (
        <div className="music-level-channels" dir="ltr">
          {data.channels.map((channel, index) => (
            <div className="music-level-channel" key={index}>
              <span className="music-level-label">
                {data.channels.length === 2 ? (index === 0 ? "L" : "R") : index + 1}
              </span>
              <div
                className="music-level-track"
                role="meter"
                aria-label={t("music.quality.channel", { number: index + 1 })}
                aria-valuemin={-60}
                aria-valuemax={0}
                aria-valuenow={data.active ? Math.max(-60, Math.min(0, channel.rmsDb)) : -60}
                aria-valuetext={
                  data.active ? `${channel.rmsDb.toFixed(1)} dBFS RMS` : t("music.quality.inactive")
                }
              >
                <span
                  className="music-level-fill"
                  style={{ transform: `scaleX(${musicMeterFraction(channel.rmsDb, data.active)})` }}
                />
                {data.active && (
                  <span
                    className="music-level-peak"
                    style={{ left: `${musicMeterFraction(channel.peakDb) * 100}%` }}
                  />
                )}
              </div>
              <span className="music-level-reading">
                {data.active ? `${channel.rmsDb.toFixed(1)}` : "—"}
              </span>
            </div>
          ))}
          <div className="music-level-scale">
            <span>−60</span>
            <span>−30</span>
            <span>0</span>
          </div>
        </div>
      )}
      <p className="music-signal-note">{t("music.quality.meterHelp")}</p>
    </div>
  );
}

export function MusicSignalDetails({
  track,
  outputLabel,
  transportCodec,
  audioSettings,
  onAudioSettings,
  meter,
  showLevels = true,
  className = "",
}: {
  track: MusicTrack;
  outputLabel?: string;
  audioSettings?: MusicAudioSettingsValue;
  onAudioSettings?: () => void;
  meter?: MusicAudioMeterState;
  showLevels?: boolean;
  className?: string;
  transportCodec?: string;
}) {
  const t = useT();
  const quality = musicTrackQuality(track);
  const tier = quality?.tier ?? "unverified";
  const output = meter?.data;
  return (
    <section className={`music-signal-details ${className}`} aria-label={t("music.quality.title")}>
      <div className="music-signal-heading" data-tier={tier}>
        <MusicQualityGlyph tier={tier} />
        <div>
          <h3>{t(MUSIC_QUALITY_LABELS[tier])}</h3>
          <p>{t(`music.quality.${tier === "hi-res" ? "hiRes" : tier}Help`)}</p>
        </div>
      </div>
      <div className="music-signal-stages">
        <div className="music-signal-stage">
          <h4>{t("music.quality.source")}</h4>
          <dl>
            {quality?.format && (
              <div>
                <dt>{t("music.quality.codec")}</dt>
                <dd>{quality.format}</dd>
              </div>
            )}
            {quality?.bitDepth && (
              <div>
                <dt>{t("music.quality.sourceDepth")}</dt>
                <dd>{t("music.quality.bits", { depth: quality.bitDepth })}</dd>
              </div>
            )}
            {quality?.sampleRateHz && (
              <div>
                <dt>{t("music.quality.decodedRate")}</dt>
                <dd>
                  <bdi dir="ltr">{musicSampleRateLabel(quality.sampleRateHz)}</bdi>
                </dd>
              </div>
            )}
            {quality?.bitrateKbps && (
              <div>
                <dt>{t("music.quality.bitrate")}</dt>
                <dd>
                  <bdi dir="ltr">{Math.round(quality.bitrateKbps)} kbps</bdi>
                </dd>
              </div>
            )}
            {!quality && (
              <div>
                <dd>{t("music.quality.unavailable")}</dd>
              </div>
            )}
          </dl>
        </div>
        <div className="music-signal-stage">
          <h4 title={t("music.quality.outputHelp")}>
            {t("music.quality.output")}
            <Info size={12} aria-hidden="true" />
            <span className="sr-only">{t("music.quality.outputHelp")}</span>
          </h4>
          <dl>
            <div>
              <dt>{t("music.quality.selectedOutput")}</dt>
              <dd>
                {outputLabel ||
                  t(
                    audioSettings?.device === "auto"
                      ? "music.audio.system"
                      : "music.quality.unavailable",
                  )}
              </dd>
            </div>
            {transportCodec && (
              <div>
                <dt>{t("music.quality.codec")}</dt>
                <dd>{transportCodec}</dd>
              </div>
            )}
            {output?.outputSampleRateHz && (
              <div>
                <dt>{t("music.quality.outputRate")}</dt>
                <dd>
                  <bdi dir="ltr">{musicSampleRateLabel(output.outputSampleRateHz)}</bdi>
                </dd>
              </div>
            )}
            {audioSettings && (
              <div>
                <dt>{t("music.lab.equalizer")}</dt>
                <dd>
                  {t(
                    audioSettings.eqEnabled && !audioSettings.dspBypass
                      ? audioSettings.eqMode === "parametric"
                        ? "music.lab.parametric"
                        : "music.audio.equalizer"
                      : "music.audio.replayOff",
                  )}
                </dd>
              </div>
            )}
            {audioSettings && (
              <div>
                <dt>{t("music.audio.replayGain")}</dt>
                <dd>
                  {t(
                    audioSettings.replayGain === "off" || audioSettings.dspBypass
                      ? "music.audio.replayOff"
                      : audioSettings.replayGain === "track"
                        ? "music.audio.replayTrack"
                        : "music.audio.replayAlbum",
                  )}
                </dd>
              </div>
            )}
            {audioSettings && (
              <div>
                <dt>{t("music.lab.crossfeed")}</dt>
                <dd>
                  {audioSettings.dspBypass ? "0%" : `${Math.round(audioSettings.crossfeed * 100)}%`}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>
      {meter && showLevels && <MusicLevelMeter meter={meter} />}
      {onAudioSettings && (
        <button type="button" className="music-signal-settings" onClick={onAudioSettings}>
          {t("music.audio.title")}
          <span aria-hidden="true">↗</span>
        </button>
      )}
    </section>
  );
}
