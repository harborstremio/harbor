import assert from 'node:assert/strict';
import test from 'node:test';
import { filterRivalsHeroes, parseRivalsOfficial, parseRivalsPairs, parseRivalsStats, rivalsGuideUrl, rivalsImage, rivalsMatchups, rivalsRoster, type RivalsOfficialHero } from '../src/lib/games/rivals-data.ts';
const now=Date.UTC(2026,8,30),meta={generated_at:new Date(now).toISOString(),season:20,min_matches:200};
const stat=(id=1011,name='Hulk',slug='hulk')=>({hero_id:id,name,short_name:slug,matches:1000,wins:550,winrate:.55,pick_rate:.1});
const stats=(heroes=[stat()],change={})=>parseRivalsStats({...meta,total_matches:10000,heroes,...change},now);
const official=(name='HULK',id='9471f35c-3f81-4ae2-9726-b2944dd431e9'):RivalsOfficialHero=>({id,name,roles:['vanguard'],portrait:'https://www.marvelrivals.com/d10.png',thumbnail:'https://www.marvelrivals.com/head.png',url:'https://www.marvelrivals.com/heroes/index.html?id='+id});
const html=(name='HULK',role='VANGUARD',src='https://www.marvelrivals.com/d10.png')=>`<div class="heroNewsList"><a data-id="9471f35c-3f81-4ae2-9726-b2944dd431e9" title="BRUCE BANNER" data-name="${name}" data-tag="${role}"><img src='${src}'><img src='${src}'><img src='${src}'></a></div>`;
test('Statistics validate timestamp, counts and rates without turning missing figures into zero',()=>{
 assert.equal(stats().rows[0].winRate,.55);
 for(const change of [{total_matches:-1},{generated_at:new Date(now+6*60_000).toISOString()},{generated_at:'invalid'},{heroes:[{...stat(),wins:1100}]},{heroes:[{...stat(),winrate:.8}]},{heroes:[{...stat(),pick_rate:2}]},{heroes:[{...stat(),matches:'1000'}]}])assert.throws(()=>stats(undefined,change));
 assert.equal(stats([{...stat(),matches:100,wins:55}]).rows.length,0);
 const d=stats([stat(),{...stat(1020,'Mantis','mantis'),wins:-1}]);assert.equal(d.partial,true);assert.equal(d.rows.length,1);
 assert.throws(()=>stats([stat(),stat()]));
});
test('Official records use hero identity rather than civilian title, and never execute remote markup',()=>{
 const d=parseRivalsOfficial(html());assert.equal(d[0].name,'HULK');assert.equal(d[0].roles[0],'vanguard');assert.match(d[0].url,/heroes\/index\.html\?id=9471/);
 assert.throws(()=>parseRivalsOfficial(html()+html()));assert.throws(()=>parseRivalsOfficial('<script>alert(1)</script>'));assert.throws(()=>parseRivalsOfficial(html('HULK','VANGUARD','https://evil.example/a.png')));
 for(const url of ['javascript:alert(1)','file:///private.png','https://www.marvelrivals.com.evil.test/a.png','https://user:password@www.marvelrivals.com/a.png','https://www.marvelrivals.com:444/a.png','http://www.marvelrivals.com/a.png'])assert.equal(rivalsImage(url),'');
});
test('Each Deadpool role keeps its own statistics; missing roles and new heroes stay visible without invented figures',()=>{
 const ref={...official('DEADPOOL'),roles:['vanguard','duelist','strategist'] as RivalsOfficialHero['roles']};
 const data=stats([stat(10571,'Deadpool (Vanguard)','deadpool-vanguard'),stat(10572,'Deadpool (Duelist)','deadpool-duelist')]);
 const roster=rivalsRoster([ref,official('Gorr the God Butcher','3cd78727-99d9-41a9-ab1c-0dc5e80451c0')],data);
 assert.equal(roster.length,4);assert.equal(new Set(roster.map(h=>h.key)).size,4);assert.equal(roster.find(h=>h.role==='strategist')?.stat,undefined);assert.equal(roster.find(h=>h.name==='Gorr the God Butcher')?.stat,undefined);
 assert.equal(roster.find(h=>h.stat?.id===10572)?.role,'duelist');assert.equal(roster.find(h=>h.stat?.id===10571)?.role,'vanguard');
});
test('Ability references retain exact official identity and only accept publisher article URLs',()=>{
 const url='https://www.marvelrivals.com/20241123/41360_1195678.html';
 assert.equal(rivalsGuideUrl(url),url);
 for(const invalid of ['http://www.marvelrivals.com/20241123/41360_1195678.html',url+'?redirect=1',url+'#content',url.replace('www.marvelrivals.com','www.marvelrivals.com.evil.example'),url.replace('https://','https://user:secret@'),url.replace('.com/','.com:444/'),'https://www.marvelrivals.com/heroes/index.html','file:///20241123/41360_1195678.html'])assert.equal(rivalsGuideUrl(invalid),'');
 const roster=parseRivalsOfficial(html().replace('<a ','<a data-url="'+url+'" '));
 assert.deepEqual(rivalsRoster(roster,stats())[0].guide,{name:'HULK',url});
 assert.deepEqual(rivalsRoster(roster,null)[0].guide,{name:'HULK',url});
 assert.equal(rivalsRoster([official('Hulkling')],stats()).find(h=>h.stat)?.guide,undefined);
 assert.equal(parseRivalsOfficial(html().replace('<a ','<a data-url="https://evil.example/guide.html" '))[0].guideUrl,undefined);
});
test('Only exact normalized hero identities join; search, role and sort operate on actual rows',()=>{
 const roster=rivalsRoster([official(),{...official('MANTIS','12345678-1234-1234-1234-123456789000'),roles:['strategist']}],stats([stat(),{...stat(1020,'Mantis','mantis'),matches:2000,wins:1000,winrate:.5}]));
 assert.equal(filterRivalsHeroes(roster,'','all','matches')[0].name,'Mantis');assert.equal(filterRivalsHeroes(roster,'','all','winRate')[0].name,'Hulk');assert.equal(filterRivalsHeroes(roster,'mant','vanguard','name').length,0);assert.equal(filterRivalsHeroes(roster,'HULK','vanguard','name').length,1);
 const wrong=rivalsRoster([official('Hulkling')],stats());assert.equal(wrong.find(h=>h.stat)?.portrait,'');assert.equal(wrong.length,2);
});
test('Matchups show the selected hero’s rate; hardest sorts ascending and teammates sort descending',()=>{
 const data=stats([stat(),stat(1020,'Mantis','mantis'),stat(1024,'Hela','hela')]),roster=rivalsRoster([],data);
 const pairs=parseRivalsPairs({...meta,min_matches:100,heroes:[{hero_id:1011,vs:[{opponent_id:1020,matches:300,winrate:.6},{opponent_id:1024,matches:600,winrate:.4}],vs_more:[]}]},now);
 const harder=rivalsMatchups(roster[0],roster,pairs,data,'hardest');assert.equal(harder[0].hero.name,'Hela');assert.equal(harder[0].winRate,.4);assert.equal(harder[0].matches,600);
 assert.equal(rivalsMatchups(roster[0],roster,pairs,data,'with')[0].hero.name,'Mantis');assert.equal(rivalsMatchups(roster[0],roster,{...pairs,season:19},data,'hardest').length,0);
});
test('Thin or malformed pairs are not recommendations; duplicate identities and oversized snapshots fail',()=>{
 const row={hero_id:1011,vs:[{opponent_id:1020,matches:99,winrate:.9},{opponent_id:1011,matches:500,winrate:.9},{opponent_id:1024,matches:500,winrate:NaN}],vs_more:[]};
 const d=parseRivalsPairs({...meta,min_matches:100,heroes:[row]},now);assert.equal(d.rows[0].pairs.length,0);assert.equal(d.partial,true);
 assert.throws(()=>parseRivalsPairs({...meta,heroes:[row,row]},now));
 assert.throws(()=>parseRivalsPairs({...meta,heroes:[{...row,vs:[{opponent_id:1020,matches:500,winrate:.5},{opponent_id:1020,matches:500,winrate:.5}]}]},now));
 assert.throws(()=>parseRivalsPairs({...meta,heroes:Array(301).fill(row)},now));
});
