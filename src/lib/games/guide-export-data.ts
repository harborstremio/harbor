import type { GameGuide, GuideArticle } from "./guides-data";
export type GuideExport = { game:string; item:GameGuide; article:GuideArticle };
export function guideFilename(title:string,extension:"txt"|"pdf") {
  const name=title.normalize("NFC").replace(/[<>:"/\\|?*\x00-\x1f]/g," ").replace(/\s+/g," ").replace(/[. ]+$/g,"").trim().slice(0,120)||"Guide";
  return `${/^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(name)?`Guide - ${name}`:name}.${extension}`;
}
/** Preserve authored code whitespace, readable block boundaries, lists and link destinations. */
export function guidePlainText(html:string):string {
  const root=new DOMParser().parseFromString(html,"text/html");
  root.querySelectorAll("script,style,button").forEach(node=>node.remove());
  root.querySelectorAll("br").forEach(node=>node.replaceWith("\n"));
  root.querySelectorAll("a[href]").forEach(node=>{const href=node.getAttribute("href");if(href&&/^https:\/\//.test(href)&&node.textContent?.trim()!==href)node.append(` (${href})`);});
  root.querySelectorAll("img").forEach(node=>node.replaceWith(`${node.alt?`[${node.alt}] `:""}${node.src}\n`));
  root.querySelectorAll("li").forEach(node=>node.prepend(node.parentElement?.tagName==="OL"?`${[...node.parentElement.children].indexOf(node)+1}. `:"• "));
  root.querySelectorAll("td,th").forEach(node=>node.append("\t"));
  root.querySelectorAll("p,div,pre,h1,h2,h3,h4,h5,h6,blockquote,ul,ol,li,table,tr,hr").forEach(node=>{node.before("\n");node.after("\n");});
  return (root.body.textContent??"").replace(/\u00a0/g," ").replace(/\n[\t ]*\n[\t ]*\n/g,"\n\n").trim();
}
export function guideAsText({game,item,article}:GuideExport):string {
  const authors=article.authors?.map(author=>author.name).join(", ")||item.author;
  return [article.title,game,authors,item.url,item.source==="pcwiki"?"PCGamingWiki · CC BY-NC-SA 3.0 · https://creativecommons.org/licenses/by-nc-sa/3.0/":"Steam Community",...article.sections.map(section=>`${section.title}\n${"─".repeat(Math.min(60,section.title.length))}\n\n${guidePlainText(section.html)}`)].filter(Boolean).join("\n\n")+"\n";
}
