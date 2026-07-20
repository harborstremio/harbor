import { corsPreflight, error } from "./http.ts";
import { handleRequest, type SyncEnv } from "./handlers.ts";

export async function fetch(request: Request, env: SyncEnv): Promise<Response> {
  if (request.method === "OPTIONS") return corsPreflight();
  try {
    return await handleRequest(request, env);
  } catch {
    return error("invalid_request", 400);
  }
}

export default { fetch };
