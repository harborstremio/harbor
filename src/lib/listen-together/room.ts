import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, type RoomCode } from "@/lib/together/protocol";

/**
 * Listen rooms ride the same relay as watch rooms, so the two code spaces must never
 * overlap. worker.js only accepts /r/[A-Z0-9]{4,8}, which rules out a separator, so the
 * namespace is a prefix and a length instead: watch codes are 6 characters, listen codes
 * are 8 beginning "LT". A code of one kind can never parse as the other.
 */
export const LISTEN_ROOM_PREFIX = "LT";
export const LISTEN_ROOM_BODY = ROOM_CODE_LENGTH;
export const LISTEN_ROOM_LENGTH = LISTEN_ROOM_PREFIX.length + LISTEN_ROOM_BODY;

const RELAY_MAX = 8;

export function generateListenRoomCode(): RoomCode {
  let out = LISTEN_ROOM_PREFIX;
  const buf = new Uint32Array(LISTEN_ROOM_BODY);
  crypto.getRandomValues(buf);
  for (let i = 0; i < LISTEN_ROOM_BODY; i += 1) {
    out += ROOM_CODE_ALPHABET[buf[i] % ROOM_CODE_ALPHABET.length];
  }
  return out;
}

export function normalizeListenRoomCode(input: string): RoomCode {
  const bare = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = bare.startsWith(LISTEN_ROOM_PREFIX) ? bare.slice(LISTEN_ROOM_PREFIX.length) : bare;
  return (LISTEN_ROOM_PREFIX + body).slice(0, LISTEN_ROOM_LENGTH);
}

export function isListenRoomCode(code: string): boolean {
  if (code.length !== LISTEN_ROOM_LENGTH) return false;
  if (!code.startsWith(LISTEN_ROOM_PREFIX)) return false;
  return /^[A-Z0-9]+$/.test(code);
}

/** A watch room is anything the relay accepts that is not one of ours. */
export function isWatchRoomCode(code: string): boolean {
  if (isListenRoomCode(code)) return false;
  return code.length >= 4 && code.length <= RELAY_MAX && /^[A-Z0-9]+$/.test(code);
}

export function listenRoomIsComplete(code: string): boolean {
  return isListenRoomCode(normalizeListenRoomCode(code));
}
