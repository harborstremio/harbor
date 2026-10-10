import type {
  Participant,
  ParticipantLocation,
  PlayInvite,
  RoomCode,
  RoomCommand,
  SummonTarget,
  SyncState,
} from "./protocol";

export type ClientState = "disconnected" | "connecting" | "joined" | "error";

export type RoomSnapshot = {
  state: ClientState;
  room: RoomCode | null;
  participants: Participant[];
  syncState: SyncState | null;
  hostClientId: string | null;
  started: boolean;
  relayVersion: number | null;
  lastError: string | null;
};

export type RoomEvent =
  | { kind: "snapshot"; snapshot: RoomSnapshot }
  | { kind: "incoming-state"; state: SyncState }
  | { kind: "incoming-command"; from: string; command: RoomCommand }
  | { kind: "chat"; from: string; name: string; text: string; at: number }
  | { kind: "invite"; from: string; name: string; invite: PlayInvite; at: number }
  | { kind: "host-leaving"; from: string; name: string; at: number }
  | { kind: "summon"; from: string; name: string; target: SummonTarget; at: number }
  | { kind: "cursor"; from: string; name: string; x: number; y: number; visible: boolean; path: string }
  | { kind: "draw"; from: string; name: string; strokeId: string; phase: "start" | "point" | "end" | "clear"; x?: number; y?: number; color?: string; path: string }
  | { kind: "presence"; from: string; activeAt: number; location?: ParticipantLocation }
  | { kind: "participant-left"; clientId: string; name: string; avatar?: string | null; color?: string | null }
  | { kind: "started"; started: boolean };

export async function diagnoseRelayFailure(httpBase: string): Promise<string> {
  try {
    const res = await fetch(`${httpBase}/health`, { method: "GET" });
    if (res.status === 429) {
      return "The watch together relay is over its daily limit right now. Try again later, or point it at another relay in Settings.";
    }
    if (res.ok) {
      return "The relay is reachable but refused the room, most likely over its daily limit. Try again later, or switch relays in Settings.";
    }
    return `The relay returned an error (HTTP ${res.status}). Check the relay URL in Settings.`;
  } catch {
    return "The watch together relay is unreachable. Check the relay URL in Settings or your connection.";
  }
}
