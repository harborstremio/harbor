/* Scroll storyboard: a gently bent arm sweeps down from the shoulder.
 * The downward knife follows the hand outside the shoulder and torso.
 * Scrolling upward retraces the same pose.
 * No timed slash, looping animation, or continuous work when offscreen. */
const POSE={bodyTravel:12,upperRaised:205,upperLowered:125,forearmRaised:235,forearmLowered:160,bladeRaised:10,bladeLowered:10,strokeStart:.18,strokeEnd:.87,still:.72};
// The marks spread from behind the cards during the final part of the stroke.
// Their shape and timing are deterministic: scrolling back erases the same marks.
const SPLATTER=`<svg viewBox="0 0 260 260" aria-hidden="true" focusable="false">
 <g fill="currentColor">
  <path d="M107 111C94 101 105 96 92 82C85 72 76 68 73 59C69 52 64 57 69 66C77 82 91 95 90 105C88 119 75 111 67 113C59 116 63 126 79 130C96 134 93 147 81 153C72 159 67 169 73 172C81 176 90 161 103 163C116 165 108 183 115 188C125 191 122 172 132 169C149 164 150 185 160 186C169 186 166 174 158 165C150 154 157 149 170 150C190 152 196 144 188 138C181 133 164 140 159 129C155 117 167 108 166 100C164 92 154 99 148 110C141 120 133 112 132 101C130 92 124 90 120 99C118 111 116 119 107 111Z"/>
  <path d="M84 117C71 108 54 105 44 104C38 105 42 111 50 112C62 111 73 123 84 124Z M153 122C169 112 179 89 188 85C197 81 193 91 186 96C177 103 168 124 157 130Z M89 146C68 147 58 161 43 166C35 169 38 175 45 172C61 165 74 156 93 154Z"/>
  <ellipse cx="61" cy="44" rx="3" ry="6" transform="rotate(-36 61 44)"/>
  <ellipse cx="39" cy="98" rx="5" ry="2.5" transform="rotate(23 39 98)"/>
  <ellipse cx="32" cy="184" rx="5" ry="2.5" transform="rotate(-35 32 184)"/>
  <ellipse cx="116" cy="231" rx="2.5" ry="5"/>
  <ellipse cx="196" cy="69" rx="2.8" ry="5" transform="rotate(38 196 69)"/>
  <ellipse cx="219" cy="147" rx="4.5" ry="2" transform="rotate(15 219 147)"/>
  <circle cx="49" cy="149" r="2"/><circle cx="172" cy="61" r="2.6"/>
  <circle cx="91" cy="199" r="2.2"/><circle cx="199" cy="181" r="3.6"/>
  <circle cx="215" cy="194" r="1.8"/><circle cx="80" cy="34" r="1.7"/>
 </g>
</svg>`;
const ARM=`<svg class="shudder-knife-art" viewBox="0 0 280 520" aria-hidden="true">
 <g transform="translate(86 142)">
  <path d="M-17-8-8-17 11-17 24-5 20 16 9 28-10 22-19 8Z" fill="#47534c"/>
 <g class="slasher-upper-arm">
  <path d="M-18 4Q-21-10-11-17Q2-22 16-11L20 5 18 30 16 62 13 81Q4 92-10 84L-16 66-19 35Z" fill="#47534c"/>
  <path d="M-18 4Q-21-10-11-17L-6-8-6 23-9 53-5 77 3 88-10 84-16 66-19 35Z" fill="#5c685a"/>
  <path d="M6-18 16-11 20 5 18 30 16 62 13 81 3 88-5 77 1 61 4 29Z" fill="#34443c"/>
  <path d="M-11 69 4 74 15 69" fill="none" stroke="#86917e" stroke-width="1.3" opacity=".35"/>
  <!-- Matches the hanging arm's shoulder (191,150), elbow (211,226), wrist (207,302). -->
  <g transform="translate(0 79)"><g class="slasher-forearm">
   <path d="M-13-7Q0-15 13-6L15 14 14 37 12 65 11 77-12 77-14 63-17 34-16 11Z" fill="#4c5857"/>
   <path d="M-13-7-16 11-17 34-14 63-12 77-4 75-6 48-5 18-4-10Z" fill="#71806e"/>
   <path d="M8-10 13-6 15 14 14 37 12 65 11 77 3 75 6 37 3 17Z" fill="#384c41"/>
   <path d="M-13 66 12 66 11 79-12 79Z" fill="#202d31"/>
   <g transform="translate(0 76)"><g class="slasher-grip">
    <!-- Only the knife is mirrored, keeping the grip and downward orientation stable. -->
    <g class="slasher-kitchen-knife" transform="translate(2 0) scale(-1 1)">
     <path d="M-6-22-3-25 6-24 9-20 8 28-6 28Z" fill="#182427"/>
     <path d="M-6-22-3-25-2-20-2 26-6 28Z" fill="#65766d"/>
     <circle cx="2" cy="-16" r="1.8" fill="#a9b6a7"/>
     <path d="M-6 28H18L17 70 12 97-6 132Z" fill="#afc1bb"/>
     <path d="M-6 28H12L10 67 5 96-6 132Z" fill="#819b94"/>
     <path d="M12 28H18L17 70 12 97-6 132 7 95 12 68Z" fill="#d4ddd0"/>
     <path d="M-7 24H11L12 30H-7Z" fill="#a1b1a5"/>
    </g>
    <path d="M-7-13Q-14-12-18-5L-20 7Q-19 18-12 23L-2 27 12 21Q16 17 16 8L14-6Q11-14 4-15Z" fill="#9ca593"/>
    <path d="M-18-3Q-13-7-2-8L9-12Q15-10 16-2L-4 5-19 8Z" fill="#b0b5a1"/>
    <path d="M-19 8-4 5 16-2 16 8-3 15-16 18Z" fill="#83917e"/>
    <path d="M-16 18-3 15 16 8Q17 18 12 21L-2 27Z" fill="#566957"/>
    <path d="M-8-12Q-5-21 2-20L9-16 14-4Q13 3 7 5L-2-1-3-8-12 1Q-19 3-20-2Z" fill="#aab19d"/>
   </g></g>
  </g></g>
 </g></g>
</svg>`;
let dispose=()=>{};
export function initShudderArt(){
 dispose();
 const shelf=document.querySelector('#section-shudder');if(!shelf)return;
 shelf.querySelector('.shudder-knife-scene')?.remove();
 shelf.querySelector('.shudder-splatter-scene')?.remove();
 shelf.insertAdjacentHTML('afterbegin','<div class="shudder-knife-scene" aria-hidden="true"><div class="shudder-figure"><div class="slasher-body-lean"><img class="shudder-figure-body" src="assets/art/shudder-figure-body.svg?v=1" alt="" loading="lazy" width="280" height="520"><div class="slasher-head"><img src="assets/art/shudder-figure-head.svg?v=1" alt="" loading="lazy" width="280" height="520"></div>'+ARM+'</div></div></div>');
 shelf.insertAdjacentHTML('afterbegin','<div class="shudder-splatter-scene" aria-hidden="true"><div class="shudder-blood-hit blood-near">'+SPLATTER+'</div><div class="shudder-blood-hit blood-far">'+SPLATTER+'</div><div class="shudder-blood-hit blood-crown">'+SPLATTER+'</div></div>');
 const rail=shelf.querySelector('.harbor-rail'),poster=shelf.querySelector('.poster-wrap');
 function measureBlood(){
  if(!rail||!poster)return;
  const bounds=shelf.getBoundingClientRect(),card=poster.getBoundingClientRect();
  shelf.style.setProperty('--blood-top',(card.top-bounds.top)+'px');
  shelf.style.setProperty('--blood-left',(card.left-bounds.left)+'px');
  shelf.style.setProperty('--blood-height',card.height+'px');
  shelf.style.setProperty('--blood-seam',(card.width+37)+'px');
  shelf.style.setProperty('--blood-crown-x',(card.width*.72+26)+'px');
 }
 const bloodSize=new ResizeObserver(measureBlood);bloodSize.observe(shelf);if(poster)bloodSize.observe(poster);measureBlood();
 const reduced=matchMedia('(prefers-reduced-motion:reduce)');
 let frame=0,visible=false;
 function paint(){
  frame=0;if(!visible||!shelf.isConnected)return;
  const rect=shelf.getBoundingClientRect(),still=reduced.matches||document.body.classList.contains('motion-off');
  const passage=(innerHeight-rect.top)/(innerHeight+rect.height*.3);
  const progress=still?POSE.still:Math.max(0,Math.min(1,(passage-POSE.strokeStart)/(POSE.strokeEnd-POSE.strokeStart)));
  const upper=POSE.upperRaised+(POSE.upperLowered-POSE.upperRaised)*progress;
  const forearm=POSE.forearmRaised+(POSE.forearmLowered-POSE.forearmRaised)*progress;
  const drive=still?0:Math.max(0,Math.min(1,(progress-.2)/.8));
  const follow=drive*drive*(3-2*drive),lean=-5.5*follow;
  shelf.style.setProperty('--slasher-lean',lean.toFixed(3)+'deg');
  shelf.style.setProperty('--slasher-head-tilt',(-7*follow).toFixed(3)+'deg');
  shelf.style.setProperty('--slasher-head-dip',(3*follow).toFixed(3)+'px');
  shelf.style.setProperty('--slasher-head-pitch',(1-.055*follow).toFixed(4));
  shelf.style.setProperty('--slasher-y',((progress-.5)*POSE.bodyTravel).toFixed(2)+'px');
  shelf.style.setProperty('--upper-angle',(upper-90).toFixed(2)+'deg');
  shelf.style.setProperty('--forearm-angle',(forearm-upper).toFixed(2)+'deg');
  const blade=POSE.bladeRaised+(POSE.bladeLowered-POSE.bladeRaised)*progress;
  shelf.style.setProperty('--grip-angle',(90-forearm+blade-lean).toFixed(2)+'deg');
  for(const [name,start,end] of [['near',.76,.96],['far',.84,1]]){
   const amount=still?0:Math.max(0,Math.min(1,(progress-start)/(end-start)));
   const spread=1-(1-amount)**3;
   shelf.style.setProperty('--blood-'+name+'-opacity',(Math.min(1,amount*3)*.76).toFixed(3));
   shelf.style.setProperty('--blood-'+name+'-scale',(.18+spread*.82).toFixed(4));
  }
 }
 const schedule=()=>{if(visible&&!frame)frame=requestAnimationFrame(paint)};
 const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;schedule()},{rootMargin:'80px'});
 observer.observe(shelf);
 const motionObserver=new MutationObserver(schedule);motionObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
 addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule,{passive:true});reduced.addEventListener('change',schedule);
 dispose=()=>{observer.disconnect();motionObserver.disconnect();bloodSize.disconnect();cancelAnimationFrame(frame);removeEventListener('scroll',schedule);removeEventListener('resize',schedule);reduced.removeEventListener('change',schedule)};
}
