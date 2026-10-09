import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Radio } from "@/components/icons/music-icons";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { Dropdown } from "@/components/dropdown";
import { MusicCable } from "./music-cable";
import type { CableStatus } from "@/lib/music/cable";
import {
  broadcastStart,
  broadcastStatus,
  broadcastStop,
  broadcastTargets,
  IDLE_BROADCAST,
  type BroadcastStatus,
  type BroadcastTargets,
} from "@/lib/music/decks";

const POLL_MS = 2000;
const AUTO = "auto";

type CableHint = { supported: boolean; active: boolean; device: string };

export function MusicBroadcast() {
  const t = useT();
  const [targets, setTargets] = useState<BroadcastTargets | null>(null);
  const [status, setStatus] = useState<BroadcastStatus>(IDLE_BROADCAST);
  const [device, setDevice] = useState(AUTO);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [cable, setCable] = useState<CableHint>({
    supported: false,
    active: false,
    device: "",
  });
  const alive = useRef(true);
  const picked = useRef("");

  useEffect(() => {
    alive.current = true;
    const poll = async () => {
      const next = await broadcastStatus();
      if (alive.current) setStatus(next);
    };
    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      alive.current = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void broadcastTargets().then((found) => {
      if (!cancelled) setTargets(found);
    });
    return () => {
      cancelled = true;
    };
  }, [cable.device]);

  useEffect(() => {
    if (status.device) setDevice(status.device);
  }, [status.device]);

  useEffect(() => {
    if (!cable.device || picked.current === cable.device) return;
    picked.current = cable.device;
    setDevice(cable.device);
  }, [cable.device]);

  const onCable = useCallback((next: CableStatus) => {
    setCable((prev) => {
      const device = next.active ? (next.outputDevice ?? "") : "";
      const same =
        prev.supported === next.supported && prev.active === next.active && prev.device === device;
      return same ? prev : { supported: next.supported, active: next.active, device };
    });
  }, []);

  const toggle = useCallback(async () => {
    setBusy(true);
    setFailed(null);
    try {
      const next = status.active
        ? await broadcastStop()
        : await broadcastStart(device === AUTO ? null : device);
      if (alive.current) setStatus(next);
    } catch (error) {
      if (alive.current) setFailed(String(error));
    } finally {
      if (alive.current) setBusy(false);
    }
  }, [device, status.active]);

  const devices = useMemo(() => targets?.devices ?? [], [targets]);
  const options = useMemo(() => {
    const list = [
      { value: AUTO, label: t("music.broadcast.auto") },
      ...devices.map((found) => ({ value: found.name, label: found.description })),
    ];
    if (cable.device && !devices.some((found) => found.name === cable.device)) {
      list.push({ value: cable.device, label: t("music.cable.title") });
    }
    return list;
  }, [devices, cable.device, t]);

  const routable = devices.length > 0 || cable.active;
  const stranded = targets !== null && !routable && !cable.supported;
  const drift = status.driftMs;

  return (
    <section className="music-audio-section">
      <div className="music-audio-row">
        <label>
          <Radio size={14} aria-hidden="true" /> {t("music.broadcast.title")}
        </label>
        {routable && (
          <button
            type="button"
            className="music-broadcast-toggle"
            data-on={status.active || undefined}
            disabled={busy}
            onClick={() => void toggle()}
          >
            {t(status.active ? "music.broadcast.stop" : "music.broadcast.start")}
          </button>
        )}
      </div>
      <p>{t("music.broadcast.blurb")}</p>

      <MusicCable onStatus={onCable} />

      {routable && (
        <div className="music-audio-row">
          <label>{t("music.broadcast.output")}</label>
          <Dropdown
            value={device}
            ariaLabel={t("music.broadcast.output")}
            onChange={setDevice}
            options={options}
          />
        </div>
      )}

      {stranded && (
        <div className="music-broadcast-empty">
          <p>{t("music.broadcast.none", { product: targets?.installProduct ?? "" })}</p>
          {targets?.installUrl && (
            <button type="button" onClick={() => openUrl(targets.installUrl)}>
              {t("music.broadcast.install", { product: targets.installProduct })}
            </button>
          )}
        </div>
      )}

      {status.active && (
        <p className="music-broadcast-live">
          {t("music.broadcast.live", { product: status.product ?? "" })}
          {typeof drift === "number" && ` ${t("music.broadcast.drift", { ms: Math.round(drift) })}`}
        </p>
      )}
      {failed && (
        <p role="alert" className="music-broadcast-failed">
          {failed}
        </p>
      )}
    </section>
  );
}
