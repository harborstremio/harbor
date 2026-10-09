export function createPageNavigation(onLeave,restoreRoute){
 const main=document.querySelector('#top'),host=document.createElement('main');host.id='route-root';host.hidden=true;document.body.append(host);
 const pages=new Map();let current='event';
 pages.set('event',{node:null,scroll:0,focus:null,title:'Spooktober',url:location.pathname+location.search,parent:false});
 history.scrollRestoration='manual';
 function capture(){const page=pages.get(current);if(page){page.scroll=scrollY;page.focus=document.activeElement;if(current==='event'&&!/^#(?:playlist|song|video)\//.test(location.hash))page.url=location.pathname+location.search+location.hash;}}
 function activate(key,restore=false){
  const page=pages.get(key);if(!page)return;
  onLeave();current=key;main.hidden=key!=='event';host.hidden=key==='event';host.replaceChildren(...(page.node?[page.node]:[]));document.body.classList.toggle('viewing-page',key!=='event');
  document.title=key==='event'?'Harbor · Spooktober':`${page.title} · Spooktober`;
  if(restore&&page.focus?.isConnected)page.focus.focus({preventScroll:true});
  else if(page.node){const title=page.node.querySelector('#page-title,h1');if(title){title.tabIndex=-1;title.focus({preventScroll:true})}}
  scrollTo({top:restore?page.scroll:0,behavior:'instant'});document.dispatchEvent(new Event('spook:navigate'));
 }
 function back(){const page=pages.get(current);if(page?.parent)history.back();else {capture();activate('event',true);history.replaceState({spookPage:'event'},'',pages.get('event').url)}}
 addEventListener('popstate',()=>{
  const key=history.state?.spookPage||'event';
  capture();
  if(pages.has(key))activate(key,true);
  else restoreRoute?.();
 });
 return {
  show(html,{key,title,trigger,replace=false}){
   capture();if(trigger)pages.get(current).focus=trigger;
   const previous=pages.get(current);if(!replace)history.replaceState({...history.state,spookPage:current},'',location.href);
   const node=document.createElement('div');node.className='route-page';
   node.innerHTML='<nav class="page-navigation" aria-label="Back navigation"><button id="page-back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg><span></span></button><span>Spooktober</span></nav><div class="route-page-content">'+html.replaceAll('id="dialog-title"','id="page-title"')+'</div>';
   node.querySelector('#page-back span').textContent='Back to '+(replace?'Spooktober':previous.title);
   node.querySelector('#page-back').addEventListener('click',back);
   const url=location.pathname+location.search+'#'+key;
   pages.set(key,{node,scroll:0,focus:null,title,url,parent:!replace});
   history[replace?'replaceState':'pushState']({spookPage:key},'',url);activate(key);
  },
  get current(){return current;}
 };
}
