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
import { TogetherClient, type RoomSnapshot } from "@/lib/together/client";
import { useSelfIdentity } from "@/lib/together/use-self-identity";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";
import { generateListenRoomCode, isListenRoomCode, normalizeListenRoomCode } from "./room";
import { listenTrackFromState, type ListenTrackRef } from "./track-state";
import { listenListenerCount } from "./session";
import { useListenSession } from "./use-listen-session";

const LISTEN_NAME_KEY = "harbor.together.name";
const LISTEN_CLIENT_KEY = "harbor.listen-together.clientId";

function randomId(): string {
  const c = globalThis.crypto;
  if (c && "randomUUID" in c) return c.randomUUID();
  return `lt-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/**
 * A separate client id from the watch room's. The same person can legitimately hold both,
 * and giving each room its own identity keeps a rename or a drop in one from touching the
 * other. Nothing in src/lib/together is read for state, only its transport is reused.
 */
function loadListenClientId(): string {
  try {
    let id = localStorage.getItem(LISTEN_CLIENT_KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(LISTEN_CLIENT_KEY, id);
    }
    return id;
  } catch {
    return randomId();
  }
}

function loadName(): string {
  try {
    return (
      localStorage.getItem(LISTEN_NAME_KEY) ?? `Guest ${Math.floor(Math.random() * 9000 + 1000)}`
    );
  } catch {
    return "Guest";
  }
}

export type ListenTogetherValue = {
  /** Null until a room is started or joined. Nothing connects on its own. */
  room: string | null;
  listeners: number;
  nowPlaying: ListenTrackRef | null;
  isHost: boolean;
  busy: boolean;
  error: string | null;
  /** False while this person is in the video player. See watchingBlocks. */
  canListen: boolean;
  watchingBlocks: boolean;
  relayReady: boolean;
  start: () => void;
  join: (code: string) => void;
  leave: () => void;
};

const EMPTY: ListenTogetherValue = {
  room: null,
  listeners: 0,
  nowPlaying: null,
  isHost: false,
  busy: false,
  error: null,
  canListen: false,
  watchingBlocks: false,
  relayReady: false,
  start: () => {},
  join: () => {},
  leave: () => {},
};

const Ctx = createContext<ListenTogetherValue>(EMPTY);

export function useListenTogether(): ListenTogetherValue {
  return useContext(Ctx);
}

export function ListenTogetherProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const { settings } = useSettings();
  const { player } = useView();
  const identity = useSelfIdentity();
  const relayUrl = settings.togetherRelayUrl;

  const clientId = useRef(loadListenClientId()).current;
  const clientRef = useRef<TogetherClient | null>(null);
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One person cannot watch and listen at once. Being in a watch ROOM is fine; being in
  // the video player is not, because the video owns the ears. js: people in a watch room
  // who are not in the player should still be able to listen.
  const watching = !!player;

  useEffect(() => {
    if (!relayUrl) {
      clientRef.current = null;
      return;
    }
    const client = new TogetherClient(
      relayUrl,
      clientId,
      loadName(),
      identity.avatar,
      identity.color,
    );
    clientRef.current = client;
    const off = client.on(() => setSnapshot(client.getSnapshot()));
    return () => {
      off();
      client.leave();
      clientRef.current = null;
      setSnapshot(null);
    };
  }, [relayUrl, clientId, identity.avatar, identity.color]);

  const leave = useCallback(() => {
    clientRef.current?.leave();
    setRoom(null);
    setBusy(false);
    setError(null);
  }, []);

  // Walking into the player ends the listening session rather than letting it desync.
  useEffect(() => {
    if (watching && room) leave();
  }, [watching, room, leave]);

  const enter = useCallback(
    (code: string) => {
      const client = clientRef.current;
      if (!client) {
        setError(t("Listen Together needs a relay. Set one up in Watch Together first."));
        return;
      }
      if (!isListenRoomCode(code)) {
        setError(t("That is not a listening room code."));
        return;
      }
      setError(null);
      setBusy(true);
      client.join(code);
      setRoom(code);
    },
    [t],
  );

  const start = useCallback(() => {
    if (watching) {
      setError(t("Leave the video player before starting a listening room."));
      return;
    }
    enter(generateListenRoomCode());
  }, [enter, watching, t]);

  const join = useCallback(
    (code: string) => {
      if (watching) {
        setError(t("Leave the video player before joining a listening room."));
        return;
      }
      enter(normalizeListenRoomCode(code));
    },
    [enter, watching, t],
  );

  useEffect(() => {
    if (snapshot?.room) setBusy(false);
  }, [snapshot?.room]);

  useListenSession({ room, clientId, snapshot, clientRef });

  const value = useMemo<ListenTogetherValue>(
    () => ({
      room,
      listeners: snapshot ? listenListenerCount(snapshot) : 0,
      nowPlaying: listenTrackFromState(snapshot?.syncState ?? null),
      isHost: !!snapshot && snapshot.hostClientId === clientId,
      busy,
      error: error ?? snapshot?.lastError ?? null,
      canListen: !watching && !!relayUrl,
      watchingBlocks: watching,
      relayReady: !!relayUrl,
      start,
      join,
      leave,
    }),
    [room, snapshot, busy, error, watching, relayUrl, clientId, start, join, leave],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
