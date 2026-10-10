import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, LoaderCircle, RefreshCw } from "@/components/icons/music-icons";
import { CastIcon } from "@/components/player/cast-icon";
import type { CastDeviceInfo } from "@/lib/cast";
import { useT } from "@/lib/i18n";
import {
  discoverMusicSpeakers,
  getMusicSpeakerState,
  loadMusicOnSpeaker,
  musicSpeakerCompatibility,
  MusicSpeakerError,
  musicTrackSpeakerIssue,
  stopMusicSpeaker,
  subscribeMusicSpeakerState,
} from "@/lib/music/casting";
import type { MusicTrack } from "@/lib/music/types";
import "./music-speakers.css";

export type MusicSpeakersProps = {
  track: MusicTrack | null;
  positionSec?: number;
  onLoad?: (device: CastDeviceInfo) => Promise<unknown>;
  onStop?: () => Promise<unknown>;
  onReturn?: () => Promise<unknown>;
  onClose?: () => void;
};

export function MusicSpeakers({
  track,
  positionSec = 0,
  onLoad,
  onStop,
  onReturn,
  onClose,
}: MusicSpeakersProps) {
  const t = useT();
  const state = useSyncExternalStore(
    subscribeMusicSpeakerState,
    getMusicSpeakerState,
    getMusicSpeakerState,
  );
  const [devices, setDevices] = useState<CastDeviceInfo[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const request = useRef(0);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    return () => {
      request.current += 1;
    };
  }, []);
  const trackIssue = track ? musicTrackSpeakerIssue(track) : "music.cast.noTrack";
  const busy = working !== null || state.phase === "loading";

  const discover = async () => {
    const token = ++request.current;
    setScanning(true);
    setErrorKey(null);
    try {
      const found = await discoverMusicSpeakers();
      if (token === request.current) setDevices(found);
    } catch (error) {
      if (token === request.current)
        setErrorKey(error instanceof MusicSpeakerError ? error.key : "music.cast.discoveryFailed");
    } finally {
      if (token === request.current) setScanning(false);
    }
  };
  const activate = async (device: CastDeviceInfo) => {
    if (!track || trackIssue || busy) return;
    setWorking(device.id);
    setErrorKey(null);
    try {
      await (onLoad ? onLoad(device) : loadMusicOnSpeaker(track, device, positionSec));
    } catch (error) {
      setErrorKey(error instanceof MusicSpeakerError ? error.key : "music.cast.loadFailed");
    } finally {
      setWorking(null);
    }
  };
  const stop = async () => {
    setWorking("stop");
    setErrorKey(null);
    try {
      await (onStop ? onStop() : stopMusicSpeaker());
    } catch (error) {
      setErrorKey(error instanceof MusicSpeakerError ? error.key : "music.cast.controlFailed");
    } finally {
      setWorking(null);
    }
  };
  const returnToComputer = async () => {
    if (!onReturn) return;
    setWorking("return");
    setErrorKey(null);
    try {
      await onReturn();
    } catch (error) {
      setErrorKey(error instanceof MusicSpeakerError ? error.key : "music.cast.controlFailed");
    } finally {
      setWorking(null);
    }
  };

  return (
    <section className="music-speakers">
      {onClose && (
        <button
          type="button"
          className="music-speakers-back"
          data-music-inner-back
          onClick={onClose}
        >
          <ArrowLeft size={17} aria-hidden="true" />
          {t("music.watch.back")}
        </button>
      )}
      <header>
        <div>
          <h2 ref={heading} tabIndex={-1}>
            {t("music.cast.title")}
          </h2>
          <p>{t("music.cast.body")}</p>
        </div>
        <button type="button" onClick={() => void discover()} disabled={scanning}>
          {scanning ? (
            <LoaderCircle size={17} className="animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw size={17} aria-hidden="true" />
          )}
          {t(scanning ? "music.cast.discovering" : "music.cast.discover")}
        </button>
      </header>
      <p className="music-speakers-compatibility">{t("music.cast.compatibility")}</p>
      {(errorKey ?? state.errorKey) && (
        <p className="music-speakers-error" role="alert">
          {t((errorKey ?? state.errorKey)!)}
        </p>
      )}
      {state.device && (
        <div className="music-speakers-session">
          <span className="music-speakers-art">
            <CastIcon device={state.device} size={48} />
          </span>
          <div>
            <strong>{state.device.name}</strong>
            <p role="status">
              {t(
                `music.cast.${state.phase === "idle" ? "stopped" : state.phase === "error" ? "loadFailed" : state.phase}`,
              )}
            </p>
            {state.track && (
              <p>
                {state.track.title} · {state.track.artist}
              </p>
            )}
          </div>
          <div className="music-speakers-actions">
            <button type="button" onClick={() => void stop()} disabled={busy}>
              {t("music.cast.stop")}
            </button>
            {onReturn && (
              <button type="button" onClick={() => void returnToComputer()} disabled={busy}>
                {t("music.cast.computer")}
              </button>
            )}
          </div>
        </div>
      )}
      {trackIssue && <p className="music-speakers-note">{t(trackIssue)}</p>}
      {scanning && <p role="status">{t("music.cast.discovering")}</p>}
      {!scanning && devices?.length === 0 && (
        <p role="status" className="music-speakers-empty">
          {t("music.cast.empty")}
        </p>
      )}
      {devices && devices.length > 0 && (
        <ul className="music-speakers-list">
          {devices.map((device) => {
            const issue = musicSpeakerCompatibility(device);
            const selected = state.active && state.device?.id === device.id;
            return (
              <li key={device.id}>
                <span className="music-speakers-art">
                  <CastIcon device={device} size={48} />
                </span>
                <div className="music-speakers-device">
                  <strong>{device.name}</strong>
                  <p>
                    {[
                      device.model,
                      device.kind === "chromecast"
                        ? "Chromecast"
                        : device.kind === "dlna"
                          ? "DLNA"
                          : device.kind === "airplay"
                            ? "AirPlay"
                            : "Roku",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {issue && <p>{t(issue)}</p>}
                </div>
                <button
                  type="button"
                  disabled={Boolean(issue || trackIssue || busy || selected)}
                  onClick={() => void activate(device)}
                  aria-label={t("music.cast.playOn", { device: device.name })}
                >
                  {working === device.id && (
                    <LoaderCircle size={17} className="animate-spin" aria-hidden="true" />
                  )}
                  {t(selected ? "music.cast.selected" : "music.play")}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="music-speakers-note">{t("music.cast.eqHelp")}</p>
    </section>
  );
}
