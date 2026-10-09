/* SCROLL STORYBOARD
 * Enter: retain the original hero composition.
 * Scroll: distant scenery lingers and the film gently pushes in; foreground props stay anchored.
 * Settle: an 85ms response softens wheel steps without changing native scrolling.
 * Reverse: retrace the same depth; offscreen/hidden/reduced motion stops the loop.
 */
const DEPTH={response:85,settle:.35,film:.22,zoom:.055,scenery:1.7,copy:-.025,title:.055,mobile:.55};
let dispose;

export function initHeroDepth(){
 dispose?.();
 const hero=document.querySelector('.hero');if(!hero)return;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const layers=[...hero.querySelectorAll('[data-depth]')].map(el=>({el,depth:Number(el.dataset.depth)*DEPTH.scenery}));
 let frame=0,lastTime=0,current=0,height=hero.offsetHeight,top=hero.getBoundingClientRect().top+scrollY,visible=false;
 const enabled=()=>!reduced.matches&&!document.hidden&&!document.body.classList.contains('motion-off')&&!document.body.classList.contains('viewing-page');
 const target=()=>Math.max(0,Math.min(height,scrollY-top));
 const stop=()=>{cancelAnimationFrame(frame);frame=0;lastTime=0};
 function paint(value){
  const travel=value*(innerWidth<=750?DEPTH.mobile:1),progress=height?value/height:0;
  for(const {el,depth} of layers)el.style.transform=`translate3d(0,${(travel*depth).toFixed(2)}px,0)`;
  hero.style.setProperty('--hero-film-y',(travel*DEPTH.film).toFixed(2)+'px');
  hero.style.setProperty('--hero-film-scale',(1+progress*DEPTH.zoom*(innerWidth<=750?DEPTH.mobile:1)).toFixed(5));
  hero.style.setProperty('--hero-copy-y',(travel*DEPTH.copy).toFixed(2)+'px');
  hero.style.setProperty('--hero-title-y',(travel*DEPTH.title).toFixed(2)+'px');
 }
 function update(now){
  frame=0;
  if(!enabled()||!visible){reset();return}
  const next=target(),dt=lastTime?Math.min(64,now-lastTime):1000/60;lastTime=now;
  current+=(next-current)*(1-Math.exp(-dt/DEPTH.response));
  if(Math.abs(next-current)<=DEPTH.settle){current=next;lastTime=0}
  paint(current);
  if(current!==next)frame=requestAnimationFrame(update);
 }
 function request(){if(visible&&enabled()&&!frame)frame=requestAnimationFrame(update)}
 function reset(){
  stop();const active=visible&&enabled();hero.classList.toggle('depth-active',active);
  current=active?target():0;paint(current);
 }
 function measure(){
  height=hero.offsetHeight;top=hero.getBoundingClientRect().top+scrollY;
  // Reserve the entire possible downward travel, even when compositor scrolling
  // reaches the top before this damped animation (or its next frame) catches up.
  hero.style.setProperty('--hero-film-bleed',Math.ceil(height*DEPTH.film*(innerWidth<=750?DEPTH.mobile:1)+2)+'px');
  reset();
 }
 const visibility=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;reset()},{rootMargin:'80px 0px'});
 const size=new ResizeObserver(measure);
 const preferences=new MutationObserver(reset);
 visibility.observe(hero);size.observe(hero);
 measure();
 preferences.observe(document.body,{attributes:true,attributeFilter:['class']});
 addEventListener('scroll',request,{passive:true});addEventListener('resize',measure,{passive:true});
 document.addEventListener('visibilitychange',reset);document.addEventListener('spook:navigate',measure);
 reduced.addEventListener('change',reset);
 dispose=()=>{
  stop();visibility.disconnect();size.disconnect();preferences.disconnect();
  removeEventListener('scroll',request);removeEventListener('resize',measure);
  document.removeEventListener('visibilitychange',reset);document.removeEventListener('spook:navigate',measure);
  reduced.removeEventListener('change',reset);hero.classList.remove('depth-active');paint(0);
 };
}
