import { mediaServerConnections } from "./connections";
import { mediaServerItems } from "./index-store";
import type { MediaServerConnection } from "./types";

export function assertServerContextConnection(
  expected: MediaServerConnection,
): MediaServerConnection {
  const current = mediaServerConnections().find((connection) => connection.id === expected.id);
  if (
    !current?.enabled ||
    current.profileId !== expected.profileId ||
    current.userId !== expected.userId ||
    current.origin !== expected.origin ||
    current.provider !== expected.provider
  )
    throw new Error("This server connection changed. Choose a source again.");
  return current;
}

export async function resolveServerContextCopy(
  expected: MediaServerConnection,
  itemId: string,
  versionId?: string,
) {
  const connection = assertServerContextConnection(expected);
  const item = (await mediaServerItems(connection.id)).find(
    (item) => item.id === itemId && item.connectionId === connection.id,
  );
  if (!item || !versionId || !item.versions.some((version) => version.id === versionId))
    throw new Error("This server version changed. Choose a source again.");
  return { connection: assertServerContextConnection(expected), item };
}
