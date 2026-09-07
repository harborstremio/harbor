import { persistCritical } from "@/lib/storage-recovery";
import {
  ebookLocationResolver,
  ebookParagraphs,
  ebookTextIdentity,
  type EBookChapterLocationSource,
} from "./chapter-locations";
import type { EBookChapter } from "./providers";

export type EBookReaderPrefs = {
  mode: "harbor" | "book";
  doubleGap: number;
  direction: "auto" | "ltr" | "rtl";
  fontSize: number;
  lineHeight: number;
  width: number;
  background: "dark" | "dim" | "light";
  brightness: number;
  focusMode: boolean;
  mouseLineTrack: boolean;
  lineTrackColor: string;
  font: "literary" | "arabic" | "classic";
  customFontId?: string;
  narrationVoice: string;
};

export type EBookBookmark = {
  id: string;
  bookId: string;
  chapterId: string;
  chapterTitle: string;
  chapterLabel?: string;
  volumeLabel?: string;
  line: number;
  preview: string;
  createdAt: number;
};

export type EBookResume = {
  chapterId: string;
  chapterTitle: string;
  chapterLabel?: string;
  volumeLabel?: string;
  chapterProgress?: number;
  bookProgress?: number;
  chapterIndex?: number;
  totalChapters?: number;
  textIdentity?: string;
  updatedAt: number;
};

export type EBookAnnotation = {
  id: string;
  chapterId: string;
  chapterLabel?: string;
  volumeLabel?: string;
  ranges: Array<{ line: number; start: number; end: number }>;
  text: string;
  color: string;
  density: number;
  title: string;
  body: string;
  tags: string[];
  reference: boolean;
  createdAt: number;
};

const PREFS = "harbor.ebook.reader.v1";
const DEFAULTS: EBookReaderPrefs = {
  mode: "harbor",
  doubleGap: 16,
  direction: "auto",
  fontSize: 19,
  lineHeight: 1.85,
  width: 768,
  background: "dark",
  brightness: 100,
  focusMode: false,
  mouseLineTrack: false,
  lineTrackColor: "#ff9f4d",
  font: "literary",
  narrationVoice: "en-US-AvaNeural",
};

const safe = (value: string) => encodeURIComponent(value);
const bookmarksKey = (profile: string, bookId: string) =>
  `harbor.ebook.bookmarks.v1.${safe(profile)}.${safe(bookId)}`;
const annotationsKey = (profile: string, bookId: string) =>
  `harbor.ebook.annotations.v1.${safe(profile)}.${safe(bookId)}`;
const progressKey = (profile: string, bookId: string, chapterId: string) =>
  `harbor.ebook.progress.v1.${safe(profile)}.${safe(bookId)}.${safe(chapterId)}`;
const resumeKey = (profile: string, bookId: string) =>
  `harbor.ebook.resume.v1.${safe(profile)}.${safe(bookId)}`;

export function loadEBookReaderPrefs(): EBookReaderPrefs {
  try {
    const value = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(PREFS) || "{}") };
    if (["alloy", "nova", "shimmer", "onyx", "echo", "fable"].includes(value.narrationVoice)) {
      value.narrationVoice = DEFAULTS.narrationVoice;
    }
    return value;
  } catch {
    return DEFAULTS;
  }
}

export function saveEBookReaderPrefs(value: EBookReaderPrefs): void {
  persistCritical(PREFS, JSON.stringify(value));
}

export function loadEBookBookmarks(profile: string, bookId: string): EBookBookmark[] {
  try {
    const value = JSON.parse(localStorage.getItem(bookmarksKey(profile, bookId)) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function addEBookBookmark(
  profile: string,
  bookmark: Omit<EBookBookmark, "id" | "createdAt">,
): EBookBookmark[] {
  const items = loadEBookBookmarks(profile, bookmark.bookId);
  const next = {
    ...bookmark,
    id: `bm${Date.now().toString(36)}`,
    createdAt: Date.now(),
  };
  const list = [
    next,
    ...items.filter((item) => item.chapterId !== next.chapterId || item.line !== next.line),
  ].slice(0, 300);
  persistCritical(bookmarksKey(profile, bookmark.bookId), JSON.stringify(list));
  return list;
}

export function removeEBookBookmark(profile: string, bookId: string, id: string): EBookBookmark[] {
  const list = loadEBookBookmarks(profile, bookId).filter((item) => item.id !== id);
  persistCritical(bookmarksKey(profile, bookId), JSON.stringify(list));
  return list;
}

export function loadEBookAnnotations(profile: string, bookId: string): EBookAnnotation[] {
  try {
    const value = JSON.parse(localStorage.getItem(annotationsKey(profile, bookId)) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function saveEBookAnnotation(
  profile: string,
  bookId: string,
  annotation: Omit<EBookAnnotation, "id" | "createdAt"> &
    Partial<Pick<EBookAnnotation, "id" | "createdAt">>,
): EBookAnnotation[] {
  const items = loadEBookAnnotations(profile, bookId);
  const next = {
    ...annotation,
    id: annotation.id ?? `an${Date.now().toString(36)}`,
    createdAt: annotation.createdAt ?? Date.now(),
  } as EBookAnnotation;
  const list = [next, ...items.filter((item) => item.id !== next.id)].slice(0, 1000);
  persistCritical(annotationsKey(profile, bookId), JSON.stringify(list));
  return list;
}

export function removeEBookAnnotation(
  profile: string,
  bookId: string,
  id: string,
): EBookAnnotation[] {
  const list = loadEBookAnnotations(profile, bookId).filter((item) => item.id !== id);
  persistCritical(annotationsKey(profile, bookId), JSON.stringify(list));
  return list;
}

export function loadEBookProgress(profile: string, bookId: string, chapterId: string): number {
  const value = Number(localStorage.getItem(progressKey(profile, bookId, chapterId)));
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

export function saveEBookProgress(
  profile: string,
  bookId: string,
  chapterId: string,
  line: number,
): void {
  persistCritical(progressKey(profile, bookId, chapterId), String(line));
}

export function loadEBookResume(profile: string, bookId: string): EBookResume | null {
  try {
    const value = JSON.parse(localStorage.getItem(resumeKey(profile, bookId)) || "null") as
      | EBookResume
      | null;
    return value?.chapterId ? value : null;
  } catch {
    return null;
  }
}

export function saveEBookResume(
  profile: string,
  bookId: string,
  resume: Omit<EBookResume, "updatedAt">,
): EBookResume {
  const previous = loadEBookResume(profile, bookId);
  const value = {
    ...(previous?.chapterId === resume.chapterId ? previous : undefined),
    ...resume,
    updatedAt: Date.now(),
  };
  persistCritical(resumeKey(profile, bookId), JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("harbor:ebook-resume", { detail: bookId }));
  return value;
}

export function savedEBookChapters(profile: string, bookId: string): EBookChapter[] {
  const resume = loadEBookResume(profile, bookId);
  const chapters = new Map<string, EBookChapter>();
  const prefix = `harbor.ebook.progress.v1.${safe(profile)}.${safe(bookId)}.`;
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (!key?.startsWith(prefix)) continue;
    try {
      const id = decodeURIComponent(key.slice(prefix.length));
      if (id.endsWith(":harbor"))
        chapters.set(id.slice(0, -7), { id: id.slice(0, -7), title: "" });
    } catch {}
  }
  for (const annotation of loadEBookAnnotations(profile, bookId))
    chapters.set(annotation.chapterId, { id: annotation.chapterId, title: "" });
  for (const bookmark of loadEBookBookmarks(profile, bookId))
    chapters.set(bookmark.chapterId, { id: bookmark.chapterId, title: bookmark.chapterTitle });
  if (resume) chapters.set(resume.chapterId, { id: resume.chapterId, title: resume.chapterTitle });
  return [...chapters.values()];
}

export function migrateEBookChapterLocations(
  profile: string,
  bookId: string,
  chapters: EBookChapter[],
  sources: EBookChapterLocationSource[],
  legacy: EBookChapterLocationSource[],
): EBookChapter[] {
  const originalResume = loadEBookResume(profile, bookId);
  const originalBookmarks = loadEBookBookmarks(profile, bookId);
  const originalAnnotations = loadEBookAnnotations(profile, bookId);
  const byId = new Map(legacy.map((source) => [source.chapter.id, source]));
  const resolve = ebookLocationResolver(sources);
  const progress = legacy.flatMap((source) => {
    const value = localStorage.getItem(progressKey(profile, bookId, `${source.chapter.id}:harbor`));
    return value === null ? [] : [{ chapterId: source.chapter.id, line: Number(value) }];
  });
  const backupKey = `harbor.ebook.chapter-migration.v1.${safe(profile)}.${safe(bookId)}`;
  if (
    !localStorage.getItem(backupKey) &&
    !persistCritical(
      backupKey,
      JSON.stringify({
        resume: originalResume,
        bookmarks: originalBookmarks,
        annotations: originalAnnotations,
        progress,
      }),
    )
  )
    return legacy.map((source) => source.chapter);
  const bookmarks = originalBookmarks.map((bookmark) => {
    const source = byId.get(bookmark.chapterId);
    if (
      !source ||
      !bookmark.preview ||
      !ebookParagraphs(source.text)[bookmark.line]?.startsWith(bookmark.preview)
    )
      return bookmark;
    const target = resolve(source, bookmark.line);
    return target
      ? {
          ...bookmark,
          chapterId: target.chapter.id,
          chapterTitle: target.chapter.title,
          chapterLabel: target.chapter.chapter,
          line: target.line,
        }
      : bookmark;
  });
  const annotations = originalAnnotations.map((annotation) => {
    const source = byId.get(annotation.chapterId);
    if (!source || !annotation.ranges.length) return annotation;
    const paragraphs = ebookParagraphs(source.text);
    const selected = annotation.ranges
      .map((range) => paragraphs[range.line]?.slice(range.start, range.end) ?? "")
      .join(" ");
    const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
    if (!annotation.text || normalize(selected) !== normalize(annotation.text)) return annotation;
    const targets = annotation.ranges.map((range) => resolve(source, range.line));
    const first = targets[0];
    if (!first || targets.some((target) => !target || target.chapter.id !== first.chapter.id))
      return annotation;
    return {
      ...annotation,
      chapterId: first.chapter.id,
      chapterLabel: first.chapter.chapter,
      ranges: annotation.ranges.map((range, index) => ({ ...range, line: targets[index]!.line })),
    };
  });
  for (const item of progress) {
    const source = byId.get(item.chapterId)!;
    const identity =
      originalResume?.chapterId === item.chapterId ? originalResume.textIdentity : undefined;
    if (identity ? identity !== ebookTextIdentity(source.text) : !source.progressKnownOriginal)
      continue;
    const target = resolve(source, item.line);
    if (
      target &&
      localStorage.getItem(progressKey(profile, bookId, `${target.chapter.id}:harbor`)) === null
    )
      saveEBookProgress(profile, bookId, `${target.chapter.id}:harbor`, target.line);
  }
  let resume = originalResume;
  if (resume) {
    const source = byId.get(resume.chapterId);
    const line = loadEBookProgress(profile, bookId, `${resume.chapterId}:harbor`);
    const matchesText =
      source &&
      (resume.textIdentity
        ? resume.textIdentity === ebookTextIdentity(source.text)
        : source.progressKnownOriginal);
    const target = matchesText ? resolve(source, line) : null;
    if (target) {
      const chapterIndex = chapters.findIndex((chapter) => chapter.id === target.chapter.id);
      const chapterProgress =
        target.count <= 1 ? 100 : Math.round((target.line / (target.count - 1)) * 100);
      resume = {
        ...resume,
        chapterId: target.chapter.id,
        chapterTitle: target.chapter.title,
        chapterLabel: target.chapter.chapter,
        chapterIndex,
        totalChapters: chapters.length,
        chapterProgress,
        bookProgress: Math.round(((chapterIndex + chapterProgress / 100) / chapters.length) * 100),
        textIdentity: ebookTextIdentity(
          sources.find((source) => source.chapter.id === target.chapter.id)!.text,
        ),
      };
      saveEBookProgress(profile, bookId, `${target.chapter.id}:harbor`, target.line);
    }
  }
  if (bookmarks.some((item, index) => item !== originalBookmarks[index]))
    persistCritical(bookmarksKey(profile, bookId), JSON.stringify(bookmarks));
  if (annotations.some((item, index) => item !== originalAnnotations[index]))
    persistCritical(annotationsKey(profile, bookId), JSON.stringify(annotations));
  if (resume !== originalResume) {
    persistCritical(resumeKey(profile, bookId), JSON.stringify(resume));
    window.dispatchEvent(new CustomEvent("harbor:ebook-resume", { detail: bookId }));
  }
  const remaining = new Set([
    loadEBookResume(profile, bookId)?.chapterId,
    ...loadEBookBookmarks(profile, bookId).map((item) => item.chapterId),
    ...loadEBookAnnotations(profile, bookId).map((item) => item.chapterId),
  ]);
  return legacy.filter((source) => remaining.has(source.chapter.id)).map((source) => source.chapter);
}
