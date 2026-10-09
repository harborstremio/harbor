import { invoke } from '@tauri-apps/api/core';
import { sourceDocumentResponse, sourceVerificationAvailable, type NativeSourceDocument } from './source-verification';

let supported = true;
/** New binaries cancel native work; browser and older binaries retain the existing path. */
export async function fetchNativeSource(profile: string | undefined, url: string, signal: AbortSignal, maxBytes: number): Promise<Response | null> {
  signal.throwIfAborted();
  if (!supported || !sourceVerificationAvailable()) return null;
  const session = crypto.randomUUID(), owner = profile ?? null;
  const command = 'games_source_http_fetch';
  let rejectAbort!: (reason: unknown) => void;
  const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
  const cancel = () => {
    void invoke('games_source_http_cancel', { profile: owner, session }).catch(() => {});
    rejectAbort(signal.reason);
  };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    const operation = invoke<NativeSourceDocument>(command, { profile: owner, session, url, maxBytes });
    const document = await Promise.race([operation, aborted]);
    signal.throwIfAborted();
    return await sourceDocumentResponse(document, url, signal, maxBytes);
  } catch (error) {
    signal.throwIfAborted();
    if (String(error).includes(command) && /not found|unknown command/i.test(String(error))) { supported = false; return null; }
    if (String(error) === 'source_canceled') throw new DOMException('Canceled', 'AbortError');
    throw error;
  } finally { signal.removeEventListener('abort', cancel); }
}
