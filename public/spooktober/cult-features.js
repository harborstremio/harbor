import {revealRailCard} from './rails.js?v=a56521c2bb';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function twilightMarkup(data,card,rail){
 if(!data?.items?.length)return '';
 return `<section id="twilight-world" class="twilight-world scene" aria-labelledby="twilight-heading">
 <div class="twilight-choice">
 <div class="twilight-characters" aria-hidden="true"><div class="twilight-character twilight-edward"></div><div class="twilight-character twilight-jacob"></div></div>
 <div class="twilight-copy"><img class="twilight-wordmark" src="assets/twilight/tt1099212-logo.png" alt="Twilight" loading="lazy" width="180" height="85"><h2 id="twilight-heading">Edward or Jacob?</h2><p>Some debates never die.</p>
 <div class="twilight-teams" role="group" aria-label="Choose your Twilight team">${['Edward','Jacob'].map(name=>`<button type="button" data-team="${name.toLowerCase()}" aria-pressed="false"><span>Team ${name}</span></button>`).join('')}</div><p class="twilight-status" aria-live="polite">Pick a team. Find your next watch.</p></div></div>
 <div class="twilight-films shelf"><div class="section-top"><h3>The complete saga</h3><div class="twilight-film-action"><span data-saga-order>5 films · In order</span><button type="button" class="section-cta" data-team-explore hidden></button></div></div>${rail(data.items.map(i=>card({...i,title:i.title.replace('The Twilight Saga: ','')},true)).join(''),'The Twilight Saga','media-row twilight-row')}</div></section>`;
}
export function initTwilight(){
 const root=document.querySelector('#twilight-world');if(!root)return;
 let chosen='';try{chosen=localStorage.getItem('spooktober-twilight-team')||''}catch{}
 const buttons=[...root.querySelectorAll('[data-team]')],cards=[...root.querySelectorAll('.twilight-row .media-card')];
 const picks={edward:{id:'tt1099212',title:'Twilight',note:'Start with Twilight.'},jacob:{id:'tt1259571',title:'New Moon',note:'See Jacob’s story in New Moon.'}};
 cards.forEach(card=>{const badge=document.createElement('span');badge.className='twilight-pick';badge.setAttribute('aria-hidden','true');badge.textContent='Start here';card.querySelector('.poster-wrap').append(badge)});
 let active='';
 function paint(team,announce=false){
  if(!['edward','jacob'].includes(team))return;
  const changed=active!==team;active=team;
  root.dataset.team=team;
  buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.team===team)));
  const pick=picks[team];
  const status=root.querySelector('.twilight-status');status.textContent=pick.note;
  const action=root.querySelector('[data-team-explore]');action.hidden=false;action.dataset.item=pick.id;action.textContent='Explore '+pick.title;root.querySelector('[data-saga-order]').hidden=true;
  cards.forEach(card=>{const selected=card.dataset.item===pick.id;card.classList.toggle('is-team-pick',selected);const label=card.getAttribute('aria-label').replace(/, Start here$/,'');card.setAttribute('aria-label',label+(selected?', Start here':''));});
  if(announce&&changed&&!matchMedia('(prefers-reduced-motion:reduce)').matches&&!document.body.classList.contains('motion-off')){
   status.animate([{opacity:0,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}],{duration:240,easing:'ease-out'});
  }
  if(announce){const card=cards.find(c=>c.dataset.item===pick.id);if(card)revealRailCard(card)}
  if(announce)try{localStorage.setItem('spooktober-twilight-team',team)}catch{}
 }
 buttons.forEach(b=>b.addEventListener('click',()=>paint(b.dataset.team,true)));paint(chosen);
}
export function spotlightsMarkup(collections,items,card,rail){
 const lookup=new Map(items.map(i=>[i.id,i]));
 return collections.map(c=>{const entries=c.itemIds.map(id=>lookup.get(id)).filter(Boolean);return `<section id="spotlight-${esc(c.id)}" class="spotlight-shelf editorial-shelf scene" aria-labelledby="spotlight-${esc(c.id)}-heading"><div class="editorial-intro"><img class="editorial-backdrop" src="${esc(c.background)}" alt="" loading="lazy"><div class="editorial-intro-copy"><span class="spotlight-role">${c.id==='zombie'?'Directed by':'Starring'}</span><h2 id="spotlight-${esc(c.id)}-heading">${esc(c.name)}</h2><p>${esc(c.description)}</p><span class="spotlight-count">${entries.length} films</span></div></div>${rail(entries.map(i=>card(i,true)).join(''),c.name+' films','media-row editorial-row')}</section>`}).join('');
}
