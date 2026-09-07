import type { EBookChapter } from "./providers";

export type EBookChapterLocationSource = {
  chapter: EBookChapter;
  text: string;
  translated?: boolean;
  progressKnownOriginal?: boolean;
};

export function ebookParagraphs(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((value) => value.replace(/\n/g, " ").trim())
    .filter(Boolean);
}

export function ebookTextIdentity(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++)
    hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return `${text.length}:${hash >>> 0}`;
}

export function ebookLocationResolver(sources: EBookChapterLocationSource[]) {
  const owner = (chapter: EBookChapter) => {
    try {
      return JSON.parse(chapter.id)[0] as string;
    } catch {
      return "";
    }
  };
  const paragraphs = sources.flatMap(({ chapter, text }) =>
    ebookParagraphs(text).map((text, line, lines) => ({
      chapter,
      text,
      line,
      count: lines.length,
      owner: owner(chapter),
    })),
  );
  const byText = new Map<string, number[]>();
  paragraphs.forEach(({ text }, index) => byText.set(text, [...(byText.get(text) ?? []), index]));
  const originals = new WeakMap<EBookChapterLocationSource, string[]>();
  return (source: EBookChapterLocationSource, line: number) => {
    if (source.translated || !Number.isInteger(line) || line < 0) return null;
    const original = originals.get(source) ?? ebookParagraphs(source.text);
    originals.set(source, original);
    const text = original[line];
    if (!text) return null;
    let candidates = (byText.get(text) ?? []).filter(
      (index) => paragraphs[index].owner === owner(source.chapter),
    );
    for (let distance = 1; candidates.length > 1 && distance <= 4; distance++) {
      candidates = candidates.filter((index) =>
        [-distance, distance].every((offset) => {
          const context = original[line + offset];
          return context === undefined || paragraphs[index + offset]?.text === context;
        }),
      );
    }
    return candidates.length === 1 ? paragraphs[candidates[0]] : null;
  };
}

export function ebookLegacyNavigation(
  source: EBookChapterLocationSource,
  sources: EBookChapterLocationSource[],
  resolve = ebookLocationResolver(sources),
): Pick<EBookChapter, "position" | "legacyNext"> {
  const original = { ...source, translated: false };
  let first: ReturnType<typeof resolve> = null;
  let last: ReturnType<typeof resolve> = null;
  for (const [line] of ebookParagraphs(source.text).entries()) {
    const target = resolve(original, line);
    if (target) {
      first ??= target;
      last = target;
    }
  }
  if (!first || !last) return {};
  const ending = last;
  const next = sources[sources.findIndex((item) => item.chapter.id === ending.chapter.id) + 1];
  return {
    position: first.chapter.position,
    legacyNext:
      last.line < last.count - 1
        ? { chapterId: last.chapter.id, line: last.line + 1 }
        : next
          ? { chapterId: next.chapter.id, line: 0 }
          : undefined,
  };
}
