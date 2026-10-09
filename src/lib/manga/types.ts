import type { MangaSummary, MangaChapter, MangaTag } from "./model";

export {
  MANGA_PAGE,
  LANGUAGE_NAMES,
  languageName,
  languageFlag,
  chapterLanguages,
  type MangaSummary,
  type MangaChapter,
  type MangaTag,
} from "./model";

export type SearchAllOpts = {
  /** Skip the stop-on-first-strong-match early exit and query every source. */
  exhaustive?: boolean;
};

export type MangaProvider = {
  id: string;
  name: string;
  popular(offset: number, tagId?: string): Promise<MangaSummary[]>;
  search(query: string, offset: number, tagId?: string): Promise<MangaSummary[]>;
  detail(id: string): Promise<MangaSummary | null>;
  chapters(id: string): Promise<MangaChapter[]>;
  pageUrls(chapterId: string): Promise<string[]>;
  tags?(): Promise<MangaTag[]>;
  searchAll?(query: string, opts?: SearchAllOpts): Promise<MangaSummary[]>;
  setLibrary?(id: string, inLibrary: boolean): Promise<void>;
};

export function mangaThrottle(gapMs: number): <T>(task: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  const wait = () => new Promise((r) => setTimeout(r, gapMs));
  return <T>(task: () => Promise<T>): Promise<T> => {
    const run = tail.then(task, task) as Promise<T>;
    tail = run.then(wait, wait);
    return run;
  };
}
