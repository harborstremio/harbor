export type BrowserSourceFile={url:string;name:string;browserTicket:string};
export const BROWSER_SOURCE_HOSTS={gofile:'Gofile',fuckingfast:'FuckingFast',datanodes:'DataNodes',fichier:'1fichier',buzzheavier:'Buzzheavier',vikingfile:'VikingFile',fileditch:'Fileditch',megadb:'MegaDB',filekeeper:'FileKeeper',akirabox:'AkiraBox',rootz:'Rootz',generic:'Website'} as const;
export type BrowserSourceHost=keyof typeof BROWSER_SOURCE_HOSTS;
/** Browser handoff is distinct from hosts with public metadata APIs. */
export function sourceBrowserHost(value:string):BrowserSourceHost|null {
 try{
  if(value.length>8192||/[\\\x00-\x1f\x7f]/.test(value))return null;
  const url=new URL(value),raw=value.split('://')[1]?.replace(/^[^/]*\//,'').split(/[?#]/)[0]??'';
  if(url.protocol!=='https:'||url.username||url.password)return null;
  const path=decodeURIComponent(raw);
  if(/[\\\x00-\x1f\x7f]/.test(path)||path.split('/').some(part=>part==='.'||part==='..'))return null;
  if(['1fichier.com','www.1fichier.com'].includes(url.hostname))return !url.hash&&url.pathname==='/'&&/^\?[a-z0-9]{5,20}(?:&af=\d{1,20})?$/.test(url.search)?'fichier':null;
  if(url.search)return null;
  if(url.hostname==='fuckingfast.co'){
   const hint=decodeURIComponent(url.hash.slice(1));
   return /^\/[a-z0-9]{12}$/.test(url.pathname)&&new TextEncoder().encode(hint).length<=1000&&!/[\/\\\x00-\x1f\x7f]/.test(hint)?'fuckingfast':null;
  }
  if(url.hash)return null;
  if(['vikingfile.com','www.vikingfile.com','vik1ngfile.site','www.vik1ngfile.site'].includes(url.hostname))return /^\/f\/[A-Za-z0-9]{10}(?:\/[^/]+)?\/?$/.test(url.pathname)&&!/%2f|%5c/i.test(url.pathname)?'vikingfile':null;
  if(['fileditchfiles.st','fileditchfiles.me'].includes(url.hostname))return /^\/[a-z]+[0-9]+\/[a-f0-9]{20}\/[^/]+$/.test(url.pathname)&&!/%2f|%5c/i.test(url.pathname)?'fileditch':null;
  if(['filekeeper.net','www.filekeeper.net'].includes(url.hostname))return /^\/[a-z0-9]{12}(?:\/[^/]+|\.html)?\/?$/.test(url.pathname)&&!/%2f|%5c/i.test(url.pathname)?'filekeeper':null;
  if(['akirabox.com','www.akirabox.com'].includes(url.hostname))return /^\/[A-Za-z0-9]{8,32}\/file\/?$/.test(url.pathname)?'akirabox':null;
  if(['rootz.so','www.rootz.so'].includes(url.hostname))return /^\/(?:download\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}|d\/[A-Za-z0-9_-]{4,64})\/?$/i.test(url.pathname)?'rootz':null;
  // MegaDB requires an approved referring page; direct navigation cannot provide it.
  if(['megadb.net','www.megadb.net'].includes(url.hostname))return null;
  if(['datanodes.to','www.datanodes.to'].includes(url.hostname))return /^\/[a-z0-9]{12}(?:\/[^/]+)?\/?$/.test(url.pathname)&&!/%2f/i.test(url.pathname)?'datanodes':null;
  if(['buzzheavier.com','www.buzzheavier.com','dd.buzzheavier.com','bzzhr.co','bzzhr.to'].includes(url.hostname))return /^\/(?:[a-z0-9]{12}|f\/[A-Za-z0-9_-]{8,64}={0,2})\/?$/.test(url.pathname)?'buzzheavier':null;
  if(!['gofile.io','www.gofile.io'].includes(url.hostname)){
   // Any public site opens in the browser hand-off; a private or local name never does.
   if(/^\[/.test(url.hostname)||!url.hostname.includes('.')||/^\d{1,3}(\.\d{1,3}){3}$/.test(url.hostname))return null;
   return ['localhost','local','internal','lan','home','arpa'].some(s=>url.hostname===s||url.hostname.endsWith(`.${s}`))?null:'generic';
  }
  if(url.hash)return null;
  return /^\/d\/(?:[a-zA-Z0-9]{6}|[a-zA-Z0-9]{8}|[a-fA-F0-9]{8}(?:-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12})\/?$/.test(url.pathname)?'gofile':null;
 }catch{return null}
}
export function sourceBrowserError(reason:unknown):string|null {
 const code=reason instanceof Error?reason.message:String(reason);
 if(code==='public_browser_canceled')return null;
 if(code.includes('games_source_browser_choose')&&/not found|unknown command/i.test(code))return 'games.sources.browser.restart';
 return code==='public_browser_timeout'?'games.sources.browser.timeout':'games.sources.browser.failed';
}
