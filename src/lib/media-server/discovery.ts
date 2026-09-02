import { mediaServerAdapter } from "./sync";
import { candidateServerOrigins } from "./transport";
import type { AuthResult, MediaServerConnection, MediaServerProvider } from "./types";

export async function discoverAndAuthenticate(
  provider: MediaServerProvider,
  address: string,
  credentials: Record<string, string>,
): Promise<{ origin: string; auth: AuthResult }> {
  const failures: string[] = [];
  for (const origin of candidateServerOrigins(address, provider)) {
    try {
      const adapter = mediaServerAdapter({ provider, origin } as MediaServerConnection);
      return { origin, auth: await adapter.authenticate(credentials) };
    } catch (cause) {
      failures.push(cause instanceof Error ? cause.message : String(cause));
    }
  }
  throw new Error(failures.at(-1) ?? "Could not find a media server at that address");
}

export async function discoverExistingConnection(
  connection: MediaServerConnection,
  address: string,
): Promise<string> {
  let lastError: unknown;
  for (const origin of candidateServerOrigins(address, connection.provider)) {
    try {
      await mediaServerAdapter({ ...connection, origin }).libraries({ ...connection, origin });
      return origin;
    } catch (cause) {
      lastError = cause;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Could not find a media server at that address");
}
