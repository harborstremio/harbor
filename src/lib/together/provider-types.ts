import type { PlayInvite, SummonTarget, SyncState } from "./protocol";

export type ChatMessage = {
  from: string;
  name: string;
  text: string;
  at: number;
};

export type IncomingInvite = {
  from: string;
  name: string;
  invite: PlayInvite;
  at: number;
};

export type IncomingHostLeaving = {
  from: string;
  name: string;
  at: number;
};

export type IncomingParticipantLeft = {
  clientId: string;
  name: string;
  at: number;
  avatar?: string | null;
  color?: string | null;
};

export type IncomingSummon = {
  from: string;
  name: string;
  target: SummonTarget;
  at: number;
};

export type RemoteCursor = {
  from: string;
  name: string;
  x: number;
  y: number;
  visible: boolean;
  path: string;
  updatedAt: number;
};

export type IncomingDraw = {
  from: string;
  name: string;
  strokeId: string;
  phase: "start" | "point" | "end" | "clear";
  x?: number;
  y?: number;
  color?: string;
  path: string;
};

export type PartialSyncState = Omit<SyncState, "updatedAt" | "updatedBy" | "hostClientId">;
