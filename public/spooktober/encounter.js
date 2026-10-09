import {railMarkup,initRails} from './rails.js?v=a56521c2bb';

const encounterCleanups=new WeakMap();

export function mountEncounter(root,data,items,card){
 encounterCleanups.get(root)?.();
 const collection=data?.collections?.find(c=>c.id==='aliens-abductions');if(!collection)return;
 const lookup=new Map(items.map(i=>[i.id,i])),records=collection.itemIds.map(id=>lookup.get(id)).filter(Boolean);
 const staticLights=['m43 60 9 2','m75 65 12 1','m110 66 12-1','m140 66 9-3'];
 root.innerHTML=`<section id="encounter-world" class="shelf encounter-world scene" aria-labelledby="encounter-heading">
 <div class="encounter-field" aria-hidden="true"><div class="encounter-mist"></div><div class="encounter-hill far"></div><div class="encounter-hill near"></div><img class="encounter-tree" src="assets/art/foreground-tree.svg" alt="" loading="lazy"><img class="encounter-grass grass-left" src="assets/art/grass-clump.svg" alt="" loading="lazy"><img class="encounter-grass grass-right" src="assets/art/grass-clump.svg" alt="" loading="lazy"></div>
 <div class="encounter-craft" aria-hidden="true"><div class="encounter-beam"></div><svg viewBox="0 0 200 84"><defs><clipPath id="encounter-rim-clip"><path d="m8 45 60 13 78-2 45-3-45 20-85-3Z"/></clipPath></defs><path d="M62 38 74 15 93 6 119 12 135 38Z" fill="#81958e"/><path d="m93 6 4 32h38l-16-26Z" fill="#4b6260"/><path d="m8 45 46-13 86 2 51 19-45 20-85-3Z" fill="#62716f"/><path d="m8 45 60 13 78-2 45-3-45 20-85-3Z" fill="#29383b"/><g class="encounter-rim-lights" clip-path="url(#encounter-rim-clip)" fill="none" stroke="#d4dec1" stroke-width="3">${Array.from({length:8},(_,i)=>`<path data-rim-light d="${staticLights[i]||'M0 0'}"${i>3?' visibility="hidden"':''}/>`).join('')}</g><path d="m21 46 44 6 84-2 27 2-29 9-80 1Z" fill="#aeb7a0"/><path d="m61 70 85 3-22 9-40-2Z" fill="#1c282a"/></svg></div>
 <div class="section-top"><div><h2 id="encounter-heading">Aliens &amp; abductions</h2><p>Something is out there.</p></div></div>
 ${railMarkup(records.map(i=>card(i,true)).join(''),'Aliens & abductions','media-row')}
 </section>`;
 initRails(root);
 const section=root.querySelector('.encounter-world'),reduced=matchMedia('(prefers-reduced-motion:reduce)');
 const craft=section.querySelector('.encounter-craft'),lights=[...section.querySelectorAll('[data-rim-light]')];
 let frame=0,visible=false,orbitFrame=0,craftVisible=false,lastTick=0,phase=0,disposed=false;
 const motionDisabled=()=>reduced.matches||document.body.classList.contains('motion-off');
 function staticRim(){lights.forEach((light,i)=>{light.setAttribute('d',staticLights[i]||'M0 0');light.setAttribute('visibility',i<4?'visible':'hidden');light.removeAttribute('opacity');light.removeAttribute('stroke-width')})}
 function stopOrbit(){cancelAnimationFrame(orbitFrame);orbitFrame=0;lastTick=0}
 // Project equally spaced lamps onto the existing underside; the top rim occludes them.
 // This loop only writes SVG attributes. Scroll-driven layout reads stay in paint().
 function orbit(now){
  orbitFrame=0;
  if(!section.isConnected){cleanup();return}
  if(!craftVisible||document.hidden||motionDisabled()){lastTick=0;return}
  if(lastTick)phase=(phase+Math.min(now-lastTick,64)*Math.PI*2/7200)%(Math.PI*2);
  lastTick=now;
  const point=a=>{const x=96+68*Math.cos(a);return [x,54+13*Math.sin(a)+(x-96)*.045]};
  lights.forEach((light,i)=>{
   const angle=phase+Math.PI/8+i*Math.PI/4,depth=Math.sin(angle);
   // Rear lamps are behind the hull. Foreshortening and a short edge fade carry depth.
   if(depth<=0){light.setAttribute('visibility','hidden');return}
   const half=.086*(.82+.18*depth),a=point(angle-half),b=point(angle+half),edge=Math.min(1,depth/.18);
   light.setAttribute('d',`M${a[0].toFixed(2)} ${a[1].toFixed(2)}L${b[0].toFixed(2)} ${b[1].toFixed(2)}`);
   light.setAttribute('stroke-width',(2.3+.7*depth).toFixed(2));
   light.setAttribute('opacity',((.72+.28*depth)*edge*edge*(3-2*edge)).toFixed(3));
   light.setAttribute('visibility','visible');
  });
  orbitFrame=requestAnimationFrame(orbit);
 }
 function paint(){frame=0;if(!visible)return;const disabled=reduced.matches||document.body.classList.contains('motion-off'),rect=section.getBoundingClientRect();const p=disabled?.7:Math.max(0,Math.min(1,(innerHeight-rect.top)/(innerHeight+rect.height*.3)));section.style.setProperty('--craft-x',((p-.6)*240).toFixed(1)+'px');section.style.setProperty('--craft-y',(-Math.sin(p*Math.PI)*8).toFixed(1)+'px');section.style.setProperty('--beam-opacity',disabled?'.3':String(Math.min(.4,Math.max(0,(p-.2)*.65))));section.classList.add('encounter-ready')}
 const schedule=()=>{if(!disposed&&visible&&!document.hidden&&!frame)frame=requestAnimationFrame(paint)};
 function syncMotion(){
  if(disposed)return;
  if(!section.isConnected){cleanup();return}
  if(document.hidden||!craftVisible||motionDisabled()){
   stopOrbit();
   if(document.hidden){cancelAnimationFrame(frame);frame=0}
   if(motionDisabled())staticRim();
  }else if(!orbitFrame)orbitFrame=requestAnimationFrame(orbit);
  schedule();
 }
 const sectionObserver=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(!section.isConnected){cleanup();return}schedule()},{rootMargin:'100px'});
 const craftObserver=new IntersectionObserver(entries=>{craftVisible=entries[0].isIntersecting;syncMotion()});
 const motionObserver=new MutationObserver(syncMotion);
 function cleanup(){
  if(disposed)return;disposed=true;cancelAnimationFrame(frame);stopOrbit();sectionObserver.disconnect();craftObserver.disconnect();motionObserver.disconnect();
  removeEventListener('scroll',schedule);removeEventListener('resize',schedule);reduced.removeEventListener('change',syncMotion);document.removeEventListener('visibilitychange',syncMotion);encounterCleanups.delete(root);
 }
 sectionObserver.observe(section);craftObserver.observe(craft);motionObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
 addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule,{passive:true});reduced.addEventListener('change',syncMotion);document.addEventListener('visibilitychange',syncMotion);
 encounterCleanups.set(root,cleanup);syncMotion();
}
