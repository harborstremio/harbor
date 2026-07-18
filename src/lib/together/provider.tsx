import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSettings } from "@/lib/settings";
import { randomUuid } from "@/lib/uuid";
import { TogetherClient, type RoomEvent, type RoomSnapshot } from "./client";
import { useSelfIdentity } from "./use-self-identity";
import { relayOutdated } from "./relay-version";
import { clearInviteParams, parseInviteFromLocation } from "./invite";
import {
  deriveHostSource,
  deriveRoomGuestPick,
  type HostSourceInfo,
  type LastInviteMeta,
} from "./room-derive";
import { applyRoomEvent } from "./provider-events";
import type {
  ChatMessage,
  IncomingDraw,
  IncomingHostLeaving,
  IncomingInvite,
  IncomingParticipantLeft,
  IncomingSummon,
  PartialSyncState,
  RemoteCursor,
} from "./provider-types";
import { createCommandSender } from "./seek-coalesce";
import {
  WT_PROTO,
  generateRoomCode,
  normalizeRoomCode,
  type ParticipantLocation,
  type PlayInvite,
  type RoomCommand,
  type SummonTarget,
  type SyncState,
} from "./protocol";

const CLIENT_ID_KEY = "harbor.together.clientId";
const NAME_KEY = "harbor.together.name";

export type {
  ChatMessage,
  IncomingDraw,
  IncomingHostLeaving,
  IncomingInvite,
  IncomingParticipantLeft,
  IncomingSummon,
  PartialSyncState,
  RemoteCursor,
} from "./provider-types";

type TogetherValue = {
  enabled: boolean;
  snapshot: RoomSnapshot;
  chat: ChatMessage[];
  displayName: string;
  clientId: string;
  setDisplayName: (n: string) => void;
  startSession: () => string;
  joinSession: (code: string) => void;
  leaveSession: () => void;
  retrySession: () => void;
  publishState: (state: PartialSyncState) => void;
  sendCommand: (command: RoomCommand) => void;
  onIncomingCommand: (cb: (from: string, command: RoomCommand) => void) => () => void;
  sendChat: (text: string) => void;
  sendInvite: (invite: PlayInvite) => void;
  clearInvite: () => void;
  wasInvitedTo: (key: string) => boolean;
  markReady: (ready: boolean) => void;
  notifyHostLeaving: () => void;
  sendSummon: (target: SummonTarget) => void;
  incomingSummon: IncomingSummon | null;
  dismissSummon: () => void;
  sendCursor: (x: number, y: number, visible: boolean, path: string) => void;
  remoteCursors: RemoteCursor[];
  sendDraw: (
    strokeId: string,
    phase: "start" | "point" | "end" | "clear",
    path: string,
    x?: number,
    y?: number,
    color?: string,
  ) => void;
  onIncomingDraw: (cb: (e: IncomingDraw) => void) => () => void;
  sendPresence: (location?: ParticipantLocation) => void;
  presenceMap: Map<string, number>;
  participantLocations: Map<string, ParticipantLocation>;
  hostLocation: ParticipantLocation | null;
  suppressOutgoingFor: (ms: number) => void;
  onIncomingState: (cb: (state: SyncState) => void) => () => void;
  modalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  incomingInvite: IncomingInvite | null;
  dismissInvite: () => void;
  incomingHostLeaving: IncomingHostLeaving | null;
  dismissHostLeaving: () => void;
  incomingParticipantLeft: IncomingParticipantLeft | null;
  dismissParticipantLeft: () => void;
  claimHost: (fresh: boolean) => void;
  startRoom: () => void;
  relayVersion: number | null;
  relayOutdated: boolean;
  hostSource: HostSourceInfo | null;
  roomGuestPick: boolean;
  lastInviteProto: number;
};

const Ctx = createContext<TogetherValue | null>(null);

function loadOrInitClientId(): string {
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = randomUuid();
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

function loadOrInitName(): string {
  return localStorage.getItem(NAME_KEY) ?? `Guest ${Math.floor(Math.random() * 9000 + 1000)}`;
}

function avatarIsShareable(a: string | null): boolean {
  return !a || a.startsWith("data:") || /^https?:\/\//i.test(a);
}

async function resolveShareableAvatar(a: string | null): Promise<string | null> {
  if (avatarIsShareable(a)) return a;
  try {
    const res = await fetch(a as string);
    if (!res.ok) return a;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : a);
      reader.onerror = () => resolve(a);
      reader.readAsDataURL(blob);
    });
  } catch {
    return a;
  }
}

export function TogetherProvider({ children }: { children: ReactNode }) {
  const { settings, update } = useSettings();
  const { avatar: effectiveAvatar, color: effectiveColor } = useSelfIdentity();
  const relayUrl = settings.togetherRelayUrl;

  const clientIdRef = useRef<string>(loadOrInitClientId());
  const [displayName, setDisplayNameState] = useState<string>(loadOrInitName());
  const displayNameRef = useRef(displayName);
  displayNameRef.current = displayName;
  const [shareAvatar, setShareAvatar] = useState<string | null>(effectiveAvatar);
  const avatarRef = useRef(shareAvatar);
  avatarRef.current = shareAvatar;
  const colorRef = useRef(effectiveColor);
  colorRef.current = effectiveColor;
  const clientRef = useRef<TogetherClient | null>(null);
  const stateListenersRef = useRef<Set<(s: SyncState) => void>>(new Set());
  const commandListenersRef = useRef<Set<(from: string, c: RoomCommand) => void>>(new Set());
  const drawListenersRef = useRef<Set<(e: IncomingDraw) => void>>(new Set());
  const lastInviteRef = useRef<LastInviteMeta | null>(null);
  const guestPickSettingRef = useRef(settings.togetherGuestsPick);
  guestPickSettingRef.current = settings.togetherGuestsPick;
  const commandSenderRef = useRef(createCommandSender((c) => clientRef.current?.sendCommand(c)));
  useEffect(() => () => commandSenderRef.current.dispose(), []);

  const [snapshot, setSnapshot] = useState<RoomSnapshot>({
    state: "disconnected",
    room: null,
    participants: [],
    syncState: null,
    hostClientId: null,
    started: false,
    relayVersion: null,
    lastError: null,
  });
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [incomingInvite, setIncomingInvite] = useState<IncomingInvite | null>(null);
  const [incomingHostLeaving, setIncomingHostLeaving] = useState<IncomingHostLeaving | null>(null);
  const [incomingParticipantLeft, setIncomingParticipantLeft] =
    useState<IncomingParticipantLeft | null>(null);
  const [incomingSummon, setIncomingSummon] = useState<IncomingSummon | null>(null);
  const [cursorMap, setCursorMap] = useState<Map<string, RemoteCursor>>(new Map());
  const [presenceMap, setPresenceMap] = useState<Map<string, number>>(new Map());
  const [participantLocations, setParticipantLocations] = useState<
    Map<string, ParticipantLocation>
  >(new Map());

  const openModal = useCallback(() => setModalOpen(true), []);
  const closeModal = useCallback(() => setModalOpen(false), []);
  const dismissInvite = useCallback(() => setIncomingInvite(null), []);
  const dismissHostLeaving = useCallback(() => setIncomingHostLeaving(null), []);
  const dismissParticipantLeft = useCallback(() => setIncomingParticipantLeft(null), []);
  const dismissSummon = useCallback(() => setIncomingSummon(null), []);

  useEffect(() => {
    if (!incomingSummon) return;
    const t = window.setTimeout(() => setIncomingSummon(null), 14000);
    return () => window.clearTimeout(t);
  }, [incomingSummon]);

  useEffect(() => {
    if (!relayUrl) {
      clientRef.current = null;
      return;
    }
    const c = new TogetherClient(
      relayUrl,
      clientIdRef.current,
      displayNameRef.current,
      avatarRef.current,
      colorRef.current,
    );
    clientRef.current = c;
    const off = c.on((e: RoomEvent) =>
      applyRoomEvent(e, {
        clientId: clientIdRef.current,
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
      }),
    );
    return () => {
      off();
      c.leave();
      stateListenersRef.current.clear();
      commandListenersRef.current.clear();
      drawListenersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relayUrl]);

  useEffect(() => {
    let cancelled = false;
    resolveShareableAvatar(effectiveAvatar).then((v) => {
      if (!cancelled) setShareAvatar(v);
    });
    return () => {
      cancelled = true;
    };
  }, [effectiveAvatar]);

  useEffect(() => {
    clientRef.current?.setProfile(shareAvatar, effectiveColor);
  }, [shareAvatar, effectiveColor]);

  const setDisplayName = useCallback((n: string) => {
    const trimmed = n.trim().slice(0, 32) || `Guest ${Math.floor(Math.random() * 9000 + 1000)}`;
    setDisplayNameState(trimmed);
    localStorage.setItem(NAME_KEY, trimmed);
    clientRef.current?.setName(trimmed);
  }, []);

  const startSession = useCallback((): string => {
    const code = generateRoomCode();
    setChat([]);
    clientRef.current?.join(code);
    return code;
  }, []);

  const joinSession = useCallback((code: string) => {
    const norm = normalizeRoomCode(code);
    if (norm.length === 0) return;
    setChat([]);
    clientRef.current?.join(norm);
  }, []);

  const pendingInviteRef = useRef<{ relayUrl: string; roomCode: string } | null>(null);
  useEffect(() => {
    void (async () => {
      const invite = parseInviteFromLocation();
      if (!invite) return;
      pendingInviteRef.current = invite;
      clearInviteParams();
      if (settings.togetherRelayUrl !== invite.relayUrl) {
        update({ togetherRelayUrl: invite.relayUrl });
      }
      setModalOpen(true);
    })();
  }, []);

  useEffect(() => {
    const pending = pendingInviteRef.current;
    if (!pending) return;
    if (relayUrl !== pending.relayUrl) return;
    if (!clientRef.current) return;
    if (snapshot.state !== "disconnected" && snapshot.state !== "error") return;
    pendingInviteRef.current = null;
    setChat([]);
    clientRef.current.join(pending.roomCode);
  }, [relayUrl, snapshot.state]);

  const leaveSession = useCallback(() => {
    setChat([]);
    clientRef.current?.leave();
  }, []);

  const retrySession = useCallback(() => {
    clientRef.current?.retry();
  }, []);

  const publishState = useCallback((state: PartialSyncState) => {
    clientRef.current?.publishState({
      ...state,
      updatedAt: Date.now(),
      updatedBy: clientIdRef.current,
      hostClientId: null,
    });
  }, []);

  const sendCommand = useCallback((command: RoomCommand) => {
    commandSenderRef.current.send(command);
  }, []);

  const onIncomingCommand = useCallback((cb: (from: string, command: RoomCommand) => void) => {
    commandListenersRef.current.add(cb);
    return () => {
      commandListenersRef.current.delete(cb);
    };
  }, []);

  const sendChat = useCallback((text: string) => {
    clientRef.current?.sendChat(text);
  }, []);

  const sendInvite = useCallback((invite: PlayInvite) => {
    clientRef.current?.sendInvite({
      ...invite,
      proto: WT_PROTO,
      guestPick: guestPickSettingRef.current || undefined,
    });
  }, []);

  const clearInvite = useCallback(() => {
    clientRef.current?.clearInvite();
  }, []);

  const markReady = useCallback((ready: boolean) => {
    clientRef.current?.markReady(ready);
  }, []);

  const notifyHostLeaving = useCallback(() => {
    clientRef.current?.notifyHostLeaving();
  }, []);

  const claimHost = useCallback((fresh: boolean) => {
    clientRef.current?.claimHost(fresh);
  }, []);

  const startRoom = useCallback(() => {
    clientRef.current?.startRoom();
  }, []);

  const sendSummon = useCallback((target: SummonTarget) => {
    clientRef.current?.sendSummon(target);
  }, []);

  const sendCursor = useCallback((x: number, y: number, visible: boolean, path: string) => {
    clientRef.current?.sendCursor(x, y, visible, path);
  }, []);

  const sendDraw = useCallback(
    (
      strokeId: string,
      phase: "start" | "point" | "end" | "clear",
      path: string,
      x?: number,
      y?: number,
      color?: string,
    ) => {
      clientRef.current?.sendDraw(strokeId, phase, path, x, y, color);
    },
    [],
  );

  const sendPresence = useCallback((location?: ParticipantLocation) => {
    clientRef.current?.sendPresence(location);
  }, []);

  const onIncomingDraw = useCallback((cb: (e: IncomingDraw) => void) => {
    drawListenersRef.current.add(cb);
    return () => {
      drawListenersRef.current.delete(cb);
    };
  }, []);

  useEffect(() => {
    if (snapshot.state === "disconnected") {
      setCursorMap(new Map());
      setPresenceMap(new Map());
      setParticipantLocations(new Map());
      setIncomingInvite(null);
      setIncomingHostLeaving(null);
      setIncomingSummon(null);
      return;
    }
    if (snapshot.state !== "joined") return;
    const id = window.setInterval(() => {
      const now = Date.now();
      setCursorMap((cur) => {
        let changed = false;
        const next = new Map(cur);
        for (const [k, v] of cur) {
          if (now - v.updatedAt > 6000) {
            next.delete(k);
            changed = true;
          }
        }
        return changed ? next : cur;
      });
    }, 1500);
    return () => window.clearInterval(id);
  }, [snapshot.state]);

  const remoteCursors = useMemo(() => Array.from(cursorMap.values()), [cursorMap]);

  const hostLocation = useMemo<ParticipantLocation | null>(() => {
    const hostId = snapshot.hostClientId;
    if (!hostId) return null;
    return participantLocations.get(hostId) ?? null;
  }, [snapshot.hostClientId, participantLocations]);

  const suppressOutgoingFor = useCallback((ms: number) => {
    clientRef.current?.suppressOutgoingFor(ms);
  }, []);

  const onIncomingState = useCallback((cb: (state: SyncState) => void) => {
    stateListenersRef.current.add(cb);
    return () => {
      stateListenersRef.current.delete(cb);
    };
  }, []);

  const wasInvitedTo = useCallback((key: string): boolean => {
    const r = lastInviteRef.current;
    return !!r && r.key === key && Date.now() - r.at < 60_000;
  }, []);

  const hostSource = useMemo(() => deriveHostSource(snapshot), [snapshot]);
  const roomGuestPick = deriveRoomGuestPick(snapshot, clientIdRef.current, lastInviteRef.current);
  const lastInviteProto = lastInviteRef.current?.proto ?? 0;
  const isRelayOutdated = snapshot.state === "joined" && relayOutdated(snapshot.relayVersion);

  const value: TogetherValue = useMemo(
    () => ({
      enabled: !!relayUrl,
      snapshot,
      chat,
      displayName,
      clientId: clientIdRef.current,
      setDisplayName,
      startSession,
      joinSession,
      leaveSession,
      retrySession,
      publishState,
      sendCommand,
      onIncomingCommand,
      sendChat,
      sendInvite,
      clearInvite,
      wasInvitedTo,
      markReady,
      notifyHostLeaving,
      sendSummon,
      incomingSummon,
      dismissSummon,
      sendCursor,
      remoteCursors,
      sendDraw,
      onIncomingDraw,
      sendPresence,
      presenceMap,
      participantLocations,
      hostLocation,
      suppressOutgoingFor,
      onIncomingState,
      modalOpen,
      openModal,
      closeModal,
      incomingInvite,
      dismissInvite,
      incomingHostLeaving,
      dismissHostLeaving,
      incomingParticipantLeft,
      dismissParticipantLeft,
      claimHost,
      startRoom,
      relayVersion: snapshot.relayVersion,
      relayOutdated: isRelayOutdated,
      hostSource,
      roomGuestPick,
      lastInviteProto,
    }),
    [
      relayUrl,
      snapshot,
      chat,
      displayName,
      setDisplayName,
      startSession,
      joinSession,
      leaveSession,
      retrySession,
      publishState,
      sendCommand,
      onIncomingCommand,
      sendChat,
      sendInvite,
      clearInvite,
      wasInvitedTo,
      markReady,
      notifyHostLeaving,
      sendSummon,
      incomingSummon,
      dismissSummon,
      sendCursor,
      remoteCursors,
      sendDraw,
      onIncomingDraw,
      sendPresence,
      presenceMap,
      participantLocations,
      hostLocation,
      suppressOutgoingFor,
      onIncomingState,
      modalOpen,
      openModal,
      closeModal,
      incomingInvite,
      dismissInvite,
      incomingHostLeaving,
      dismissHostLeaving,
      incomingParticipantLeft,
      dismissParticipantLeft,
      claimHost,
      startRoom,
      isRelayOutdated,
      hostSource,
      roomGuestPick,
      lastInviteProto,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTogether(): TogetherValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTogether outside TogetherProvider");
  return v;
}
