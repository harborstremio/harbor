import { useMemo, useState } from "react";
import { FolderOpen, Music2, Pause, Play, Radio, Server } from "@/components/icons/music-icons";
import { Poster } from "@/components/poster";
import {
  useMusicConnections,
  type MusicConnectionsStatus,
} from "@/components/music/music-connections";
import { useMusicSourcePicker } from "@/components/music/music-source-picker";
import { useT } from "@/lib/i18n";
import { toggleMusicPlayback, useMusicPlayer } from "@/lib/music/player";
import type {
  MusicConnection,
  MusicConnectionKind,
  MusicConnectionStatus,
  MusicTrack,
} from "@/lib/music/types";

const SHELL =
  "animate-row-in relative grid h-[400px] overflow-hidden rounded-xl border border-edge-soft bg-surface md:grid-cols-2";
const CTA =
  "inline-flex h-11 min-w-[148px] items-center justify-center gap-2 rounded-full bg-ink px-5 text-[13px] font-bold text-canvas transition-transform duration-200 ease-out hover:scale-[1.02] active:scale-[0.99]";
const KICKER = "font-mono text-[10px] uppercase tracking-[0.18em] text-ink-subtle";
const TITLE =
  "mt-3 line-clamp-2 font-semibold text-[39px] font-medium leading-[1.16] tracking-tight text-ink";
const DECK = "mt-3 max-w-[46ch] text-[16px] leading-[22px] text-ink-muted";

const FAST_KINDS: MusicConnectionKind[] = ["local", "server", "streaming"];

const STATUS_KEY: Record<MusicConnectionStatus, string> = {
  connected: "music.connections.statusConnected",
  disconnected: "music.connections.statusDisconnected",
  error: "music.connections.statusError",
  unavailable: "music.connections.statusUnavailable",
};

const STATUS_DOT: Record<MusicConnectionStatus, string> = {
  connected: "bg-success",
  disconnected: "bg-ink-subtle",
  error: "bg-danger",
  unavailable: "bg-ink-subtle",
};

function clock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function MusicHero({
  track,
  queue,
  onOpenConnections,
}: {
  track?: MusicTrack;
  queue?: MusicTrack[];
  onOpenConnections?: () => void;
}) {
  const player = useMusicPlayer();
  const { connections, status, reload } = useMusicConnections();
  const subject = track ?? player.recents[0] ?? null;
  const source = useMemo(
    () => connections.find((row) => row.id === subject?.connectorId),
    [connections, subject?.connectorId],
  );
  const blocked = source ? source.status !== "connected" : false;
  const playable = connections.some(
    (row) => row.status === "connected" && row.capabilities.includes("play"),
  );

  if (!subject || blocked) {
    return (
      <ConnectHero
        connections={connections}
        status={status}
        onRetry={reload}
        onOpenConnections={onOpenConnections}
        variant={playable && !blocked ? "start" : "connect"}
      />
    );
  }

  return <ResumeHero track={subject} queue={queue ?? player.recents} sourceName={source?.name} />;
}

function ArtworkWash({ artwork }: { artwork: string }) {
  const [broken, setBroken] = useState(false);
  if (!artwork || broken) return null;
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      <img
        src={artwork}
        alt=""
        onError={() => setBroken(true)}
        className="size-full scale-110 object-cover opacity-25 blur-lg"
      />
      <span className="absolute inset-0 bg-gradient-to-t from-surface via-surface/70 to-surface/40" />
      <span className="absolute inset-0 bg-gradient-to-r from-surface/20 from-0% via-surface/65 via-50% to-surface to-82% rtl:bg-gradient-to-l" />
    </span>
  );
}

function ResumeHero({
  track,
  queue,
  sourceName,
}: {
  track: MusicTrack;
  queue: MusicTrack[];
  sourceName?: string;
}) {
  const t = useT();
  const player = useMusicPlayer();
  const { openSourcePicker } = useMusicSourcePicker();
  const current = player.current?.id === track.id;
  const playing = current && player.phase === "playing";
  const position = current ? player.currentTime : 0;
  const time = position >= 1 ? clock(position) : "";
  const artist = track.artist;

  let line = artist;
  if (sourceName && time) line = t("music.hero.resumeAt", { artist, source: sourceName, time });
  else {
    const parts = [artist, sourceName, time ? t("music.hero.pausedAt", { time }) : ""];
    line = parts.filter(Boolean).join(" · ");
  }

  const act = () => {
    if (current) toggleMusicPlayback();
    else openSourcePicker(track, queue.length > 0 ? queue : [track]);
  };

  return (
    <section className={SHELL} aria-label={t("music.hero.resumeKicker")}>
      <ArtworkWash artwork={track.artwork} />
      <div className="relative z-10 flex min-w-0 flex-col justify-between p-8">
        <div className="min-w-0">
          <p className={KICKER}>{t("music.hero.resumeKicker")}</p>
          <h2 className={TITLE} title={track.title}>
            {track.title}
          </h2>
          {player.error && current ? (
            <p className={`${DECK} text-danger`}>{player.error}</p>
          ) : (
            <p className={DECK} title={line}>
              {line}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={act} className={CTA}>
            {playing ? (
              <Pause size={16} fill="currentColor" aria-hidden="true" />
            ) : (
              <Play size={16} fill="currentColor" aria-hidden="true" />
            )}
            {playing ? t("music.pause") : t("music.hero.resumeCta")}
          </button>
        </div>
      </div>
      <div className="relative z-10 hidden place-items-center p-8 md:grid">
        <div className="w-[280px] max-w-full">
          <Poster
            src={track.artwork}
            seed={track.id}
            ratio="square"
            className="w-full rounded-md"
          />
        </div>
      </div>
    </section>
  );
}

function ConnectHero({
  connections,
  status,
  onRetry,
  onOpenConnections,
  variant = "connect",
}: {
  connections: MusicConnection[];
  status: MusicConnectionsStatus;
  onRetry: () => void;
  onOpenConnections?: () => void;
  variant?: "connect" | "start";
}) {
  const t = useT();
  const copy =
    variant === "start"
      ? {
          kicker: "music.hero.startKicker",
          title: "music.hero.startTitle",
          body: "music.hero.startBody",
          cta: "music.hero.startCta",
        }
      : {
          kicker: "music.hero.connectKicker",
          title: "music.hero.connectTitle",
          body: "music.hero.connectBody",
          cta: "music.hero.connectCta",
        };
  const fastest = useMemo(
    () =>
      FAST_KINDS.map((kind) => connections.find((row) => row.kind === kind)).filter(
        (row): row is MusicConnection => Boolean(row),
      ),
    [connections],
  );

  return (
    <section className={SHELL} aria-label={t(copy.title)}>
      <div className="relative z-10 flex min-w-0 flex-col justify-between p-8">
        <div className="min-w-0">
          <p className={KICKER}>{t(copy.kicker)}</p>
          <h2 className={TITLE}>{t(copy.title)}</h2>
          <p className={DECK}>{t(copy.body)}</p>
        </div>
        <button type="button" onClick={onOpenConnections} className={`${CTA} self-start`}>
          <Music2 size={16} aria-hidden="true" />
          {t(copy.cta)}
        </button>
      </div>
      <div className="relative z-10 flex min-w-0 flex-col justify-center gap-3 p-8">
        <p className={KICKER}>{t("music.connections.title")}</p>
        {status === "error" ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-[13px] text-ink-subtle">{t("music.error.load")}</p>
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex h-11 items-center rounded-full border border-edge px-4 text-[12px] font-medium text-ink transition-colors duration-200 ease-out hover:bg-elevated"
            >
              {t("music.offline.retry")}
            </button>
          </div>
        ) : status === "loading" ? (
          <ul className="flex flex-col gap-2">
            {FAST_KINDS.map((kind) => (
              <li key={kind} className="harbor-shimmer h-[52px] rounded-md" />
            ))}
          </ul>
        ) : fastest.length === 0 ? (
          <p className="text-[13px] text-ink-subtle">{t("music.connect.shelfBody")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {fastest.map((row) => (
              <ConnectionLine key={row.id} connection={row} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ConnectionLine({ connection }: { connection: MusicConnection }) {
  const t = useT();
  const Icon =
    connection.kind === "local" ? FolderOpen : connection.kind === "server" ? Server : Radio;
  const status = connection.error ?? t(STATUS_KEY[connection.status]);

  return (
    <li className="flex items-center gap-3 rounded-md border border-edge-soft bg-elevated/40 px-3 py-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-elevated text-ink-muted">
        <Icon size={16} aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[13px] font-semibold text-ink" title={connection.name}>
          {connection.name}
        </span>
        <span className="truncate text-[12px] text-ink-subtle" title={status}>
          {status}
        </span>
      </span>
      <span
        aria-hidden="true"
        className={`ms-auto size-1.5 shrink-0 rounded-full ${STATUS_DOT[connection.status]}`}
      />
    </li>
  );
}
