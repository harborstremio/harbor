import {createSpooktoberEnvironment} from './native-environment.js';
import {startSpooktoberRuntime} from './native-runtime.js?v=1f87a4b3cd8a';
const fonts=new Map();
const mounts=new WeakMap();
async function loadFonts(records){await Promise.all(records.map(async record=>{const key=JSON.stringify(record);if(!fonts.has(key)){const font=new FontFace(record.family,record.source,record.descriptors);fonts.set(key,font.load().then(value=>document.fonts.add(value)).catch(()=>null))}await fonts.get(key)}))}
export async function mountSpooktober({root,scroller,onIntent}){
 if(!(root instanceof ShadowRoot)||!(scroller instanceof HTMLElement)||typeof onIntent!=='function')throw new Error('Spooktober requires a shadow root, its Harbor scroller, and an intent callback.');
 mounts.get(root)?.dispose?.();const mount={};mounts.set(root,mount);
 const base=new URL('.',import.meta.url);
 const [layout,styles,fontRecords]=await Promise.all([fetch(new URL('native-layout.html',base)).then(r=>{if(!r.ok)throw Error('Spooktober layout unavailable');return r.text()}),fetch(new URL('native-styles.css',base)).then(r=>{if(!r.ok)throw Error('Spooktober styles unavailable');return r.text()}),fetch(new URL('native-fonts.json',base)).then(r=>r.json())]);
 if(mounts.get(root)!==mount)throw new DOMException('A newer Spooktober mount replaced this one.','AbortError');
 const sheet=document.createElement('style');sheet.textContent=styles;
 const body=document.createElement('div');body.className='spook-native-body';body.innerHTML=layout;
 const sticky=document.createElement('div');sticky.className='spook-native-overlay';
 const overlay=document.createElement('div');overlay.className='spook-native-viewport';sticky.append(overlay);
 root.replaceChildren(sheet,sticky,body);
 for(const node of body.querySelectorAll('.toast,.skip'))overlay.append(node);
 let resolveReady,rejectReady;const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject});ready.catch(()=>{});
 const environment=createSpooktoberEnvironment({root,scroller,body,overlay,onIntent,onReady:resolveReady});
 try{
  mount.dispose=()=>{environment.dispose();rejectReady(new DOMException('Spooktober was unmounted.','AbortError'));if(mounts.get(root)===mount)mounts.delete(root)};
  await loadFonts(fontRecords);if(mounts.get(root)!==mount)throw new DOMException('A newer Spooktober mount replaced this one.','AbortError');startSpooktoberRuntime(environment.api);
  let timeout;await Promise.race([ready,new Promise((_,reject)=>timeout=globalThis.setTimeout(()=>reject(Error('Spooktober catalog did not become ready')),30000))]).finally(()=>globalThis.clearTimeout(timeout));
  return {setActive:environment.setActive,forget:environment.forget,back:environment.back,dispose:mount.dispose};
 }catch(error){environment.dispose();throw error}
}
