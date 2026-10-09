/* ANIMATION STORYBOARD
 *    0ms   pointer passes over: controls respond, scenery stays quiet
 *  170ms   deliberate hover: nested artwork / secondary facts respond
 * 1600ms   bats settle; no idle flight loop
 * Scroll   existing scenery follows position, up to 12px either way
 * Exit / hidden / reduced motion: cancel pending gestures immediately.
 */
const TIMING={hoverIntent:170,batSettle:1600,batRest:2200};
const SCENERY=[
 ['.shelf-garden',10],
 ['.reading-stone',7],
 ['.feature-bg',12],
 ['.video-pumpkins',8],
];
const ATTENTION='.editorial-entry,.playlist-card,.screening-ticket,.feature-selector,.format-link,.media-card,.video-feature,.video-tile,.bat-roost,.section-cta,.text-button';

export function initSceneLife(){
 const reduced=matchMedia('(prefers-reduced-motion:reduce)');
 const roost=document.querySelector('.bat-roost');
 const scenery=SCENERY.flatMap(([selector,travel])=>[...document.querySelectorAll(selector)].map(el=>({el,travel,scene:el.closest('.scene'),visible:false})));
 let attention=null,intentTimer=0,batTimer=0,lastBat=-Infinity,frame=0;
 const enabled=()=>!reduced.matches&&!document.hidden&&!document.body.classList.contains('motion-off');
 const stopBats=()=>{clearTimeout(batTimer);roost?.classList.remove('bats-awake')};
 const clearAttention=()=>{clearTimeout(intentTimer);attention?.classList.remove('intent-active');attention=null};
 const wakeBats=()=>{
  if(!roost||!enabled()||performance.now()-lastBat<TIMING.batRest)return;
  lastBat=performance.now();stopBats();roost.classList.add('bats-awake');
  batTimer=setTimeout(stopBats,TIMING.batSettle);
 };
 const activate=el=>{
  if(!el?.isConnected||document.hidden||document.querySelector('#detail[open]'))return;
  el.classList.add('intent-active');
  if(el===roost)wakeBats();
 };
 document.addEventListener('pointerover',event=>{
  if(event.pointerType==='touch')return;
  const el=event.target.closest(ATTENTION);
  if(!el||el.contains(event.relatedTarget))return;
  clearAttention();attention=el;
  intentTimer=setTimeout(()=>activate(el),TIMING.hoverIntent);
 });
 document.addEventListener('pointerout',event=>{
  if(attention?.contains(event.target)&&!attention.contains(event.relatedTarget))clearAttention();
 });
 document.addEventListener('pointerdown',clearAttention);
 document.addEventListener('focusin',event=>{if(event.target===roost&&roost.matches(':focus-visible'))wakeBats()});
 roost?.addEventListener('click',wakeBats);

 function updateScenery(){
  frame=0;const active=enabled();
  for(const state of scenery){
   if(!active){state.el.style.setProperty('--scenery-y','0px');state.el.style.setProperty('--ghost-x','0px');state.el.style.setProperty('--ghost-y','0px');state.el.style.setProperty('--ghost-tilt','0deg');continue}
   if(!state.visible)continue;
   const rect=state.scene.getBoundingClientRect();
   const progress=Math.max(-1,Math.min(1,(innerHeight*.5-rect.top-rect.height*.5)/(innerHeight*.5+rect.height*.5)));
   state.el.style.setProperty('--scenery-y',`${(progress*state.travel).toFixed(2)}px`);
   if(state.el.classList.contains('shelf-garden')){
    const flight=Math.max(0,Math.min(1,(innerHeight*.8-rect.top)/(innerHeight*.65)));
    // A short quadratic arc: rise first, then drift left above the grave.
    state.el.style.setProperty('--ghost-x',`${(-30*flight*flight).toFixed(2)}px`);
    state.el.style.setProperty('--ghost-y',`${(-44*(2*flight-flight*flight)).toFixed(2)}px`);
    state.el.style.setProperty('--ghost-tilt',`${(-6*Math.sin(Math.PI*flight)).toFixed(2)}deg`);
   }
  }
 }
 const requestScenery=()=>{if(!frame)frame=requestAnimationFrame(updateScenery)};
 const observer=new IntersectionObserver(entries=>{
  for(const entry of entries){
   scenery.filter(s=>s.scene===entry.target).forEach(s=>s.visible=entry.isIntersecting);
   if(entry.target===roost&&!entry.isIntersecting)stopBats();
  }
  requestScenery();
 });
 new Set(scenery.map(s=>s.scene)).forEach(el=>observer.observe(el));
 if(roost)observer.observe(roost);
 addEventListener('scroll',()=>{clearAttention();requestScenery()},{passive:true});
 addEventListener('resize',requestScenery,{passive:true});
 const reset=()=>{clearAttention();stopBats();requestScenery()};
 document.addEventListener('visibilitychange',reset);
 reduced.addEventListener('change',reset);
 new MutationObserver(reset).observe(document.body,{attributes:true,attributeFilter:['class']});
 const dialog=document.querySelector('dialog');
 if(dialog)new MutationObserver(()=>{if(dialog.open)reset()}).observe(dialog,{attributes:true,attributeFilter:['open']});
 requestScenery();
}
