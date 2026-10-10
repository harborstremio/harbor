/** Portraits are joined by the provider profile URL, never by a similar name. */
export function proPortraitId(raw:unknown):string {
  if(typeof raw!=="string")return "";
  try{const url=new URL(raw);return url.protocol==="https:"&&url.hostname==="prosettings.net"&&!url.port&&!url.username&&!url.password&&!url.search&&!url.hash?url.pathname.match(/^\/players\/([\w-]{1,80})\/$/)?.[1]??"":"";}catch{return "";}
}
export function proPortraitImage(raw:unknown):string {
  if(typeof raw!=="string"||raw.length>1200)return "";
  try{const url=new URL(raw);return url.protocol==="https:"&&url.hostname==="prosettings.net"&&!url.port&&!url.username&&!url.password&&/^\/wp-content\/uploads\//.test(url.pathname)&&/\.(?:png|jpe?g|webp|avif)$/i.test(url.pathname)?url.href:"";}catch{return "";}
}
export function parseProPortraitSearch(raw:unknown,id:string):string {
  const groups=(raw as {groups?:unknown})?.groups;if(!Array.isArray(groups))return "";
  for(const group of groups.slice(0,20))if(group?.type==="player"&&Array.isArray(group.items)){
    for(const item of group.items.slice(0,100))if(proPortraitId(item?.url)===id){const image=proPortraitImage(item?.thumbnail);if(image)return image;}
  }
  return "";
}
export function portraitFromProfile(root:Document,id:string):string {
  if(proPortraitId(root.querySelector('link[rel="canonical"]')?.getAttribute("href"))!==id)return "";
  const image=root.querySelector<HTMLImageElement>('section.avatar img');
  const direct=proPortraitImage(image?.getAttribute("src"))||proPortraitImage(image?.getAttribute("data-src"));if(direct)return direct;
  // The provider's Person graph is a second, explicit identity/image association.
  for(const script of [...root.querySelectorAll('script[type="application/ld+json"]')].slice(0,10))try{
    const data=JSON.parse(script.textContent??""),graph=Array.isArray(data?.["@graph"])?data["@graph"]:[data];
    const person=graph.find((node:Record<string,unknown>)=>node?.["@type"]==="Person"&&proPortraitId(node.url)===id);
    const ref=person?.image,object=typeof ref==="object"&&ref?graph.find((node:Record<string,unknown>)=>node?.["@id"]===ref["@id"]):null;
    const linked=proPortraitImage(typeof ref==="string"?ref:ref?.url)||proPortraitImage(object?.contentUrl)||proPortraitImage(object?.url);if(linked)return linked;
  }catch{/* Optional public metadata can be malformed. */}
  return "";
}
