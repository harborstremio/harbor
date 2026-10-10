import type { AthletePortrait, AthletePortraitRequest } from "./athlete-portraits";

type Json = Record<string, unknown>;
const obj = (value: unknown): Json =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : {};
const rows = (value: unknown): Json[] => (Array.isArray(value) ? value.map(obj) : []);
const text = (value: unknown) => (typeof value === "string" ? value : "");
const normal = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const api = (params: Record<string, string>) =>
  `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ action: "query", format: "json", formatversion: "2", ...params })}`;

/** Two bounded reads of an exact person's category; never a general image search. */
export async function commonsAthletePortrait(
  request: AthletePortraitRequest,
  sport: RegExp,
  read: (url: string) => Promise<unknown>,
): Promise<AthletePortrait | null> {
  const category = `Category:${request.name.trim()}`;
  const root = obj(
    obj(
      await read(
        api({
          prop: "categories",
          titles: category,
          cllimit: "50",
          list: "categorymembers",
          cmtitle: category,
          cmtype: "file|subcat",
          cmlimit: "40",
        }),
      ),
    ).query,
  );
  const person = rows(root.pages).find(
    (page) => page.ns === 14 && !page.missing && normal(text(page.title)) === normal(category),
  );
  if (!person || !rows(person.categories).some((parent) => sport.test(text(parent.title))))
    return null;

  const name = normal(request.name);
  const ownFile = (title: unknown) =>
    text(title).startsWith("File:") && normal(text(title).slice(5)).startsWith(`${name} `);
  const members = rows(root.categorymembers);
  const files = members.filter((row) => row.ns === 6 && ownFile(row.title)).slice(0, 8);
  const yearly = members
    .filter(
      (row) =>
        row.ns === 14 &&
        normal(text(row.title)).startsWith(`category ${name} in `) &&
        /^\d{4}$/.test(normal(text(row.title)).slice(`category ${name} in `.length)),
    )
    .sort((a, b) => text(b.title).localeCompare(text(a.title)))[0];
  if (!files.length && !yearly) return null;
  const query: Record<string, string> = files.length
    ? { titles: files.map((row) => text(row.title)).join("|") }
    : {
        generator: "categorymembers",
        gcmtitle: text(yearly.title),
        gcmtype: "file",
        gcmlimit: "8",
      };
  const images = rows(
    obj(
      obj(
        await read(
          api({
            ...query,
            prop: "imageinfo",
            iiprop: "url|size",
            iiurlwidth: "330",
          }),
        ),
      ).query,
    ).pages,
  ).filter((page) => page.ns === 6 && ownFile(page.title));
  // Prefer a crop/portrait; unrelated group photographs in the category stay excluded.
  const candidates = images
    .flatMap((page) => rows(page.imageinfo).map((info) => ({ page, info })))
    .sort((a, b) => {
      const score = ({ page, info }: typeof a) =>
        (/crop|recadr/i.test(text(page.title)) ? 2 : 0) +
        (Number(info.height) > Number(info.width) ? 1 : 0);
      return score(b) - score(a);
    });
  for (const { page, info } of candidates) {
    try {
      const url = new URL(text(info.thumburl));
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.port ||
        !["upload.wikimedia.org", "thumb.wikimedia.org"].includes(url.hostname) ||
        !/^\/wikipedia\/commons\//.test(url.pathname) ||
        !/\.(?:png|jpe?g|webp)$/i.test(url.pathname)
      )
        continue;
      return {
        url: url.href,
        source: "Wikimedia Commons",
        sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(text(page.title).replace(/ /g, "_"))}`,
      };
    } catch {
      /* A missing or malformed thumbnail is not a portrait. */
    }
  }
  return null;
}
