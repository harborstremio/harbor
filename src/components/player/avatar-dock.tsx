import { useT } from "@/lib/i18n";
import type { PanelCorner } from "@/lib/player-chrome";
import { nameColor } from "@/lib/together/colors";
import type { Participant, ParticipantLocation, SyncState } from "@/lib/together/protocol";
import { useSelfIdentity } from "@/lib/together/use-self-identity";
import { Crown, DoorOpen, Pause, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

const ACTIVE_THRESHOLD_MS = 18_000;

const CORNER_POSITION: Record<PanelCorner, string> = {
  "top-left": "top-20 left-6 items-start",
  "top-right": "top-20 right-6 items-end",
  "bottom-left": "bottom-44 left-6 items-start",
  "bottom-right": "bottom-44 right-6 items-end",
};

export function AvatarDock({
  participants,
  selfId,
  hostId,
  syncState,
  visible,
  presenceMap,
  participantLocations,
  now,
  corner = "top-right",
  hidden = false,
}: {
  participants: Participant[];
  selfId: string;
  hostId: string | null;
  syncState: SyncState | null;
  visible: boolean;
  presenceMap: Map<string, number>;
  participantLocations: Map<string, ParticipantLocation>;
  now: number;
  corner?: PanelCorner;
  hidden?: boolean;
}) {
  if (hidden) return null;
  if (participants.length === 0) return null;
  const lastPauserId = syncState && !syncState.playing && syncState.updatedBy ? syncState.updatedBy : null;
  const alignRight = corner === "top-right" || corner === "bottom-right";

  const attention = participants.some((p) => {
    if (p.id === selfId) return false;
    const lastSeen = presenceMap.get(p.id) ?? p.joinedAt;
    const stale = now - lastSeen > ACTIVE_THRESHOLD_MS;
    const loc = participantLocations.get(p.id);
    const leftPlayer = !!loc && loc.kind !== "player";
    return stale || leftPlayer || p.id === lastPauserId || !p.ready;
  });
  const surface = visible || attention;

  return (
    <div
      className={`fixed ${CORNER_POSITION[corner]} z-30 flex flex-col gap-2 transition-opacity duration-500 ${
        surface ? "pointer-events-none opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <div
        className={`flex flex-col gap-1.5 rounded-2xl border border-white/12 bg-black/35 px-2.5 py-2 backdrop-blur-xl shadow-[0_18px_50px_-22px_rgba(0,0,0,0.65)] ${alignRight ? "items-end" : "items-start"}`}
      >
        {participants.map((p) => {
          const lastSeen = p.id === selfId ? now : (presenceMap.get(p.id) ?? p.joinedAt);
          const stale = now - lastSeen > ACTIVE_THRESHOLD_MS;
          const loc = participantLocations.get(p.id);
          const leftPlayer = p.id !== selfId && !!loc && loc.kind !== "player";
          return (
            <Avatar
              key={p.id}
              participant={p}
              isSelf={p.id === selfId}
              isHost={hostId != null && p.id === hostId}
              isPauser={p.id === lastPauserId}
              isStale={stale}
              leftPlayer={leftPlayer}
            />
          );
        })}
      </div>
    </div>
  );
}

function Avatar({
  participant,
  isSelf,
  isHost,
  isPauser,
  isStale,
  leftPlayer,
}: {
  participant: Participant;
  isSelf: boolean;
  isHost: boolean;
  isPauser: boolean;
  isStale: boolean;
  leftPlayer: boolean;
}) {
  const t = useT();
  const { avatar: selfAvatar, color: selfColor } = useSelfIdentity();
  const initial = (participant.name?.[0] ?? "?").toUpperCase();
  const avatarSrc = isSelf ? selfAvatar : (participant.avatar ?? null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  useEffect(() => setAvatarFailed(false), [avatarSrc]);
  const tint = isSelf ? (selfColor ?? nameColor(participant.name)) : (participant.color ?? nameColor(participant.name));
  const dim = isPauser || isStale || leftPlayer || !participant.ready;
  return (
    <div className="group/avatar pointer-events-auto flex items-center gap-2">
      <span className="hidden whitespace-nowrap rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-medium text-white/90 backdrop-blur-md group-hover/avatar:inline-flex">
        {participant.name}
        {isSelf && t(" · you")}
        {isHost && t(" · host")}
        {isStale && t(" · away")}
        {isPauser && t(" · paused")}
        {leftPlayer && t(" · left the video")}
      </span>
      <span
        aria-label={participant.name}
        className={`relative inline-flex h-9 w-9 transition-[opacity,filter] duration-500 ${
          dim ? "opacity-55 grayscale-[40%]" : "opacity-100"
        }`}
      >
        <span
          className="inline-flex h-full w-full items-center justify-center overflow-hidden rounded-full text-[14px] font-semibold text-black ring-2 ring-white/15"
          style={{
            background: tint,
            boxShadow: `inset 0 0 0 2px ${tint}`,
          }}
        >
          {avatarSrc && !avatarFailed ? (
            <img
              src={avatarSrc}
              alt=""
              draggable={false}
              onError={() => setAvatarFailed(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            initial
          )}
        </span>
        {leftPlayer && (
          <span className="pointer-events-none absolute -bottom-1 -end-1 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/85 text-white/80 ring-1 ring-white/20">
            <DoorOpen size={11} strokeWidth={2.2} />
          </span>
        )}
        {isPauser && !leftPlayer && (
          <span className="pointer-events-none absolute -bottom-1 -end-1 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/85 text-white ring-1 ring-white/20">
            <Pause size={11} fill="currentColor" strokeWidth={0} />
          </span>
        )}
        {isStale && !isPauser && !leftPlayer && (
          <span className="pointer-events-none absolute -bottom-1 -end-1 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/85 text-white/70 ring-1 ring-white/20">
            <WifiOff size={10} strokeWidth={2.4} />
          </span>
        )}
        {isHost && (
          <span
            aria-label={t("Host")}
            className="pointer-events-none absolute -top-2 -end-1 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-300 text-black shadow-[0_2px_6px_rgba(0,0,0,0.45)] ring-2 ring-black/35"
          >
            <Crown size={11} strokeWidth={2.4} fill="currentColor" />
          </span>
        )}
      </span>
    </div>
  );
}
