import type { Dispatch, RefObject, SetStateAction } from "react";
import type { RoomEvent, RoomSnapshot } from "./client";
import type { ParticipantLocation, PlayInvite, RoomCommand, SyncState } from "./protocol";
import type { LastInviteMeta } from "./room-derive";
import type {
  ChatMessage,
  IncomingDraw,
  IncomingHostLeaving,
  IncomingInvite,
  IncomingParticipantLeft,
  IncomingSummon,
  RemoteCursor,
} from "./provider-types";

const CHAT_HISTORY_LIMIT = 200;

export function inviteMediaKey(invite: PlayInvite): string {
  return `${invite.mediaId}|${invite.episode?.season ?? ""}|${invite.episode?.episode ?? ""}`;
}

function pruneMap<V>(m: Map<string, V>, keep: Set<string>): Map<string, V> {
  let changed = false;
  for (const k of m.keys()) {
    if (!keep.has(k)) {
      changed = true;
      break;
    }
  }
  if (!changed) return m;
  const next = new Map<string, V>();
  for (const [k, v] of m) if (keep.has(k)) next.set(k, v);
  return next;
}

export type RoomEventSinks = {
  clientId: string;
  stateListenersRef: RefObject<Set<(s: SyncState) => void>>;
  commandListenersRef: RefObject<Set<(from: string, c: RoomCommand) => void>>;
  drawListenersRef: RefObject<Set<(e: IncomingDraw) => void>>;
  lastInviteRef: RefObject<LastInviteMeta | null>;
  setSnapshot: Dispatch<SetStateAction<RoomSnapshot>>;
  setCursorMap: Dispatch<SetStateAction<Map<string, RemoteCursor>>>;
  setPresenceMap: Dispatch<SetStateAction<Map<string, number>>>;
  setParticipantLocations: Dispatch<SetStateAction<Map<string, ParticipantLocation>>>;
  setChat: Dispatch<SetStateAction<ChatMessage[]>>;
  setIncomingInvite: Dispatch<SetStateAction<IncomingInvite | null>>;
  setIncomingHostLeaving: Dispatch<SetStateAction<IncomingHostLeaving | null>>;
  setIncomingParticipantLeft: Dispatch<SetStateAction<IncomingParticipantLeft | null>>;
  setIncomingSummon: Dispatch<SetStateAction<IncomingSummon | null>>;
};

export function applyRoomEvent(e: RoomEvent, sinks: RoomEventSinks): void {
  const {
    clientId,
    stateListenersRef,
    commandListenersRef,
    drawListenersRef,
    lastInviteRef,
    setSnapshot,
    setCursorMap,
    setPresenceMap,
    setParticipantLocations,
    setChat,
    setIncomingInvite,
    setIncomingHostLeaving,
    setIncomingParticipantLeft,
    setIncomingSummon,
  } = sinks;
  if (e.kind === "snapshot") {
    const keep = new Set(e.snapshot.participants.map((p) => p.id));
    setSnapshot(e.snapshot);
    setCursorMap((cur) => pruneMap(cur, keep));
    setPresenceMap((cur) => pruneMap(cur, keep));
    setParticipantLocations((cur) => pruneMap(cur, keep));
  } else if (e.kind === "incoming-state") {
    for (const l of stateListenersRef.current) l(e.state);
  } else if (e.kind === "incoming-command") {
    for (const l of commandListenersRef.current) l(e.from, e.command);
  } else if (e.kind === "chat") {
    setChat((cur) => [...cur, e].slice(-CHAT_HISTORY_LIMIT));
  } else if (e.kind === "invite") {
    lastInviteRef.current = {
      key: inviteMediaKey(e.invite),
      at: Date.now(),
      proto: typeof e.invite.proto === "number" ? e.invite.proto : 0,
      guestPick: e.invite.guestPick === true,
    };
    setIncomingSummon(null);
    setIncomingInvite({ from: e.from, name: e.name, invite: e.invite, at: e.at });
  } else if (e.kind === "host-leaving") {
    setIncomingHostLeaving({ from: e.from, name: e.name, at: e.at });
  } else if (e.kind === "participant-left") {
    if (e.clientId !== clientId) {
      setIncomingParticipantLeft({
        clientId: e.clientId,
        name: e.name,
        at: Date.now(),
        avatar: e.avatar ?? null,
        color: e.color ?? null,
      });
    }
  } else if (e.kind === "summon") {
    setIncomingInvite(null);
    setIncomingSummon({ from: e.from, name: e.name, target: e.target, at: e.at });
  } else if (e.kind === "cursor") {
    setCursorMap((cur) => {
      const next = new Map(cur);
      next.set(e.from, { from: e.from, name: e.name, x: e.x, y: e.y, visible: e.visible, path: e.path, updatedAt: Date.now() });
      return next;
    });
    setPresenceMap((cur) => {
      const next = new Map(cur);
      next.set(e.from, Date.now());
      return next;
    });
  } else if (e.kind === "draw") {
    for (const l of drawListenersRef.current) l(e);
  } else if (e.kind === "presence") {
    setPresenceMap((cur) => {
      const next = new Map(cur);
      next.set(e.from, e.activeAt);
      return next;
    });
    if (e.location) {
      setParticipantLocations((cur) => {
        const next = new Map(cur);
        next.set(e.from, e.location!);
        return next;
      });
    }
  }
}
