export const EXAMPLE = `{
  "name": "My Source",
  "iconUrl": "https://example-manga.test/favicon.ico",
  "baseUrl": "https://example-manga.test",
  "popularPath": "/browse?sort=popular&offset={offset}",
  "searchPath": "/search?keyword={query}&offset={offset}",
  "list": {
    "item": "article.card",
    "title": "a.title",
    "link": "a.cover@href",
    "cover": "img@data-src|img@src"
  },
  "detail": {
    "title": "h1",
    "cover": "img.poster@src",
    "description": "p.summary",
    "author": "a.author",
    "status": "span.status"
  },
  "chapters": {
    "item": "a[href*=chapter]",
    "link": "@href",
    "number": "span.num",
    "title": "span.name",
    "date": "time@datetime",
    "listUrl": { "match": "/[^/]+$", "replace": "/all-chapters" }
  },
  "pages": {
    "image": ".reader img@src",
    "pathSuffix": "/images?mode=long"
  },
  "headers": {
    "Referer": "https://example-manga.test/"
  }
}`;

export const GUIDE_TXT = `Harbor custom manga source - setup guide
========================================

Harbor ships the engine, not the sites. You write a short JSON config that
describes a site with CSS selectors, and Harbor reads the site with them.
Nothing is bundled: point it only at sites you are legally allowed to read.

RULES (read first)
- Publicly accessible pages only. Harbor logs into nothing and bypasses no
  password, paywall, or access control, and must not be used to attempt it.
- Never target official or licensed publisher sites. Only sites you have the
  right to read.
- You alone are responsible for what you connect and for following copyright
  and each site's terms.
- Works on plain server-rendered HTML. Sites that build the page with
  JavaScript, or hide data inside scripts, need a plugin instead.

SELECTOR SYNTAX
  "sel"                 reads the text inside the first match
  "sel@attr"            reads an attribute (e.g. a@href, img@src)
  "a@data-src|a@src"    tries each in order, uses the first with a value
  "@attr"               reads the attribute off the matched item itself

CONFIG FIELDS
  name          display name (optional; can also be set in the form)
  iconUrl       logo URL (optional)
  baseUrl       the site root, e.g. https://example-manga.test
  popularPath   browse URL, with a paging token (see below)
  searchPath    search URL, with {query} and a paging token
  list          each card on a browse/search page:
                  item   the box around one manga
                  link   the manga link
                  title  its name
                  cover  its cover image
  detail        the series page (all optional): title, cover, description,
                author, status
  chapters      the chapter links on a series page:
                  item     each chapter row
                  link     its URL
                  number   the chapter number text
                  date     its timestamp
                  listUrl  optional { match, replace } regex that rewrites the
                           series URL to a separate full-chapter-list page,
                           for when the series page shows only the latest few
  pages         the reader:
                  image      the page image (matches every page)
                  pathSuffix optional suffix appended to the chapter URL to
                             reach the image list (e.g. /images?mode=long)
  headers       optional request headers, e.g. { "Referer": "..." }

PAGING + SEARCH TOKENS
  {query}   the search text (searchPath only)
  {offset}  how many items to skip, starting at 0. Harbor auto-detects the
            site's page size and walks it for you, so you never set a page
            size. Use when the URL counts items.
  {page}    a page number. Add "pageStart": 0 if the first page is 0. Use
            when the URL counts pages.
  Not sure which? Load page 2 of the site in a browser, watch the address bar.

HOW TO FIND A SELECTOR
  1. Open the site in a browser. Right-click the thing you want (a cover, a
     title, a chapter link) and choose Inspect.
  2. The highlighted tag shows its name and class. class="card cover" becomes
     .card or .cover.
  3. For a link or image you usually want an attribute: a@href, img@src.
  4. Do it once on a browse page, once on a series page, once in the reader.

EXAMPLE CONFIG
${EXAMPLE}
`;

export const AI_PROMPT = `You are generating a manga source config for Harbor's built-in HTML scraper.

Harbor's scraper does a PLAIN HTTP GET (no JavaScript, no headless browser),
parses the HTML with the browser DOMParser, and extracts data with CSS
selectors. It CANNOT run JavaScript, solve Cloudflare/JS challenges, parse JSON
APIs, or render client-side SPAs. It only reads publicly accessible,
server-rendered HTML pages the user is legally allowed to read (never official
or licensed sites, never anything behind a login or paywall).

Selector syntax:
  "sel"              -> text of the first match
  "sel@attr"         -> an attribute (e.g. a@href, img@src)
  "a@data-src|a@src" -> try each, use the first with a value
  "@attr"            -> attribute of the matched item itself

Produce a single JSON object with these keys:
  name, iconUrl (optional), baseUrl,
  popularPath, searchPath   (tokens: {query}, and {offset} for item-count
                             paging or {page} for page-number paging; prefer
                             {offset} - Harbor auto-detects page size),
  list: { item, link, title, cover },
  detail: { title, cover, description, author, status },
  chapters: { item, link, number, title, date,
              listUrl: { match, replace } (optional regex that rewrites the
              series URL to a full-chapter-list page when the series page
              shows only the latest chapters) },
  pages: { image, pathSuffix (optional suffix appended to the chapter URL to
           reach the page-image list) },
  headers: { ... } (optional, e.g. Referer)

Steps:
  1. Fetch the site's browse page, a series page, and a reader page.
  2. Verify every selector against the real HTML before using it.
  3. If the site needs JavaScript, is behind Cloudflare, serves decoy content
     to non-browser clients, or exposes data only as JSON, STOP: say it is not
     scrapeable with this engine (it needs a plugin) and explain why.
  4. Otherwise output ONLY the JSON config, no prose.

Reference example (structure only; the selectors are placeholders):
${EXAMPLE}
`;
