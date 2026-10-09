// Mirrors Harbor's Row/NavChevron controls for this standalone review surface.
const CHEVRON='M278.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-160 160c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L210.7 256 73.4 118.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l160 160z';
const RAIL={dragThreshold:6,minDuration:280,maxDuration:620,baseDuration:260,distanceTime:.45,friction:.004};
const states=new WeakMap();
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const cards=row=>[...row.children];
const stride=row=>{const c=cards(row);return c[1]?c[1].getBoundingClientRect().left-c[0].getBoundingClientRect().left:row.clientWidth};
const maxScroll=row=>Math.max(0,row.scrollWidth-row.clientWidth);
const clamp=(value,row)=>Math.max(0,Math.min(maxScroll(row),value));
const enabled=()=>!reduced.matches&&!document.body.classList.contains('motion-off');

// Fit an integer number of cards to the actual rail, including split editorial layouts.
function fitRail(row) {
 const state=states.get(row),style=getComputedStyle(row);
 const padding=(parseFloat(style.paddingLeft)||0)+(parseFloat(style.paddingRight)||0);
 const available=row.getBoundingClientRect().width-padding;
 if(available<=0)return;
 const gap=parseFloat(style.columnGap)||0,min=parseFloat(style.getPropertyValue('--rail-min'))||156;
 const limit=parseInt(style.getPropertyValue('--rail-max'))||6;
 const count=Math.min(limit,Math.max(1,Math.floor((available+gap)/(min+gap))));
 const width=(Math.ceil(((available-(count-1)*gap)/count)*64)+1)/64;
 if(state.width===width&&state.gap===gap)return;
 const index=state.step?Math.round(row.scrollLeft/state.step):0;
 const wasEnd=state.step&&state.max>0&&row.scrollLeft>=state.max-2;
 cancel(row,false);row.style.scrollSnapType='none';row.style.scrollBehavior='auto';
 row.style.setProperty('--rail-card-width',width+'px');
 row.style.scrollPaddingInline=style.paddingLeft+' '+style.paddingRight;
 row.dataset.fitted='';state.width=width;state.gap=gap;state.count=count;state.step=width+gap;
 state.max=maxScroll(row);row.scrollLeft=wasEnd?state.max:clamp(index*state.step,row);
 row.style.scrollSnapType='';row.style.scrollBehavior='';updateRail(row);
}

export function railMarkup(content,title,trackClass='media-row',extraClass='') {
 const label=title.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const edge=(dir,name)=>`<button class="rail-edge rail-${name}" data-direction="${dir}" aria-label="Scroll ${name}: ${label}" disabled tabindex="-1"><span><svg viewBox="0 0 320 512" aria-hidden="true"><path d="${CHEVRON}" fill="currentColor"/></svg></span></button>`;
 return `<div class="harbor-rail ${extraClass}"><div class="rail-track ${trackClass}" role="group" aria-label="${label}">${content}</div>${edge(-1,'left')}${edge(1,'right')}</div>`;
}

export function updateRail(row) {
 const rail=row.closest('.harbor-rail');if(!rail)return;
 const left=rail.querySelector('.rail-left'),right=rail.querySelector('.rail-right');
 const previous=row.scrollLeft>3,next=row.scrollLeft<maxScroll(row)-3;
 left.disabled=!previous;right.disabled=!next;left.tabIndex=previous?0:-1;right.tabIndex=next?0:-1;
 if(!previous&&document.activeElement===left)cards(row)[0]?.focus({preventScroll:true});
 if(!next&&document.activeElement===right)cards(row).at(-1)?.focus({preventScroll:true});
 rail.classList.toggle('can-prev',previous);rail.classList.toggle('can-next',next);
 const poster=row.querySelector('.poster-wrap,.director-portrait,.feature-selector');
 if(poster){const art=poster.getBoundingClientRect(),container=rail.getBoundingClientRect();rail.style.setProperty('--rail-art-height',art.height+'px');rail.style.setProperty('--rail-art-top',(art.top-container.top)+'px');}
}

function cancel(row,restore=true) {
 const state=states.get(row);if(state?.frame)cancelAnimationFrame(state.frame);
 if(state)state.frame=0;
 if(restore){row.style.scrollSnapType='';row.style.scrollBehavior='';}
}

/* Rail storyboard: click/drag -> cubic ease-out -> exact card boundary.
 * A second gesture cancels the current glide; reduced motion settles instantly.
 */
function glide(row,rawTarget) {
 cancel(row,false);const state=states.get(row);if(!state)return;
 const start=row.scrollLeft,target=clamp(rawTarget,row),distance=target-start;
 if(!enabled()||Math.abs(distance)<1){row.scrollLeft=target;updateRail(row);return}
 row.style.scrollSnapType='none';row.style.scrollBehavior='auto';
 const time=performance.now(),duration=Math.max(RAIL.minDuration,Math.min(RAIL.maxDuration,RAIL.baseDuration+Math.abs(distance)*RAIL.distanceTime));
 const frame=now=>{
  const t=Math.min(1,(now-time)/duration);row.scrollLeft=start+distance*(1-Math.pow(1-t,3));
  if(t<1)state.frame=requestAnimationFrame(frame);
  else {state.frame=0;row.scrollLeft=target;row.style.scrollSnapType='';row.style.scrollBehavior='';updateRail(row)}
 };
 state.frame=requestAnimationFrame(frame);
}

export function scrollRail(row,direction) {
 const step=stride(row),count=states.get(row)?.count||1;
 glide(row,(Math.round(row.scrollLeft/step)+direction*count)*step);
}

export function revealRailCard(card) {
 const row=card.closest('.rail-track');if(!row)return;
 const left=card.offsetLeft-row.children[0].offsetLeft;
 const padding=(parseFloat(getComputedStyle(row).paddingLeft)||0)*2;
 if(left<row.scrollLeft-1||left+card.offsetWidth>row.scrollLeft+row.clientWidth-padding+1)glide(row,left);
}

export function initRails(root=document) {
 root.querySelectorAll('.rail-track').forEach(row=>{
  if(states.has(row)){fitRail(row);updateRail(row);return}
  const state={frame:0,drag:null,suppressClick:false};states.set(row,state);
  row.addEventListener('scroll',()=>updateRail(row),{passive:true});
  row.addEventListener('wheel',()=>cancel(row),{passive:true});
  row.addEventListener('dragstart',e=>e.preventDefault());
  row.addEventListener('pointerdown',e=>{
   cancel(row);state.suppressClick=false;
   if(e.button!==0||e.pointerType==='touch')return;
   state.drag={id:e.pointerId,startX:e.clientX,startScroll:row.scrollLeft,lastX:e.clientX,lastTime:performance.now(),velocity:0,moved:false};
  });
  row.addEventListener('pointermove',e=>{
   const drag=state.drag;if(!drag)return;
   const dx=e.clientX-drag.startX;
   if(!drag.moved&&Math.abs(dx)<RAIL.dragThreshold)return;
   if(!drag.moved){drag.moved=true;row.setPointerCapture(e.pointerId);row.style.scrollSnapType='none';row.classList.add('dragging')}
   e.preventDefault();const now=performance.now(),dt=now-drag.lastTime;
   if(dt>0)drag.velocity=drag.velocity*.55+(e.clientX-drag.lastX)/dt*.45;
   drag.lastX=e.clientX;drag.lastTime=now;row.scrollLeft=drag.startScroll-dx;
  });
  const end=e=>{
   const drag=state.drag;if(!drag)return;state.drag=null;
   if(row.hasPointerCapture(drag.id))row.releasePointerCapture(drag.id);
   row.classList.remove('dragging');if(!drag.moved)return;
   state.suppressClick=true;setTimeout(()=>state.suppressClick=false,0);
   const velocity=e.type==='pointercancel'||performance.now()-drag.lastTime>100?0:drag.velocity;
   const projection=Math.max(-row.clientWidth,Math.min(row.clientWidth,-velocity*Math.abs(velocity)/(2*RAIL.friction)));
   glide(row,Math.round((row.scrollLeft+projection)/stride(row))*stride(row));
  };
  row.addEventListener('pointerup',end);row.addEventListener('pointercancel',end);
  row.addEventListener('lostpointercapture',end);
  row.addEventListener('click',e=>{if(state.suppressClick){e.preventDefault();e.stopImmediatePropagation()}},true);
  row.addEventListener('keydown',e=>{
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
   const children=cards(row),current=children.indexOf(e.target.closest('.media-card,.director-button,.feature-selector,.playlist-card'));if(current<0)return;
   const next=e.key==='Home'?0:e.key==='End'?children.length-1:current+(e.key==='ArrowRight'?1:-1);
   if(!children[next])return;e.preventDefault();e.stopPropagation();
   children[next].focus({preventScroll:true});
   const padding=parseFloat(getComputedStyle(row).paddingLeft)||0;
   const left=children[next].offsetLeft-children[0].offsetLeft;
   if(e.key==='Home'||e.key==='End'||left<row.scrollLeft||left+children[next].offsetWidth>row.scrollLeft+row.clientWidth-padding)glide(row,left);
  });
  new ResizeObserver(()=>{fitRail(row);updateRail(row)}).observe(row);
  fitRail(row);updateRail(row);
 });
}
