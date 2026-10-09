export function createSpooktoberEnvironment({root,scroller,body,overlay,onIntent,onReady}){
 const nativeWindow=globalThis.window,nativeDocument=globalThis.document;
 const events=new EventTarget(),listeners=[],observers=new Set(),timers=new Map(),frames=new Map(),restores=[];
 const abort=new AbortController();let active=true,disposed=false,sequence=0,title='Spooktober';
 let savedScroll=scroller.scrollTop,savedFocus=null;
 const base=new URL('/spooktober/index.html',nativeWindow.location.href);
 let currentUrl=new URL(base),historyIndex=0;const historyEntries=[{url:currentUrl.href,state:null}];
 const originalAppend=body.append.bind(body);
 body.append=(...nodes)=>{for(const node of nodes){if(node?.matches?.('.catalog-menu,.scroll-return,.toast,.skip'))overlay.append(node);else originalAppend(node)}};
 const add=(target,type,listener,options)=>{if(disposed)return;target.addEventListener(type,listener,options);listeners.push([target,type,listener,options])};
 const remove=(target,type,listener,options)=>target.removeEventListener(type,listener,options);
 const eventTarget=type=>type==='scroll'?scroller:events;
 const rect=element=>{const value=element.getBoundingClientRect(),bounds=scroller.getBoundingClientRect();return new DOMRect(value.x-bounds.x-scroller.clientLeft,value.y-bounds.y-scroller.clientTop,value.width,value.height)};
 function scrollIntoView(element,options={}){
  if(typeof options==='boolean')options={block:options?'start':'end'};
  let ancestor=element.parentElement;
  while(ancestor&&ancestor!==body){
   if(ancestor.scrollHeight>ancestor.clientHeight+1&&/(auto|scroll)/.test(getComputedStyle(ancestor).overflowY)){
    const item=element.getBoundingClientRect(),box=ancestor.getBoundingClientRect();
    if(item.top<box.top)ancestor.scrollTop+=item.top-box.top;else if(item.bottom>box.bottom)ancestor.scrollTop+=item.bottom-box.bottom;
    if(ancestor.closest('.spook-native-overlay'))return;
   }
   if(ancestor.scrollWidth>ancestor.clientWidth+1&&/(auto|scroll)/.test(getComputedStyle(ancestor).overflowX)){
    const item=element.getBoundingClientRect(),box=ancestor.getBoundingClientRect();
    if(item.left<box.left)ancestor.scrollLeft+=item.left-box.left;else if(item.right>box.right)ancestor.scrollLeft+=item.right-box.right;
   }
   ancestor=ancestor.parentElement;
  }
  const item=rect(element),height=scroller.clientHeight;let offset=item.top;
  if(options.block==='nearest')offset=item.top<0?item.top:item.bottom>height?item.bottom-height:0;
  else if(options.block==='center')offset=item.top-(height-item.height)/2;
  else if(options.block==='end')offset=item.bottom-height;
  scroller.scrollTo({top:scroller.scrollTop+offset,behavior:options.behavior||'instant'});
 }
 const document={
  body,head:{append:(...nodes)=>root.append(...nodes)},documentElement:body,
  querySelector:selector=>body.querySelector(selector)||overlay.querySelector(selector),querySelectorAll:selector=>[...body.querySelectorAll(selector),...overlay.querySelectorAll(selector)],
  createElement:(...args)=>nativeDocument.createElement(...args),
  addEventListener:(type,listener,options)=>add(root,type,listener,options),
  removeEventListener:(type,listener,options)=>remove(root,type,listener,options),
  dispatchEvent:event=>root.dispatchEvent(event),
  get activeElement(){return root.activeElement||body},get hidden(){return !active||nativeDocument.hidden},
  get title(){return title},set title(value){title=value},
 };
 function remember(){if(active&&body.getClientRects().length){savedScroll=scroller.scrollTop;if(root.activeElement)savedFocus=root.activeElement}}
 function forget(){savedScroll=0;savedFocus=null;scroller.scrollTop=0}
 function back(){
  if(disposed||!active)return false;
  const menu=document.querySelector('[role="menu"]:not([hidden]),[role="listbox"]:not([hidden])');
  if(menu){const event=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});menu.dispatchEvent(event);if(event.defaultPrevented)return true}
  const detail=document.querySelector('#detail[open]');
  if(detail){const parent=detail.querySelector('#dialog-back');if(parent&&!parent.hidden)parent.click();else detail.close();return true}
  if(body.classList.contains('viewing-page')){document.querySelector('#page-back')?.click();return true}
  return false;
 }
 function historyMove(state,url,push){
  currentUrl=new URL(url||currentUrl.href,currentUrl);
  if(push){historyEntries.splice(++historyIndex);historyEntries.push({state,url:currentUrl.href})}
  else historyEntries[historyIndex]={state,url:currentUrl.href};
 }
 const history={scrollRestoration:'manual',get state(){return historyEntries[historyIndex].state},
  pushState:(state,_title,url)=>historyMove(state,url,true),replaceState:(state,_title,url)=>historyMove(state,url,false),
  back(){if(historyIndex){const previous=historyEntries[--historyIndex];currentUrl=new URL(previous.url);events.dispatchEvent(new PopStateEvent('popstate',{state:previous.state}))}},
 };
 const location={get href(){return currentUrl.href},get origin(){return nativeWindow.location.origin},get pathname(){return currentUrl.pathname},get search(){return ''},get hash(){return currentUrl.hash},reload(){onIntent({channel:'harbor-spooktober',intent:'reload'})}};
 function scheduleTimer(timer){timer.deadline=performance.now()+timer.remaining;timer.handle=nativeWindow.setTimeout(()=>{if(disposed)return;timers.delete(timer.id);timer.callback(...timer.args)},timer.remaining)}
 function setTimeout(callback,delay=0,...args){if(disposed)return 0;const id=++sequence,timer={id,callback,args,remaining:Math.max(0,delay),handle:0,deadline:0};timers.set(id,timer);if(active)scheduleTimer(timer);return id}
 function clearTimeout(id){const timer=timers.get(id);if(timer)nativeWindow.clearTimeout(timer.handle);timers.delete(id)}
 function scheduleFrame(frame){frame.handle=nativeWindow.requestAnimationFrame(time=>{if(disposed)return;frames.delete(frame.id);frame.callback(time)})}
 function requestAnimationFrame(callback){if(disposed)return 0;const id=++sequence,frame={id,callback,handle:0};frames.set(id,frame);if(active)scheduleFrame(frame);return id}
 function cancelAnimationFrame(id){const frame=frames.get(id);if(frame)nativeWindow.cancelAnimationFrame(frame.handle);frames.delete(id)}
 function observerClass(Original,intersection=false){return class {
  constructor(callback,options){this.observer=new Original((...args)=>{if(!disposed&&active)callback(...args)},intersection?{root:scroller,...options}:options);observers.add(this)}
  observe(...args){if(!disposed){observers.add(this);this.observer.observe(...args)}}unobserve(...args){this.observer.unobserve(...args)}disconnect(){this.observer.disconnect();observers.delete(this)}takeRecords(){return this.observer.takeRecords?.()||[]}
 }}
 function matchMedia(query){const media=nativeWindow.matchMedia(query);return {get matches(){return media.matches},media:media.media,addEventListener:(type,listener,options)=>add(media,type,listener,options),removeEventListener:(type,listener,options)=>remove(media,type,listener,options)}}
 function mapAssets(value){if(typeof value==='string')return value.startsWith('assets/')?'/spooktober/'+value:value;if(Array.isArray(value))return value.map(mapAssets);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,mapAssets(item)]));return value}
 async function fetch(input,options){const response=await nativeWindow.fetch(new URL(input,base),{...options,signal:abort.signal});return {ok:response.ok,status:response.status,json:async()=>mapAssets(await response.json()),text:()=>response.text()}}
 const api={document,history,location,rect,scrollIntoView,fetch,matchMedia,setTimeout,clearTimeout,requestAnimationFrame,cancelAnimationFrame,__spookBack:back,
  addEventListener:(type,listener,options)=>add(eventTarget(type),type,listener,options),removeEventListener:(type,listener,options)=>remove(eventTarget(type),type,listener,options),
  scrollTo:(...args)=>scroller.scrollTo(...args),get scrollY(){return scroller.scrollTop},get innerWidth(){return scroller.clientWidth},get innerHeight(){return scroller.clientHeight},
  IntersectionObserver:observerClass(nativeWindow.IntersectionObserver,true),ResizeObserver:observerClass(nativeWindow.ResizeObserver),MutationObserver:observerClass(nativeWindow.MutationObserver),
 };
 api.window=new Proxy(api,{get(target,key){if(key==='__spookIntent')return message=>{if(disposed)return;remember();if(message.intent==='ready')onReady();onIntent(message)};if(key in target)return target[key];const value=nativeWindow[key];return typeof value==='function'?value.bind(nativeWindow):value},set(_target,key,value){const prior=nativeWindow[key];nativeWindow[key]=value;restores.push(()=>{if(nativeWindow[key]===value)nativeWindow[key]=prior});return true}});
 const measure=()=>{root.host.style.setProperty('--spook-height',scroller.clientHeight+'px');events.dispatchEvent(new Event('resize'))};
 const size=new nativeWindow.ResizeObserver(measure);size.observe(scroller);observers.add({disconnect:()=>size.disconnect()});
 add(nativeDocument,'visibilitychange',()=>document.dispatchEvent(new Event('visibilitychange')));
 add(scroller,'scroll',remember,{passive:true});add(root,'focusin',remember);
 measure();
 function setActive(value){
  if(disposed||active===value)return;
  if(!value)remember();
  active=value;
  if(!active){for(const timer of timers.values()){nativeWindow.clearTimeout(timer.handle);timer.handle=0;timer.remaining=Math.max(0,timer.deadline-performance.now())}for(const frame of frames.values()){nativeWindow.cancelAnimationFrame(frame.handle);frame.handle=0}}
  document.dispatchEvent(new Event('visibilitychange'));
  if(active){scroller.scrollTop=savedScroll;if(savedFocus?.isConnected)savedFocus.focus({preventScroll:true});measure();for(const timer of timers.values())if(!timer.handle)scheduleTimer(timer);for(const frame of frames.values())if(!frame.handle)scheduleFrame(frame);scroller.dispatchEvent(new Event('scroll'))}
 }
 function dispose(){if(disposed)return;setActive(false);disposed=true;abort.abort();for(const [target,type,listener,options] of listeners)target.removeEventListener(type,listener,options);observers.forEach(observer=>observer.disconnect());timers.forEach(timer=>nativeWindow.clearTimeout(timer.handle));frames.forEach(frame=>nativeWindow.cancelAnimationFrame(frame.handle));timers.clear();frames.clear();restores.reverse().forEach(restore=>restore());body.querySelectorAll('audio,video').forEach(media=>media.pause());if(root.contains(body))root.replaceChildren()}
 return {api,setActive,forget,back,dispose};
}
