// A section swap keeps its original geometry and scrollable rail in the DOM.
export function initInlineSurface(panel){
 let host=null,source=null,replaced=[],observer=null;
 const restore=()=>{for(const [el,inert] of replaced){el.classList.remove('inline-replaced');el.inert=inert}replaced=[]};
 function layout(){
  if(!host||!source?.isConnected||!host.offsetWidth)return;
  restore();
  if(host.id==='catalog-grid'){
   const top=source.offsetTop;
   const row=[...host.children].filter(el=>el!==panel&&Math.abs(el.offsetTop-top)<3);
   const height=Math.max(...row.map(el=>el.offsetHeight));
   panel.style.top=top+'px';panel.style.height=height+'px';
   replaced=row.map(el=>[el,el.inert]);
  }else{panel.style.top='';panel.style.height='';replaced=[...host.children].filter(el=>el!==panel).map(el=>[el,el.inert]);}
  for(const [el] of replaced){el.classList.add('inline-replaced');el.inert=true}
 }
 function close(){
  if(!panel.open)return;
  observer?.disconnect();restore();host?.classList.remove('inline-host');
  panel.hidden=true;panel.open=false;panel.removeAttribute('open');panel.classList.remove('inline-enter');
  document.body.append(panel);host=null;source=null;panel.dispatchEvent(new Event('close'));
 }
 function open(trigger){
  if(!panel.open){
   source=trigger;
   host=source?.closest('#catalog-grid,.editorial-shelf,.playlist-world,.video-program,.video-library,.masters-world,.shelf,.film-hero')||document.querySelector('.film-hero');
   if(!host)return;
   host.classList.add('inline-host');host.append(panel);panel.hidden=false;panel.open=true;panel.setAttribute('open','');layout();
   observer=new ResizeObserver(layout);observer.observe(host);
  }
  panel.classList.remove('inline-enter');void panel.offsetWidth;panel.classList.add('inline-enter');
 }
 panel.hidden=true;panel.open=false;panel.close=close;
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&panel.open&&!document.body.classList.contains('viewing-page')){event.preventDefault();close()}});
 document.addEventListener('catalog:reset',()=>{if(host?.id==='catalog-grid')close()});
 return {open,close};
}
