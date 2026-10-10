import { ARTWORK_MAX_BYTES, validateArtworkLottie, type ArtworkChoice } from './custom-artwork-data';

const canvas = () => { const el = document.createElement('canvas'); el.width = el.height = 256; return el; };
async function imagePoster(blob: Blob) {
  const image = new Image(), url = URL.createObjectURL(blob);
  try {
    image.src = url; await image.decode();
    if (!image.width || !image.height) throw Error('invalid');
    if (image.width > 4096 || image.height > 4096) throw Error('large');
    const el = canvas(), scale = Math.min(256/image.width,256/image.height), w = image.width*scale, h=image.height*scale;
    el.getContext('2d')!.drawImage(image,(256-w)/2,(256-h)/2,w,h);
    return el.toDataURL('image/png');
  } finally { URL.revokeObjectURL(url); }
}
async function animationPoster(data: Record<string,unknown>) {
  const {default:lottie} = await import('lottie-web/build/player/lottie_light_canvas');
  const host = document.createElement('div'); host.style.cssText='position:fixed;inset-inline-start:-1000px;width:256px;height:256px;pointer-events:none';document.body.append(host);
  let animation: import('lottie-web').AnimationItem | undefined;
  try {
    animation = lottie.loadAnimation({container:host,renderer:'canvas',loop:false,autoplay:false,animationData:structuredClone(data),rendererSettings:{clearCanvas:true,preserveAspectRatio:'xMidYMid meet'}});
    const current = animation;
    await new Promise<void>((resolve,reject)=>{
      const timer = setTimeout(()=>reject(Error('invalid')),8000);
      const ready=()=>{clearTimeout(timer);resolve();};
      const failed=()=>{clearTimeout(timer);reject(Error('invalid'));};
      current.addEventListener('DOMLoaded',ready);
      current.addEventListener('data_failed',failed);
      current.addEventListener('error',failed);
      if (current.isLoaded) ready();
    });
    animation.goToAndStop(Math.floor(animation.totalFrames*.25),true);
    const source=host.querySelector('canvas');if(!source)throw Error('invalid');
    const el=canvas();el.getContext('2d')!.drawImage(source,0,0,256,256);return el.toDataURL('image/png');
  } finally { animation?.destroy();host.remove(); }
}
async function unpack(file: File): Promise<unknown> {
  const {unzip,strFromU8} = await import('fflate');
  const bytes = new Uint8Array(await file.arrayBuffer());let size=0,invalid=false;
  const entries = await new Promise<Record<string,Uint8Array>>((resolve,reject)=>{
    unzip(bytes,{filter:entry=>{size+=entry.originalSize;if(size>16*1024*1024 || /(?:^|\/)\.\.(?:\/|$)/.test(entry.name) || entry.name.startsWith('/'))invalid=true;return !invalid;}},(error,result)=>error||invalid?reject(Error('large')):resolve(result));
  });
  const manifest = entries['manifest.json'] ? JSON.parse(strFromU8(entries['manifest.json'])) : null;
  const id = manifest?.animations?.[0]?.id;
  const name = typeof id === 'string' ? [`animations/${id}.json`,`a/${id}.json`].find(key=>entries[key]) : Object.keys(entries).find(key=>/^(animations|a)\/[^/]+\.json$/.test(key));
  if (!name) throw Error('invalid');
  const data = JSON.parse(strFromU8(entries[name]));
  for (const asset of data.assets ?? []) {
    if (typeof asset.p !== 'string' || asset.p.startsWith('data:')) continue;
    const path = `${asset.u ?? ''}${asset.p}`.replace(/^\.\//,'');
    const content = entries[path] ?? entries[`images/${asset.p}`] ?? entries[`i/${asset.p}`];
    const ext = asset.p.split('.').pop()?.toLowerCase();
    if (!content || !['png','jpg','jpeg','gif','webp'].includes(ext)) throw Error('external');
    let binary='';for(let i=0;i<content.length;i+=8192)binary+=String.fromCharCode(...content.subarray(i,i+8192));
    asset.p=`data:image/${ext==='jpg'?'jpeg':ext};base64,${btoa(binary)}`;asset.u='';asset.e=1;
  }
  return data;
}
export async function importArtwork(file: File): Promise<{choice:ArtworkChoice;blob:Blob}> {
  if (!file.size || file.size > ARTWORK_MAX_BYTES) throw Error('large');
  const ext=file.name.split('.').pop()?.toLowerCase();
  let blob:Blob,poster:string,kind:ArtworkChoice['kind'];
  if (ext==='json'||ext==='lottie') {
    const data=validateArtworkLottie(ext==='lottie'?await unpack(file):JSON.parse(await file.text()));
    const text=JSON.stringify(data);if(text.length>16*1024*1024)throw Error('large');
    poster=await animationPoster(data);blob=new Blob([text],{type:'application/json'});kind='lottie';
  } else {
    if (!ext || !['png','jpg','jpeg','webp','gif'].includes(ext)) throw Error('invalid');
    blob=new Blob([await file.arrayBuffer()],{type:`image/${ext==='jpg'?'jpeg':ext}`});
    poster=await imagePoster(blob);kind='image';
  }
  if(poster.length>=200_000)throw Error('large');
  return {blob,choice:{id:crypto.randomUUID(),name:file.name.slice(0,200),kind,poster}};
}
