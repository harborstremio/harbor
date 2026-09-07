/* Canonical chapter identity helpers.
 *
 * A single manga chapter can be served by several providers, each with its own
 * id and its own (often messy) chapter label. These helpers derive a stable,
 * provider-independent key so the UI can treat those copies as one chapter.
 */

/* Extracts the chapter number from a raw label, or null when there is no
   parseable number. Tolerates "ch.", "chap", "chapter", "vol.", "vol"
   prefixes and surrounding punctuation, and normalises decimal separators
   ("5,5" -> "5.5") and leading/trailing zeros ("05" -> "5"). The volume
   number is ignored - only the LAST numeric token is treated as the chapter
   number, which matches the common "Vol.X Ch.Y" ordering. */
export function chapterNumberKey(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const s = raw.toLowerCase().replace(/,/g, ".")
  const tokens = s.match(/\d+(?:\.\d+)?/g)
  if (!tokens || tokens.length === 0) return null
  const last = tokens[tokens.length - 1]
  const n = parseFloat(last)
  if (!Number.isFinite(n)) return null
  return String(n)
}

/* Stable group key for a chapter across providers. Numeric chapters group by
   their normalised number; everything else falls back to a case-folded,
   whitespace-collapsed slug of the raw label or title. */
export function chapterGroupKey(c: {
  language?: string
  chapter?: string | null
  title?: string | null
}): string {
  const numberKey = chapterNumberKey(c.chapter)
  if (numberKey != null) return `${c.language}|${numberKey}`
  const slug = (c.chapter ?? c.title ?? "oneshot").trim().toLowerCase().replace(/\s+/g, " ")
  return `${c.language}|${slug}`
}

/* A chapter's source id is the id prefix before the provider separator. */
export function chapterSourceIdFromId(id: string): string {
  const i = id.indexOf("::")
  return i === -1 ? "" : id.slice(0, i)
}

/* Build the list of chapters handed to the reader.
 *
 * The reader is index-driven: "next chapter" walks the array it is given, it
 * does not re-derive a provider. Callers pass a raw, interleaved list where
 * the same chapter number appears once per provider, so we collapse each
 * group down to a single copy here. When a preferred source is supplied the
 * group keeps that source's copy when it exists; a preferred scanlator group
 * further narrows the pick. The result is sorted ascending by chapter number
 * so the reader's index semantics hold. */
export function resolveReaderChapters<T extends { id: string; chapter?: string | null; language?: string; title?: string | null; publishAt?: string; group?: string }>(
  chapters: T[],
  opts?: { sourceId?: string; group?: string },
): T[] {
  const groups = new Map<string, T[]>()
  for (const c of chapters) {
    const key = chapterGroupKey(c)
    groups.set(key, [...(groups.get(key) ?? []), c])
  }
  const picked: T[] = []
  for (const group of groups.values()) {
    let winner = group[0]
    for (const c of group) {
      if (new Date(c.publishAt ?? 0).getTime() > new Date(winner.publishAt ?? 0).getTime()) {
        winner = c
      }
    }
    const preferred =
      opts?.sourceId != null || opts?.group != null
        ? group.find(
            (c) =>
              (opts?.sourceId == null || chapterSourceIdFromId(c.id) === opts.sourceId) &&
              (opts?.group == null || c.group === opts.group),
          )
        : undefined
    picked.push(preferred ?? winner)
  }
  return picked.sort((a, b) => {
    const an = chapterNumberKey(a.chapter ?? a.title ?? "")
    const bn = chapterNumberKey(b.chapter ?? b.title ?? "")
    const anum = an == null ? NaN : parseFloat(an)
    const bnum = bn == null ? NaN : parseFloat(bn)
    if (Number.isFinite(anum) && Number.isFinite(bnum)) return anum - bnum
    return (a.chapter ?? a.title ?? "").localeCompare(b.chapter ?? b.title ?? "")
  })
}
