import {writeFile} from 'node:fs/promises';
import {indexRetroLogoFiles,RETRO_LOGO_FOLDERS} from '../src/lib/games/hero-logo-data.ts';

// node --experimental-loader ./scripts/node-test-loader.mjs scripts/refresh-game-logo-index.mjs
// Metadata only: images stay on the source server and load for one selected game.
const index={}, counts={};
for(const [id,folder] of Object.entries(RETRO_LOGO_FOLDERS)){
  const url=`https://thumbnails.libretro.com/${encodeURIComponent(folder)}/Named_Logos/`;
  const response=await fetch(url,{signal:AbortSignal.timeout(25000)});
  if(response.status===404){console.log(`No published logo directory: ${folder}`);continue;}
  if(!response.ok)throw Error(`${folder}: HTTP ${response.status}`);
  const html=await response.text();if(html.length>2_500_000)throw Error('Logo directory too large');
  const files=[...html.matchAll(/href="([^"<>]+\.png)"/g)].flatMap(match=>{try{return[decodeURIComponent(match[1])];}catch{return[]}});
  if(!files.length)throw Error(`No logos listed for ${folder}`);
  index[id]=indexRetroLogoFiles(files);counts[folder]=Object.keys(index[id]).length;
}
await writeFile(new URL('../src/lib/games/retro-logo-index.json',import.meta.url),JSON.stringify(index));
console.log(JSON.stringify({verified:new Date().toISOString(),counts,total:Object.values(counts).reduce((a,b)=>a+b,0)},null,2));
