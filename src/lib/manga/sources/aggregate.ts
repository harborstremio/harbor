import type { MangaChapter, MangaProvider, MangaSummary, MangaTag } from "@/lib/manga/types";
import { aggregateSubProviders } from "@/lib/manga/sources";

const SEP = "::";
const SOURCE_TIMEOUT = 10000;

const EMPTY_PROVIDER: MangaProvider = {
  id: "",
  name: "",
  popular: async () => [],
  search: async () => [],
  detail: async () => null,
  chapters: async () => [],
  pageUrls: async () => [],
};

function withTimeout<T>(p: Promise<T>, fallback: T, timeout = SOURCE_TIMEOUT): Promise<T> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(fallback), timeout);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(fallback);
      },
    );
  });
}

function prefixId(sourceId: string, id: string): string {
  return `${sourceId}${SEP}${id}`;
}

function parseId(id: string): { source: string; orig: string } {
  const i = id.indexOf(SEP);
  if (i === -1) return { source: aggregateSubProviders()[0]?.id ?? "", orig: id };
  return { source: id.slice(0, i), orig: id.slice(i + SEP.length) };
}

function subById(sourceId: string): MangaProvider {
  const subs = aggregateSubProviders();
  return subs.find((s) => s.id === sourceId) ?? subs[0] ?? EMPTY_PROVIDER;
}

export function routeById(id: string): { provider: MangaProvider; orig: string } | null {
  const i = id.indexOf(SEP);
  if (i === -1) return null;
  const source = id.slice(0, i);
  const orig = id.slice(i + SEP.length);
  const provider = aggregateSubProviders().find((s) => s.id === source);
  return provider ? { provider, orig } : null;
}

async function mergeLists(
  fn: (p: MangaProvider) => Promise<MangaSummary[]>,
  timeout = SOURCE_TIMEOUT,
): Promise<MangaSummary[]> {
  const lists = await Promise.all(
    aggregateSubProviders().map((p) =>
      withTimeout(
        fn(p).then((l) => l.map((m) => ({ ...m, id: prefixId(p.id, m.id) }))),
        [] as MangaSummary[],
        timeout,
      ).catch(() => [] as MangaSummary[]),
    ),
  );
  const out: MangaSummary[] = [];
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) {
    for (const list of lists) {
      if (list[i]) out.push(list[i]);
    }
  }
  return out;
}

export async function streamAll(
  fn: (p: MangaProvider) => Promise<MangaSummary[]>,
  onChunk: (items: MangaSummary[]) => void,
): Promise<MangaSummary[]> {
  const all: MangaSummary[] = [];
  await Promise.all(
    aggregateSubProviders().map((p) =>
      withTimeout(
        fn(p).then((l) => l.map((m) => ({ ...m, id: prefixId(p.id, m.id) }))),
        [] as MangaSummary[],
      )
        .catch(() => [] as MangaSummary[])
        .then((list) => {
          if (list.length) {
            all.push(...list);
            onChunk(list);
          }
        }),
    ),
  );
  return all;
}

export async function streamAggregateChapters(
  id: string,
  onChunk: (chs: MangaChapter[]) => void,
  ownHintId?: string,
): Promise<void> {
  const subs = aggregateSubProviders();
  const sepIdx = id.indexOf(SEP);
  const hintReal = !!ownHintId && subs.some((p) => p.id === ownHintId);
  const source =
    sepIdx !== -1 ? id.slice(0, sepIdx) : hintReal ? (ownHintId as string) : (subs[0]?.id ?? "");
  const orig = sepIdx !== -1 ? id.slice(sepIdx + SEP.length) : id;
  const ownP = subById(source);
  const ownChaptersP = ownP
    .chapters(orig)
    .then((cs) => labelChapters(cs, ownP))
    .catch(() => [] as MangaChapter[]);
  const detail = await ownP.detail(orig).catch(() => null);
  const title = detail?.title;
  const others = title ? subs.filter((p) => p.id !== ownP.id) : [];
  await Promise.all([
    ownChaptersP.then((chs) => {
      if (chs.length) onChunk(chs);
    }),
    ...others.map((p) =>
      withTimeout(
        (async () => {
          const hit = pickSameTitle(
            await p.search(title as string, 0).catch(() => []),
            title as string,
          );
          if (!hit) return;
          const labeled = labelChapters(await p.chapters(hit.id).catch(() => []), p);
          if (labeled.length) onChunk(labeled);
        })(),
        undefined,
      ).catch(() => {}),
    ),
  ]);
}

function labelChapters(chs: MangaChapter[], p: MangaProvider): MangaChapter[] {
  return chs.map((c) => ({
    ...c,
    id: prefixId(p.id, c.id),
    // The scanlator group stands alone: the server name was previously
    // prepended here ("My Server · Webtoon"), which is noise on the details
    // page. Server identity is retained in the prefixed chapter id.
    group: c.group,
  }));
}

function normTitle(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function pickSameTitle(hits: MangaSummary[], title: string): MangaSummary | null {
  const key = normTitle(title);
  if (!key) return null;
  return (
    hits.find(
      (h) => normTitle(h.title) === key || (h.altTitle != null && normTitle(h.altTitle) === key),
    ) ?? null
  );
}

async function mergeSearchLists(query: string): Promise<MangaSummary[]> {
  const providers = aggregateSubProviders();
  if (!providers.length) return [];

  const lists = new Map<number, MangaSummary[]>();
  let releaseExact: () => void = () => {};
  const exact = new Promise<void>((resolve) => {
    releaseExact = resolve;
  });
  let exactFound = false;

  const requests = providers.map((provider, index) =>
    withTimeout(
      (provider.searchAll?.(query) ?? provider.search(query, 0)).then((items) =>
        items.map((item) => ({ ...item, id: prefixId(provider.id, item.id) })),
      ),
      [] as MangaSummary[],
      30_000,
    ).then((items) => {
      lists.set(index, items);
      if (!exactFound && pickSameTitle(items, query)) {
        exactFound = true;
        releaseExact();
      }
    }),
  );

  const all = Promise.all(requests).then(() => undefined);
  await Promise.race([all, exact]);
  return [...lists.entries()].sort(([a], [b]) => a - b).flatMap(([, items]) => items);
}

async function mergeTags(): Promise<MangaTag[]> {
  const lists = await Promise.all(
    aggregateSubProviders().map((p) =>
      withTimeout(p.tags?.() ?? Promise.resolve([]), [] as MangaTag[]),
    ),
  );
  const seen = new Set<string>();
  return lists.flat().filter((tg) => (seen.has(tg.id) ? false : (seen.add(tg.id), true)));
}

export const aggregateProvider: MangaProvider = {
  id: "all",
  name: "All Sources",
  popular: (offset, tagId) => mergeLists((p) => p.popular(offset, tagId)),
  search: (query, offset, tagId) => mergeLists((p) => p.search(query, offset, tagId)),
  searchAll: mergeSearchLists,
  detail: async (id) => {
    const { source, orig } = parseId(id);
    const d = await subById(source)
      .detail(orig)
      .catch(() => null);
    return d ? { ...d, id } : null;
  },
  chapters: async (id) => {
    const { source, orig } = parseId(id);
    const ownP = subById(source);
    const detail = await ownP.detail(orig).catch(() => null);
    const ownChs = labelChapters(await ownP.chapters(orig).catch(() => []), ownP);
    const title = detail?.title;
    if (!title) return ownChs;
    const others = aggregateSubProviders().filter((p) => p.id !== source);
    const extra = await Promise.all(
      others.map((p) =>
        withTimeout(
          (async () => {
            const hit = pickSameTitle(await p.search(title, 0).catch(() => []), title);
            if (!hit) return [] as MangaChapter[];
            const chs = await p.chapters(hit.id).catch(() => []);
            return labelChapters(chs, p);
          })(),
          [] as MangaChapter[],
        ),
      ),
    );
    return [...ownChs, ...extra.flat()];
  },
  pageUrls: async (chapterId) => {
    const { source, orig } = parseId(chapterId);
    return subById(source)
      .pageUrls(orig)
      .catch(() => []);
  },
  setLibrary: async (id, inLibrary) => {
    const { source, orig } = parseId(id);
    await subById(source).setLibrary?.(orig, inLibrary);
  },
  tags: mergeTags,
};
