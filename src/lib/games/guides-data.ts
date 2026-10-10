import { GuideSourceNotFound } from "./guide-source-status";
export type GuideSource = "steam" | "pcwiki" | "bulbapedia" | "youtube" | "kick" | "twitch";
export type GameGuide = { id: string; source: GuideSource; title: string; author: string; image: string; description: string; url: string; live?: boolean; duration?: string; published?: string; views?: number; viewers?: number; rating?: number };
export type GuideSection = { id: string; title: string; html: string };
export type GuideAuthor = { name: string; url: string; avatar: string };
export type GuideArticle = { title: string; sections: GuideSection[]; attribution?: string; image?: string; authors?: GuideAuthor[] };
export function guideCount(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0 ? value : undefined;
  if (typeof value !== "string") return;
  const match = value.match(/^\s*(\d[\d,]*(?:\.\d+)?)\s*([KMB])?(?=\s|$)/i); if (!match) return;
  const multiplier:Record<string,number>={k:1e3,m:1e6,b:1e9};
  const count = Math.round(Number(match[1].replaceAll(",", "")) * (multiplier[match[2]?.toLowerCase()] ?? 1));
  return Number.isSafeInteger(count) && count >= 0 ? count : undefined;
}
const text = (node: Element | null) => (node?.textContent ?? "").replace(/\s+/g, " ").trim();
const doc = (html: string) => new DOMParser().parseFromString(html, "text/html");
export function guideUrl(raw: string, base?: string): string {
  try { const url = new URL(raw, base); return url.protocol === "https:" && !url.username && !url.password && !url.port ? url.href : ""; } catch { return ""; }
}
export function guideImage(raw: string, base?: string): string {
  const value = guideUrl(raw, base);
  return value && /(?:^|\.)(?:steamusercontent\.com|steamstatic\.com|steamuserimages-a\.akamaihd\.net|pcgamingwiki\.com|ytimg\.com)$/.test(new URL(value).hostname) ? value : "";
}
export type SteamGuidePage = { items: GameGuide[]; more: boolean; total?:number; categories:string[]; empty?:boolean };
export function parseSteamGuides(html: string, appId: number): SteamGuidePage {
  const root = doc(html), seen = new Set<string>();
  // Steam omits the normal catalog wrapper on an explicitly empty result page.
  // Require the selected Guides tab to identify this app before accepting that state.
  if(root.querySelector(".apphub_ContentNoGuides") && [...root.querySelectorAll("a.apphub_sectionTab.active")].some(node=>{
    try{const url=new URL(node.getAttribute("href")??"");return url.origin==="https://steamcommunity.com"&&url.pathname===`/app/${appId}/guides/`;}catch{return false;}
  }))return {items:[],more:false,categories:[],empty:true};
  if (!root.querySelector("#guides_content_ctn")) throw Error("Guide catalog unavailable");
  const items = [...root.querySelectorAll<HTMLAnchorElement>("a.workshopItemCollection[data-publishedfileid]")].flatMap(node => {
    const id = node.dataset.publishedfileid ?? "", title = text(node.querySelector(".workshopItemTitle"));
    if (!/^\d{1,20}$/.test(id) || Number(node.dataset.appid) !== appId || !title || seen.has(id)) return [];
    seen.add(id);
    const stars=node.querySelector(".fileRating")?.getAttribute("src")?.match(/\/([1-5])-star\.png(?:\?|$)/)?.[1];
    return [{ id, source: "steam" as const, title, author: text(node.querySelector(".workshopItemAuthorName")), description: text(node.querySelector(".workshopItemShortDesc")), image: guideImage(node.querySelector(".workshopItemPreviewImage")?.getAttribute("src") ?? ""), url: `https://steamcommunity.com/sharedfiles/filedetails/?id=${id}`, rating:stars?Number(stars):undefined }];
  }).slice(0, 30);
  const more = [...root.querySelectorAll("a.pagebtn")].some(node => {
    try { const url=new URL(node.getAttribute("href")??"",`https://steamcommunity.com/app/${appId}/guides/`); return text(node)===">" && url.origin==="https://steamcommunity.com" && url.pathname===`/app/${appId}/guides/` && /^\d+$/.test(url.searchParams.get("p")??""); } catch { return false; }
  });
  const count=text(root.querySelector(".workshopBrowsePagingInfo")).match(/\bof\s+([\d,]+)\s+entries\b/i)?.[1];
  const categories=[...root.querySelectorAll<HTMLInputElement>('input.inputTagsFilter[name="requiredtags[]"]')].map(node=>node.value).filter(value=>!!value&&value.length<=80).slice(0,64);
  return { items, more, total:count?guideCount(count):undefined, categories };
}
const tags = new Set(["p","br","hr","h1","h2","h3","h4","h5","h6","strong","b","em","i","u","s","small","sub","sup","ul","ol","li","blockquote","div","span","a","img","table","thead","tbody","tr","th","td","pre","code"]);
const steamTags:Record<string,string>={bb_h1:"h3",bb_h2:"h4",bb_h3:"h5",bb_code:"pre",bb_table:"table",bb_table_tr:"tr",bb_table_th:"th",bb_table_td:"td",bb_ul:"ul",bb_ol:"ol",bb_blockquote:"blockquote"};
const steamClasses:Record<string,string>={sizeThumb:"games-guide-image-thumb",sizeFull:"games-guide-image-full",sizeOriginal:"games-guide-image-original",floatLeft:"games-guide-float-left",floatRight:"games-guide-float-right",bb_quoteauthor:"games-guide-quote-author",bb_clear:"games-guide-clear",emoticon:"games-guide-emoticon"};
const discard = new Set(["script","style","iframe","object","embed","form","input","button","textarea","select","svg","math","link","meta","template"]);
/** Reconstruct provider content; remote CSS, scripts, attributes and frames never enter Harbor. */
export function sanitizeGuideHtml(html: string, base: string): string {
  const source = document.createElement("template"), result = document.createElement("template");
  source.innerHTML = html.slice(0, 700_000); let count = 0;
  const wiki=new URL(base).hostname==="www.pcgamingwiki.com",steam=new URL(base).hostname==="steamcommunity.com",pokemon=new URL(base).hostname==="bulbapedia.bulbagarden.net";
  const copy = (node: Node, parent: Node, depth: number) => {
    if (++count > 12000 || depth > 60) return;
    if (node.nodeType === Node.TEXT_NODE) { parent.appendChild(document.createTextNode(node.textContent ?? "")); return; }
    if (!(node instanceof HTMLElement)) return;
    // PCGamingWiki uses CSS sprite containers (including transparent overlay
    // images) for support/OS/DRM values. Preserve their meaning without importing
    // the remote stylesheet or rendering empty cells.
    if(wiki&&node.classList.contains("svg-icon")){
      const label=node.getAttribute("title")??node.querySelector("[title]")?.getAttribute("title")??node.querySelector("img")?.getAttribute("alt");
      if(label){const status=document.createElement("span");status.className="games-guide-wiki-status";status.textContent=label.split(" - ")[0].slice(0,160);status.title=label.slice(0,500);parent.appendChild(status);return;}
    }
    if (node.localName==="iframe") {
      const href=guideUrl(node.getAttribute("src")??""), url=href?new URL(href):null;
      const id=url && ["www.youtube.com","www.youtube-nocookie.com"].includes(url.hostname) ? url.pathname.match(/^\/embed\/([\w-]{11})$/)?.[1] : undefined;
      if(id){const link=document.createElement("a");link.href=`https://www.youtube.com/watch?v=${id}`;link.textContent="YouTube";link.rel="noopener noreferrer";link.target="_blank";parent.appendChild(link);} return;
    }
    if (discard.has(node.localName)) return;
    const mapped=steam?Object.keys(steamTags).find(name=>node.classList.contains(name)):undefined;
    const tag = mapped?steamTags[mapped]:node.localName;
    if (!tags.has(tag)) { node.childNodes.forEach(child => copy(child, parent, depth + 1)); return; }
    const target = document.createElement(tag);
    if(steam){
      for(const name of node.classList)if(steamClasses[name])target.classList.add(steamClasses[name]);
      if(node.classList.contains("bb_spoiler")){target.classList.add("games-guide-spoiler");target.tabIndex=0;}
      // Only Steam's explicit clear-break survives; never import remote styles.
      if(node.localName==="div"&&["both","left","right"].includes(node.style.clear))target.classList.add("games-guide-clear");
    }
    if (tag === "a") {
      let href = guideUrl(node.getAttribute("href") ?? "", base);
      if (href && new URL(href).hostname === "steamcommunity.com" && new URL(href).pathname === "/linkfilter/") href = guideUrl(new URL(href).searchParams.get("u") ?? new URL(href).searchParams.get("url") ?? "");
      if (href) { target.setAttribute("href", href); target.setAttribute("rel", "noopener noreferrer"); target.setAttribute("target", "_blank"); }
    }
    if (tag === "img") {
      const raw = node.getAttribute("src") ?? "";
      const pokemonImage = pokemon ? guideUrl(raw, base) : "";
      const src = guideImage(raw, base) || (pokemonImage && new URL(pokemonImage).hostname === "archives.bulbagarden.net" && new URL(pokemonImage).pathname.startsWith("/media/") ? pokemonImage : ""); if (!src) return;
      target.setAttribute("src", src); target.setAttribute("alt", (node.getAttribute("alt") ?? "").slice(0, 300)); target.setAttribute("loading", "lazy"); target.setAttribute("decoding", "async");
      // Wiki status/platform icons carry meaning. Preserve their intrinsic size
      // without accepting remote styles or allowing them to become banner art.
      for (const dimension of ["width", "height"]) { const size=Number(node.getAttribute(dimension)); if(Number.isInteger(size)&&size>0&&size<=(steam?8192:64)) target.setAttribute(dimension,String(size)); }
      const title=node.getAttribute("title");if(title)target.setAttribute("title",title.slice(0,300));
    }
    if(tag==="ol"){const start=Number(node.getAttribute("start"));if(Number.isInteger(start)&&start>0&&start<10000)target.setAttribute("start",String(start));}
    if (tag === "td" || tag === "th") for (const name of ["colspan","rowspan"]) { const n = Number(node.getAttribute(name)); if (Number.isInteger(n) && n > 0 && n <= 20) target.setAttribute(name, String(n)); }
    node.childNodes.forEach(child => copy(child, target, depth + 1));
    if(tag==="table"){const wrap=document.createElement("div");wrap.className="games-guide-table-scroll";wrap.tabIndex=0;wrap.appendChild(target);parent.appendChild(wrap);}else parent.appendChild(target);
  };
  source.content.childNodes.forEach(node => copy(node, result.content, 0)); return result.innerHTML;
}
export function parseSteamGuide(html: string, appId: number): GuideArticle {
  const root = doc(html);
  const sameGame = [...root.querySelectorAll<HTMLAnchorElement>('a[href]')].some(a => { try { const u = new URL(a.href); return u.hostname === "steamcommunity.com" && u.pathname === `/app/${appId}` || u.hostname === "steamcommunity.com" && u.pathname === `/app/${appId}/`; } catch { return false; } });
  const sections = [...root.querySelectorAll(".guide .subSection")].slice(0, 120).map((node, index) => ({ id: `guide-section-${index}`, title: text(node.querySelector(".subSectionTitle")), html: sanitizeGuideHtml(node.querySelector(".subSectionDesc")?.innerHTML ?? "", "https://steamcommunity.com/") })).filter(section => section.html);
  if (!sameGame || !sections.length) throw Error("Guide unavailable for this game");
  const overview=root.querySelector('.guideTopDescription');
  if(overview&&(text(overview)||overview.querySelector('img'))){
    const html=sanitizeGuideHtml(overview.innerHTML,'https://steamcommunity.com/');
    if(html)sections.unshift({id:'guide-overview',title:text(root.querySelector('#guideSectionSelection_0'))||text(root.querySelector('.workshopItemTitle')),html});
  }
  const authors:GuideAuthor[]=[];
  for(const node of [...root.querySelectorAll('.creatorsBlock .friendBlock')].slice(0,20)){
    const content=node.querySelector('.friendBlockContent');
    const name=[...(content?.childNodes??[])].filter(child=>child.nodeType===Node.TEXT_NODE).map(child=>child.textContent??"").join(" ").replace(/\s+/g," ").trim().slice(0,160);
    const href=guideUrl(node.querySelector('a.friendBlockLinkOverlay')?.getAttribute('href')??"","https://steamcommunity.com/");
    const url=href&&/^https:\/\/steamcommunity\.com\/(?:id\/[\w-]+|profiles\/\d+)\/?$/.test(href)?href:"";
    if(name&&!authors.some(author=>author.url===url&&author.name===name))authors.push({name,url,avatar:guideImage(node.querySelector('.playerAvatar img')?.getAttribute('src')??"")});
  }
  let image=guideImage(root.querySelector('meta[property="og:image"]')?.getAttribute('content')??"")||guideImage(root.querySelector('.guidePreviewImage img')?.getAttribute('src')??"");
  // Steam advertises a 5000px social preview. Use the same CDN image and its
  // published resize parameters at a size appropriate for this reader header.
  if(image){const cover=new URL(image);if(/(?:^|\.)steamusercontent\.com$/.test(cover.hostname)&&cover.searchParams.has('imw')&&cover.searchParams.has('imh')){cover.searchParams.set('imw','1600');cover.searchParams.set('imh','1600');image=cover.href;}}
  return { title: text(root.querySelector(".workshopItemTitle")), sections, image, authors };
}
export function parsePcGuide(raw: unknown, appId?: number): GuideArticle {
  if((raw as {error?:{code?:string}})?.error?.code==="missingtitle")throw new GuideSourceNotFound();
  const value = raw as { parse?: { title?: string; text?: { "*"?: string } } }, page = value?.parse;
  if (!page?.title || !page.text?.["*"]) throw Error("Guide unavailable");
  const root = doc(page.text["*"]);
  if (appId && ![...root.querySelectorAll<HTMLAnchorElement>("a[href]")].some(node => { try { const url=new URL(node.href); return url.hostname==="store.steampowered.com" && url.pathname.match(/^\/app\/(\d+)(?:\/|$)/)?.[1]===String(appId); } catch { return false; } })) throw Error("Wiki page does not identify this Steam edition");
  root.querySelectorAll(".template-infobox,.navbox,.mw-editsection,.toc,script,style,.references,.reference,.mw-empty-elt").forEach(node => node.remove());
  const body = root.querySelector(".mw-parser-output") ?? root.body;
  const sections: GuideSection[] = []; let section: GuideSection | undefined;
  for (const node of [...body.children]) {
    if (node.tagName === "H2") { section = { id: `guide-section-${sections.length}`, title: text(node), html: "" }; sections.push(section); }
    else if (section) section.html += node.outerHTML;
  }
  if(!sections.some(section=>section.html)) throw Error("Guide sections unavailable");
  return { title: page.title, sections: sections.filter(s => s.html).slice(0, 60).map(s => ({ ...s, html: sanitizeGuideHtml(s.html, `https://www.pcgamingwiki.com/wiki/${encodeURIComponent(page.title!)}`) })).filter(s=>s.html.replace(/<[^>]*>/g,"").trim()||s.html.includes("<img")) };
}
export const normalizeGuideGame = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();
const normalize = normalizeGuideGame;
const gameAliases: Record<string,string[]> = {
  "counter strike 2":["cs2"], "tom clancy s rainbow six siege":["rainbow six siege","r6 siege","r6s"],
  "tom clancy s rainbow six siege x":["rainbow six siege x","rainbow six siege","r6 siege","r6s"],
  "grand theft auto v":["gta v","gta 5"], "world of warcraft":["wow"],
};
const sequelNumbers = ["ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii", "xiii", "xiv", "xv", "xvi", "xvii", "xviii", "xix", "xx"];
export function guideVideoGameName(game: string) {
  // Catalog editions append “Version”; creators usually use the retail name.
  if (!/^pok[eé]mon\b/i.test(game)) return game;
  return game.replace(/\s+version\b/gi, "").replace(/:\s*Special Pikachu Edition/i, "")
    .replace(/Fire\s*Red/gi, "FireRed").replace(/Leaf\s*Green/gi, "LeafGreen")
    .replace(/Heart\s*Gold/gi, "HeartGold").replace(/Soul\s*Silver/gi, "SoulSilver");
}
function videoTitlePattern(game: string) {
  if (/^pok[eé]mon\b/i.test(game)) return normalize(guideVideoGameName(game)).split(" ").map(word => ({
    firered: "fire ?red", leafgreen: "leaf ?green", heartgold: "heart ?gold", soulsilver: "soul ?silver",
  }[word] ?? word)).join(" ");
  return normalize(game).split(" ").map((word, index) => {
    // Preserve words such as the leading V in V Rising and the pronoun I.
    if (!index) return word;
    const roman = sequelNumbers.indexOf(word), number = Number(word);
    if (roman >= 0) return `(?:${word}|${roman + 2})`;
    if (Number.isInteger(number) && number >= 2 && number <= 20) return `(?:${word}|${sequelNumbers[number - 2]})`;
    return word;
  }).join(" ");
}
type Json = Record<string, any>;
export type GuideVideoCursor = { token:string; clientVersion:string };
export type GuideVideoPage = { items:GameGuide[]; cursor?:GuideVideoCursor; incomplete?:boolean };
export function youtubeInitialData(html: string): unknown {
  const marker = /(?:var\s+ytInitialData\s*=\s*|window\["ytInitialData"\]\s*=\s*)/.exec(html);
  if (!marker) throw Error("Video search unavailable");
  const start = marker.index + marker[0].length; let depth = 0, quoted = false, escaped = false, end = start;
  for (; end < html.length; end++) { const ch = html[end]; if (quoted) { if (escaped) escaped = false; else if (ch === "\\") escaped = true; else if (ch === '"') quoted = false; } else { if (ch === '"') quoted = true; else if (ch === "{") depth++; else if (ch === "}" && --depth === 0) { end++; break; } } }
  return JSON.parse(html.slice(start,end));
}
export function parseGuideVideoPage(input: string | object, game: string, live: boolean, clientVersion?:string): GuideVideoPage {
  const data = typeof input==="string" ? youtubeInitialData(input) : input, found: GameGuide[] = [], seen = new Set<string>(), needle = normalize(game);
  const version=clientVersion ?? (typeof input==="string" ? input.match(/"INNERTUBE_CONTEXT_CLIENT_VERSION"\s*:\s*"([\w.-]+)"/)?.[1] : undefined);
  let token:string|undefined;
  const pattern = videoTitlePattern(game), matchesTitle = new RegExp(` ${pattern} `);
  const matchesSequel = new RegExp(` ${pattern} (?:[2-9]|1\\d|20|${sequelNumbers.join("|")}) `);
  const label = (v: Json | undefined) => typeof v?.simpleText === "string" ? v.simpleText : Array.isArray(v?.runs) ? v.runs.map((r: Json) => typeof r.text === "string" ? r.text : "").join("") : "";
  let visited = 0, recognized = false;
  const walk = (value: unknown, level: number) => {
    if (++visited > 25000 || level > 40 || !value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(v => walk(v, level + 1)); return; }
    const object = value as Json, video = object.videoRenderer;
    if(video || Array.isArray(object.itemSectionRenderer?.contents) || Array.isArray(object.sectionListRenderer?.contents))recognized=true;
    const next=object.continuationItemRenderer?.continuationEndpoint;
    if(next?.commandMetadata?.webCommandMetadata?.apiUrl==="/youtubei/v1/search" && typeof next.continuationCommand?.token==="string") { token=next.continuationCommand.token.slice(0,20000);recognized=true; }
    if (video) {
      const id = String(video.videoId ?? ""), title = label(video.title), isLive = (video.badges ?? []).some((b: Json) => b.metadataBadgeRenderer?.style === "BADGE_STYLE_TYPE_LIVE_NOW") || (video.thumbnailOverlays ?? []).some((b: Json) => b.thumbnailOverlayTimeStatusRenderer?.style === "LIVE");
      const titleText = ` ${normalize(title)} `;
      // A base-title search often includes its sequel (Hades II, Portal 2).
      // Do not treat an immediately following sequel number as the selected original.
      const sequel = matchesSequel.test(titleText);
      const matched=matchesTitle.test(titleText) || (gameAliases[needle]??[]).some(alias=>titleText.includes(` ${alias} `));
      if (/^[\w-]{11}$/.test(id) && !seen.has(id) && needle && matched && !sequel && isLive === live) {
        seen.add(id); found.push({ id, source:"youtube", title, author:label(video.ownerText ?? video.longBylineText), image:`https://i.ytimg.com/vi/${id}/hqdefault.jpg`, description:"", url:`https://www.youtube.com/watch?v=${id}`, live:isLive, duration:label(video.lengthText), published:label(video.publishedTimeText), ...(isLive?{viewers:guideCount(label(video.viewCountText))}:{views:guideCount(label(video.viewCountText))}) });
      }
      return;
    }
    Object.values(object).forEach(v => walk(v, level + 1));
  };
  walk(data, 0);
  if(!recognized)throw Error("Video search unavailable");
  return {items:found, cursor:token && version ? {token,clientVersion:version}:undefined, ...(token&&!version?{incomplete:true}:{})};
}
export function parseGuideVideos(html:string,game:string,live:boolean):GameGuide[] { return parseGuideVideoPage(html,game,live).items; }

/** Read only Kick's public server-rendered category response, never execute its scripts. */
export function parseKickGuides(html:string,game:string):GameGuide[] {
  const chunks=[...html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)].map(match=>JSON.parse(match[1]) as string).join("");
  const found:GameGuide[]=[], seen=new Set<string>(); let recognized=false;
  for(const line of chunks.split("\n")) {
    const at=line.indexOf(":"); if(at<0)continue;
    let value:unknown;try{value=JSON.parse(line.slice(at+1));}catch{continue;}
    let count=0;
    const walk=(node:any,depth:number)=>{
      if(++count>35000 || depth>45 || !node || typeof node!=="object")return;
      if(Array.isArray(node.livestreams)) { recognized=true; for(const stream of node.livestreams){
        const slug=stream?.channel?.slug, title=stream?.title, category=normalize(String(stream?.category?.name??""));
        if(typeof slug!=="string" || !/^[a-z\d_-]{1,80}$/i.test(slug) || typeof title!=="string" || seen.has(slug) || category!==normalize(game))continue;
        seen.add(slug);const image=guideUrl(String(stream?.thumbnail?.src??""));
        found.push({id:slug,source:"kick",title:title.slice(0,400),author:String(stream.channel.username??slug),image:image && new URL(image).hostname==="images.kick.com"?image:"",description:"",url:`https://kick.com/${slug}`,live:true,viewers:guideCount(stream.viewer_count)});
      }}
      Object.values(node).forEach(child=>walk(child,depth+1));
    };walk(value,0);
  }
  if(!recognized)throw Error("Kick category unavailable");
  return found;
}
