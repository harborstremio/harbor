/**
 * Suwayomi reports a server-side failure as a GraphQL error whose message is the
 * whole Kotlin stack trace, e.g.
 *
 *   Exception while fetching data (/updateExtension) : Extension can't be updated
 *   to the same version. Reinstall the extension instead
 *   java.lang.IllegalStateException: ...
 *       at suwayomi.tachidesk.manga.impl.extension.Extension.installExtension(...)
 *
 * Keep the first meaningful sentence so the UI can show the real reason instead of
 * a generic "action failed".
 */
export function cleanServerMessage(raw: string): string {
  const line = raw.trim().split(/\r?\n/, 1)[0]?.trim() ?? "";
  return line
    .replace(/^Exception while fetching data \([^)]*\)\s*:\s*/i, "")
    .replace(/\s+at\s+[\w.$<>/]+\(.*$/i, "")
    .trim();
}
