import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, MicVocal } from "@/components/icons/music-icons";
import { useT } from "@/lib/i18n";
import { copyText } from "@/components/player/copy-link-button";
import {
  cableCreate,
  cableDepthKey,
  cableDestroy,
  cableErrorKey,
  cableHertz,
  cableResampleKey,
  cableStatus,
  IDLE_CABLE,
  type CableStatus,
} from "@/lib/music/cable";
import "./music-cable.css";

const POLL_MS = 3000;
const COPIED_MS = 1400;

function CableName({ label, name, hint }: { label: string; name: string; hint: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );
  const copy = useCallback(async () => {
    if (!(await copyText(label))) return;
    setCopied(true);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
  }, [label]);
  return (
    <div className="music-cable-name">
      <span className="music-cable-hint">{hint}</span>
      <div className="music-cable-pick">
        <code title={name}>{label}</code>
        <button
          type="button"
          aria-label={t(copied ? "music.cable.copied" : "music.cable.copy")}
          title={t(copied ? "music.cable.copied" : "music.cable.copy")}
          data-copied={copied || undefined}
          onClick={() => void copy()}
        >
          {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

function CableFormat({ status }: { status: CableStatus }) {
  const t = useT();
  const rate = cableHertz(status.rate);
  const depthKey = cableDepthKey(status.format);
  const depth = depthKey ? t(depthKey) : (status.format ?? "");
  if (!rate) {
    return <p className="music-cable-format">{t("music.cable.unknownSpec")}</p>;
  }
  const spec = depth ? t("music.cable.spec", { rate, depth }) : rate;
  const reason = t(cableResampleKey(status.resampledBy), {
    graph: cableHertz(status.graphRate),
    rate,
    requested: cableHertz(status.requestedRate),
    agent: status.resampledBy ?? "",
  });
  return (
    <p className="music-cable-format" data-perfect={status.bitPerfect || undefined}>
      <span className="music-cable-spec">{spec}</span>
      <span className="music-cable-verdict">
        {status.bitPerfect ? t("music.cable.perfect") : reason}
      </span>
    </p>
  );
}

export function MusicCable({ onStatus }: { onStatus?: (status: CableStatus) => void }) {
  const t = useT();
  const [status, setStatus] = useState<CableStatus>(IDLE_CABLE);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    const poll = async () => {
      const next = await cableStatus();
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
    onStatus?.(status);
  }, [status, onStatus]);

  const act = useCallback(
    async (rate?: number) => {
      setBusy(true);
      setFailed(null);
      try {
        const next =
          status.active && rate === undefined ? await cableDestroy() : await cableCreate(rate);
        if (alive.current) setStatus(next);
      } catch (error) {
        if (alive.current) setFailed(cableErrorKey(error));
      } finally {
        if (alive.current) setBusy(false);
      }
    },
    [status.active],
  );

  if (!status.supported) return null;

  const separate = status.monitorReady && status.monitorName !== status.micName;
  const note = status.detail === "music.cable.unknownSpec" ? null : status.detail;

  return (
    <div className="music-cable" data-on={status.active || undefined}>
      <div className="music-cable-head">
        <div className="music-cable-lede">
          <strong>
            <MicVocal size={14} aria-hidden="true" /> {t("music.cable.title")}
          </strong>
          <small>{t("music.cable.blurb")}</small>
        </div>
        <button
          type="button"
          className="music-cable-action"
          data-on={status.active || undefined}
          disabled={busy}
          onClick={() => void act()}
        >
          {t(status.active ? "music.cable.remove" : "music.cable.create")}
        </button>
      </div>

      {status.active && (
        <>
          <CableFormat status={status} />
          {status.resampledBy === "graph" && status.graphRate !== null && (
            <button
              type="button"
              className="music-cable-fix"
              disabled={busy}
              onClick={() => void act(status.graphRate ?? undefined)}
            >
              {t("music.cable.rebuild", { rate: cableHertz(status.graphRate) })}
            </button>
          )}
          {status.micReady && (
            <CableName
              label={status.micLabel}
              name={status.micName}
              hint={t("music.cable.pickMic")}
            />
          )}
          {separate && (
            <CableName
              label={status.monitorLabel}
              name={status.monitorName}
              hint={t("music.cable.pickMonitor")}
            />
          )}
        </>
      )}

      {note && <p className="music-cable-note">{t(note)}</p>}
      {failed && (
        <p role="alert" className="music-cable-failed">
          {t(failed)}
        </p>
      )}
    </div>
  );
}
