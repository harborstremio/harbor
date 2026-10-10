import {webIntent,type WebIntent} from './cloud-web-jobs';
let connection:Promise<IDBDatabase>|undefined;
function database(){
 if(!connection)connection=new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('harbor-game-web-jobs',1);request.onupgradeneeded=()=>request.result.createObjectStore('intents');request.onerror=request.onblocked=()=>reject(Error('web_storage'));request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();connection=undefined};resolve(request.result)}}).catch(reason=>{connection=undefined;throw reason});
 return connection;
}
export async function readWebIntent(key:string){const db=await database();return new Promise<WebIntent|null>((resolve,reject)=>{const request=db.transaction('intents').objectStore('intents').get(key);request.onsuccess=()=>{try{resolve(webIntent(request.result))}catch{reject(Error('web_storage'))}};request.onerror=()=>reject(Error('web_storage'))})}
// Commit the intent before contacting the service. A crashed/ambiguous submission never auto-retries.
export async function claimWebIntent(key:string,value:WebIntent){
 const db=await database();return new Promise<{intent:WebIntent;created:boolean}>((resolve,reject)=>{const tx=db.transaction('intents','readwrite'),store=tx.objectStore('intents');let result:{intent:WebIntent;created:boolean};const get=store.get(key);get.onsuccess=()=>{try{const old=webIntent(get.result);result={intent:old??value,created:!old};if(!old)store.add(webIntent(value),key)}catch{tx.abort()}};tx.oncomplete=()=>resolve(result);tx.onabort=tx.onerror=()=>reject(Error('web_storage'))});
}
export async function writeWebIntent(key:string,value:WebIntent|null){const db=await database();const valid=value===null?null:webIntent(value);return new Promise<void>((resolve,reject)=>{const tx=db.transaction('intents','readwrite');if(valid)tx.objectStore('intents').put(valid,key);else tx.objectStore('intents').delete(key);tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(Error('web_storage'))})}

// A late AllDebrid response must not replace a newer, explicitly repeated request.
export async function replaceWebIntent(key:string,expected:WebIntent,value:WebIntent|null){
 const db=await database(),next=value===null?null:webIntent(value);
 return new Promise<boolean>((resolve,reject)=>{const tx=db.transaction('intents','readwrite'),store=tx.objectStore('intents');let changed=false;const get=store.get(key);
 get.onsuccess=()=>{try{const old=webIntent(get.result);if(old&&old.requestId===expected.requestId&&old.createdAt===expected.createdAt&&old.remoteId===expected.remoteId){changed=true;if(next)store.put(next,key);else store.delete(key)}}catch{tx.abort()}};
 tx.oncomplete=()=>resolve(changed);tx.onabort=tx.onerror=()=>reject(Error('web_storage'));
 });
}
