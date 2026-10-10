import { safeFetch } from "@/lib/safe-fetch";
import { decodeChapterId, isDigits, makeServer, type SuwayomiServer } from "./model";

export type SyncTarget = { server: SuwayomiServer; mangaId: string; key: string };

function headersFor(server: SuwayomiServer, extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { ...(extra ?? {}) };
  if (server.authHeader) h.authorization = server.authHeader;
  return h;
}

async function gqlUpdate(
  server: SuwayomiServer,
  chapterId: string,
  isRead: boolean,
  lastPageRead: number,
): Promise<boolean> {
  if (!isDigits(chapterId)) return false;
  // Only ever set isRead true. Sending false would un-finish a chapter that was
  // completed on another device.
  const patch = isRead ? "isRead: true, lastPageRead: $last" : "lastPageRead: $last";
  const query = `mutation($id: Int!, $last: Int!) {
    updateChapter(input: { id: $id, patch: { ${patch} } }) {
      chapter { id isRead lastPageRead }
    }
  }`;
  try {
    const res = await safeFetch(`${server.base}/api/graphql`, {
      method: "POST",
      headers: headersFor(server, { "content-type": "application/json" }),
      body: JSON.stringify({
        query,
        variables: { id: Number(chapterId), last: Math.max(0, lastPageRead) },
      }),
    });
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    if (!data || data.errors) return false;
    return data?.data?.updateChapter?.chapter?.id != null;
  } catch {
    return false;
  }
}

async function restUpdate(
  server: SuwayomiServer,
  mangaId: string,
  index: string,
  isRead: boolean,
  lastPageRead: number,
): Promise<boolean> {
  if (!isDigits(mangaId) || !isDigits(index)) return false;
  const form: Record<string, string> = { lastPageRead: String(Math.max(0, lastPageRead)) };
  if (isRead) form.read = "true";
  const body = new URLSearchParams(form).toString();
  try {
    const res = await safeFetch(`${server.base}/api/v1/manga/${mangaId}/chapter/${index}`, {
      method: "PATCH",
      headers: headersFor(server, { "content-type": "application/x-www-form-urlencoded" }),
      body,
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function pushChapterProgress(
  baseUrl: string,
  chapterId: string,
  page: number,
  totalPages: number,
  completed?: boolean,
): Promise<boolean> {
  const parsed = decodeChapterId(chapterId);
  if (!parsed) return false;
  const server = makeServer(baseUrl);
  const finished = completed ?? (totalPages > 0 && page >= totalPages - 1);
  const lastPageRead = Math.max(0, page);
  if (await gqlUpdate(server, parsed.key, finished, lastPageRead)) return true;
  return restUpdate(server, parsed.mangaId, parsed.key, finished, lastPageRead);
}
